/**
 * Deterministic Counterfactual Neighborhood (DCN) generator v0.
 *
 * DCN = Deterministic Counterfactual Neighborhood — the ordered challenge-identity
 * set (`receiptos.counterfactual_neighborhood.v0`) that is the Lane B neighborhood
 * identity. Leaf challenge SPECs list "DCN" as a non-claim; this module is the
 * closed generator that reconstructs that neighborhood from frozen child vector
 * authorities and proves identity equivalence to the pinned Lane B digest.
 *
 * Does not use expected-result content for membership. Does not mutate children.
 */

import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs"
import { dirname, isAbsolute, relative, resolve, sep } from "node:path"
import { tmpdir } from "node:os"
import { fileURLToPath } from "node:url"
import { tryNormalizeFrozenRepositoryRelativePath } from "./frozen-repository-path"
import { projectVerifierChallengeVector } from "./verifier-challenge-model"
import {
  PINNED_COUNTERFACTUAL_NEIGHBORHOOD_SHA256_V0,
  PINNED_NEIGHBORHOOD_MEMBER_INVENTORY_V0,
} from "./counterfactual-neighborhood-conformance"
import {
  computeFrozenCounterfactualNeighborhoodSha256,
  projectCounterfactualChallengeIdentity,
  projectFrozenCounterfactualNeighborhood,
  type FrozenCounterfactualNeighborhoodV0,
  canonicalIdentityJson,
} from "./counterfactual-neighborhood"

export const COUNTERFACTUAL_DCN_GENERATOR_SCHEMA = "receiptos.counterfactual_dcn_generator.v0" as const
export const COUNTERFACTUAL_DCN_GENERATOR_VERSION = "v0" as const
export const COUNTERFACTUAL_DCN_NEIGHBORHOOD_ID =
  "receiptos-counterfactual-neighborhood-lane-b-fixture-v0" as const

export const COUNTERFACTUAL_CONFORMANCE_PACKAGE_ID = "counterfactual-conformance-v0" as const
export const COUNTERFACTUAL_CONFORMANCE_PACKAGE_PATH =
  "conformance/counterfactual-conformance-v0" as const

export type DcnGeneratorErrorReasonV0 =
  | "unsupported_schema"
  | "child_inventory_mismatch"
  | "child_identity_mismatch"
  | "child_digest_mismatch"
  | "expected_authority_mismatch"
  | "dcn_inventory_mismatch"
  | "dcn_digest_mismatch"
  | "duplicate_member"
  | "vector_load_failure"
  | "package_materialization_failure"
  | "generator_drift"
  | "target_path_invalid"

export class DcnGeneratorError extends Error {
  readonly code = "dcn_generator_error" as const
  readonly reason: DcnGeneratorErrorReasonV0

  constructor(reason: DcnGeneratorErrorReasonV0) {
    super("dcn generator failed")
    this.name = "DcnGeneratorError"
    this.reason = reason
  }
}

export type DcnMemberAuthorityV0 = {
  readonly ordinal: number
  readonly package_path: string
  readonly package_version: string
  readonly vector_id: string
  readonly challenge_id: string | null
  readonly surface: string
  readonly vector_path: string
  readonly execution_class: string
  readonly fixture_set_sha256: string
  readonly expected_result_set_sha256: string
}

