/**
 * Counterfactual Conformance v0 umbrella package verification entrypoint.
 *
 * Sequence (closed):
 * 1. Validate umbrella schema and package identity
 * 2. Validate child package identities/digests
 * 3. Generate/reconstruct the DCN
 * 4. Recompute and verify Lane B neighborhood SHA256
 * 5. Derive the exact Lane H request through Lane I
 * 6. Execute aggregate evaluation through Lane H
 * 7. Return bounded aggregate result + minimum package identity evidence
 */

import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { dirname, isAbsolute, relative, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"
import { tryNormalizeFrozenRepositoryRelativePath } from "./frozen-repository-path"
import {
  COUNTERFACTUAL_CONFORMANCE_PACKAGE_ID,
  COUNTERFACTUAL_CONFORMANCE_PACKAGE_PATH,
  COUNTERFACTUAL_DCN_GENERATOR_SCHEMA,
  COUNTERFACTUAL_DCN_GENERATOR_VERSION,
  COUNTERFACTUAL_DCN_NEIGHBORHOOD_ID,
  DCN_MEMBER_AUTHORITIES_V0,
  DcnGeneratorError,
  childIdentityRecordFromAuthority,
  computeChildIdentitySetSha256,
  generateFrozenCounterfactualNeighborhood,
  type ChildIdentityRecordV0,
} from "./counterfactual-dcn-generator"
import {
  MaterializedInputDerivationError,
  deriveCounterfactualNeighborhoodConformanceRequest,
} from "./counterfactual-materialized-input-derivation"
import {
  NeighborhoodConformanceContractError,
  PINNED_COUNTERFACTUAL_NEIGHBORHOOD_SHA256_V0,
  evaluateCounterfactualNeighborhoodConformance,
  type CounterfactualNeighborhoodConformanceEvaluationV0,
} from "./counterfactual-neighborhood-conformance"
import {
  computeFrozenCounterfactualNeighborhoodSha256,
  canonicalIdentityJson,
  type FrozenCounterfactualNeighborhoodV0,
} from "./counterfactual-neighborhood"

export const COUNTERFACTUAL_CONFORMANCE_PACKAGE_VERIFICATION_SCHEMA =
  "receiptos.counterfactual_conformance_package_verification.v0" as const

export type CounterfactualConformancePackageErrorReasonV0 =
  | "unsupported_umbrella_schema"
  | "contract_manifest_mismatch"
  | "child_inventory_mismatch"
  | "child_identity_mismatch"
  | "child_digest_mismatch"
  | "expected_authority_mismatch"
  | "dcn_inventory_mismatch"
  | "dcn_digest_mismatch"
  | "generator_drift"
  | "materialization_failure"
  | "aggregate_contract_failure"
  | "package_materialization_failure"

export class CounterfactualConformancePackageError extends Error {
  readonly code = "counterfactual_conformance_package_error" as const
  readonly reason: CounterfactualConformancePackageErrorReasonV0

  constructor(reason: CounterfactualConformancePackageErrorReasonV0) {
    super("counterfactual conformance package verification failed")
    this.name = "CounterfactualConformancePackageError"
    this.reason = reason
  }
}

export type CounterfactualConformancePackageVerificationV0 = {
  readonly schema: typeof COUNTERFACTUAL_CONFORMANCE_PACKAGE_VERIFICATION_SCHEMA
  readonly package_id: typeof COUNTERFACTUAL_CONFORMANCE_PACKAGE_ID
  readonly version: "v0"
  readonly dcn_sha256: string
  readonly child_identity_set_sha256: string
  readonly fixture_set_sha256: string
  readonly generator: {
    readonly schema: typeof COUNTERFACTUAL_DCN_GENERATOR_SCHEMA
    readonly version: typeof COUNTERFACTUAL_DCN_GENERATOR_VERSION
  }
  readonly aggregate: CounterfactualNeighborhoodConformanceEvaluationV0
}

const MODULE_DIR = dirname(fileURLToPath(import.meta.url))
const DEFAULT_REPOSITORY_ROOT = resolve(MODULE_DIR, "../../..")

function sha256BytesHex(bytes: Uint8Array | Buffer): string {
  return createHash("sha256").update(bytes).digest("hex")
}

function assertSafeRelativePath(repositoryPath: string): string {
  if (typeof repositoryPath !== "string" || repositoryPath.length === 0) {
    throw new CounterfactualConformancePackageError("package_materialization_failure")
  }
  const normalized = tryNormalizeFrozenRepositoryRelativePath(repositoryPath)
  if (normalized === null) {
    throw new CounterfactualConformancePackageError("package_materialization_failure")
  }
  return normalized
}

function resolveUnderRoot(repositoryRoot: string, repositoryPath: string): string {
  const safe = assertSafeRelativePath(repositoryPath)
  const absolute = resolve(repositoryRoot, ...safe.split("/"))
  const rel = relative(repositoryRoot, absolute)
  if (rel.startsWith("..") || isAbsolute(rel) || rel.includes(`..${sep}`)) {
    throw new CounterfactualConformancePackageError("package_materialization_failure")
  }
  return absolute
}

function readJson(repositoryRoot: string, repositoryPath: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(readFileSync(resolveUnderRoot(repositoryRoot, repositoryPath), "utf8")) as unknown
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new CounterfactualConformancePackageError("package_materialization_failure")
    }
    return parsed as Record<string, unknown>
  } catch (error) {
    if (error instanceof CounterfactualConformancePackageError) throw error
    throw new CounterfactualConformancePackageError("package_materialization_failure")
  }
}

