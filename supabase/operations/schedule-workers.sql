-- Apply after deploying the batched routes. Create lessonara_cron_secret in Vault first.
-- This file contains only the Vault reference; never paste the secret into SQL Editor.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
select cron.schedule('lessonara-reminders', '*/5 * * * *', $worker$
  select net.http_get(
    url := 'https://lessonara.mosaic-labs.co/api/cron/reminders',
    headers := jsonb_build_object('Authorization', 'Bearer ' ||
      (select decrypted_secret from vault.decrypted_secrets where name = 'lessonara_cron_secret')),
    timeout_milliseconds := 30000
  );
$worker$);
select cron.schedule('lessonara-emails', '2-59/5 * * * *', $worker$
  select net.http_get(
    url := 'https://lessonara.mosaic-labs.co/api/cron/emails',
    headers := jsonb_build_object('Authorization', 'Bearer ' ||
      (select decrypted_secret from vault.decrypted_secrets where name = 'lessonara_cron_secret')),
    timeout_milliseconds := 30000
  );
$worker$);
