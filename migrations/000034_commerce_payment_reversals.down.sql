BEGIN;

ALTER TABLE commerce_revenue_entries
  DROP CONSTRAINT IF EXISTS commerce_revenue_reversal_shape,
  DROP COLUMN IF EXISTS reversed_at,
  DROP COLUMN IF EXISTS reversal_reference,
  DROP COLUMN IF EXISTS reversed_amount_minor,
  DROP COLUMN IF EXISTS reversal_type;

DROP TABLE IF EXISTS commerce_payment_reversals;

DROP INDEX IF EXISTS commerce_payment_requests_provider_session_idx;
CREATE INDEX commerce_payment_requests_provider_session_idx
  ON commerce_payment_requests(provider_code,provider_session_id)
  WHERE provider_session_id <> '';

ALTER TABLE commerce_provider_events
  DROP CONSTRAINT IF EXISTS commerce_provider_events_event_status_check;

ALTER TABLE commerce_provider_events
  ADD CONSTRAINT commerce_provider_events_event_status_check
    CHECK (event_status IN ('paid','failed','cancelled'));

ALTER TABLE commerce_payment_requests
  DROP CONSTRAINT IF EXISTS commerce_payment_provider_session_shape,
  DROP CONSTRAINT IF EXISTS commerce_payment_paid_shape,
  DROP CONSTRAINT IF EXISTS commerce_payment_requests_status_check;

ALTER TABLE commerce_payment_requests
  ADD CONSTRAINT commerce_payment_requests_status_check
    CHECK (status IN ('pending','paid','rejected','cancelled','failed')),
  ADD CONSTRAINT commerce_payment_paid_shape CHECK (
    (status='paid' AND paid_at IS NOT NULL)
    OR
    (status<>'paid' AND paid_at IS NULL)
  ),
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
      (status='failed' AND provider_session_status='initiated' AND btrim(provider_session_id)<>'')
      OR
      (status IN ('paid','cancelled','rejected') AND provider_session_status='initiated' AND btrim(provider_session_id)<>'')
    ))
  );

COMMIT;