function readBytes(repositoryRoot: string, repositoryPath: string): Buffer {
  try {
    return readFileSync(resolveUnderRoot(repositoryRoot, repositoryPath))
  } catch {
    throw new CounterfactualConformancePackageError("package_materialization_failure")
  }
}

function mapGeneratorReason(
  reason: DcnGeneratorError["reason"],
): CounterfactualConformancePackageErrorReasonV0 {
  switch (reason) {
    case "unsupported_schema":
      return "unsupported_umbrella_schema"
    case "child_inventory_mismatch":
      return "child_inventory_mismatch"
    case "child_identity_mismatch":
      return "child_identity_mismatch"
    case "child_digest_mismatch":
      return "child_digest_mismatch"
    case "expected_authority_mismatch":
      return "expected_authority_mismatch"
    case "dcn_inventory_mismatch":
      return "dcn_inventory_mismatch"
    case "dcn_digest_mismatch":
    case "duplicate_member":
      return "dcn_digest_mismatch"
    case "generator_drift":
      return "generator_drift"
    case "vector_load_failure":
    case "package_materialization_failure":
    case "target_path_invalid":
      return "package_materialization_failure"
    default:
      return "package_materialization_failure"
  }
}

function projectChildIdentity(raw: Record<string, unknown>): ChildIdentityRecordV0 {
  return {
    ordinal: Number(raw.ordinal),
    challenge_id: (raw.challenge_id ?? null) as string | null,
    package_path: String(raw.package_path),
    package_version: String(raw.package_version),
    vector_id: String(raw.vector_id),
    surface: String(raw.surface),
    vector_path: String(raw.vector_path),
    execution_class: String(raw.execution_class),
    fixture_set_sha256: String(raw.fixture_set_sha256),
    expected_result_set_sha256: String(raw.expected_result_set_sha256),
  }
}

