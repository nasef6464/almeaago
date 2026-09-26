BEGIN;

DROP INDEX IF EXISTS commerce_payment_requests_provider_session_idx;

ALTER TABLE commerce_payment_requests
  DROP CONSTRAINT IF EXISTS commerce_payment_provider_session_shape,
  DROP COLUMN IF EXISTS provider_session_status,
  DROP COLUMN IF EXISTS provider_redirect_url,
  DROP COLUMN IF EXISTS provider_session_id;

ALTER TABLE commerce_payment_requests
  DROP CONSTRAINT IF EXISTS commerce_payment_requests_gateway_mode_check;

ALTER TABLE commerce_payment_requests
  ADD CONSTRAINT commerce_payment_requests_gateway_mode_check
    CHECK (gateway_mode IN ('manual_review','webhook'));

COMMIT;
