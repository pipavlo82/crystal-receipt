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