function verifyUmbrellaPackageIdentity(repositoryRoot: string): {
  contract: Record<string, unknown>
  manifest: Record<string, unknown>
  fixture_set_sha256: string
  child_identity_set_sha256: string
} {
  const packagePath = COUNTERFACTUAL_CONFORMANCE_PACKAGE_PATH
  const contract = readJson(repositoryRoot, `${packagePath}/contract.json`)
  const manifest = readJson(repositoryRoot, `${packagePath}/manifest.json`)

  if (
    contract.schema !== "counterfactual_conformance_package_contract.v0" ||
    contract.package_id !== COUNTERFACTUAL_CONFORMANCE_PACKAGE_ID ||
    contract.version !== "v0"
  ) {
    throw new CounterfactualConformancePackageError("unsupported_umbrella_schema")
  }
  if (
    manifest.schema !== "counterfactual_conformance_package_fixture_manifest.v0" ||
    manifest.package_id !== COUNTERFACTUAL_CONFORMANCE_PACKAGE_ID ||
    manifest.version !== "v0"
  ) {
    throw new CounterfactualConformancePackageError("unsupported_umbrella_schema")
  }

  const files = manifest.files
  if (!Array.isArray(files) || manifest.file_count !== files.length) {
    throw new CounterfactualConformancePackageError("contract_manifest_mismatch")
  }

  const rows: string[] = []
  const paths: string[] = []
  for (const file of files) {
    if (file === null || typeof file !== "object" || Array.isArray(file)) {
      throw new CounterfactualConformancePackageError("contract_manifest_mismatch")
    }
    const record = file as Record<string, unknown>
    const path = String(record.path)
    const expected = String(record.sha256)
    const actual = sha256BytesHex(readBytes(repositoryRoot, path))
    if (actual !== expected) {
      throw new CounterfactualConformancePackageError("contract_manifest_mismatch")
    }
    paths.push(path)
    rows.push(`${path}\t${actual}\n`)
  }
  const sorted = [...paths].sort((a, b) => Buffer.from(a).compare(Buffer.from(b)))
  if (JSON.stringify(paths) !== JSON.stringify(sorted)) {
    throw new CounterfactualConformancePackageError("contract_manifest_mismatch")
  }
  const fixtureHash = sha256BytesHex(Buffer.from(rows.join(""), "utf8"))
  if (fixtureHash !== manifest.fixture_set_sha256) {
    throw new CounterfactualConformancePackageError("contract_manifest_mismatch")
  }
  if (manifest.dcn_sha256 !== PINNED_COUNTERFACTUAL_NEIGHBORHOOD_SHA256_V0) {
    throw new CounterfactualConformancePackageError("dcn_digest_mismatch")
  }

  const dcnBlock = contract.dcn as Record<string, unknown> | undefined
  if (
    !dcnBlock ||
    dcnBlock.neighborhood_id !== COUNTERFACTUAL_DCN_NEIGHBORHOOD_ID ||
    dcnBlock.pinned_sha256 !== PINNED_COUNTERFACTUAL_NEIGHBORHOOD_SHA256_V0 ||
    dcnBlock.member_count !== 10
  ) {
    throw new CounterfactualConformancePackageError("dcn_inventory_mismatch")
  }

  const generator = contract.generator as Record<string, unknown> | undefined
  if (
    !generator ||
    generator.schema !== COUNTERFACTUAL_DCN_GENERATOR_SCHEMA ||
    generator.version !== COUNTERFACTUAL_DCN_GENERATOR_VERSION
  ) {
    throw new CounterfactualConformancePackageError("unsupported_umbrella_schema")
  }

  const childrenRaw = contract.children
  if (!Array.isArray(childrenRaw) || childrenRaw.length !== DCN_MEMBER_AUTHORITIES_V0.length) {
    throw new CounterfactualConformancePackageError("child_inventory_mismatch")
  }

  const children: ChildIdentityRecordV0[] = []
  for (let i = 0; i < DCN_MEMBER_AUTHORITIES_V0.length; i += 1) {
    const expected = childIdentityRecordFromAuthority(DCN_MEMBER_AUTHORITIES_V0[i]!)
    const raw = childrenRaw[i]
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
      throw new CounterfactualConformancePackageError("child_inventory_mismatch")
    }
    const actual = projectChildIdentity(raw as Record<string, unknown>)
    if (canonicalIdentityJson(actual) !== canonicalIdentityJson(expected)) {
      throw new CounterfactualConformancePackageError("child_identity_mismatch")
    }

    const childManifest = readJson(repositoryRoot, `${actual.package_path}/manifest.json`)
    const childContract = readJson(repositoryRoot, `${actual.package_path}/contract.json`)
    if (childManifest.fixture_set_sha256 !== actual.fixture_set_sha256) {
      throw new CounterfactualConformancePackageError("child_digest_mismatch")
    }
    if (childContract.expected_result_set_sha256 !== actual.expected_result_set_sha256) {
      throw new CounterfactualConformancePackageError("expected_authority_mismatch")
    }
    children.push(actual)
  }

  const aggregate = contract.aggregate as Record<string, unknown> | undefined
  const identityHash = computeChildIdentitySetSha256(children)
  if (!aggregate || aggregate.child_identity_set_sha256 !== identityHash) {
    throw new CounterfactualConformancePackageError("child_identity_mismatch")
  }
  if (aggregate.child_count !== 10 || aggregate.vector_count !== 10) {
    throw new CounterfactualConformancePackageError("child_inventory_mismatch")
  }

  const dcnArtifact = readJson(repositoryRoot, `${packagePath}/dcn/neighborhood.json`) as unknown as FrozenCounterfactualNeighborhoodV0
  if (dcnArtifact.schema !== "receiptos.counterfactual_neighborhood.v0") {
    throw new CounterfactualConformancePackageError("dcn_inventory_mismatch")
  }
  const artifactSha = computeFrozenCounterfactualNeighborhoodSha256(dcnArtifact)
  if (artifactSha !== PINNED_COUNTERFACTUAL_NEIGHBORHOOD_SHA256_V0) {
    throw new CounterfactualConformancePackageError("dcn_digest_mismatch")
  }

  return {
    contract,
    manifest,
    fixture_set_sha256: fixtureHash,
    child_identity_set_sha256: identityHash,
  }
}

