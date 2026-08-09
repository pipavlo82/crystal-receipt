import { describe, expect, test } from "bun:test"
import { readFileSync, statSync } from "node:fs"
import { resolve } from "node:path"
import {
  VERIFIER_CHALLENGE_MODEL_SCHEMA,
  projectVerifierChallengeVector,
  type VerifierChallengeVectorModelV0,
} from "../../src/receiptos/challenge/verifier-challenge-model"

const root = resolve(import.meta.dir, "../..")

function readJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(resolve(root, relativePath), "utf8"))
}

function projectFrozen(relativePath: string): {
  raw: Record<string, unknown>
  model: VerifierChallengeVectorModelV0
} {
  const absolute = resolve(root, relativePath)
  const before = statSync(absolute)
  const raw = readJson(relativePath) as Record<string, unknown>
  const model = projectVerifierChallengeVector(raw)
  const after = statSync(absolute)
  expect(after.size).toBe(before.size)
  expect(after.mtimeMs).toBe(before.mtimeMs)
  return { raw, model }
}

function assertLosslessNative(raw: Record<string, unknown>, model: VerifierChallengeVectorModelV0) {
  expect(model.model_schema).toBe(VERIFIER_CHALLENGE_MODEL_SCHEMA)
  expect(model.native).toEqual(raw)
  expect(model.native).not.toBe(raw)
  expect(model.expected).toEqual(raw.expected)
  expect(model.expected).not.toBe(raw.expected)
  expect(model.native_schema).toBe(raw.schema)
  expect(model.vector_id).toBe(raw.vector_id)
  expect(model.package_version).toBe(raw.package_version)
  expect(model.execution_class).toBe(raw.execution_class)
}

function childIdentity(contract: Record<string, unknown>): string | undefined {
  if (typeof contract.child_identity_set_sha256 === "string") {
    return contract.child_identity_set_sha256
  }
  const aggregate = contract.aggregate
  if (aggregate && typeof aggregate === "object" && !Array.isArray(aggregate)) {
    const value = (aggregate as { child_identity_set_sha256?: unknown }).child_identity_set_sha256
    if (typeof value === "string") return value
  }
  return undefined
}