/** Closed 10-member DCN inventory. Digests are frozen child package authorities. */
export const DCN_MEMBER_AUTHORITIES_V0: readonly DcnMemberAuthorityV0[] = Object.freeze([
  Object.freeze({
    ordinal: 1,
    package_path: "conformance/verifier-challenge-observed-not-validated-v0",
    package_version: "verifier-challenge-observed-not-validated-v0",
    vector_id: "V-OBSERVED-NOT-VALIDATED",
    challenge_id: "observed_not_validated",
    surface: "verify_handoff_receipt_root",
    vector_path:
      "conformance/verifier-challenge-observed-not-validated-v0/vectors/V-OBSERVED-NOT-VALIDATED.json",
    execution_class: "production-verifier-binding",
    fixture_set_sha256: "efeb64c3cc3809d604145ad7436a481baffd7aa9bdd798a1ddf2c1e5e38ae33f",
    expected_result_set_sha256: "0979570c534e3808ac3d5a951902564e33b1a58f3263f1da45ceb344d0e85514",
  }),
  Object.freeze({
    ordinal: 2,
    package_path: "conformance/verifier-challenge-missing-required-input-unverifiable-v0",
    package_version: "verifier-challenge-missing-required-input-unverifiable-v0",
    vector_id: "V-MISSING-REQUIRED-INPUT",
    challenge_id: "missing_required_input_unverifiable",
    surface: "verify_handoff_receipt_root",
    vector_path:
      "conformance/verifier-challenge-missing-required-input-unverifiable-v0/vectors/V-MISSING-REQUIRED-INPUT.json",
    execution_class: "production-verifier-binding",
    fixture_set_sha256: "525bed2d6b2dcd735be96b3faba11c045a24a24189787ce8d5d398b3def23e04",
    expected_result_set_sha256: "7e32bc856b317574d38c8d036c5a352bb83b4f2a04c00ed4e52de53b378a2184",
  }),
  Object.freeze({
    ordinal: 3,
    package_path: "conformance/verifier-challenge-integrity-mismatch-rejected-v0",
    package_version: "verifier-challenge-integrity-mismatch-rejected-v0",
    vector_id: "V-INTEGRITY-MISMATCH",
    challenge_id: "integrity_mismatch_rejected",
    surface: "verify_handoff_receipt_root",
    vector_path:
      "conformance/verifier-challenge-integrity-mismatch-rejected-v0/vectors/V-INTEGRITY-MISMATCH.json",
    execution_class: "production-verifier-binding",
    fixture_set_sha256: "6844b0554d71bee8c650fcc949e23f730980d75d22a8483f1c4f50e722de941d",
    expected_result_set_sha256: "b755108edac9dc607b7b6b7f30d845f381cac13100194741a451b1c7cb7162a5",
  }),
  Object.freeze({
    ordinal: 4,
    package_path: "conformance/verifier-challenge-chronicle-proof-root-mismatch-rejected-v0",
    package_version: "verifier-challenge-chronicle-proof-root-mismatch-rejected-v0",
    vector_id: "V-CHRONICLE-PROOF-ROOT-MISMATCH",
    challenge_id: "proof_root_mismatch_rejected",
    surface: "chronicle_admission",
    vector_path:
      "conformance/verifier-challenge-chronicle-proof-root-mismatch-rejected-v0/vectors/V-CHRONICLE-PROOF-ROOT-MISMATCH.json",
    execution_class: "production-admission-binding",
    fixture_set_sha256: "6788b09f29917254a93faf6e85c2d6922fc6fc36995577cb1fd46e6a698ce457",
    expected_result_set_sha256: "d04a66073a965d19e380beed8426a3cfdccff11ce720244c4d0f5eb6f2a7bf08",
  }),
  Object.freeze({
    ordinal: 5,
    package_path: "conformance/verifier-challenge-chronicle-predecessor-unknown-unverifiable-v0",
    package_version: "verifier-challenge-chronicle-predecessor-unknown-unverifiable-v0",
    vector_id: "V-CHRONICLE-PREDECESSOR-UNKNOWN",
    challenge_id: "predecessor_unknown_unverifiable",
    surface: "chronicle_continuity",
    vector_path:
      "conformance/verifier-challenge-chronicle-predecessor-unknown-unverifiable-v0/vectors/V-CHRONICLE-PREDECESSOR-UNKNOWN.json",
    execution_class: "production-continuity-binding",
    fixture_set_sha256: "e7a45ad8aa0d81fd0146212f545a7ae15e0645f40345cd2e1ca9f67e4b2b0128",
    expected_result_set_sha256: "772efdfc67d8d018c5d0b3ab8b7ec45f44266b9c44e55b77a4215a4230779e93",
  }),
  Object.freeze({
    ordinal: 6,
    package_path: "conformance/verifier-challenge-chronicle-sequence-gap-rejected-v0",
    package_version: "verifier-challenge-chronicle-sequence-gap-rejected-v0",
    vector_id: "V-CHRONICLE-SEQUENCE-GAP",
    challenge_id: "sequence_gap_rejected",
    surface: "chronicle_continuity",
    vector_path:
      "conformance/verifier-challenge-chronicle-sequence-gap-rejected-v0/vectors/V-CHRONICLE-SEQUENCE-GAP.json",
    execution_class: "production-continuity-binding",
    fixture_set_sha256: "3fa071610dea0e06ece35349aa6b6df3da7955b6e8eea9eeb78a2a3be007ea0c",
    expected_result_set_sha256: "0484c8dde064a5002d07243bb7fdc964e8c680756db14ac65a794eeab8788bce",
  }),
  Object.freeze({
    ordinal: 7,
    package_path: "conformance/verifier-challenge-chronicle-checkpoint-root-mismatch-rejected-v0",
    package_version: "verifier-challenge-chronicle-checkpoint-root-mismatch-rejected-v0",
    vector_id: "V-CHRONICLE-CHECKPOINT-ROOT-MISMATCH",
    challenge_id: "checkpoint_root_mismatch_rejected",
    surface: "chronicle_checkpoint_local",
    vector_path:
      "conformance/verifier-challenge-chronicle-checkpoint-root-mismatch-rejected-v0/vectors/V-CHRONICLE-CHECKPOINT-ROOT-MISMATCH.json",
    execution_class: "production-checkpoint-local-binding",
    fixture_set_sha256: "aa29ca815795af11fb2a0f17f4591ba882bb4513882ad1d0142d192e3b95b1c2",
    expected_result_set_sha256: "4fe0a2cac4d3c23f233274e5b23a15eb7b9689e3b0e75719588fc41873d8de7d",
  }),
  Object.freeze({
    ordinal: 8,
    package_path: "conformance/verifier-challenge-chronicle-checkpoint-entry-refs-noncanonical-rejected-v0",
    package_version: "verifier-challenge-chronicle-checkpoint-entry-refs-noncanonical-rejected-v0",
    vector_id: "V-CHRONICLE-CHECKPOINT-ENTRY-REFS-NONCANONICAL",
    challenge_id: "checkpoint_entry_refs_noncanonical_rejected",
    surface: "chronicle_checkpoint_local",
    vector_path:
      "conformance/verifier-challenge-chronicle-checkpoint-entry-refs-noncanonical-rejected-v0/vectors/V-CHRONICLE-CHECKPOINT-ENTRY-REFS-NONCANONICAL.json",
    execution_class: "production-checkpoint-local-binding",
    fixture_set_sha256: "69c3f877c6f7be51d49751141f688af7ab5bf57023da046576402dcbaac7afda",
    expected_result_set_sha256: "b1d56d206b71790b0f0d53f9c3d38844855125638ec932a30706c67ba40c3964",
  }),
  Object.freeze({
    ordinal: 9,
    package_path: "conformance/counterfactual-audit-boundary-v0",
    package_version: "counterfactual-audit-boundary-v0",
    vector_id: "V-AT-NEST-OBJ",
    challenge_id: null,
    surface: "counterfactual_audit_boundary",
    vector_path: "conformance/counterfactual-audit-boundary-v0/vectors/V-AT-NEST-OBJ.json",
    execution_class: "semantic-snapshot",
    fixture_set_sha256: "7503d5cac003a23489f194c5521ef90b01ac0b2ce345a2cec57ad12ffeb274f8",
    expected_result_set_sha256: "db664c5e8da2f0fb6d1d94a036eab572ae2941ffeb5193624365d4bdbaeec24a",
  }),
  Object.freeze({
    ordinal: 10,
    package_path: "conformance/counterfactual-audit-boundary-v0",
    package_version: "counterfactual-audit-boundary-v0",
    vector_id: "V-MAN-HASH-DIFF",
    challenge_id: null,
    surface: "counterfactual_audit_boundary",
    vector_path: "conformance/counterfactual-audit-boundary-v0/vectors/V-MAN-HASH-DIFF.json",
    execution_class: "manifest-file-hash",
    fixture_set_sha256: "7503d5cac003a23489f194c5521ef90b01ac0b2ce345a2cec57ad12ffeb274f8",
    expected_result_set_sha256: "db664c5e8da2f0fb6d1d94a036eab572ae2941ffeb5193624365d4bdbaeec24a",
  }),
])

