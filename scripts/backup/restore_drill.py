#!/usr/bin/env python3
"""Restore drill for a disposable local Supabase database only. No remote targets."""
import json
import os
from pathlib import Path
import sys
from urllib.parse import urlparse, unquote
import psycopg
from psycopg import sql
from backup import verify_tree, run, validate_restore_target



def restore(root, dsn):
    target = validate_restore_target(dsn, os.environ.get('ISOLATED_RESTORE_ACK'))
    manifest = verify_tree(root)
    env = os.environ.copy() | {'PGHOST':target.hostname,'PGPORT':str(target.port or 5432),
        'PGDATABASE':unquote(target.path[1:]),'PGUSER':unquote(target.username or ''),
        'PGPASSWORD':unquote(target.password or ''),'PGSSLMODE':'disable'}
    with psycopg.connect(dsn, autocommit=True) as db:
        if db.execute("select to_regclass('public.teachers')").fetchone()[0] or db.execute('select count(*) from auth.users').fetchone()[0]:
            raise ValueError('The restore drill database is not empty')
        db.execute(sql.SQL('GRANT CREATE ON DATABASE {} TO postgres').format(sql.Identifier(unquote(target.path[1:]))))
        platform = json.loads((root/'platform.json').read_text())
        for name, login in platform['roles']:
            if not db.execute('select 1 from pg_roles where rolname=%s',(name,)).fetchone():
                db.execute(sql.SQL('CREATE ROLE {} NOLOGIN').format(sql.Identifier(name)))
        for name, schema, version in platform['extensions']:
            if name == 'pg_cron':
                continue  # Schedules are intentionally not enabled by a restore drill.
            db.execute(sql.SQL('CREATE SCHEMA IF NOT EXISTS {}').format(sql.Identifier(schema)))
            db.execute(sql.SQL('CREATE EXTENSION IF NOT EXISTS {} WITH SCHEMA {}').format(sql.Identifier(name),sql.Identifier(schema)))
        records = json.loads((root/'auth.json').read_text())
        db.execute('BEGIN')
        db.execute('SET LOCAL session_replication_role = replica')
        names = [sql.Identifier('auth',row['table']) for row in records]
        db.execute(sql.SQL('TRUNCATE {} CASCADE').format(sql.SQL(',').join(names)))
        for row in records:
            if not row['rows']: continue
            table = sql.Identifier('auth',row['table'])
            columns = sql.SQL(',').join(map(sql.Identifier,row['columns']))
            db.execute(sql.SQL('INSERT INTO {} ({}) SELECT {} FROM jsonb_populate_recordset(NULL::{},%s::jsonb)').format(table,columns,columns,table),(json.dumps(row['rows']),))
        db.execute('COMMIT')
    # Application policies, grants, constraints and functions remain in the archive.
    # Use the same non-superuser owner as the source for SECURITY DEFINER functions.
    toc = run(['pg_restore','--list',str(root/'database.dump')],env=env).decode()
    platform_acls = [line for line in toc.splitlines() if 'DEFAULT ACL' in line and 'supabase_admin' in line]
    filtered = '\n'.join(line for line in toc.splitlines() if ' SCHEMA - public ' not in line and ' COMMENT - SCHEMA public ' not in line and line not in platform_acls)
    restore_list = root / 'application.restore-list'
    restore_list.write_text(filtered + '\n')
    run(['pg_restore','--dbname=' + env['PGDATABASE'],'--no-owner','--role=postgres','--single-transaction','--exit-on-error','--use-list=' + str(restore_list),str(root/'database.dump')],env=env)
    if platform_acls:
        platform_list = root / 'platform-acls.restore-list'
        platform_list.write_text('\n'.join(platform_acls) + '\n')
        run(['pg_restore','--dbname=' + env['PGDATABASE'],'--no-owner','--single-transaction','--exit-on-error','--use-list=' + str(platform_list),str(root/'database.dump')],env=env)
    run(['pg_restore','--dbname=' + env['PGDATABASE'],'--no-owner','--exit-on-error',str(root/'storage-metadata.dump')],env=env)
    with psycopg.connect(dsn) as db:
        db.execute((root/'platform-hooks.sql').read_text())
        for entry in json.loads((root/'vault.json').read_text()):
            db.execute('select vault.create_secret(%s,%s,%s)',(entry['secret'],entry['name'],entry.get('description','')))
        db.commit()
        for table, expected in manifest['tables'].items():
            schema,name=table.split('.',1)
            actual=db.execute(sql.SQL('SELECT count(*) FROM {}.{}').format(sql.Identifier(schema),sql.Identifier(name))).fetchone()[0]
            if actual != expected: raise ValueError('Restored table count mismatch')
        for entry in json.loads((root/'vault.json').read_text()):
            actual=db.execute('select decrypted_secret from vault.decrypted_secrets where name=%s',(entry['name'],)).fetchone()[0]
            if actual != entry['secret']: raise ValueError('Restored Vault entry mismatch')
        # Source participation/history/payment tables are checked with all other rows.
        # Check file metadata against bytes independently of archive integrity.
        for row in manifest['objects']:
            if not db.execute('select 1 from storage.objects where bucket_id=%s and name=%s',(row['bucket'],row['name'])).fetchone():
                raise ValueError('Restored file metadata mismatch')
    result={'tables':len(manifest['tables']),'rows':sum(manifest['tables'].values()),
        'files':len(manifest['objects']),'vaultVerified':True,'networkIsolated':True}
    print(json.dumps(result))
    return result


if __name__ == '__main__':
    os.umask(0o077)
    try:
        restore(Path(sys.argv[1]),os.environ['RESTORE_TEST_DSN'])
    except Exception as error:
        diagnostic=os.environ.get('BACKUP_PRIVATE_DIAGNOSTIC_PATH')
        if diagnostic and not isinstance(error, RuntimeError):
            Path(diagnostic).write_text(str(error))
            Path(diagnostic).chmod(0o600)
        print('Isolated restore failed; sensitive diagnostics suppressed.',file=sys.stderr)
        sys.exit(1)
