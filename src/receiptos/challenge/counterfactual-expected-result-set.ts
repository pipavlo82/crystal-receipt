/**
 * Expected-result-set identity and membership binding v0 (Lane G).
 *
 * Reuses the exact leaf-package auditor recipe already committed in each
 * conformance package's audit_package.ts / SPEC:
 *
 *   member = SHA256(UTF-8(canonical_json(vector.expected)))  // lowercase hex
 *   row    = `${vector_id}\t${member}\n`
 *   set    = SHA256(UTF-8(sorted_rows_concatenated))         // lowercase hex
 *
 * Authority is a closed, version-pinned package registry. Caller-supplied
 * digests and arbitrary package paths are never trusted.
 */

import { createHash } from "node:crypto"
import { readdirSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import type { VerifierChallengeVectorModelV0 } from "./verifier-challenge-model"

export const EXPECTED_RESULT_SET_BINDING_SCHEMA =
  "receiptos.expected_result_set_binding.v0" as const

export type ExpectedResultSetBindingSchema = typeof EXPECTED_RESULT_SET_BINDING_SCHEMA

export type ExpectedResultSetBindingReasonV0 =
  | "unknown_package_authority"
  | "contract_digest_mismatch"
  | "complete_set_digest_mismatch"
  | "vector_missing"
  | "vector_duplicate"
  | "inventory_mismatch"
  | "expected_content_mismatch"
  | "non_canonical_expected"
  | "package_materialization_failure"

export class ExpectedResultSetBindingError extends Error {
  readonly code = "expected_result_set_binding_error" as const
  readonly reason: ExpectedResultSetBindingReasonV0

  constructor(reason: ExpectedResultSetBindingReasonV0) {
    super("expected result set binding failed")
    this.name = "ExpectedResultSetBindingError"
    this.reason = reason
  }
}

export type AuthenticatedExpectedResultSetBindingV0 = {
  readonly schema: ExpectedResultSetBindingSchema
  readonly package_version: string
  readonly vector_id: string
  readonly expected_result_set_sha256: string
  readonly membership: "complete_set_member"
}

type PackageAuthorityV0 = {
  readonly package_dir: string
  readonly expected_result_set_sha256: string
}

/**
 * Immutable closed authority for every currently supported counterfactual
 * leaf package that commits expected_result_set_sha256.
 */
const PACKAGE_AUTHORITIES: Readonly<Record<string, PackageAuthorityV0>> = Object.freeze({
  "counterfactual-audit-boundary-v0": Object.freeze({
    package_dir: "conformance/counterfactual-audit-boundary-v0",
    expected_result_set_sha256:
      "db664c5e8da2f0fb6d1d94a036eab572ae2941ffeb5193624365d4bdbaeec24a",
  }),
  "verifier-challenge-observed-not-validated-v0": Object.freeze({
    package_dir: "conformance/verifier-challenge-observed-not-validated-v0",
    expected_result_set_sha256:
      "0979570c534e3808ac3d5a951902564e33b1a58f3263f1da45ceb344d0e85514",
  }),
  "verifier-challenge-missing-required-input-unverifiable-v0": Object.freeze({
    package_dir: "conformance/verifier-challenge-missing-required-input-unverifiable-v0",
    expected_result_set_sha256:
      "7e32bc856b317574d38c8d036c5a352bb83b4f2a04c00ed4e52de53b378a2184",
  }),
  "verifier-challenge-integrity-mismatch-rejected-v0": Object.freeze({
    package_dir: "conformance/verifier-challenge-integrity-mismatch-rejected-v0",
    expected_result_set_sha256:
      "b755108edac9dc607b7b6b7f30d845f381cac13100194741a451b1c7cb7162a5",
  }),
  "verifier-challenge-chronicle-proof-root-mismatch-rejected-v0": Object.freeze({
    package_dir: "conformance/verifier-challenge-chronicle-proof-root-mismatch-rejected-v0",
    expected_result_set_sha256:
      "d04a66073a965d19e380beed8426a3cfdccff11ce720244c4d0f5eb6f2a7bf08",
  }),
  "verifier-challenge-chronicle-proof-object-id-invalid-rejected-v0": Object.freeze({
    package_dir: "conformance/verifier-challenge-chronicle-proof-object-id-invalid-rejected-v0",
    expected_result_set_sha256:
      "273d04333671345e7c30ea4bd78d668157edf9605d61fe0a4d092c33f64ab1a6",
  }),
  "verifier-challenge-chronicle-capsule-label-inconsistent-rejected-v0": Object.freeze({
    package_dir: "conformance/verifier-challenge-chronicle-capsule-label-inconsistent-rejected-v0",
    expected_result_set_sha256:
      "a0560da2071f483b76bcc8aee3b5c543ae87ef57093a67ff2a18b485be512cc3",
  }),
  "verifier-challenge-chronicle-predecessor-unknown-unverifiable-v0": Object.freeze({
    package_dir: "conformance/verifier-challenge-chronicle-predecessor-unknown-unverifiable-v0",
    expected_result_set_sha256:
      "772efdfc67d8d018c5d0b3ab8b7ec45f44266b9c44e55b77a4215a4230779e93",
  }),
  "verifier-challenge-chronicle-predecessor-ref-mismatch-rejected-v0": Object.freeze({
    package_dir: "conformance/verifier-challenge-chronicle-predecessor-ref-mismatch-rejected-v0",
    expected_result_set_sha256:
      "a7108e666496a9d32bc0b2e490bddf5a1df51ffd5d04263321ee907c880298b9",
  }),
  "verifier-challenge-chronicle-sequence-gap-rejected-v0": Object.freeze({
    package_dir: "conformance/verifier-challenge-chronicle-sequence-gap-rejected-v0",
    expected_result_set_sha256:
      "0484c8dde064a5002d07243bb7fdc964e8c680756db14ac65a794eeab8788bce",
  }),
  "verifier-challenge-chronicle-checkpoint-root-mismatch-rejected-v0": Object.freeze({
    package_dir: "conformance/verifier-challenge-chronicle-checkpoint-root-mismatch-rejected-v0",
    expected_result_set_sha256:
      "4fe0a2cac4d3c23f233274e5b23a15eb7b9689e3b0e75719588fc41873d8de7d",
  }),
  "verifier-challenge-chronicle-checkpoint-entry-refs-noncanonical-rejected-v0": Object.freeze({
    package_dir: "conformance/verifier-challenge-chronicle-checkpoint-entry-refs-noncanonical-rejected-v0",
    expected_result_set_sha256:
      "b1d56d206b71790b0f0d53f9c3d38844855125638ec932a30706c67ba40c3964",
  }),
})

const MODULE_DIR = dirname(fileURLToPath(import.meta.url))
const REPOSITORY_ROOT = resolve(MODULE_DIR, "../../..")

function sha256Utf8Hex(text: string): string {
  return createHash("sha256").update(Buffer.from(text, "utf8")).digest("hex")
}

/**
 * Exact auditor canonical JSON for expected payloads.
 * Unsupported host values fail before hashing.
 */
export function canonicalExpectedJson(value: unknown): string {
  if (value === null) return "null"
  if (value === true) return "true"
  if (value === false) return "false"
  if (typeof value === "string") return JSON.stringify(value)
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new ExpectedResultSetBindingError("non_canonical_expected")
    }
    return String(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalExpectedJson(item)).join(",")}]`
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>
    const keys = Object.keys(record).sort()
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalExpectedJson(record[key])}`).join(",")}}`
  }
  throw new ExpectedResultSetBindingError("non_canonical_expected")
}

export function computeExpectedMemberDigest(expected: unknown): string {
  return sha256Utf8Hex(canonicalExpectedJson(expected))
}

/**
 * Compute complete expected-result-set digest from ordered members.
 * Caller must supply unique vector IDs; duplicates fail closed.
 */
export function computeExpectedResultSetSha256(
  members: ReadonlyArray<{ readonly vector_id: string; readonly expected: unknown }>,
): string {
  const seen = new Set<string>()
  const rows: string[] = []
  const sorted = [...members].sort((a, b) => {
    if (a.vector_id < b.vector_id) return -1
    if (a.vector_id > b.vector_id) return 1
    return 0
  })
  for (const member of sorted) {
    if (seen.has(member.vector_id)) {
      throw new ExpectedResultSetBindingError("vector_duplicate")
    }
    seen.add(member.vector_id)
    rows.push(`${member.vector_id}\t${computeExpectedMemberDigest(member.expected)}\n`)
  }
  return sha256Utf8Hex(rows.join(""))
}

function readJsonFile(absolutePath: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(readFileSync(absolutePath, "utf8"))
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new ExpectedResultSetBindingError("package_materialization_failure")
    }
    return parsed as Record<string, unknown>
  } catch (error) {
    if (error instanceof ExpectedResultSetBindingError) throw error
    throw new ExpectedResultSetBindingError("package_materialization_failure")
  }
}

function loadPackageMembers(authority: PackageAuthorityV0): {
  readonly members: Array<{ vector_id: string; expected: unknown }>
  readonly inventory: string[] | null
  readonly contractDigest: string
} {
  const packageRoot = resolve(REPOSITORY_ROOT, authority.package_dir)
  const contract = readJsonFile(resolve(packageRoot, "contract.json"))
  const contractDigest = contract.expected_result_set_sha256
  if (typeof contractDigest !== "string" || contractDigest.length === 0) {
    throw new ExpectedResultSetBindingError("package_materialization_failure")
  }
  if (contractDigest !== authority.expected_result_set_sha256) {
    throw new ExpectedResultSetBindingError("contract_digest_mismatch")
  }

  const inventory = Array.isArray(contract.vector_inventory)
    ? contract.vector_inventory.map((id) => {
        if (typeof id !== "string" || id.length === 0) {
          throw new ExpectedResultSetBindingError("package_materialization_failure")
        }
        return id
      })
    : null

  const vectorsDir = resolve(packageRoot, "vectors")
  let names: string[]
  try {
    names = readdirSync(vectorsDir)
      .filter((name) => name.startsWith("V-") && name.endsWith(".json"))
      .map((name) => name.slice(0, -5))
      .sort()
  } catch {
    throw new ExpectedResultSetBindingError("package_materialization_failure")
  }

  if (inventory !== null) {
    const inventorySorted = [...inventory].sort()
    if (inventorySorted.length !== names.length) {
      throw new ExpectedResultSetBindingError("inventory_mismatch")
    }
    for (let i = 0; i < inventorySorted.length; i += 1) {
      if (inventorySorted[i] !== names[i]) {
        throw new ExpectedResultSetBindingError("inventory_mismatch")
      }
    }
  }

  const seen = new Set<string>()
  const members: Array<{ vector_id: string; expected: unknown }> = []
  for (const vectorId of names) {
    if (seen.has(vectorId)) {
      throw new ExpectedResultSetBindingError("vector_duplicate")
    }
    seen.add(vectorId)
    const vector = readJsonFile(resolve(vectorsDir, `${vectorId}.json`))
    if (vector.vector_id !== vectorId) {
      throw new ExpectedResultSetBindingError("inventory_mismatch")
    }
    if (!Object.prototype.hasOwnProperty.call(vector, "expected")) {
      throw new ExpectedResultSetBindingError("package_materialization_failure")
    }
    members.push({ vector_id: vectorId, expected: vector.expected })
  }
  return { members, inventory, contractDigest }
}

/**
 * Authenticate lane_a_model.expected as a complete-set member of the frozen
 * package authority identified by model.package_version / model.vector_id.
 *
 * Does not mutate model. Does not trust request-supplied digests.
 */
export function bindExpectedResultSet(
  model: VerifierChallengeVectorModelV0,
): AuthenticatedExpectedResultSetBindingV0 {
  const authority = PACKAGE_AUTHORITIES[model.package_version]
  if (authority === undefined) {
    throw new ExpectedResultSetBindingError("unknown_package_authority")
  }

  const { members, contractDigest } = loadPackageMembers(authority)
  const recomputed = computeExpectedResultSetSha256(members)
  if (recomputed !== authority.expected_result_set_sha256 || recomputed !== contractDigest) {
    throw new ExpectedResultSetBindingError("complete_set_digest_mismatch")
  }

  const matches = members.filter((member) => member.vector_id === model.vector_id)
  if (matches.length === 0) {
    throw new ExpectedResultSetBindingError("vector_missing")
  }
  if (matches.length !== 1) {
    throw new ExpectedResultSetBindingError("vector_duplicate")
  }

  let packageExpectedCanonical: string
  let modelExpectedCanonical: string
  try {
    packageExpectedCanonical = canonicalExpectedJson(matches[0]!.expected)
    modelExpectedCanonical = canonicalExpectedJson(model.expected)
  } catch (error) {
    if (error instanceof ExpectedResultSetBindingError) throw error
    throw new ExpectedResultSetBindingError("non_canonical_expected")
  }
  if (packageExpectedCanonical !== modelExpectedCanonical) {
    throw new ExpectedResultSetBindingError("expected_content_mismatch")
  }

  return Object.freeze({
    schema: EXPECTED_RESULT_SET_BINDING_SCHEMA,
    package_version: model.package_version,
    vector_id: model.vector_id,
    expected_result_set_sha256: authority.expected_result_set_sha256,
    membership: "complete_set_member",
  })
}

/** Test/audit helper: list closed authority package versions. */
export function listExpectedResultSetAuthorityPackages(): readonly string[] {
  return Object.freeze(Object.keys(PACKAGE_AUTHORITIES).sort())
}

/** Test/audit helper: pinned digest for a closed authority package. */
export function getExpectedResultSetAuthorityDigest(packageVersion: string): string | null {
  return PACKAGE_AUTHORITIES[packageVersion]?.expected_result_set_sha256 ?? null
}
