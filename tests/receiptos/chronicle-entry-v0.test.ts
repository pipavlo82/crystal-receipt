import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createChronicleEntryV0, createPortableProofObjectV0, type HandoffEvidence } from "../../src/receiptos"

function fixturePath(name: string) {
  return resolve(import.meta.dir, "../../src/receiptos/fixtures", name)
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T
}

describe("chronicle entry v0", () => {
  test("matches canonical Chronicle web field contract", async () => {
    const evidence = readJson<HandoffEvidence>(fixturePath("session-evidence.sample.json"))
    const proof = await createPortableProofObjectV0(evidence, {
      sourceEvidenceRef: "example://stealth-handoff/normalized-evidence.json",
    })

    const entry = createChronicleEntryV0(proof)

    expect(entry).toEqual({
      schema: "chronicle_entry.v0",
      entry_id: `entry-${proof.proof_object_id}`,
      source_system: proof.proof_system,
      receipt_root: proof.receipt_root,
      proof_object_ref: proof.proof_ref,
      evidence_capsule_ref: `embedded:${proof.proof_object_id}:evidence_capsule`,
      provenance_summary_ref: `embedded:${proof.proof_object_id}:provenance_summary`,
      created_from: proof.source_evidence_ref,
      labels: [],
      notes: null,
    })
  })

  test("supports Chronicle-compatible optional overrides", async () => {
    const evidence = readJson<HandoffEvidence>(fixturePath("session-evidence.sample.json"))
    const proof = await createPortableProofObjectV0(evidence)

    const entry = createChronicleEntryV0(proof, {
      entryId: "entry-custom",
      evidenceCapsuleRef: "capsule://custom",
      provenanceSummaryRef: "provenance://custom",
      createdFrom: "import://custom",
      labels: ["demo", "portable"],
      notes: "reviewed",
    })

    expect(entry.entry_id).toBe("entry-custom")
    expect(entry.evidence_capsule_ref).toBe("capsule://custom")
    expect(entry.provenance_summary_ref).toBe("provenance://custom")
    expect(entry.created_from).toBe("import://custom")
    expect(entry.labels).toEqual(["demo", "portable"])
    expect(entry.notes).toBe("reviewed")
  })
})
