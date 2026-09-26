BEGIN;

ALTER TABLE commerce_payment_requests
  DROP CONSTRAINT IF EXISTS commerce_payment_requests_gateway_mode_check;

ALTER TABLE commerce_payment_requests
  ADD CONSTRAINT commerce_payment_requests_gateway_mode_check
    CHECK (gateway_mode IN ('manual_review','webhook','payment_link'));

ALTER TABLE commerce_payment_requests
  ADD COLUMN provider_session_id text NOT NULL DEFAULT '',
  ADD COLUMN provider_redirect_url text NOT NULL DEFAULT '',
  ADD COLUMN provider_session_status text NOT NULL DEFAULT ''
    CHECK (provider_session_status IN ('','initiated','failed'));

ALTER TABLE commerce_payment_requests
  ADD CONSTRAINT commerce_payment_provider_session_shape CHECK (
    (gateway_mode <> 'payment_link' AND provider_session_id='' AND provider_redirect_url='' AND provider_session_status='')
    OR
    (gateway_mode='payment_link' AND (
      (status='pending' AND provider_session_status='initiated' AND btrim(provider_session_id)<>'' AND btrim(provider_redirect_url)<>'')
      OR
      (status='pending' AND provider_session_status='' AND provider_session_id='' AND provider_redirect_url='')
      OR
      (status='failed' AND provider_session_status='failed' AND provider_redirect_url='')
      OR
      (status IN ('paid','cancelled','rejected') AND provider_session_status='initiated' AND btrim(provider_session_id)<>'')
    ))
  );

CREATE INDEX commerce_payment_requests_provider_session_idx
  ON commerce_payment_requests(provider_code,provider_session_id)
  WHERE provider_session_id <> '';

COMMIT;
