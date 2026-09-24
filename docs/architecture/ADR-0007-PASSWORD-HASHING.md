# ADR-0007: Argon2id Versioned Password Hashing

Status: Accepted.

## Decision
ALMEAA V2 uses Argon2id for newly stored passwords.

The encoded hash is self-describing and stores:
- algorithm/version;
- memory cost;
- iteration count;
- parallelism;
- random salt;
- derived hash.

Initial baseline:
- memory: 19 MiB;
- iterations: 2;
- parallelism: 1;
- salt: 16 bytes;
- output: 32 bytes.

## Why
ALMEAA V2 is a greenfield rebuild without a FIPS requirement. A memory-hard password hashing function is preferred for new applications.

PBKDF2 is not selected merely to avoid one Go dependency. Security architecture has higher priority than dependency count.

## Operational rule
Before Production:
1. benchmark hash and verify latency on the actual API instance class;
2. load-test concurrent login bursts;
3. confirm memory/CPU headroom;
4. increase parameters when feasible, but never below the documented security baseline without an explicit ADR.

## Migration
The hash format is versioned and parameterized.
When parameters are raised, successful login can trigger a rehash path later without forcing all users to reset passwords.

## Secrets
Passwords are never logged or persisted in plaintext.
A future server-side pepper may be considered only with a proper secrets manager and rotation plan; it is not required for the initial secure design.
