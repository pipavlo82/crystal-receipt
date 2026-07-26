import { describe, expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { readdirSync, readFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { createChronicleEntryV0 } from "../../src/receiptos"
import { readGitIndexBytes, readGitIndexJson } from "./helpers/git-index-bytes"

type SharedResult = {
  outcome: "admitted" | "rejected"
  failure_class: string
  reason_code: string | null
  chronicle_entry: Record<string, unknown> | null
}

type Vector = {
  schema: string
  case_id: string
  description: string
  input: {
    evidence: Record<string, unknown> | null
    proof_object: Record<string, unknown> | null
    options?: Record<string, unknown>
  }
  expected: SharedResult
}

const repo = resolve(import.meta.dir, "../..")
const packageRoot = resolve(import.meta.dir, "../fixtures/receiptos-chronicle-admission-v0")
const vectorsRoot = join(packageRoot, "vectors")
const manifest = readGitIndexJson<{
  schema: string
  package_version: string
  vector_schema: { path: string; sha256: string }
  files: Array<{ path: string; sha256: string }>
  fixture_set_sha256: string
}>(repo, "tests/fixtures/receiptos-chronicle-admission-v0/manifest.json")
const schema = readGitIndexJson<{
  properties: {
    expected: { properties: { failure_class: { enum: string[] } } }
  }
}>(repo, `tests/fixtures/receiptos-chronicle-admission-v0/${manifest.vector_schema.path}`)
const vectorFiles = readdirSync(vectorsRoot).filter((name) => name.endsWith(".json")).sort()
const vectors = vectorFiles.map((name) => JSON.parse(readFileSync(join(vectorsRoot, name), "utf8")) as Vector)
const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex")

const errorMap: Array<[string, string, string]> = [
  ["requires evidence.anchor.receipt_root to be present", "unverifiable", "evidence_root_missing"],
  ["stored receipt_root to independently recompute (mismatch)", "evidence_mismatch", "evidence_root_mismatch"],
  ["proofObject.receipt_root to equal", "cross_object_inconsistency", "proof_root_mismatch"],
  ["receipt_root.stored to equal", "cross_object_inconsistency", "capsule_stored_mismatch"],
  ["receipt_root.computed to equal", "cross_object_inconsistency", "capsule_computed_mismatch"],
  ["receipt_root.match/status to be internally consistent", "reported_state_inconsistency", "capsule_label_inconsistent"],
  ["evidence_capsule.verifier_result to be internally consistent", "reported_state_inconsistency", "verifier_result_inconsistent"],
  ["proofObject.proof_object_id to be the canonical derivation", "identity_inconsistency", "proof_object_id_invalid"],
  ["proofObject.proof_ref to be the canonical derivation", "identity_inconsistency", "proof_ref_invalid"],
]

function execute(vector: Vector): SharedResult {
  try {
    const chronicleEntry = createChronicleEntryV0(
      vector.input.evidence as never,
      vector.input.proof_object as never,
      vector.input.options as never,
    )
    return {
      outcome: "admitted",
      failure_class: "none",
      reason_code: null,
      chronicle_entry: chronicleEntry,
    }
  } catch (error) {
    if (!(error instanceof Error)) throw error
    if (vector.input.evidence === null) {
      return {
        outcome: "rejected",
        failure_class: "malformed_input",
        reason_code: null,
        chronicle_entry: null,
      }
    }
    const mapped = errorMap.find(([fragment]) => error.message.includes(fragment))
    if (!mapped) throw new Error(`Unmapped Crystal admission error: ${error.message}`)
    return {
      outcome: "rejected",
      failure_class: mapped[1],
      reason_code: mapped[2],
      chronicle_entry: null,
    }
  }
}

describe("shared ReceiptOS Chronicle admission vectors", () => {
  test("package schema, inventory, and manifest are complete and hash-pinned by Git index bytes", () => {
    expect(manifest.schema).toBe("receiptos_chronicle_admission_fixture_manifest.v0")
    expect(manifest.package_version).toBe("receiptos-chronicle-admission-v0")
    expect(vectorFiles).toHaveLength(11)
    expect(new Set(vectors.map(({ case_id }) => case_id)).size).toBe(11)

    const required = [
      "clean_admitted",
      "evidence_root_missing",
      "evidence_root_mismatch",
      "proof_root_mismatch",
      "capsule_stored_root_mismatch",
      "capsule_computed_root_mismatch",
      "capsule_label_inconsistent",
      "verifier_result_inconsistent",
      "proof_object_id_invalid",
      "proof_ref_invalid",
      "proof_object_only_rejected",
    ]
    expect(vectors.map(({ case_id }) => case_id).sort()).toEqual(required.sort())

    for (const vector of vectors) {
      expect(vector.schema).toBe("receiptos_chronicle_admission_vector.v0")
      expect(vector.case_id.length).toBeGreaterThan(0)
      expect(vector.description.length).toBeGreaterThan(0)
      expect(["admitted", "rejected"]).toContain(vector.expected.outcome)
      expect(schema.properties.expected.properties.failure_class.enum).toContain(vector.expected.failure_class)
      expect(vector.expected.outcome === "admitted" ? vector.expected.chronicle_entry : null)
        .toEqual(vector.expected.chronicle_entry)
    }

    const actualFiles = manifest.files.map(({ path, sha256: expectedHash }) => {
      const bytes = readGitIndexBytes(repo, `tests/fixtures/receiptos-chronicle-admission-v0/${path}`)
      expect(sha256(bytes), path).toBe(expectedHash)
      return `${path}\t${expectedHash}\n`
    })
    expect(manifest.files.map(({ path }) => path)).toEqual(
      [...manifest.files.map(({ path }) => path)].sort(),
    )
    expect(sha256(actualFiles.join(""))).toBe(manifest.fixture_set_sha256)
    expect(manifest.vector_schema.sha256).toBe(
      manifest.files.find(({ path }) => path === manifest.vector_schema.path)?.sha256,
    )
  })

  for (const vector of vectors) {
    test(vector.case_id, () => {
      const actual = execute(vector)
      expect(actual).toEqual(vector.expected)
      if (vector.expected.outcome === "rejected") {
        expect(actual.chronicle_entry).toBeNull()
      }
    })
  }
})