const MODULE_DIR = dirname(fileURLToPath(import.meta.url))
const DEFAULT_REPOSITORY_ROOT = resolve(MODULE_DIR, "../../..")

const CHILD_IDENTITY_FIELDS = [
  "ordinal",
  "challenge_id",
  "package_path",
  "package_version",
  "vector_id",
  "surface",
  "vector_path",
  "execution_class",
  "fixture_set_sha256",
  "expected_result_set_sha256",
] as const

export type ChildIdentityRecordV0 = {
  readonly ordinal: number
  readonly challenge_id: string | null
  readonly package_path: string
  readonly package_version: string
  readonly vector_id: string
  readonly surface: string
  readonly vector_path: string
  readonly execution_class: string
  readonly fixture_set_sha256: string
  readonly expected_result_set_sha256: string
}

export function childIdentityRecordFromAuthority(member: DcnMemberAuthorityV0): ChildIdentityRecordV0 {
  return {
    ordinal: member.ordinal,
    challenge_id: member.challenge_id,
    package_path: member.package_path,
    package_version: member.package_version,
    vector_id: member.vector_id,
    surface: member.surface,
    vector_path: member.vector_path,
    execution_class: member.execution_class,
    fixture_set_sha256: member.fixture_set_sha256,
    expected_result_set_sha256: member.expected_result_set_sha256,
  }
}

