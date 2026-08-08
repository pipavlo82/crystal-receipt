import { describe, expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { readFileSync, readdirSync } from "node:fs"
import { resolve } from "node:path"
import { auditPackage } from "../../conformance/counterfactual-audit-boundary-v0/audit_package"
import { canonicalize } from "../../src/receiptos/canon/canonicalize"
import {
  computeCounterfactualManifestFileSha256,
  snapshotCounterfactualSemanticJson,
} from "../../src/receiptos/challenge/counterfactual-audit-boundary"

const root = resolve(import.meta.dir, "../..")
const pkg = "conformance/counterfactual-audit-boundary-v0"
const vectorDir = resolve(root, `${pkg}/vectors`)
const vectorIds = readdirSync(vectorDir)
  .filter((name) => name.startsWith("V-") && name.endsWith(".json"))
  .map((name) => name.slice(0, -5))
  .sort()
const vectors = Object.fromEntries(
  vectorIds.map((id) => [id, JSON.parse(readFileSync(resolve(vectorDir, `${id}.json`), "utf8"))]),
)

const semanticArtifact = {
  challenge_id: "observed_not_validated",
  profile_id: "counterfactual-review-v0",
  expected_conformance_observation: "preserve semantic non-elevation",
}

function reviewManifest(auditTimestamp?: string) {
  return {
    semantic_artifact: structuredClone(semanticArtifact),
    ...(auditTimestamp === undefined ? {} : { audit_timestamp: auditTimestamp }),
  }
}

function capturedError(run: () => unknown): string {
  try {
    run()
  } catch (error) {
    if (error instanceof Error) return error.message
    return String(error)
  }
  throw new Error("expected operation to reject")
}

function buildRuntimeInput(construction: Record<string, unknown>): unknown {
  if (construction.kind === "changing_accessor_trap") {
    let reads = 0
    return Object.defineProperty({}, String(construction.property), {
      enumerable: true,
      get() {
        reads += 1
        return reads === 1 ? construction.first_value : construction.second_value
      },
    })
  }
  if (construction.kind === "post_snapshot_mutation") {
    return structuredClone(construction.initial)
  }
  throw new Error(`unsupported runtime construction: ${String(construction.kind)}`)
}

function applyMutations(input: Record<string, unknown>, mutations: Record<string, unknown>[]) {
  for (const mutation of mutations) {
    if ("set" in mutation) {
      let current: Record<string, unknown> = input
      const path = mutation.set as string[]
      for (const segment of path.slice(0, -1)) current = current[segment] as Record<string, unknown>
      current[path[path.length - 1]] = mutation.value
    } else if ("append" in mutation) {
      const path = mutation.append as string[]
      let current: unknown = input
      for (const segment of path) current = (current as Record<string, unknown>)[segment]
      ;(current as unknown[]).push(mutation.value)
    }
  }
}

describe("counterfactual-audit-boundary-v0 package", () => {
  test("independent package audit reconstructs inventory and expected-result digests", () => {
    const result = auditPackage()
    expect(result.production_imports).toBe(0)
    expect(result).toEqual(JSON.parse(readFileSync(resolve(root, `${pkg}/typescript-audit-output.json`), "utf8")))
  })

  test("every frozen vector is exercised against production boundary helpers", () => {
    for (const id of vectorIds) {
      const vector = vectors[id]
      if (vector.operation === "semantic_snapshot") {
        if (vector.runtime_construction?.kind === "changing_accessor_trap") {
          let reads = 0
          const input = Object.defineProperty({}, String(vector.runtime_construction.property), {
            enumerable: true,
            get() {
              reads += 1
              return reads === 1
                ? vector.runtime_construction.first_value
                : vector.runtime_construction.second_value
            },
          })
          expect(() => snapshotCounterfactualSemanticJson(input)).toThrow(
            vector.expected.error_message_contains,
          )
          expect(reads).toBe(vector.expected.property_get_invocation_count ?? 0)
          continue
        }
        if (vector.runtime_construction?.kind === "post_snapshot_mutation") {
          const input = structuredClone(vector.runtime_construction.initial) as Record<string, unknown>
          const snapshot = snapshotCounterfactualSemanticJson(input)
          const before = canonicalize(snapshot)
          applyMutations(input, vector.runtime_construction.mutations as Record<string, unknown>[])
          expect(canonicalize(snapshot)).toBe(before)
          expect(canonicalize(snapshot)).toBe(vector.expected.canonical_snapshot_json)
          expect(canonicalize(snapshot)).not.toContain(vector.expected.canonical_excludes)
          continue
        }
        if (vector.input_variants) {
          const messages = vector.input_variants.map((variant: unknown) =>
            capturedError(() => snapshotCounterfactualSemanticJson(variant)),
          )
          expect(new Set(messages).size).toBe(1)
          expect(messages[0]).toContain(vector.expected.error_path)
          expect(messages[0]).toContain(vector.expected.error_message_contains)
          continue
        }
        if (vector.manifest_variants) {
          const canonicals = vector.manifest_variants.map(() =>
            canonicalize(snapshotCounterfactualSemanticJson(vector.semantic_artifact)),
          )
          expect(new Set(canonicals).size).toBe(1)
          expect(canonicals[0]).toBe(vector.expected.canonical_snapshot_json)
          continue
        }
        if (vector.baseline_semantic_artifact) {
          const base = canonicalize(snapshotCounterfactualSemanticJson(vector.baseline_semantic_artifact))
          const mutated = canonicalize(snapshotCounterfactualSemanticJson(vector.mutated_semantic_artifact))
          expect(base).not.toBe(mutated)
          continue
        }
        expect(() => snapshotCounterfactualSemanticJson(vector.input)).toThrow(vector.expected.error_path)
        expect(capturedError(() => snapshotCounterfactualSemanticJson(vector.input))).toContain(
          vector.expected.error_message_contains,
        )
        continue
      }
      if (vector.operation === "manifest_file_sha256") {
        const hashes = vector.inputs.map((input: Record<string, unknown>) => {
          if (input.encoding === "utf8_string") return computeCounterfactualManifestFileSha256(String(input.value))
          if (input.bytes) return computeCounterfactualManifestFileSha256(Uint8Array.from(input.bytes as number[]))
          return computeCounterfactualManifestFileSha256(
            new TextEncoder().encode(String(input.utf8_bytes_of)),
          )
        })
        if (vector.expected.outcome === "manifest_hash_differs") expect(hashes[0]).not.toBe(hashes[1])
        if (vector.expected.outcome === "manifest_hash_equals") expect(hashes[0]).toBe(hashes[1])
        if (vector.expected.outcome === "manifest_hash_value") expect(hashes[0]).toBe(vector.expected.sha256_hex)
      }
    }
  })

  test("manifest review helper remains aligned with V-MAN-HASH-DIFF bytes", () => {
    const earlier = `${JSON.stringify(reviewManifest("2026-07-27T12:00:00Z"), null, 2)}\n`
    const later = `${JSON.stringify(reviewManifest("2026-08-05T12:00:00Z"), null, 2)}\n`
    expect(computeCounterfactualManifestFileSha256(earlier)).not.toBe(
      computeCounterfactualManifestFileSha256(later),
    )
  })

  test("uint8 oracle remains aligned with production helper", () => {
    const bytes = new Uint8Array([0x00, 0xff, 0x01, 0x80, 0x0a])
    const oracle = createHash("sha256").update(bytes).digest("hex")
    expect(computeCounterfactualManifestFileSha256(bytes)).toBe(oracle)
    expect(oracle).toBe(vectors["V-MAN-UINT8-EXACT"].expected.sha256_hex)
  })
})
