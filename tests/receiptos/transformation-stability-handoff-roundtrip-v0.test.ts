import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { computeReceiptRoot } from "../../src/receiptos/canon/receipt-root"
import { HandoffEvidenceSchema } from "../../src/receiptos/schema/evidence"
import {
  HANDOFF_EVIDENCE_CANONICAL_ROUNDTRIP_PROFILE_ID_V0,
  verifyHandoffEvidenceCanonicalRoundTripV0,
} from "../../src/receiptos/challenge/transformation-stability-handoff-roundtrip"

const root = resolve(import.meta.dir, "../..")
const fixture = JSON.parse(
  readFileSync(resolve(root, "src/receiptos/fixtures/session-evidence.sample.json"), "utf8"),
)

describe("handoff canonical round-trip v0", () => {
  test("committed sample is schema-valid and root-bound", () => {
    const parsed = HandoffEvidenceSchema.parse(fixture)
    expect(computeReceiptRoot(parsed)).toBe(
      "0x687dc5c00d9241469138bb1c17a06af1b8713b0f84663b55e11d476f4171a6bc",
    )
    expect(parsed.anchor.receipt_root).toBe(computeReceiptRoot(parsed))
  })

  test("canonical round trip is stable", async () => {
    const result = await verifyHandoffEvidenceCanonicalRoundTripV0(fixture)
    expect(result.transformation_profile_id).toBe(
      HANDOFF_EVIDENCE_CANONICAL_ROUNDTRIP_PROFILE_ID_V0,
    )
    expect(result.classification).toBe("stable")
    expect(result.normative_match).toBe(true)
    expect(result.stability_match).toBe(true)
    expect(result.forbidden_variant_match).toBe(true)
  })
})
