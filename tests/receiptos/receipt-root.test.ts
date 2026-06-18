import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { computeReceiptRoot, stripAnchor } from "../../src/receiptos/canon/receipt-root"
import type { HandoffEvidence } from "../../src/receiptos/schema/types"

function readFixture(name: string): HandoffEvidence {
  return JSON.parse(
    readFileSync(resolve(import.meta.dir, "../../src/receiptos/fixtures", name), "utf8"),
  ) as HandoffEvidence
}

describe("receiptos receipt root", () => {
  test("computeReceiptRoot(sample) equals exact expected root", () => {
    const sample = readFixture("session-evidence.sample.json")
    expect(computeReceiptRoot(stripAnchor(sample))).toBe(sample.anchor.receipt_root)
  })

  test("top-level anchor changes do not change computed root", () => {
    const sample = readFixture("session-evidence.sample.json")
    const changedAnchor = {
      ...sample,
      anchor: {
        ...sample.anchor,
        receipt_root: "0x" + "f".repeat(64),
        merkle_root: "0x" + "a".repeat(64),
        contract: "0x" + "1".repeat(40),
        tx_hash: "0x" + "2".repeat(64),
      },
    }

    expect(computeReceiptRoot(stripAnchor(changedAnchor))).toBe(sample.anchor.receipt_root)
  })

  test("changing a non-anchor field changes computed root", () => {
    const sample = readFixture("session-evidence.sample.json")
    const changed = {
      ...sample,
      task: {
        ...sample.task,
        title: `${sample.task.title} changed`,
      },
    }

    expect(computeReceiptRoot(stripAnchor(changed))).not.toBe(sample.anchor.receipt_root)
  })
})
