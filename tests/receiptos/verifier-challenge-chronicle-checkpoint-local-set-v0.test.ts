import { createHash } from "node:crypto"
import { describe, expect, test } from "bun:test"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { canonicalize, sha256 } from "../../src/receiptos"
import { auditPackage } from "../../conformance/verifier-challenge-chronicle-checkpoint-local-set-v0/audit_package"
import {
  createChronicleCheckpointV0,
  sortEntryRefs,
  verifyChronicleCheckpointV0,
} from "../../src/receiptos"

const root = resolve(import.meta.dir, "../..")
const pkg = "conformance/verifier-challenge-chronicle-checkpoint-local-set-v0"

const expectedChildOrder = [
  "checkpoint_root_mismatch_rejected",
  "checkpoint_entry_refs_noncanonical_rejected",
]

const expectedTrustBoundaries = [
  "stored-root-integrity",
  "canonical-entry-ref-order",
]

const expectedTrustBoundaryMapping = {
  "stored-root-integrity": "checkpoint_root_mismatch_rejected",
  "canonical-entry-ref-order": "checkpoint_entry_refs_noncanonical_rejected",
}

const expectedChildIdentitySetSha256 = "5bcdef8fa4fdb24287e29efb273b4e1998e443047ea1251ec12e3c8097269e28"

const gitIndexBlobOid = (repositoryPath: string) =>
  execFileSync("git", ["rev-parse", `:${repositoryPath}`], { cwd: root, encoding: "utf8" }).trim()

const canonicalJson = (value: unknown): string => {
  if (value === null) return "null"
  if (value === true) return "true"
  if (value === false) return "false"
  if (typeof value === "string") return JSON.stringify(value)
  if (typeof value === "number") return String(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`
  if (typeof value === "object") {
    const record = value as Record<string, unknown>
    const keys = Object.keys(record).sort()
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`
  }
  throw new Error(`non-canonical json value: ${typeof value}`)
}

const childIdentitySetSha256 = (children: Array<Record<string, unknown>>) =>
  createHash("sha256")
    .update(
      Buffer.from(
        canonicalJson(
          children.map((child) => ({
            ordinal: child.ordinal,
            challenge_id: child.challenge_id,
            package_path: child.package_path,
            vector_count: child.vector_count,
            execution_class: child.execution_class,
            fixture_set_sha256: child.fixture_set_sha256,
            expected_result_set_sha256: child.expected_result_set_sha256,
          })),
        ),
        "utf8",
      ),
    )
    .digest("hex")

function buildBaseline() {
  return createChronicleCheckpointV0({
    checkpointId: "checkpoint-demo",
    collectionRef: "/collection/demo",
    entryRefs: ["entry-alpha", "entry-beta", "entry-gamma"],
    prevCheckpoint: "sha256:abcdef",
    sequence: 2,
  })
}

function storedOrderRoot(input: {
  schema: "chronicle_checkpoint.v0"
  checkpoint_id: string
  collection_ref: string
  entry_refs: string[]
  prev_checkpoint: string | null
  sequence: number
}) {
  return `sha256:${sha256(canonicalize({
    schema: input.schema,
    checkpoint_id: input.checkpoint_id,
    collection_ref: input.collection_ref,
    entry_refs: input.entry_refs,
    prev_checkpoint: input.prev_checkpoint,
    sequence: input.sequence,
  }))}`
}

function analyze(checkpoint: ReturnType<typeof buildBaseline>) {
  const result = verifyChronicleCheckpointV0(checkpoint)
  const canonical = sortEntryRefs(checkpoint.entry_refs)
  const entryRefsAreCanonical =
    checkpoint.entry_refs.length === canonical.length &&
    checkpoint.entry_refs.every((value, index) => value === canonical[index])
  const rootMatches = result.checkpoint_root === result.recomputed_checkpoint_root
  return { result, rootMatches, entryRefsAreCanonical }
}