/**
 * Closed umbrella verification entrypoint. Does not accept arbitrary vectors,
 * packages, runners, evaluators, or expected authorities.
 */
export async function verifyCounterfactualConformancePackage(options?: {
  readonly repositoryRoot?: string
}): Promise<CounterfactualConformancePackageVerificationV0> {
  const repositoryRoot = resolve(options?.repositoryRoot ?? DEFAULT_REPOSITORY_ROOT)

  const packageIdentity = verifyUmbrellaPackageIdentity(repositoryRoot)

  let generated
  try {
    generated = generateFrozenCounterfactualNeighborhood({ repositoryRoot })
  } catch (error) {
    if (error instanceof DcnGeneratorError) {
      throw new CounterfactualConformancePackageError(mapGeneratorReason(error.reason))
    }
    throw new CounterfactualConformancePackageError("package_materialization_failure")
  }

  if (generated.dcn_sha256 !== PINNED_COUNTERFACTUAL_NEIGHBORHOOD_SHA256_V0) {
    throw new CounterfactualConformancePackageError("dcn_digest_mismatch")
  }
  if (generated.child_identity_set_sha256 !== packageIdentity.child_identity_set_sha256) {
    throw new CounterfactualConformancePackageError("child_identity_mismatch")
  }

  let request
  try {
    request = deriveCounterfactualNeighborhoodConformanceRequest({ repositoryRoot })
  } catch (error) {
    if (error instanceof MaterializedInputDerivationError) {
      throw new CounterfactualConformancePackageError("materialization_failure")
    }
    throw new CounterfactualConformancePackageError("materialization_failure")
  }

  if (
    computeFrozenCounterfactualNeighborhoodSha256(request.neighborhood) !==
    PINNED_COUNTERFACTUAL_NEIGHBORHOOD_SHA256_V0
  ) {
    throw new CounterfactualConformancePackageError("dcn_digest_mismatch")
  }
  if (canonicalIdentityJson(request.neighborhood) !== canonicalIdentityJson(generated.neighborhood)) {
    throw new CounterfactualConformancePackageError("dcn_digest_mismatch")
  }

  let aggregate: CounterfactualNeighborhoodConformanceEvaluationV0
  try {
    aggregate = await evaluateCounterfactualNeighborhoodConformance(request)
  } catch (error) {
    if (error instanceof NeighborhoodConformanceContractError) {
      throw new CounterfactualConformancePackageError("aggregate_contract_failure")
    }
    throw new CounterfactualConformancePackageError("aggregate_contract_failure")
  }

  return {
    schema: COUNTERFACTUAL_CONFORMANCE_PACKAGE_VERIFICATION_SCHEMA,
    package_id: COUNTERFACTUAL_CONFORMANCE_PACKAGE_ID,
    version: "v0",
    dcn_sha256: generated.dcn_sha256,
    child_identity_set_sha256: generated.child_identity_set_sha256,
    fixture_set_sha256: packageIdentity.fixture_set_sha256,
    generator: {
      schema: COUNTERFACTUAL_DCN_GENERATOR_SCHEMA,
      version: COUNTERFACTUAL_DCN_GENERATOR_VERSION,
    },
    aggregate,
  }
}
