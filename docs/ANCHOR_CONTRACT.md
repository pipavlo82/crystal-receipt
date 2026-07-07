# Anchor Contract

## Address

`0x461e60fa7D2Bd9512DE1B043A3e8d206462D34f5`

## Network

`sepolia` (`chainId` `11155111`)

## Event

`ReceiptAnchored`

Fields per fixture shape:
- `receiptRoot`
- `metadataURI`
- `publisher`

## Demo anchor

`txHash` `0x03828c9ba39f27a7f433a3e830160c7fa30c1993877ed6563e74705e300d082c`

## Scope boundary

The reference implementation verifies anchor results offline against the capsule (see `fixtures/invalid/EXPECTED.md`) and does not decode on-chain event logs. The indexed-topic layout of `ReceiptAnchored` has not been pinned in this repository; an external verifier has observed that the indexed topic does not equal the raw `receiptRoot` value, consistent with ABI encoding rules for indexed dynamic types. Pinning the full event ABI from the deployment artifact is an open task; until then, on-chain log decoding must not be presented as a conformance check.
