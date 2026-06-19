import { describe, expect, test } from "bun:test"
import { createVerifyResult } from "../../scripts/receiptos-verify"

describe("receiptos verify cli", () => {
  test("clean-local-proof verifies successfully", async () => {
    const result = await createVerifyResult("src/receiptos/fixtures/session-evidence.with-local-merkle.sample.json")
    expect(result.schema).toBe("receiptos.verify_result.v0")
    expect(result.receipt_root.match).toBe(true)
    expect(result.verifier_result.ok).toBe(true)
    expect(result.proof_refs.merkle.status).toBe("valid")
  })

  test("tampered receipt fails verification clearly", async () => {
    const result = await createVerifyResult("src/receiptos/fixtures/session-evidence.tampered.sample.json")
    expect(result.receipt_root.match).toBe(false)
    expect(result.verifier_result.ok).toBe(false)
    expect(result.verifier_result.status).toBe("mismatch")
  })
})
