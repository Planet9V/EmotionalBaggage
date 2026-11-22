-- Up Migration
-- Review S4 of the admin area: a credential saved before secrets were bound to an address (bound_origin NULL) used to
-- be bound, on first use, to whatever address was current, and some of those addresses (the model hosts) may be
-- changed by any signed-in account. Such rows are bound now to the provider's own built-in address, which no account
-- can change. A Kokoro or mail password has no built-in address: it stays unbound and is not sent anywhere until it
-- is typed again in Admin (src/lib/secretOrigin.ts boundOrigin).
UPDATE credentials SET bound_origin = CASE provider
    WHEN 'ollama' THEN 'http://host.docker.internal:11434'
    WHEN 'lmstudio' THEN 'http://host.docker.internal:1234'
    WHEN 'openrouter' THEN 'https://openrouter.ai'
    WHEN 'perplexity' THEN 'https://api.perplexity.ai'
    WHEN 'amazon-sp' THEN 'https://api.amazon.com'
    WHEN 'x' THEN 'https://api.x.com'
    WHEN 'instagram' THEN 'https://graph.instagram.com'
    WHEN 'stripe' THEN 'https://api.stripe.com'
  END
WHERE bound_origin IS NULL AND provider IN ('ollama', 'lmstudio', 'openrouter', 'perplexity', 'amazon-sp', 'x', 'instagram', 'stripe');

-- Down Migration
-- Nothing to undo: an address once bound is kept.
SELECT 1;
