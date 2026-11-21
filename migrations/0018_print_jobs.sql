-- Up Migration
-- Plan 6.6: the print job statuses. A job moves queued, slicing, sliced, sent, printing, then done, failed or cancelled.
-- No table or column is added: a print job is an `items` row in prototype/printing, as before, and what the slicer and the
-- printer reported is kept in its `data`. Only the words change, so rows written with the earlier words are renamed here.
UPDATE items SET status = 'queued' WHERE section = 'prototype/printing' AND status IN ('waiting on file', 'ready');
UPDATE items SET status = 'done'   WHERE section = 'prototype/printing' AND status = 'printed';

-- Down Migration
-- The earlier words had less meaning (queued stood for two of them), so the way back is lossy by design.
UPDATE items SET status = 'waiting on file' WHERE section = 'prototype/printing' AND status IN ('queued', 'slicing', 'sliced');
UPDATE items SET status = 'printing' WHERE section = 'prototype/printing' AND status = 'sent';
UPDATE items SET status = 'printed' WHERE section = 'prototype/printing' AND status = 'done';
UPDATE items SET status = 'failed' WHERE section = 'prototype/printing' AND status = 'cancelled';
