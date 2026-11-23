-- Up Migration
-- The owner's answers of 23 Nov (10:52, docs/TASKS.md): "the 7 try lockout resets after 15 minutes, and this is
-- logged in the admin console, and an email alert is sent to jim@eigenia.nl". Workstream ws26-lock-alert: this
-- number may change at merge.

-- A new setting: where lock alerts go (src/lib/auth2/lockAlerts.ts; default jim@eigenia.nl in the code).
ALTER TABLE auth2_settings DROP CONSTRAINT IF EXISTS auth2_settings_key_check;
ALTER TABLE auth2_settings ADD CONSTRAINT auth2_settings_key_check CHECK (key IN (
  'auth2.enabled', 'auth2.baseUrl', 'auth2.trustedOrigins', 'auth2.platformAdminAddress',
  'invites.expiryDays', 'signIn.maxFailures', 'signIn.lockMinutes', 'password.policy', 'notify.signupRequestsTo', 'signUp.open',
  'impersonation.minutes', 'impersonation.notifyUser', 'notify.lockAlertsTo'
));

-- The lock now lasts 15 minutes by default (was 30). A stored 30 is the old default saved with the form, so it
-- becomes 15; any other value was chosen and stays.
UPDATE auth2_settings SET value = '15'::jsonb, updated_at = now(), updated_by = 'migration 0045' WHERE key = 'signIn.lockMinutes' AND value = '30'::jsonb;

-- Alerts sent, for the overall limit (20 an hour). No address, hash or network address is kept: only when, and
-- whether it was the "more locks are happening" notice. Owner-only (src/lib/auth2/dbRoles.ts, WITHHELD).
CREATE TABLE auth2_lock_alerts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sent_at timestamptz NOT NULL DEFAULT now(),
  overflow boolean NOT NULL DEFAULT false
);
CREATE INDEX auth2_lock_alerts_sent_idx ON auth2_lock_alerts (sent_at);

-- Down Migration
DROP TABLE IF EXISTS auth2_lock_alerts;
DELETE FROM auth2_settings WHERE key = 'notify.lockAlertsTo';
ALTER TABLE auth2_settings DROP CONSTRAINT IF EXISTS auth2_settings_key_check;
ALTER TABLE auth2_settings ADD CONSTRAINT auth2_settings_key_check CHECK (key IN (
  'auth2.enabled', 'auth2.baseUrl', 'auth2.trustedOrigins', 'auth2.platformAdminAddress',
  'invites.expiryDays', 'signIn.maxFailures', 'signIn.lockMinutes', 'password.policy', 'notify.signupRequestsTo', 'signUp.open',
  'impersonation.minutes', 'impersonation.notifyUser'
));
