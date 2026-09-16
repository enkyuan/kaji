# Active work

Goal: Implement Kaji's single canonical safe execution path using the finalized Capability and ExecutionStore contracts.
Reference: docs/product.md, docs/invariants.md, docs/api.md
Owner: implementation
State: DONE
Started: 2026-09-15
Exit condition: createKaji()/kaji.execute() compose validation, idempotency claim, authorization, approval, capability execution, and settlement into one deterministic path; runtime/type/concurrency tests and full package checks pass.
