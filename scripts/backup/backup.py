#!/usr/bin/env python3
"""Private encrypted snapshots. Never print database output, paths or credentials."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from urllib.parse import quote, urlparse, unquote
from urllib.request import Request, urlopen

SCHEMAS = ('public', 'private', 'supabase_migrations')
TAG = 'lessonara-production'
HOST = 'lessonara-backup'


def validate_restore_target(dsn, acknowledgement):
    target = urlparse(dsn)
    if (target.scheme not in ('postgres', 'postgresql') or target.hostname not in ('127.0.0.1','localhost')
            or not unquote(target.path).startswith('/lessonara_restore') or target.query or target.fragment
            or acknowledgement != 'I_CREATED_THIS_EMPTY_LOCAL_DATABASE'):
        raise ValueError('Restore drills require an explicitly acknowledged, disposable loopback database')
    return target


def write_json(path, value):
    path.write_text(json.dumps(value, sort_keys=True, default=str))
    path.chmod(0o600)


def digest(path):
    with path.open('rb') as stream:
        value = hashlib.sha256()
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            value.update(chunk)
        return value.hexdigest()


def run(args, **kwargs):
    # Raw subprocess output can contain database contents or object names.
    result = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, **kwargs)
    if result.returncode:
        diagnostic = os.environ.get('BACKUP_PRIVATE_DIAGNOSTIC_PATH')
        if diagnostic:
            Path(diagnostic).write_bytes(result.stderr)
            Path(diagnostic).chmod(0o600)
        raise RuntimeError('Backup tool failed; sensitive output was suppressed.')
    return result.stdout


def restic(*args):
    return run(['restic', '--quiet', *args])


def request(path, body=None):
    base = os.environ['SUPABASE_URL']
    parsed = urlparse(base)
    if parsed.scheme != 'https' or not parsed.hostname.endswith('.supabase.co'):
        raise ValueError('Invalid source endpoint')
    req = Request(base + path, data=None if body is None else json.dumps(body).encode(), headers={
        'apikey': os.environ['SUPABASE_SECRET_KEY'],
        'Content-Type': 'application/json',
    })
    with urlopen(req, timeout=120) as response:
        return response.read()


def rpc(name, data):
    raw = request('/rest/v1/rpc/' + name, data)
    return json.loads(raw) if raw else None


def storage_path(root, bucket, name):
    # Hash names: object keys may contain ../, separators or personal information.
    key = hashlib.sha256((bucket + '\0' + name).encode()).hexdigest()
    return root / 'storage' / key


def fetch_object(bucket, name, target):
    path = '/storage/v1/object/authenticated/' + quote(bucket, safe='') + '/' + quote(name, safe='/')
    temporary = target.with_suffix('.partial')
    try:
        payload = request(path)
        temporary.write_bytes(payload)
        temporary.chmod(0o600)
        temporary.replace(target)
    finally:
        temporary.unlink(missing_ok=True)


def sync_storage(root, objects, previous):
    (root / 'storage').mkdir(mode=0o700, exist_ok=True)
    prior = {(row['bucket'], row['name']): row for row in previous}
    output = []
    changed = 0
    for row in objects:
        version = str(row['updated_at'])
        old = prior.get((row['bucket_id'], row['name']))
        target = storage_path(root, row['bucket_id'], row['name'])
        if not (old and old['version'] == version and target.is_file() and digest(target) == old['sha256']):
            fetch_object(row['bucket_id'], row['name'], target)
            changed += 1
        actual_size = target.stat().st_size
        expected_size = (row.get('metadata') or {}).get('size')
        if expected_size is not None and actual_size != int(expected_size):
            raise ValueError('Storage file size changed during export')
        output.append({'bucket': row['bucket_id'], 'name': row['name'], 'version': version,
                       'bytes': actual_size, 'sha256': digest(target), 'file': target.name})
    keep = {row['file'] for row in output}
    for target in (root / 'storage').iterdir():
        if target.name not in keep:
            target.unlink()
    return output, changed


def snapshots():
    return json.loads(restic('snapshots', '--json', '--tag', TAG + ',verified', '--host', HOST))


def capture(root):
    import psycopg
    from psycopg import sql
    # Source credentials use PG* environment variables, never command arguments.
    with psycopg.connect('') as connection:
        connection.execute('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
        snapshot = connection.execute('SELECT pg_export_snapshot()').fetchone()[0]
        version = connection.execute('SHOW server_version').fetchone()[0]
        available = {r[0] for r in connection.execute('SELECT nspname FROM pg_namespace')}
        selected = [s for s in SCHEMAS if s in available]
        table_rows = connection.execute("""SELECT schemaname, tablename FROM pg_tables
          WHERE schemaname = ANY(%s) ORDER BY 1,2""", (selected,)).fetchall()
        auth_records = connection.execute('SELECT private.backup_auth_records()').fetchone()[0]
        counts = {'auth.' + row['table']: len(row['rows']) for row in auth_records}
        write_json(root / 'auth.json', auth_records)
        for schema, table in table_rows:
            counts[schema + '.' + table] = connection.execute(
                sql.SQL('SELECT count(*) FROM {}.{}').format(sql.Identifier(schema), sql.Identifier(table))
            ).fetchone()[0]
        for table in ('buckets', 'objects'):
            counts['storage.' + table] = connection.execute(sql.SQL('SELECT count(*) FROM storage.{}').format(sql.Identifier(table))).fetchone()[0]
        objects = connection.execute('SELECT bucket_id,name,updated_at,metadata FROM storage.objects ORDER BY bucket_id,name').fetchall()
        objects = [dict(zip(('bucket_id', 'name', 'updated_at', 'metadata'), row)) for row in objects]
        # Rebuild explicitly inventoried Vault entries from encrypted recovery
        # configuration. The database reader never decrypts Vault.
        vault = json.loads(os.environ['BACKUP_VAULT_ENTRIES']) if os.environ.get('BACKUP_VAULT_ENTRIES') else json.loads((root / 'vault.json').read_text())
        extensions = connection.execute("SELECT extname,nspname,extversion FROM pg_extension JOIN pg_namespace ON extnamespace=pg_namespace.oid WHERE extname <> 'plpgsql' ORDER BY extname").fetchall()
        role_rows = connection.execute("SELECT rolname,rolcanlogin FROM pg_roles WHERE rolname NOT LIKE 'pg_%%' ORDER BY rolname").fetchall()
        run(['pg_dump', '--format=custom', '--no-owner', '--no-large-objects', '--snapshot=' + snapshot,
             *['--schema=' + s for s in selected], '--file=' + str(root / 'database.dump')])
        run(['pg_dump', '--format=custom', '--data-only', '--no-owner', '--no-large-objects', '--snapshot=' + snapshot, '--table=storage.buckets', '--table=storage.objects', '--file=' + str(root / 'storage-metadata.dump')])
        hooks = connection.execute("SELECT pg_get_triggerdef(t.oid) || ';' FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace cn ON cn.oid=c.relnamespace WHERE NOT t.tgisinternal AND n.nspname IN ('public','private') AND cn.nspname IN ('auth','storage')").fetchall()
        policies = connection.execute("SELECT schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname='storage'").fetchall()
        hook_sql = [r[0] for r in hooks]
        for schema, table, name, permissive, roles, cmd, qual, check in policies:
            identifiers = ['PUBLIC' if role == 'public' else sql.Identifier(role).as_string(connection) for role in roles]
            statement = sql.SQL('CREATE POLICY {} ON {}.{} AS {} FOR {} TO ').format(sql.Identifier(name), sql.Identifier(schema), sql.Identifier(table), sql.SQL(permissive), sql.SQL(cmd)).as_string(connection) + ','.join(identifiers)
            if qual: statement += ' USING (' + qual + ')'
            if check: statement += ' WITH CHECK (' + check + ')'
            hook_sql.append(statement + ';')
        (root / 'platform-hooks.sql').write_text('\n'.join(hook_sql))
        write_json(root / 'vault.json', vault)
        write_json(root / 'platform.json', {'extensions': extensions, 'roles': role_rows})
        connection.rollback()
    old_manifest = root / 'manifest.json'
    previous = json.loads(old_manifest.read_text()).get('objects', []) if old_manifest.is_file() else []
    files, changed = sync_storage(root, objects, previous)
    # Check the source object list again: never publish a snapshot with a missing
    # or changed object. Database writes continue; there is no global DB/S3 transaction.
    with psycopg.connect('') as connection:
        current = connection.execute('SELECT bucket_id,name,updated_at FROM storage.objects ORDER BY bucket_id,name').fetchall()
    if [(r['bucket_id'], r['name'], str(r['updated_at'])) for r in objects] != [(r[0], r[1], str(r[2])) for r in current]:
        raise ValueError('Storage changed during backup; retry at the next run')
    recovery = json.loads(os.environ['BACKUP_RECOVERY_ENV']) if os.environ.get('BACKUP_RECOVERY_ENV') else json.loads((root / 'recovery-env.json').read_text())
    required = {'EMAIL_ENCRYPTION_KEY', 'CRON_SECRET'}
    if not required <= recovery.keys():
        raise ValueError('Missing recovery keys')
    write_json(root / 'recovery-env.json', recovery)
    write_json(root / 'manifest.json', {'format': 1, 'capturedAt': datetime.now(timezone.utc).isoformat(),
        'postgres': version, 'tables': counts, 'objects': files, 'databaseSha256': digest(root / 'database.dump'),
        'sidecarHashes': {name: digest(root / name) for name in ('auth.json','vault.json','platform.json','recovery-env.json','storage-metadata.dump','platform-hooks.sql')}})
    return {'tables': len(counts), 'rows': sum(counts.values()), 'files': len(files),
            'downloadedFiles': changed, 'storageBytes': sum(r['bytes'] for r in files)}


def verify_tree(root):
    manifest = json.loads((root / 'manifest.json').read_text())
    if digest(root / 'database.dump') != manifest['databaseSha256']:
        raise ValueError('Database checksum mismatch')
    for name, expected in manifest.get('sidecarHashes', {}).items():
        if digest(root / name) != expected:
            raise ValueError('Recovery configuration checksum mismatch')
    platform = json.loads((root / 'platform.json').read_text())
    if not all(isinstance(row, list) and len(row) == 2 and isinstance(row[0], str) and isinstance(row[1], bool) for row in platform['roles']):
        raise ValueError('Invalid recovery role inventory')
    for row in manifest['objects']:
        target = root / 'storage' / row['file']
        if target.stat().st_size != row['bytes'] or digest(target) != row['sha256']:
            raise ValueError('Storage checksum mismatch')
    return manifest


def backup():
    run_id = rpc('start_job_run', {'p_job': 'backup'})
    if not run_id:
        raise RuntimeError('Another backup is running')
    try:
        with tempfile.TemporaryDirectory(prefix='lessonara-backup-') as staging:
            work = Path(staging)
            previous = snapshots()
            if previous:
                restic('restore', 'latest', '--tag', TAG + ',verified', '--host', HOST, '--target', str(work))
            root = work / 'snapshot'
            root.mkdir(mode=0o700, exist_ok=True)
            metrics = capture(root)
            verify_tree(root)
            run(
                ['restic', '--quiet', 'backup', 'snapshot', '--host', HOST, '--tag', TAG, '--json'], cwd=work)
            # Read the newly uploaded snapshot back before declaring success or pruning.
            restored = work / 'verified'
            restic('restore', 'latest', '--tag', TAG, '--host', HOST, '--target', str(restored))
            verify_tree(restored / 'snapshot')
            restic('tag', '--add', 'verified', '--tag', TAG, '--host', HOST, 'latest')
            restic('forget', '--tag', TAG + ',verified', '--host', HOST, '--group-by', 'host,tags', '--keep-last', '14', '--prune')
        rpc('finish_job_run', {'p_id': run_id, 'p_status': 'succeeded', 'p_metrics': metrics})
        print('Encrypted backup uploaded and read-back verified. Retention: 14 snapshots.')
    except Exception:
        try:
            rpc('finish_job_run', {'p_id': run_id, 'p_status': 'failed', 'p_metrics': {}})
        except Exception:
            pass
        raise RuntimeError('Backup failed; no success was recorded. Check configuration and retry.') from None


def health():
    copies = snapshots()
    latest = max((datetime.fromisoformat(s['time'].replace('Z', '+00:00')) for s in copies), default=None)
    if latest is None or (datetime.now(timezone.utc) - latest).total_seconds() > 30 * 3600:
        raise RuntimeError('No encrypted backup in the last 30 hours')
    print('Recent encrypted backup found.')


if __name__ == '__main__':
    os.umask(0o077)
    try:
        {'backup': backup, 'health': health}[sys.argv[1]]()
    except Exception:
        print('Backup operation failed. Sensitive diagnostics are suppressed.', file=sys.stderr)
        sys.exit(1)
