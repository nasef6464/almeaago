BEGIN;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM commerce_payment_requests WHERE transfer_sender_name <> '' OR transfer_sender_bank <> '' OR transfer_reference <> '' OR transfer_receipt_url <> '') THEN
    RAISE EXCEPTION 'cannot remove saved transfer details';
  END IF;
END $$;
ALTER TABLE commerce_payment_requests
  DROP COLUMN transfer_receipt_url,
  DROP COLUMN transfer_reference,
  DROP COLUMN transfer_sender_bank,
  DROP COLUMN transfer_sender_name;
COMMIT;