describe("verifier-challenge-chronicle-checkpoint-local-set-v0 aggregate index", () => {
  test("independent package audit reconstructs aggregate inventory and child references", () => {
    const result = auditPackage()
    expect(result.production_imports).toBe(0)
    expect(result).toEqual(
      JSON.parse(readFileSync(resolve(root, `${pkg}/typescript-audit-output.json`), "utf8")),
    )
  })

  test("frozen child inventory matches declared package digests and conjunction predicate order", () => {
    const contract = JSON.parse(readFileSync(resolve(root, `${pkg}/contract.json`), "utf8"))
    const manifest = JSON.parse(readFileSync(resolve(root, `${pkg}/manifest.json`), "utf8"))
    const children = contract.children

    expect(existsSync(resolve(root, pkg, "vectors"))).toBe(false)
    expect(contract.expected_result_set_sha256).toBeUndefined()

    expect(contract.set_id).toBe("verifier-challenge-chronicle-checkpoint-local-set-v0")
    expect(contract.version).toBe("v0")

    expect(children).toHaveLength(2)
    expect(children.map((child: { challenge_id: string }) => child.challenge_id)).toEqual(
      expectedChildOrder,
    )
    expect(children.map((child: { trust_boundary: string }) => child.trust_boundary)).toEqual(
      expectedTrustBoundaries,
    )
    expect(contract.trust_boundary_mapping).toEqual(expectedTrustBoundaryMapping)

    expect(contract.subject_local_checkpoint_verifier.entrypoint).toBe("verifyChronicleCheckpointV0")
    expect(contract.subject_local_checkpoint_verifier.module_path).toBe(
      "src/receiptos/capsule/chronicle-portfolio-v0.ts",
    )
    expect(gitIndexBlobOid(contract.subject_local_checkpoint_verifier.module_path)).toBe(
      contract.subject_local_checkpoint_verifier.git_blob_oid,
    )
    expect(contract.subject_local_checkpoint_verifier.git_blob_oid).toBe(
      "0e790911092546c62344f980e6b611542bcd00fe",
    )
    expect(gitIndexBlobOid(contract.normative_spec_identity.repository_path)).toBe(
      contract.normative_spec_identity.git_blob_oid,
    )

    for (const [index, child] of children.entries()) {
      expect(child.ordinal).toBe(index + 1)
      expect(child.vector_count).toBe(1)
      expect(child.execution_class).toBe("production-checkpoint-local-binding")
      expect(existsSync(resolve(root, child.package_path))).toBe(true)

      const childManifest = JSON.parse(
        readFileSync(resolve(root, `${child.package_path}/manifest.json`), "utf8"),
      )
      const childContract = JSON.parse(
        readFileSync(resolve(root, `${child.package_path}/contract.json`), "utf8"),
      )

      expect(childManifest.fixture_set_sha256).toBe(child.fixture_set_sha256)
      expect(childContract.expected_result_set_sha256).toBe(child.expected_result_set_sha256)
    }

    expect(contract.aggregate.child_count).toBe(2)
    expect(contract.aggregate.vector_count).toBe(0)
    expect(contract.aggregate.child_vector_count).toBe(2)
    expect(contract.aggregate.execution_class_counts).toEqual({
      "production-checkpoint-local-binding": 2,
    })
    expect(manifest.aggregate_vector_count).toBe(0)
    expect(manifest.child_vector_count).toBe(2)

    const identityHash = childIdentitySetSha256(children)
    expect(identityHash).toBe(expectedChildIdentitySetSha256)
    expect(identityHash).toBe(contract.aggregate.child_identity_set_sha256)
    expect(identityHash).toBe(manifest.child_identity_set_sha256)
  })

  test("pinned verifyChronicleCheckpointV0 surface matches the two frozen predicate children", () => {
    const baseline = buildBaseline()
    const positive = analyze(baseline)
    expect(positive.rootMatches).toBe(true)
    expect(positive.entryRefsAreCanonical).toBe(true)
    expect(positive.result.ok).toBe(true)

    const rootOnlyFailure = analyze({
      ...baseline,
      checkpoint_root: `sha256:${"f".repeat(64)}`,
    })
    expect(rootOnlyFailure.rootMatches).toBe(false)
    expect(rootOnlyFailure.entryRefsAreCanonical).toBe(true)
    expect(rootOnlyFailure.result.ok).toBe(false)

    const noncanonicalRefs = ["entry-gamma", "entry-alpha", "entry-beta"]
    const canonicalOrderFailure = analyze({
      ...baseline,
      entry_refs: noncanonicalRefs,
      checkpoint_root: storedOrderRoot({ ...baseline, entry_refs: noncanonicalRefs }),
    })
    expect(canonicalOrderFailure.rootMatches).toBe(true)
    expect(canonicalOrderFailure.entryRefsAreCanonical).toBe(false)
    expect(canonicalOrderFailure.result.ok).toBe(false)
  })
})
