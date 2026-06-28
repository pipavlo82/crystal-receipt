import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  createPortableProofObjectV0,
  type HandoffEvidence,
  type PortableProofObjectV0,
} from "../../src/receiptos"

function fixturePath(name: string) {
  return resolve(import.meta.dir, "../../src/receiptos/fixtures", name)
}

function examplePath(name: string) {
  return resolve(import.meta.dir, "../../examples", name)
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T
}

describe("portable proof object v0", () => {
  test("builder reproduces the canonical portable proof object example", async () => {
    const evidence = readJson<HandoffEvidence>(fixturePath("session-evidence.sample.json"))
    const portableProofObject = await createPortableProofObjectV0(evidence, {
      sourceEvidenceRef: "example://stealth-handoff/normalized-evidence.json",
    })
    const expected = readJson<PortableProofObjectV0>(examplePath("portable-proof-object-v0.json"))

    expect(portableProofObject).toEqual(expected)
  })

  test("Chronicle-compatible top-level fields are present", async () => {
    const evidence = readJson<HandoffEvidence>(fixturePath("session-evidence.sample.json"))
    const portableProofObject = await createPortableProofObjectV0(evidence)

    expect(portableProofObject.schema).toBe("receiptos.portable_proof_object.v0")
    expect(portableProofObject.proof_system).toBe("ReceiptOS")
    expect(portableProofObject.proof_object_id).toMatch(/^proofobj-/)
    expect(portableProofObject.receipt_root).toMatch(/^0x[0-9a-f]{64}$/)
    expect(typeof portableProofObject.proof_ref).toBe("string")
    expect(portableProofObject.evidence_capsule.schema).toBe("receiptos.evidence_capsule.v0")
    expect(portableProofObject.provenance_summary.schema).toBe("receiptos.provenance_summary.v0")
  })
})
