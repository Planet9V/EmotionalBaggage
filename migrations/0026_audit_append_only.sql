-- Up Migration

-- The audit log is append-only. Until now that was only a convention (0005_audit_log.sql said "nothing in the app
-- updates or deletes these rows"); now the database refuses it. A row can be inserted and read, never changed or
-- removed, whoever asks (the app, a script, a person with psql). The only way past is a superuser switching
-- triggers off for a session, which leaves its own trace in the server log and is not available to the app's role.
-- A late "why" for an older line is therefore a new line (item.reason) that names the line it explains.
CREATE FUNCTION audit_log_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'TRUNCATE' THEN
    RAISE EXCEPTION 'audit_log is append-only: it cannot be truncated. Add new lines instead.' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RAISE EXCEPTION 'audit_log is append-only: a line cannot be % (line %). Add a new line instead.', lower(TG_OP), OLD.id
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$;

CREATE TRIGGER audit_log_append_only
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_refuse_change();

-- TRUNCATE skips row triggers, so it has its own.
CREATE TRIGGER audit_log_no_truncate
  BEFORE TRUNCATE ON audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION audit_log_refuse_change();

-- Down Migration
DROP TRIGGER audit_log_no_truncate ON audit_log;
DROP TRIGGER audit_log_append_only ON audit_log;
DROP FUNCTION audit_log_refuse_change();
