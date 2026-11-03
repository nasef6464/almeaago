ALTER TABLE commerce_entitlements
  DROP CONSTRAINT IF EXISTS commerce_entitlements_source_type_check,
  ADD CONSTRAINT commerce_entitlements_source_type_check
    CHECK (source_type IN (
      'admin_manual',
      'payment_request',
      'payment_webhook',
      'access_code',
      'membership',
      'school_contract'
    ));
