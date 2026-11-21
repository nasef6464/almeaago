BEGIN;
ALTER TABLE commerce_payment_requests
  ADD COLUMN transfer_sender_name text NOT NULL DEFAULT '',
  ADD COLUMN transfer_sender_bank text NOT NULL DEFAULT '',
  ADD COLUMN transfer_reference text NOT NULL DEFAULT '',
  ADD COLUMN transfer_receipt_url text NOT NULL DEFAULT '';
COMMIT;
