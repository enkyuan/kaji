# Active work

Goal: Prove Kaji's execution invariants under failure, concurrency, cancellation, timeout, replay, and ambiguity.
Reference: docs/invariants.md, docs/api.md
Owner: verification
State: DONE
Started: 2026-09-15
Exit condition: every failure/duplicate/cancellation/timeout/settlement state in the frozen contract has a deterministic test asserting execute-call-count; production code is unchanged; all package checks pass; 20 repeated test runs show zero flakiness.
