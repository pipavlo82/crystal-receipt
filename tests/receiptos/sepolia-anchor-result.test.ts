import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { computeReceiptRoot, stripAnchor } from "../../src/receiptos/canon/receipt-root"
import { importSepoliaAnchorResult } from "../../src/receiptos/anchor/sepolia-result"
import type { HandoffEvidence, ImportedAnchorResult, SepoliaAnchorOverlay } from "../../src/receiptos/schema/types"

function readEvidence(name: string): HandoffEvidence {
  return JSON.parse(readFileSync(resolve(import.meta.dir, "../../src/receiptos/fixtures", name), "utf8")) as HandoffEvidence
}

function readResult(name: string): ImportedAnchorResult {
  return JSON.parse(readFileSync(resolve(import.meta.dir, "../../src/receiptos/fixtures", name), "utf8")) as ImportedAnchorResult
}

function readInvalid(name: string): ImportedAnchorResult {
  return JSON.parse(readFileSync(resolve(import.meta.dir, "../../src/receiptos/fixtures/invalid", name), "utf8")) as ImportedAnchorResult
}

describe("receiptos sepolia anchor result", () => {
  test("valid imported result returns exact overlay fields", () => {
    const evidence = readEvidence("session-evidence.with-local-merkle.sample.json")
    const raw = readResult("sepolia-anchor-result.sample.json")
    const overlay: SepoliaAnchorOverlay = importSepoliaAnchorResult(evidence, raw)

    expect(overlay).toEqual({
      onchain_anchor_status: "anchored",
      network: "sepolia",
      contract: raw.contractAddress,
      tx_hash: raw.txHash,
    })
  })

  test("wrong network fails", () => {
    const evidence = readEvidence("session-evidence.with-local-merkle.sample.json")
    const raw = readInvalid("wrong-network-anchor-result.json")
    expect(() => importSepoliaAnchorResult(evidence, raw)).toThrow('invalid network: expected "sepolia"')
  })

  test("wrong chainId fails", () => {
    const evidence = readEvidence("session-evidence.with-local-merkle.sample.json")
    const raw = readInvalid("wrong-chainid-anchor-result.json")
    expect(() => importSepoliaAnchorResult(evidence, raw)).toThrow('invalid chainId: expected 11155111')
  })

  test("mismatched receiptRoot fails", () => {
    const evidence = readEvidence("session-evidence.with-local-merkle.sample.json")
    const raw = readInvalid("mismatched-root-anchor-result.json")
    expect(() => importSepoliaAnchorResult(evidence, raw)).toThrow('imported receiptRoot does not match anchor.merkle_root')
  })

  test("malformed txHash fails", () => {
    const evidence = readEvidence("session-evidence.with-local-merkle.sample.json")
    const raw = readInvalid("malformed-txhash-anchor-result.json")
    expect(() => importSepoliaAnchorResult(evidence, raw)).toThrow('invalid txHash: 0x1234')
  })

  test("malformed contractAddress fails", () => {
    const evidence = readEvidence("session-evidence.with-local-merkle.sample.json")
    const raw = readInvalid("malformed-contract-anchor-result.json")
    expect(() => importSepoliaAnchorResult(evidence, raw)).toThrow('invalid contractAddress: 0x1234')
  })

  test("event.receiptRoot mismatch fails", () => {
    const evidence = readEvidence("session-evidence.with-local-merkle.sample.json")
    const raw = readResult("sepolia-anchor-result.sample.json")
    raw.event = { ...raw.event, receiptRoot: "0x" + "c".repeat(64) }
    expect(() => importSepoliaAnchorResult(evidence, raw)).toThrow('event.receiptRoot does not match anchor.merkle_root')
  })

  test("overlay updates only allowed fields", () => {
    const evidence = readEvidence("session-evidence.with-local-merkle.sample.json")
    const raw = readResult("sepolia-anchor-result.sample.json")
    const overlay = importSepoliaAnchorResult(evidence, raw)
    const applied = {
      ...evidence,
      anchor: {
        ...evidence.anchor,
        onchain_anchor_status: overlay.onchain_anchor_status,
        network: overlay.network,
        contract: overlay.contract,
        tx_hash: overlay.tx_hash,
      },
    }

    expect(applied.anchor.receipt_root).toBe(evidence.anchor.receipt_root)
    expect(applied.anchor.merkle_root).toBe(evidence.anchor.merkle_root)
    expect(applied.anchor.merkle_proof).toEqual(evidence.anchor.merkle_proof)
    expect(applied.anchor.verifier_status).toBe(evidence.anchor.verifier_status)
    expect(applied.anchor.onchain_anchor_status).toBe("anchored")
    expect(applied.anchor.network).toBe("sepolia")
    expect(applied.anchor.contract).toBe(raw.contractAddress)
    expect(applied.anchor.tx_hash).toBe(raw.txHash)
  })

  test("importing anchor result must not change computeReceiptRoot(evidence)", () => {
    const evidence = readEvidence("session-evidence.with-local-merkle.sample.json")
    const raw = readResult("sepolia-anchor-result.sample.json")
    const overlay = importSepoliaAnchorResult(evidence, raw)
    const applied = {
      ...evidence,
      anchor: {
        ...evidence.anchor,
        onchain_anchor_status: overlay.onchain_anchor_status,
        network: overlay.network,
        contract: overlay.contract,
        tx_hash: overlay.tx_hash,
      },
    }

    expect(computeReceiptRoot(stripAnchor(evidence))).toBe(computeReceiptRoot(stripAnchor(applied)))
  })

  test("input evidence is not mutated and canonical receipt body is unaffected", () => {
    const evidence = readEvidence("session-evidence.with-local-merkle.sample.json")
    const before = JSON.stringify(evidence)
    const raw = readResult("sepolia-anchor-result.sample.json")
    void importSepoliaAnchorResult(evidence, raw)
    expect(JSON.stringify(evidence)).toBe(before)
  })
})
