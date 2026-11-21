-- Up Migration
-- Plan 3.2: a gate that is overridden records who did it, beside the reason (note) and the time
-- (decided_at) that migration 0003 already keeps. The same column records who passed a gate
-- by advancing the stage. Existing rows had no way to say, so they keep an empty name.
ALTER TABLE gates ADD COLUMN decided_by text NOT NULL DEFAULT '';

-- Down Migration
ALTER TABLE gates DROP COLUMN decided_by;
