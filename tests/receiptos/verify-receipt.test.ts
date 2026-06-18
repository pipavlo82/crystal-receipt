import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { verifyHandoffReceiptRoot } from "../../src/receiptos/verify/verify-receipt"
import type { HandoffEvidence } from "../../src/receiptos/schema/types"

function readFixture(name: string): HandoffEvidence {
  return JSON.parse(
    readFileSync(resolve(import.meta.dir, "../../src/receiptos/fixtures", name), "utf8"),
  ) as HandoffEvidence
}

describe("receiptos verifier", () => {
  test("sample verifies ok", async () => {
    const sample = readFixture("session-evidence.sample.json")
    const result = await verifyHandoffReceiptRoot(sample)
    expect(result.ok).toBe(true)
    expect(result.receipt_root).toBe(sample.anchor.receipt_root)
    expect(result.recomputed_root).toBe(sample.anchor.receipt_root)
  })

  test("tampered sample fails verification", async () => {
    const sample = readFixture("session-evidence.tampered.sample.json")
    const result = await verifyHandoffReceiptRoot(sample)
    expect(result.ok).toBe(false)
    expect(result.receipt_root).toBe(sample.anchor.receipt_root)
    expect(result.recomputed_root).not.toBe(sample.anchor.receipt_root)
  })

  test("missing anchor.receipt_root fails gracefully", async () => {
    const sample = readFixture("session-evidence.sample.json")
    const result = await verifyHandoffReceiptRoot({
      ...sample,
      anchor: {
        ...sample.anchor,
        receipt_root: null as unknown as string,
      },
    })

    expect(result).toEqual({
      ok: false,
      receipt_root: null,
      recomputed_root: null,
    })
  })
})