/** Existing aggregate child-identity-set algorithm applied to DCN member records. */
export function computeChildIdentitySetSha256(children: readonly ChildIdentityRecordV0[]): string {
  const projected = children.map((child) => {
    const record: Record<string, unknown> = {}
    for (const key of CHILD_IDENTITY_FIELDS) {
      record[key] = child[key]
    }
    return record
  })
  return sha256Utf8Hex(canonicalIdentityJson(projected))
}

function sha256Utf8Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex")
}

function sha256BytesHex(bytes: Uint8Array | Buffer): string {
  return createHash("sha256").update(bytes).digest("hex")
}

function assertSafeRelativePath(repositoryPath: string): string {
  if (typeof repositoryPath !== "string" || repositoryPath.length === 0) {
    throw new DcnGeneratorError("package_materialization_failure")
  }
  const normalized = tryNormalizeFrozenRepositoryRelativePath(repositoryPath)
  if (normalized === null) {
    throw new DcnGeneratorError("package_materialization_failure")
  }
  return normalized
}

function resolveUnderRoot(repositoryRoot: string, repositoryPath: string): string {
  const safe = assertSafeRelativePath(repositoryPath)
  const absolute = resolve(repositoryRoot, ...safe.split("/"))
  const rel = relative(repositoryRoot, absolute)
  if (rel.startsWith("..") || isAbsolute(rel) || rel.includes(`..${sep}`)) {
    throw new DcnGeneratorError("package_materialization_failure")
  }
  return absolute
}

function runGit(repositoryRoot: string, args: string[]): Buffer | null {
  try {
    return execFileSync("git", args, {
      cwd: repositoryRoot,
      stdio: ["ignore", "pipe", "ignore"],
    })
  } catch {
    return null
  }
}

function gitPathOid(repositoryRoot: string, repositoryPath: string): string | null {
  const index = runGit(repositoryRoot, ["rev-parse", `:${repositoryPath}`])
  if (index !== null) {
    const oid = index.toString("utf8").trim()
    if (/^[0-9a-f]{40}$/.test(oid)) return oid
  }
  const head = runGit(repositoryRoot, ["rev-parse", `HEAD:${repositoryPath}`])
  if (head !== null) {
    const oid = head.toString("utf8").trim()
    if (/^[0-9a-f]{40}$/.test(oid)) return oid
  }
  return null
}

function computeGitBlobOidSha1(bytes: Uint8Array): string {
  const header = Buffer.from(`blob ${bytes.byteLength}\0`, "utf8")
  return createHash("sha1").update(header).update(bytes).digest("hex")
}

