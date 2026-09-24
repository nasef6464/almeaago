# ADR-0007: Versioned Password Hashing

Status: Accepted.

ALMEAA V2 stores password hashes in a versioned self-describing format so algorithms and cost parameters can migrate without resetting all accounts.

Initial implementation uses PBKDF2-HMAC-SHA256 from the Go standard library with per-password random salt and constant-time verification.

This is intentionally isolated behind `internal/platform/security`.

Before Production:
- benchmark login throughput on the real API instance class;
- confirm the cost does not create unacceptable CPU saturation at expected concurrency;
- preserve a migration path to a memory-hard scheme such as Argon2id if operational/security review selects it.

Public password rules remain legacy-compatible and are independent from the storage algorithm.