describe("verifier challenge model v0", () => {
  test("verifyHandoff observed-not-validated projects losslessly", () => {
    const path = "conformance/verifier-challenge-observed-not-validated-v0/vectors/V-OBSERVED-NOT-VALIDATED.json"
    const { raw, model } = projectFrozen(path)
    assertLosslessNative(raw, model)
    expect(model.surface).toBe("verify_handoff_receipt_root")
    expect(model.challenge_id).toBe("observed_not_validated")
    expect(model.subject).toEqual(raw.subject_verifier)
    expect(model.source).toEqual({
      repository_path: (raw.source_fixture as { repository_path: string }).repository_path,
      git_blob_oid: (raw.source_fixture as { git_blob_oid: string }).git_blob_oid,
    })
    expect(model.derivation).toEqual({
      kind: "path_mutation",
      operation: "set",
      path: ["anchor", "verifier_status"],
      from: "not verified",
      to: "verified",
    })
    expect(model.field_classification).toEqual(raw.field_classification)
  })

  test("verifyHandoff missing-required-input projects null mutation target", () => {
    const path =
      "conformance/verifier-challenge-missing-required-input-unverifiable-v0/vectors/V-MISSING-REQUIRED-INPUT.json"
    const { raw, model } = projectFrozen(path)
    assertLosslessNative(raw, model)
    expect(model.surface).toBe("verify_handoff_receipt_root")
    expect(model.challenge_id).toBe("missing_required_input_unverifiable")
    expect(model.subject?.entrypoint).toBe("verifyHandoffReceiptRoot")
    expect(model.source?.git_blob_oid).toBe((raw.source_fixture as { git_blob_oid: string }).git_blob_oid)
    expect(model.derivation).toEqual({
      kind: "path_mutation",
      operation: "set",
      path: ["anchor", "receipt_root"],
      from: (raw.mutation as { from: unknown }).from,
      to: null,
    })
  })

  test("verifyHandoff integrity-mismatch projects decisive body mutation", () => {
    const path = "conformance/verifier-challenge-integrity-mismatch-rejected-v0/vectors/V-INTEGRITY-MISMATCH.json"
    const { raw, model } = projectFrozen(path)
    assertLosslessNative(raw, model)
    expect(model.surface).toBe("verify_handoff_receipt_root")
    expect(model.challenge_id).toBe("integrity_mismatch_rejected")
    expect(model.derivation.kind).toBe("path_mutation")
    if (model.derivation.kind === "path_mutation") {
      expect(model.derivation.path).toEqual(["task", "title"])
    }
    expect((model.expected as { outcomes: string[] }).outcomes).toContain("integrity_mismatch_detected")
  })

  test("Chronicle admission proof-root-mismatch projects losslessly", () => {
    const path =
      "conformance/verifier-challenge-chronicle-proof-root-mismatch-rejected-v0/vectors/V-CHRONICLE-PROOF-ROOT-MISMATCH.json"
    const { raw, model } = projectFrozen(path)
    assertLosslessNative(raw, model)
    expect(model.surface).toBe("chronicle_admission")
    expect(model.challenge_id).toBe("proof_root_mismatch_rejected")
    expect(model.subject).toEqual(raw.subject_admission_verifier)
    expect(model.source?.repository_path).toBe((raw.source_fixture as { repository_path: string }).repository_path)
    expect(model.derivation.kind).toBe("path_mutation")
  })

  test("Chronicle continuity predecessor_unknown projects substitution", () => {
    const path =
      "conformance/verifier-challenge-chronicle-predecessor-unknown-unverifiable-v0/vectors/V-CHRONICLE-PREDECESSOR-UNKNOWN.json"
    const { raw, model } = projectFrozen(path)
    assertLosslessNative(raw, model)
    expect(model.surface).toBe("chronicle_continuity")
    expect(model.challenge_id).toBe("predecessor_unknown_unverifiable")
    expect(model.subject).toEqual(raw.subject_continuity_evaluator)
    expect(model.source).toEqual({
      repository_path: (raw.source_fixture as { repository_path: string }).repository_path,
      git_blob_oid: (raw.source_fixture as { git_blob_oid: string }).git_blob_oid,
    })
    expect(model.derivation).toEqual({
      kind: "substitution",
      value: raw.substitution,
    })
    expect((raw.source_fixture as { baseline_vector_name: string }).baseline_vector_name).toBe("valid_successor")
    expect((model.native.source_fixture as { baseline_vector_name: string }).baseline_vector_name).toBe(
      "valid_successor",
    )
  })

  test("Chronicle continuity sequence_gap projects substitution", () => {
    const path =
      "conformance/verifier-challenge-chronicle-sequence-gap-rejected-v0/vectors/V-CHRONICLE-SEQUENCE-GAP.json"
    const { raw, model } = projectFrozen(path)
    assertLosslessNative(raw, model)
    expect(model.surface).toBe("chronicle_continuity")
    expect(model.challenge_id).toBe("sequence_gap_rejected")
    expect(model.derivation.kind).toBe("substitution")
    expect(model.derivation).toEqual({ kind: "substitution", value: raw.substitution })
  })

  test("Chronicle checkpoint root mismatch projects without source_fixture", () => {
    const path =
      "conformance/verifier-challenge-chronicle-checkpoint-root-mismatch-rejected-v0/vectors/V-CHRONICLE-CHECKPOINT-ROOT-MISMATCH.json"
    const { raw, model } = projectFrozen(path)
    assertLosslessNative(raw, model)
    expect(model.surface).toBe("chronicle_checkpoint_local")
    expect(model.challenge_id).toBe("checkpoint_root_mismatch_rejected")
    expect(model.subject).toEqual(raw.subject_local_checkpoint_verifier)
    expect(model.source).toBeNull()
    expect(model.derivation).toEqual({
      kind: "substitution",
      value: raw.substitution,
    })
  })

  test("Chronicle checkpoint noncanonical refs projects losslessly", () => {
    const path =
      "conformance/verifier-challenge-chronicle-checkpoint-entry-refs-noncanonical-rejected-v0/vectors/V-CHRONICLE-CHECKPOINT-ENTRY-REFS-NONCANONICAL.json"
    const { raw, model } = projectFrozen(path)
    assertLosslessNative(raw, model)
    expect(model.surface).toBe("chronicle_checkpoint_local")
    expect(model.challenge_id).toBe("checkpoint_entry_refs_noncanonical_rejected")
    expect(model.source).toBeNull()
    expect(model.derivation.kind).toBe("substitution")
  })

  test("CAB rejected nested audit_timestamp projects as audit-boundary operation", () => {
    const path = "conformance/counterfactual-audit-boundary-v0/vectors/V-AT-NEST-OBJ.json"
    const { raw, model } = projectFrozen(path)
    assertLosslessNative(raw, model)
    expect(model.surface).toBe("counterfactual_audit_boundary")
    expect(model.challenge_id).toBeNull()
    expect(model.subject).toBeNull()
    expect(model.source).toBeNull()
    expect(model.field_classification).toBeNull()
    expect(model.derivation).toEqual({
      kind: "audit_boundary_operation",
      operation: "semantic_snapshot",
    })
    expect((model.expected as { outcome: string }).outcome).toBe("rejected")
    expect(model.native.input).toEqual(raw.input)
  })

  test("CAB manifest_hash_differs projects distinct operation payload", () => {
    const path = "conformance/counterfactual-audit-boundary-v0/vectors/V-MAN-HASH-DIFF.json"
    const { raw, model } = projectFrozen(path)
    assertLosslessNative(raw, model)
    expect(model.surface).toBe("counterfactual_audit_boundary")
    expect(model.derivation).toEqual({
      kind: "audit_boundary_operation",
      operation: "manifest_file_sha256",
    })
    expect((model.expected as { outcome: string }).outcome).toBe("manifest_hash_differs")
    expect(model.native.inputs).toEqual(raw.inputs)
  })

  test("projection does not mutate caller-owned raw object", () => {
    const path = "conformance/verifier-challenge-observed-not-validated-v0/vectors/V-OBSERVED-NOT-VALIDATED.json"
    const raw = readJson(path) as Record<string, unknown>
    const before = structuredClone(raw)
    const model = projectVerifierChallengeVector(raw)
    expect(raw).toEqual(before)
    ;(model.native as { challenge_id: string }).challenge_id = "mutated-in-model-clone-only"
    expect(raw.challenge_id).toBe("observed_not_validated")
  })

  test("frozen package digests remain unchanged after projection", () => {
    const digests: Array<{
      packageDir: string
      fixture: string
      child?: string
      expected?: string
    }> = [
      {
        packageDir: "conformance/counterfactual-audit-boundary-v0",
        fixture: "7503d5cac003a23489f194c5521ef90b01ac0b2ce345a2cec57ad12ffeb274f8",
        expected: "db664c5e8da2f0fb6d1d94a036eab572ae2941ffeb5193624365d4bdbaeec24a",
      },
      {
        packageDir: "conformance/verifier-challenge-set-v0",
        fixture: "6a4f84a109f633559c7df2e9dd86092e00ce52a81c4a3dcd46c112175748e284",
        child: "945ec30015490b3d92c01177124be5eddcee18b99308d3aed7701fedff67d326",
      },
      {
        packageDir: "conformance/verifier-challenge-chronicle-admission-set-v0",
        fixture: "dbf062131278b8164373725442e069eb53328729058960b52213dd74b78c83c5",
        child: "55c8f203255bf97c40ab76255a95db3447bc2dc30ec961fd65f6a39eba12f22a",
      },
      {
        packageDir: "conformance/verifier-challenge-chronicle-continuity-set-v0",
        fixture: "77261f48e3a712536e3cd37f4384c0b62a5063a3c6be7cf14ac648848feea716",
        child: "4448c728b264cc51d369de7b42430205b9dfdabedb09a282c619e5a42e0d61ac",
      },
      {
        packageDir: "conformance/verifier-challenge-chronicle-checkpoint-local-set-v0",
        fixture: "2c5b171806a253c32495a819d011087c46f4cfb8bad27b0821f6abd280a6ef89",
        child: "5bcdef8fa4fdb24287e29efb273b4e1998e443047ea1251ec12e3c8097269e28",
      },
    ]

    for (const relative of [
      "conformance/verifier-challenge-observed-not-validated-v0/vectors/V-OBSERVED-NOT-VALIDATED.json",
      "conformance/verifier-challenge-missing-required-input-unverifiable-v0/vectors/V-MISSING-REQUIRED-INPUT.json",
      "conformance/verifier-challenge-integrity-mismatch-rejected-v0/vectors/V-INTEGRITY-MISMATCH.json",
      "conformance/verifier-challenge-chronicle-proof-root-mismatch-rejected-v0/vectors/V-CHRONICLE-PROOF-ROOT-MISMATCH.json",
      "conformance/verifier-challenge-chronicle-predecessor-unknown-unverifiable-v0/vectors/V-CHRONICLE-PREDECESSOR-UNKNOWN.json",
      "conformance/verifier-challenge-chronicle-sequence-gap-rejected-v0/vectors/V-CHRONICLE-SEQUENCE-GAP.json",
      "conformance/verifier-challenge-chronicle-checkpoint-root-mismatch-rejected-v0/vectors/V-CHRONICLE-CHECKPOINT-ROOT-MISMATCH.json",
      "conformance/verifier-challenge-chronicle-checkpoint-entry-refs-noncanonical-rejected-v0/vectors/V-CHRONICLE-CHECKPOINT-ENTRY-REFS-NONCANONICAL.json",
      "conformance/counterfactual-audit-boundary-v0/vectors/V-AT-NEST-OBJ.json",
      "conformance/counterfactual-audit-boundary-v0/vectors/V-MAN-HASH-DIFF.json",
    ]) {
      projectVerifierChallengeVector(readJson(relative))
    }

    for (const entry of digests) {
      const manifest = readJson(`${entry.packageDir}/manifest.json`) as { fixture_set_sha256: string }
      expect(manifest.fixture_set_sha256).toBe(entry.fixture)
      const contract = readJson(`${entry.packageDir}/contract.json`) as Record<string, unknown>
      if (entry.child) {
        expect(childIdentity(contract)).toBe(entry.child)
      }
      if (entry.expected) {
        expect(contract.expected_result_set_sha256).toBe(entry.expected)
      }
    }
  })
})