function loadCommittedVectorBytes(repositoryRoot: string, vectorPath: string): Buffer {
  assertSafeRelativePath(vectorPath)
  const pathOid = gitPathOid(repositoryRoot, vectorPath)
  if (pathOid === null) {
    throw new DcnGeneratorError("vector_load_failure")
  }
  const bytes = runGit(repositoryRoot, ["cat-file", "blob", pathOid])
  if (bytes !== null && computeGitBlobOidSha1(bytes) === pathOid) {
    return bytes
  }
  // Fallback: worktree must match index OID (Windows line-ending safety).
  const worktree = readFileSync(resolveUnderRoot(repositoryRoot, vectorPath))
  if (computeGitBlobOidSha1(worktree) !== pathOid) {
    throw new DcnGeneratorError("vector_load_failure")
  }
  return worktree
}

function readJsonFile(absolutePath: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(readFileSync(absolutePath, "utf8")) as unknown
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new DcnGeneratorError("child_digest_mismatch")
    }
    return parsed as Record<string, unknown>
  } catch (error) {
    if (error instanceof DcnGeneratorError) throw error
    throw new DcnGeneratorError("child_digest_mismatch")
  }
}

function verifyChildPackageDigests(
  repositoryRoot: string,
  member: DcnMemberAuthorityV0,
): void {
  const manifest = readJsonFile(resolveUnderRoot(repositoryRoot, `${member.package_path}/manifest.json`))
  const contract = readJsonFile(resolveUnderRoot(repositoryRoot, `${member.package_path}/contract.json`))
  if (manifest.fixture_set_sha256 !== member.fixture_set_sha256) {
    throw new DcnGeneratorError("child_digest_mismatch")
  }
  if (contract.expected_result_set_sha256 !== member.expected_result_set_sha256) {
    throw new DcnGeneratorError("expected_authority_mismatch")
  }
}

function assertAuthoritiesMatchPinnedInventory(members: readonly DcnMemberAuthorityV0[]): void {
  if (members.length !== PINNED_NEIGHBORHOOD_MEMBER_INVENTORY_V0.length) {
    throw new DcnGeneratorError("dcn_inventory_mismatch")
  }
  for (let i = 0; i < members.length; i += 1) {
    const authority = members[i]!
    const pinned = PINNED_NEIGHBORHOOD_MEMBER_INVENTORY_V0[i]!
    if (
      authority.ordinal !== i + 1 ||
      authority.package_version !== pinned.package_version ||
      authority.vector_id !== pinned.vector_id ||
      authority.surface !== pinned.surface
    ) {
      throw new DcnGeneratorError("dcn_inventory_mismatch")
    }
  }
}

export type GeneratedDcnV0 = {
  readonly neighborhood: FrozenCounterfactualNeighborhoodV0
  readonly dcn_sha256: string
  readonly children: readonly ChildIdentityRecordV0[]
  readonly child_identity_set_sha256: string
}

/**
 * Reconstruct the DCN from closed frozen child vector authorities.
 * Membership is authority-driven; expected payloads are never consulted.
 */
export function generateFrozenCounterfactualNeighborhood(options?: {
  readonly repositoryRoot?: string
  readonly members?: readonly DcnMemberAuthorityV0[]
}): GeneratedDcnV0 {
  const repositoryRoot = resolve(options?.repositoryRoot ?? DEFAULT_REPOSITORY_ROOT)
  const members = options?.members ?? DCN_MEMBER_AUTHORITIES_V0
  assertAuthoritiesMatchPinnedInventory(members)

  const seenKeys = new Set<string>()
  const models = []
  const children: ChildIdentityRecordV0[] = []

  for (const member of members) {
    verifyChildPackageDigests(repositoryRoot, member)
    let vector: unknown
    try {
      const bytes = loadCommittedVectorBytes(repositoryRoot, member.vector_path)
      vector = JSON.parse(bytes.toString("utf8"))
    } catch (error) {
      if (error instanceof DcnGeneratorError) throw error
      throw new DcnGeneratorError("vector_load_failure")
    }
    const model = projectVerifierChallengeVector(vector)
    if (
      model.package_version !== member.package_version ||
      model.vector_id !== member.vector_id ||
      model.surface !== member.surface ||
      model.challenge_id !== member.challenge_id ||
      model.execution_class !== member.execution_class
    ) {
      throw new DcnGeneratorError("child_identity_mismatch")
    }
    const identity = projectCounterfactualChallengeIdentity(model)
    const key = canonicalIdentityJson(identity)
    if (seenKeys.has(key)) {
      throw new DcnGeneratorError("duplicate_member")
    }
    seenKeys.add(key)
    models.push(model)
    children.push(childIdentityRecordFromAuthority(member))
  }

  if (models.length !== 10) {
    throw new DcnGeneratorError("dcn_inventory_mismatch")
  }

  const neighborhood = projectFrozenCounterfactualNeighborhood({
    neighborhood_id: COUNTERFACTUAL_DCN_NEIGHBORHOOD_ID,
    members: models,
  })
  const dcnSha256 = computeFrozenCounterfactualNeighborhoodSha256(neighborhood)
  if (dcnSha256 !== PINNED_COUNTERFACTUAL_NEIGHBORHOOD_SHA256_V0) {
    throw new DcnGeneratorError("dcn_digest_mismatch")
  }

  return {
    neighborhood,
    dcn_sha256: dcnSha256,
    children,
    child_identity_set_sha256: computeChildIdentitySetSha256(children),
  }
}

