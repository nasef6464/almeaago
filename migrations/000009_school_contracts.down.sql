BEGIN;

DROP INDEX IF EXISTS school_contract_modules_module_contract_idx;
DROP INDEX IF EXISTS school_contracts_status_valid_until_idx;
DROP TABLE IF EXISTS school_contract_modules;
DROP TABLE IF EXISTS school_contracts;

COMMIT;
