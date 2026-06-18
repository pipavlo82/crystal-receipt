import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { computeReceiptRoot, stripAnchor } from "../../src/receiptos/canon/receipt-root"
import {
  applyLocalMerkleProofToEvidence,
  attachLocalMerkleProof,
  verifyLocalMerkleProof,
} from "../../src/receiptos/merkle/local-merkle"
import type { HandoffEvidence } from "../../src/receiptos/schema/types"

function readFixture(name: string): HandoffEvidence {
  return JSON.parse(
    readFileSync(resolve(import.meta.dir, "../../src/receiptos/fixtures", name), "utf8"),
  ) as HandoffEvidence
}

describe("receiptos local merkle helpers", () => {
  test("attachLocalMerkleProof attaches expected one-leaf structure", () => {
    const sample = readFixture("session-evidence.sample.json")
    const proof = attachLocalMerkleProof(sample)

    expect(proof.receipt_root).toBe(sample.anchor.receipt_root)
    expect(proof.merkle_root).toBe(sample.anchor.receipt_root)
    expect(proof.merkle_leaf_index).toBe(0)
    expect(proof.merkle_proof).toEqual([])
    expect(proof.merkle_proof_status).toBe("attached")
    expect(proof.onchain_anchor_status).toBe("not anchored")
    expect(proof.network).toBe("local/off-chain")
    expect(proof.contract).toBeNull()
    expect(proof.tx_hash).toBeNull()
  })

  test("applyLocalMerkleProofToEvidence overlays only expected anchor fields", () => {
    const sample = readFixture("session-evidence.sample.json")
    const proof = attachLocalMerkleProof(sample)
    const applied = applyLocalMerkleProofToEvidence(sample, proof)

    expect(applied.session_id).toBe(sample.session_id)
    expect(applied.directory).toBe(sample.directory)
    expect(applied.task).toEqual(sample.task)
    expect(applied.authorization).toEqual(sample.authorization)
    expect(applied.anchor.receipt_root).toBe(sample.anchor.receipt_root)
    expect(applied.anchor.merkle_proof_status).toBe("attached")
    expect(applied.anchor.merkle_root).toBe(sample.anchor.receipt_root)
    expect(applied.anchor.merkle_leaf_index).toBe(0)
    expect(applied.anchor.merkle_proof).toEqual([])
    expect(applied.anchor.onchain_anchor_status).toBe("not anchored")
    expect(applied.anchor.network).toBe("local/off-chain")
    expect(applied.anchor.contract).toBeNull()
    expect(applied.anchor.tx_hash).toBeNull()
    expect(applied.anchor.verifier_status).toBe(sample.anchor.verifier_status)
  })

  test("verifyLocalMerkleProof valid attached proof passes", () => {
    const sample = readFixture("session-evidence.sample.json")
    const proof = attachLocalMerkleProof(sample)
    expect(verifyLocalMerkleProof(proof)).toEqual({
      ok: true,
      merkle_root: sample.anchor.receipt_root,
      recomputed_root: sample.anchor.receipt_root,
      merkle_leaf_index: 0,
      merkle_proof_count: 0,
    })
  })

  test("verifyLocalMerkleProof mismatched merkle_root fails", () => {
    const sample = readFixture("session-evidence.sample.json")
    const proof = { ...attachLocalMerkleProof(sample), merkle_root: "0x" + "a".repeat(64) }
    expect(verifyLocalMerkleProof(proof).ok).toBe(false)
  })

  test("verifyLocalMerkleProof non-zero merkle_leaf_index fails", () => {
    const sample = readFixture("session-evidence.sample.json")
    const proof = { ...attachLocalMerkleProof(sample), merkle_leaf_index: 1 }
    expect(verifyLocalMerkleProof(proof).ok).toBe(false)
  })

  test("verifyLocalMerkleProof non-empty proof fails", () => {
    const sample = readFixture("session-evidence.sample.json")
    const proof = { ...attachLocalMerkleProof(sample), merkle_proof: ["0x" + "b".repeat(64)] }
    expect(verifyLocalMerkleProof(proof).ok).toBe(false)
  })

  test("missing receipt_root fails gracefully", () => {
    const sample = readFixture("session-evidence.sample.json")
    expect(() => attachLocalMerkleProof({
      ...sample,
      anchor: {
        ...sample.anchor,
        receipt_root: null as unknown as string,
      },
    })).toThrow("Missing anchor.receipt_root")
  })

  test("fixture with local merkle matches helper output exactly", () => {
    const sample = readFixture("session-evidence.sample.json")
    const expected = readFixture("session-evidence.with-local-merkle.sample.json")
    const proof = attachLocalMerkleProof(sample)
    const applied = applyLocalMerkleProofToEvidence(sample, proof)

    expect(applied).toEqual(expected)
  })

  test("receipt_root invariance holds with local merkle overlay", () => {
    const sample = readFixture("session-evidence.sample.json")
    const proof = attachLocalMerkleProof(sample)
    const applied = applyLocalMerkleProofToEvidence(sample, proof)

    expect(computeReceiptRoot(stripAnchor(sample))).toBe(computeReceiptRoot(stripAnchor(applied)))
  })
})