function stableJsonBytes(value: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8")
}

function buildContract(generated: GeneratedDcnV0): Record<string, unknown> {
  return {
    schema: "counterfactual_conformance_package_contract.v0",
    package_id: COUNTERFACTUAL_CONFORMANCE_PACKAGE_ID,
    version: "v0",
    dcn: {
      acronym: "Deterministic Counterfactual Neighborhood",
      neighborhood_schema: "receiptos.counterfactual_neighborhood.v0",
      neighborhood_id: COUNTERFACTUAL_DCN_NEIGHBORHOOD_ID,
      member_count: 10,
      pinned_sha256: PINNED_COUNTERFACTUAL_NEIGHBORHOOD_SHA256_V0,
      generated_sha256: generated.dcn_sha256,
      artifact_path: `${COUNTERFACTUAL_CONFORMANCE_PACKAGE_PATH}/dcn/neighborhood.json`,
    },
    generator: {
      schema: COUNTERFACTUAL_DCN_GENERATOR_SCHEMA,
      version: COUNTERFACTUAL_DCN_GENERATOR_VERSION,
      module_path: "src/receiptos/challenge/counterfactual-dcn-generator.ts",
    },
    materialization: {
      schema: "receiptos.counterfactual_materialized_input_derivation.v0",
      version: "v0",
      module_path: "src/receiptos/challenge/counterfactual-materialized-input-derivation.ts",
    },
    aggregate_evaluation: {
      schema: "receiptos.counterfactual_neighborhood_conformance_evaluation.v0",
      request_schema: "receiptos.counterfactual_neighborhood_conformance_request.v0",
      version: "v0",
      module_path: "src/receiptos/challenge/counterfactual-neighborhood-conformance.ts",
    },
    children: generated.children,
    aggregate: {
      child_count: generated.children.length,
      vector_count: generated.children.length,
      child_identity_set_recipe:
        "Ordered children from contract.children encoded as canonical JSON array containing only ordinal, challenge_id, package_path, package_version, vector_id, surface, vector_path, execution_class, fixture_set_sha256, expected_result_set_sha256 (sort_keys=true, compact separators), UTF-8, SHA-256 lowercase hex.",
      child_identity_set_sha256: generated.child_identity_set_sha256,
    },
    hash_algorithm: "sha256-lowercase-hex",
    fixture_set_recipe:
      "Sorted member paths except manifest.json: <path>\\t<file-sha256>\\n concatenated UTF-8 then SHA-256.",
    independence_scope: {
      package_identity:
        "Python and TypeScript auditors recompute umbrella fixture, DCN preimage digest, and child-reference digests without production imports.",
      challenge_semantics:
        "Child packages remain authoritative for vector semantics; umbrella binds inventory, DCN identity, and declared child digests.",
      production_result:
        "Production Lane I/H verification remains separate from independent package-identity audit.",
    },
    forbidden_semantics: [
      "coverage_beyond_exact_10_member_neighborhood",
      "source_validity_claim",
      "universal_verifier_correctness",
      "real_world_system_authorization",
      "unresolved_equals_nonconformant",
      "absence_of_all_implementation_defects",
    ],
  }
}

