import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from datetime import datetime, timezone, timedelta

spec = importlib.util.spec_from_file_location('backup', Path(__file__).with_name('backup.py'))
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)

class BackupTests(unittest.TestCase):
    def test_object_keys_cannot_escape_staging(self):
        root = Path('/safe/staging')
        target = backup.storage_path(root, '../../private', '/../../credentials')
        self.assertEqual(target.parent, root / 'storage')
        self.assertEqual(len(target.name), 64)

    def test_unchanged_objects_are_reused_but_corruption_forces_download(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            row = {'bucket_id':'materials','name':'one.pdf','updated_at':'v1','metadata':{'size':3}}
            def fetch(bucket, name, target): target.write_bytes(b'pdf')
            with patch.object(backup, 'fetch_object', side_effect=fetch) as fetcher:
                files, changed = backup.sync_storage(root, [row], [])
                self.assertEqual(changed, 1)
                backup.sync_storage(root, [row], files)
                self.assertEqual(fetcher.call_count, 1)
                backup.storage_path(root, 'materials', 'one.pdf').write_bytes(b'bad')
                backup.sync_storage(root, [row], files)
                self.assertEqual(fetcher.call_count, 2)

    def test_deleted_objects_are_removed_only_from_new_staging(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'storage').mkdir()
            (root / 'storage' / 'old').write_bytes(b'old')
            self.assertEqual(backup.sync_storage(root, [], []), ([], 0))
            self.assertEqual(list((root / 'storage').iterdir()), [])

    def test_size_change_fails_snapshot(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(backup, 'fetch_object', side_effect=lambda b,n,p:p.write_bytes(b'x')):
                with self.assertRaises(ValueError):
                    backup.sync_storage(Path(directory), [{'bucket_id':'b','name':'o','updated_at':'v','metadata':{'size':4}}], [])

    def test_corrupt_database_is_not_verified(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root/'database.dump').write_bytes(b'changed')
            (root/'manifest.json').write_text(json.dumps({'databaseSha256':'wrong','objects':[]}))
            with self.assertRaises(ValueError): backup.verify_tree(root)

    def test_failed_export_never_prunes_or_records_success(self):
        with patch.object(backup,'rpc',return_value='run') as rpc, patch.object(backup,'snapshots',return_value=[]), patch.object(backup,'capture',side_effect=RuntimeError('sensitive')), patch.object(backup,'restic') as restic:
            with self.assertRaisesRegex(RuntimeError, 'Backup failed'): backup.backup()
            restic.assert_not_called()
            self.assertEqual(rpc.call_args.args[1]['p_status'], 'failed')

    def test_readback_failure_never_prunes_or_records_success(self):
        def capture(root): return {'files':0}
        with patch.object(backup,'rpc',return_value='run') as rpc, patch.object(backup,'snapshots',return_value=[]), patch.object(backup,'capture',side_effect=capture), patch.object(backup,'verify_tree',side_effect=[{},ValueError('corruption')]), patch.object(backup,'run'), patch.object(backup,'restic') as restic:
            with self.assertRaises(RuntimeError): backup.backup()
            self.assertFalse(any('forget' in c.args for c in restic.call_args_list))
            self.assertEqual(rpc.call_args.args[1]['p_status'], 'failed')

    def test_health_rejects_missing_and_stale_snapshots(self):
        for rows in [[], [{'time':(datetime.now(timezone.utc)-timedelta(hours=31)).isoformat()}]]:
            with patch.object(backup,'snapshots',return_value=rows):
                with self.assertRaises(RuntimeError): backup.health()

    def test_logs_do_not_include_subprocess_credentials_or_data(self):
        import subprocess
        with patch.object(backup.subprocess,'run',return_value=subprocess.CompletedProcess([],1,b'secret',b'password')):
            with self.assertRaises(RuntimeError) as error: backup.run(['tool'])
            self.assertNotIn('password', str(error.exception))
            self.assertNotIn('secret', str(error.exception))

    def test_restore_refuses_remote_targets_and_libpq_host_override(self):
        ack='I_CREATED_THIS_EMPTY_LOCAL_DATABASE'
        for dsn in ['postgresql://production/lessonara_restore','postgresql://127.0.0.1/postgres','postgresql://127.0.0.1/lessonara_restore?host=production','postgresql://127.0.0.1/lessonara_restore#fragment']:
            with self.assertRaises(ValueError): backup.validate_restore_target(dsn,ack)
        with self.assertRaises(ValueError): backup.validate_restore_target('postgresql://127.0.0.1/lessonara_restore','')
        self.assertEqual(backup.validate_restore_target('postgresql://127.0.0.1:55498/lessonara_restore',ack).hostname,'127.0.0.1')

    def test_invalid_role_inventory_is_rejected_before_retention(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            (root/'database.dump').write_bytes(b'dump')
            (root/'platform.json').write_text(json.dumps({'roles':['authenticated']}))
            (root/'manifest.json').write_text(json.dumps({'databaseSha256':backup.digest(root/'database.dump'),'objects':[]}))
            with self.assertRaisesRegex(ValueError,'role inventory'): backup.verify_tree(root)

    def test_void_rpc_response_is_a_success(self):
        with patch.object(backup,'request',return_value=b''):
            self.assertIsNone(backup.rpc('finish_job_run',{}))

if __name__ == '__main__': unittest.main()
