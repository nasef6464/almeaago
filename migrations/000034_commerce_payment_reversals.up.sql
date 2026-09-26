BEGIN;

ALTER TABLE commerce_payment_requests
  DROP CONSTRAINT IF EXISTS commerce_payment_requests_status_check,
  DROP CONSTRAINT IF EXISTS commerce_payment_paid_shape,
  DROP CONSTRAINT IF EXISTS commerce_payment_provider_session_shape;

ALTER TABLE commerce_payment_requests
  ADD CONSTRAINT commerce_payment_requests_status_check
    CHECK (status IN ('pending','paid','rejected','cancelled','failed','refunded','chargeback')),
  ADD CONSTRAINT commerce_payment_paid_shape CHECK (
    (status IN ('paid','refunded','chargeback') AND paid_at IS NOT NULL)
    OR
    (status NOT IN ('paid','refunded','chargeback') AND paid_at IS NULL)
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
      (status IN ('paid','cancelled','rejected','refunded','chargeback') AND provider_session_status='initiated' AND btrim(provider_session_id)<>'')
    ))
  );

DROP INDEX IF EXISTS commerce_payment_requests_provider_session_idx;
CREATE UNIQUE INDEX commerce_payment_requests_provider_session_idx
  ON commerce_payment_requests(provider_code,provider_session_id)
  WHERE provider_session_id <> '';

ALTER TABLE commerce_provider_events
  DROP CONSTRAINT IF EXISTS commerce_provider_events_event_status_check;

ALTER TABLE commerce_provider_events
  ADD CONSTRAINT commerce_provider_events_event_status_check
    CHECK (event_status IN ('paid','failed','cancelled','refunded','chargeback'));

CREATE TABLE commerce_payment_reversals (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  payment_request_id uuid NOT NULL UNIQUE REFERENCES commerce_payment_requests(id) ON DELETE RESTRICT,
  reversal_type text NOT NULL CHECK (reversal_type IN ('refund','chargeback')),
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  provider_code text NOT NULL CHECK (btrim(provider_code) <> ''),
  provider_reference text NOT NULL CHECK (btrim(provider_reference) <> ''),
  source text NOT NULL CHECK (source IN ('provider_webhook','admin_evidence')),
  evidence text NOT NULL DEFAULT '',
  payload_sha256 text NOT NULL DEFAULT ''
    CHECK (payload_sha256='' OR payload_sha256 ~ '^[0-9a-f]{64}$'),
  recorded_by uuid REFERENCES users(id) ON DELETE SET NULL,
  occurred_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commerce_payment_reversal_source_shape CHECK (
    (source='provider_webhook' AND payload_sha256 ~ '^[0-9a-f]{64}$')
    OR
    (source='admin_evidence' AND recorded_by IS NOT NULL AND btrim(evidence) <> '')
  )
);

CREATE UNIQUE INDEX commerce_payment_reversals_provider_ref_idx
  ON commerce_payment_reversals(provider_code,provider_reference);

CREATE INDEX commerce_payment_reversals_created_idx
  ON commerce_payment_reversals(reversal_type,created_at DESC,id DESC);

ALTER TABLE commerce_revenue_entries
  ADD COLUMN reversal_type text NOT NULL DEFAULT ''
    CHECK (reversal_type IN ('','refund','chargeback')),
  ADD COLUMN reversed_amount_minor bigint
    CHECK (reversed_amount_minor IS NULL OR reversed_amount_minor > 0),
  ADD COLUMN reversal_reference text NOT NULL DEFAULT '',
  ADD COLUMN reversed_at timestamptz;

ALTER TABLE commerce_revenue_entries
  ADD CONSTRAINT commerce_revenue_reversal_shape CHECK (
    (reversal_type='' AND reversed_amount_minor IS NULL AND reversal_reference='' AND reversed_at IS NULL)
    OR
    (reversal_type IN ('refund','chargeback')
      AND reversed_amount_minor=paid_amount_minor
      AND btrim(reversal_reference)<>''
      AND reversed_at IS NOT NULL)
  );

COMMIT;