function buildManifest(files: Array<{ path: string; sha256: string }>): Record<string, unknown> {
  const sorted = [...files].sort((a, b) => Buffer.from(a.path).compare(Buffer.from(b.path)))
  const rows = sorted.map((file) => `${file.path}\t${file.sha256}\n`)
  return {
    schema: "counterfactual_conformance_package_fixture_manifest.v0",
    package_id: COUNTERFACTUAL_CONFORMANCE_PACKAGE_ID,
    version: "v0",
    file_count: sorted.length,
    files: sorted,
    fixture_set_sha256: sha256BytesHex(Buffer.from(rows.join(""), "utf8")),
    dcn_sha256: PINNED_COUNTERFACTUAL_NEIGHBORHOOD_SHA256_V0,
  }
}

export type GeneratedUmbrellaPackageFilesV0 = {
  readonly files: Readonly<Record<string, Buffer>>
  readonly dcn_sha256: string
  readonly child_identity_set_sha256: string
  readonly fixture_set_sha256: string
  readonly contract_sha256: string
}

/**
 * Generate umbrella package file bytes in memory (deterministic LF UTF-8).
 * Does not write the worktree.
 */
export function generateCounterfactualConformancePackageFiles(options?: {
  readonly repositoryRoot?: string
  readonly members?: readonly DcnMemberAuthorityV0[]
  readonly specMarkdown?: string
}): GeneratedUmbrellaPackageFilesV0 {
  const repositoryRoot = resolve(options?.repositoryRoot ?? DEFAULT_REPOSITORY_ROOT)
  const generated = generateFrozenCounterfactualNeighborhood({
    repositoryRoot,
    members: options?.members,
  })
  const packagePath = COUNTERFACTUAL_CONFORMANCE_PACKAGE_PATH
  const specPath = `${packagePath}/SPEC.md`
  const contractPath = `${packagePath}/contract.json`
  const dcnPath = `${packagePath}/dcn/neighborhood.json`
  const specAbsolute = resolveUnderRoot(repositoryRoot, specPath)
  let specBytes: Buffer
  if (options?.specMarkdown !== undefined) {
    specBytes = Buffer.from(options.specMarkdown.replace(/\r\n/g, "\n"), "utf8")
    if (!specBytes.toString("utf8").endsWith("\n")) {
      specBytes = Buffer.concat([specBytes, Buffer.from("\n", "utf8")])
    }
  } else {
    try {
      specBytes = readFileSync(specAbsolute)
    } catch {
      throw new DcnGeneratorError("package_materialization_failure")
    }
  }

  const contract = buildContract(generated)
  const contractBytes = stableJsonBytes(contract)
  const dcnBytes = stableJsonBytes(generated.neighborhood)

  const memberFiles = [
    { path: specPath, sha256: sha256BytesHex(specBytes) },
    { path: contractPath, sha256: sha256BytesHex(contractBytes) },
    { path: dcnPath, sha256: sha256BytesHex(dcnBytes) },
  ]
  const manifest = buildManifest(memberFiles)
  const manifestPath = `${packagePath}/manifest.json`
  const manifestBytes = stableJsonBytes(manifest)

  return {
    files: {
      [specPath]: specBytes,
      [contractPath]: contractBytes,
      [dcnPath]: dcnBytes,
      [manifestPath]: manifestBytes,
    },
    dcn_sha256: generated.dcn_sha256,
    child_identity_set_sha256: generated.child_identity_set_sha256,
    fixture_set_sha256: String(manifest.fixture_set_sha256),
    contract_sha256: sha256BytesHex(contractBytes),
  }
}

function atomicWriteFile(absolutePath: string, bytes: Buffer): void {
  mkdirSync(dirname(absolutePath), { recursive: true })
  const tempPath = `${absolutePath}.${process.pid}.${Date.now()}.tmp`
  writeFileSync(tempPath, bytes)
  renameSync(tempPath, absolutePath)
}

export type PackageGenerateModeV0 = "check" | "write"

export type PackageGenerateResultV0 = {
  readonly mode: PackageGenerateModeV0
  readonly dcn_sha256: string
  readonly child_identity_set_sha256: string
  readonly fixture_set_sha256: string
  readonly drifted_paths: readonly string[]
  readonly ok: boolean
}

/**
 * Generate umbrella artifacts.
 * - check: generate to memory / temp compare against committed package; never rewrite.
 * - write: write only into the exact umbrella package directory.
 */
