-- Up Migration
-- The owner's ruling of 23 Nov (13:22, docs/TASKS.md): "change the email to Shipwright in admin and email". The
-- product is named Shipwright; a mail sender name saved while it was still shown as "Concept to Realization" is
-- that old default saved with the form, so it becomes "Shipwright". Any other sender name was chosen and stays.
UPDATE settings
   SET value = jsonb_set(value, '{fromName}', '"Shipwright"'::jsonb), updated_at = now()
 WHERE key = 'mail.smtp'
   AND jsonb_typeof(value) = 'object'
   AND value->>'fromName' IN ('Concept to Realization', 'Concept to realization');

-- Down Migration
-- Not reversed: the old name is no longer the product's name.
