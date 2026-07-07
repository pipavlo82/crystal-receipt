# Expected rejection semantics for invalid anchor-result fixtures

Derived from the reference implementation in `src/receiptos/anchor/sepolia-result.ts`.

| Fixture | Check locus | Expected rejection |
|---|---|---|
| malformed-contract-anchor-result | offline, format: `contractAddress` regex | Reject with `invalid contractAddress: <value>` because `contractAddress` must match `^0x[a-fA-F0-9]{40}$`. |
| malformed-txhash-anchor-result | offline, format: `txHash` regex | Reject with `invalid txHash: <value>` because `txHash` must match `^0x[a-fA-F0-9]{64}$`. |
| wrong-chainid-anchor-result | offline, `chainId` must be `11155111` | Reject with `invalid chainId: expected 11155111, got <value>`. |
| wrong-network-anchor-result | offline, `network` must be `"sepolia"` | Reject with `invalid network: expected "sepolia", got <value>`. |
| mismatched-root-anchor-result | offline equality: imported `receiptRoot` must equal capsule's `anchor.merkle_root`, which equals `receipt_root` in the one-leaf case; the reference never decodes on-chain logs — the fixture's `event` block is optional metadata, only `event.name` is checked | Reject with `imported receiptRoot does not match anchor.merkle_root: <imported> != <expected>`. |

A conforming gate reproduces these rejections deterministically; matching the rejection reason, not just the failure, is part of conformance. Live-chain checks (RPC resolution of tx/contract) exceed reference scope and should be labeled as such.

## Tri-state verdict mapping (co-signed: pipavlo82 · babyblueviper1)

External verification gates (e.g. the pre-post gate, row pre-post-gate-composed in docs/CONFORMANCE_INDEX.md) emit a three-value verdict: admit / reject / undetermined. This section pins how those values map onto ReceiptOS binary admissibility, so that neither system silently reinterprets the other's third state.

Rule zero: undetermined never maps to admit.

- reject = the verification procedure ran to completion and returned a definitive negative (format validation failed, declared-value mismatch, root inequality). Maps to ReceiptOS Adm(R)=0.
- undetermined = the procedure could not run at all (missing required input, unreachable external dependency where the profile requires it). Maps to ReceiptOS conservative failure — "rejection before an admissible root exists" — a state ReceiptOS folds into failure and the tri-state alphabet surfaces explicitly.

| Fixture | Reference rejection (offline) | Tri-state verdict |
|---|---|---|
| malformed-contract-anchor-result | contractAddress fails format validation | reject |
| malformed-txhash-anchor-result | txHash fails format validation | reject |
| wrong-chainid-anchor-result | chainId ≠ 11155111 | reject |
| wrong-network-anchor-result | network ≠ "sepolia" | reject |
| mismatched-root-anchor-result | imported receiptRoot ≠ capsule's anchor.merkle_root | reject |

Classification note: malformed-format cases are classified as reject, not undetermined — validation is a check that ran and returned a definitive answer. undetermined is reserved for cases where the procedure could not be evaluated at all.

Gap, stated honestly: no current fixture exemplifies undetermined. A sixth fixture pinning that state canonically (absent required anchor-result field) is proposed; until it lands, undetermined has a definition but no exemplar in this corpus.

Status: draft pending pressure-test by babyblueviper1 against the gate's actual outputs; becomes locked when both sides re-run and agree.