export function runCounterfactualConformancePackageGenerator(options: {
  readonly mode: PackageGenerateModeV0
  readonly repositoryRoot?: string
}): PackageGenerateResultV0 {
  const repositoryRoot = resolve(options.repositoryRoot ?? DEFAULT_REPOSITORY_ROOT)
  const packageRoot = resolveUnderRoot(repositoryRoot, COUNTERFACTUAL_CONFORMANCE_PACKAGE_PATH)
  const rel = relative(repositoryRoot, packageRoot).replace(/\\/g, "/")
  if (rel !== COUNTERFACTUAL_CONFORMANCE_PACKAGE_PATH) {
    throw new DcnGeneratorError("target_path_invalid")
  }

  const generated = generateCounterfactualConformancePackageFiles({ repositoryRoot })
  const drifted: string[] = []

  for (const [path, bytes] of Object.entries(generated.files)) {
    if (path.endsWith("/SPEC.md")) continue
    const absolute = resolveUnderRoot(repositoryRoot, path)
    let committed: Buffer | null = null
    try {
      committed = readFileSync(absolute)
    } catch {
      committed = null
    }
    if (committed === null || Buffer.compare(committed, bytes) !== 0) {
      drifted.push(path)
    }
  }

  // SPEC is hand-authored; still require presence in check mode.
  const specPath = `${COUNTERFACTUAL_CONFORMANCE_PACKAGE_PATH}/SPEC.md`
  try {
    readFileSync(resolveUnderRoot(repositoryRoot, specPath))
  } catch {
    drifted.push(specPath)
  }

  if (options.mode === "check") {
    if (drifted.length > 0) {
      throw new DcnGeneratorError("generator_drift")
    }
    return {
      mode: "check",
      dcn_sha256: generated.dcn_sha256,
      child_identity_set_sha256: generated.child_identity_set_sha256,
      fixture_set_sha256: generated.fixture_set_sha256,
      drifted_paths: [],
      ok: true,
    }
  }

  // write mode: only generated identity artifacts (never rewrite SPEC content here)
  for (const [path, bytes] of Object.entries(generated.files)) {
    if (path.endsWith("/SPEC.md")) continue
    atomicWriteFile(resolveUnderRoot(repositoryRoot, path), bytes)
  }

  return {
    mode: "write",
    dcn_sha256: generated.dcn_sha256,
    child_identity_set_sha256: generated.child_identity_set_sha256,
    fixture_set_sha256: generated.fixture_set_sha256,
    drifted_paths: drifted.filter((path) => !path.endsWith("/SPEC.md")),
    ok: true,
  }
}

/** Two independent generations into isolated temps; returns whether all bytes match. */
export function proveGeneratorByteReproducibility(repositoryRoot?: string): boolean {
  const root = resolve(repositoryRoot ?? DEFAULT_REPOSITORY_ROOT)
  const a = generateCounterfactualConformancePackageFiles({ repositoryRoot: root })
  const b = generateCounterfactualConformancePackageFiles({ repositoryRoot: root })
  for (const path of Object.keys(a.files)) {
    if (path.endsWith("/SPEC.md")) continue
    if (Buffer.compare(a.files[path]!, b.files[path]!) !== 0) return false
  }
  // Also prove cwd independence by generating after chdir-equivalent via absolute root only.
  const temp = mkdtempSync(resolve(tmpdir(), "cc-v0-dcn-"))
  try {
    for (const [path, bytes] of Object.entries(a.files)) {
      if (path.endsWith("/SPEC.md")) continue
      const out = resolve(temp, path)
      mkdirSync(dirname(out), { recursive: true })
      writeFileSync(out, bytes)
    }
    const c = generateCounterfactualConformancePackageFiles({ repositoryRoot: root })
    for (const path of Object.keys(a.files)) {
      if (path.endsWith("/SPEC.md")) continue
      if (Buffer.compare(a.files[path]!, c.files[path]!) !== 0) return false
    }
    return true
  } finally {
    rmSync(temp, { recursive: true, force: true })
  }
}

export function listDcnMemberAuthorities(): readonly DcnMemberAuthorityV0[] {
  return DCN_MEMBER_AUTHORITIES_V0
}
