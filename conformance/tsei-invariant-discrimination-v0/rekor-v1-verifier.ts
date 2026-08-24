/**
 * Production Rekor v1 verifier for the independent-authority provider policy.
 *
 * Caller booleans, prose, generic envelopes, and synthetic test injection
 * cannot satisfy this module. Malformed input fails closed and does not throw.
 *
 * Dummy-gate fixtures may be injected for offline tests. Live retrieval is
 * not performed here. This module does not mint Object A, Object B, or PROVEN.
 */

import { createHash, createPublicKey, verify as cryptoVerify, X509Certificate } from "node:crypto"
import {
  AUTHORITY_SAN_EMAIL,
  DECLARED_PROVIDER_SELECTION,
  DUMMY_GATE_D0_SHA256,
  DUMMY_GATE_D1_SHA256,
  DUMMY_GATE_D2_SHA256,
  DUMMY_GATE_RUN,
  OIDC_ISSUER_GITHUB_OAUTH,
  ORIGINATOR_SAN_EMAIL,
  REKOR_V1_ENDPOINT,
  REKOR_V1_LOG_ID,
  type ProviderInjectionKind,
} from "./independent-authority-model"

export const REKOR_V1_PROVIDER_ID = "rekor-v1" as const
export const PROVIDER_POLICY_SCHEMA = "tsei-invariant-discrimination-v0.provider-policy.rekor-v1.v0"
export const PROVIDER_POLICY_P0_SCHEMA =
  "tsei-invariant-discrimination-v0.provider-policy.rekor-v1.p0-e0-e1-e2.v0" as const
export const PROVIDER_POLICY_P0_V1_SCHEMA =
  "tsei-invariant-discrimination-v1.provider-policy.rekor-v1.p0-e0-e1-e2.v1" as const
export const DUMMY_GATE_ELIGIBILITY_CLASS = "ELIGIBILITY_ONLY_NOT_OBJECT_A_NOT_PROVEN" as const
export const REKOR_V1_PROVIDER_POLICY_SHA256 = "9efefd8e00950e21c121a88a0886b20eb6bc8b1ee04737f1d69c96e4b02ffd77" as const
/** SHA-256 of provider-policy.rekor-v1.p0-e0-e1-e2.json. Does not retarget the v0 pin. */
export const REKOR_V1_P0_PROVIDER_POLICY_SHA256 =
  "a047d4a41515d3982f6ba00bb3304f3e40e0fc46ba10f6c61092c3219bbb4862" as const
export const REKOR_V1_P0_PROVIDER_POLICY_V1_SHA256 =
  "744d024586c983f8bb6c1dd10209aeb0354b65a5121af0ef6580ea2fd8aa8e56" as const

// Sigstore public-good trust material obtained from the Sigstore TUF trusted
// root. Callers cannot replace any of these anchors.
const REKOR_V1_PUBLIC_KEY_DER_B64 =
  "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE2G2Y+2tabdTV5BcGiBIx0a9fAFwrkBbmLSGtks4L3qX6yYY0zufBnhC8Ur/iy55GhWP/9A/bY2LhC30M9+RYtw=="
const FULCIO_INTERMEDIATE_DER_B64 =
  "MIICGjCCAaGgAwIBAgIUALnViVfnU0brJasmRkHrn/UnfaQwCgYIKoZIzj0EAwMwKjEVMBMGA1UEChMMc2lnc3RvcmUuZGV2MREwDwYDVQQDEwhzaWdzdG9yZTAeFw0yMjA0MTMyMDA2MTVaFw0zMTEwMDUxMzU2NThaMDcxFTATBgNVBAoTDHNpZ3N0b3JlLmRldjEeMBwGA1UEAxMVc2lnc3RvcmUtaW50ZXJtZWRpYXRlMHYwEAYHKoZIzj0CAQYFK4EEACIDYgAE8RVS/ysH+NOvuDZyPIZtilgUF9NlarYpAd9HP1vBBH1U5CV77LSS7s0ZiH4nE7Hv7ptS6LvvR/STk798LVgMzLlJ4HeIfF3tHSaexLcYpSASr1kS0N/RgBJz/9jWCiXno3sweTAOBgNVHQ8BAf8EBAMCAQYwEwYDVR0lBAwwCgYIKwYBBQUHAwMwEgYDVR0TAQH/BAgwBgEB/wIBADAdBgNVHQ4EFgQU39Ppz1YkEZb5qNjpKFWixi4YZD8wHwYDVR0jBBgwFoAUWMAeX5FFpWapesyQoZMi0CrFxfowCgYIKoZIzj0EAwMDZwAwZAIwPCsQK4DYiZYDPIaDi5HFKnfxXx6ASSVmERfsynYBiX2X6SJRnZU84/9DZdnFvvxmAjBOt6QpBlc4J/0DxvkTCqpclvziL6BCCPnjdlIB3Pu3BxsPmygUY7Ii2zbdCdliiow="
const FULCIO_ROOT_DER_B64 =
  "MIIB9zCCAXygAwIBAgIUALZNAPFdxHPwjeDloDwyYChAO/4wCgYIKoZIzj0EAwMwKjEVMBMGA1UEChMMc2lnc3RvcmUuZGV2MREwDwYDVQQDEwhzaWdzdG9yZTAeFw0yMTEwMDcxMzU2NTlaFw0zMTEwMDUxMzU2NThaMCoxFTATBgNVBAoTDHNpZ3N0b3JlLmRldjERMA8GA1UEAxMIc2lnc3RvcmUwdjAQBgcqhkjOPQIBBgUrgQQAIgNiAAT7XeFT4rb3PQGwS4IajtLk3/OlnpgangaBclYpsYBr5i+4ynB07ceb3LP0OIOZdxexX69c5iVuyJRQ+Hz05yi+UF3uBWAlHpiS5sh0+H2GHE7SXrk1EC5m1Tr19L9gg92jYzBhMA4GA1UdDwEB/wQEAwIBBjAPBgNVHRMBAf8EBTADAQH/MB0GA1UdDgQWBBRYwB5fkUWlZql6zJChkyLQKsXF+jAfBgNVHSMEGDAWgBRYwB5fkUWlZql6zJChkyLQKsXF+jAKBggqhkjOPQQDAwNpADBmAjEAj1nHeXZp+13NWBNa+EDsDP8G1WWg1tCMWP/WHPqpaVo0jhsweNFZgSs0eE7wYI4qAjEA2WB9ot98sIkoF3vZYdd3/VtWB5b9TNMea7Ix/stJ5TfcLLeABLE4BNJOsQ4vnBHJ"

const REKOR_V1_PUBLIC_KEY_DER = Buffer.from(REKOR_V1_PUBLIC_KEY_DER_B64, "base64")
const REKOR_V1_PUBLIC_KEY = createPublicKey({ key: REKOR_V1_PUBLIC_KEY_DER, format: "der", type: "spki" })
const REKOR_V1_KEY_ID = createHash("sha256").update(REKOR_V1_PUBLIC_KEY_DER).digest().subarray(0, 4)
const FULCIO_INTERMEDIATE = new X509Certificate(Buffer.from(FULCIO_INTERMEDIATE_DER_B64, "base64"))
const FULCIO_ROOT = new X509Certificate(Buffer.from(FULCIO_ROOT_DER_B64, "base64"))

const FULCIO_OIDC_ISSUER_V1_OID = "1.3.6.1.4.1.57264.1.1"
const FULCIO_OIDC_ISSUER_V2_OID = "1.3.6.1.4.1.57264.1.8"

export type RekorV1Controller = "originator" | "authority"

export type RekorV1LogLookup = {
  readonly searchByHash: (sha256Hex: string) => unknown
  readonly getEntry: (uuid: unknown) => unknown
}

export type RekorV1PublicationResult = {
  readonly ok: boolean
  readonly reasons: readonly string[]
  readonly provider_id: typeof REKOR_V1_PROVIDER_ID
  readonly injection_kind: ProviderInjectionKind
  readonly uuid: string | null
  readonly global_log_index: number | null
  readonly shard_local_log_index: number | null
  readonly tree_id: string | null
  readonly artifact_sha256: string | null
  readonly san_email: string | null
}

export type RekorV1OrderedResult = {
  readonly ok: boolean
  readonly reasons: readonly string[]
  readonly captured_tree_id: string | null
  readonly global_log_indexes: readonly number[]
  readonly publications: readonly RekorV1PublicationResult[]
  readonly dummy_gate_eligibility_only: true
  readonly sufficient_for_proven_grounding: false
  readonly production_publishable: false
}

export type ProviderPolicyFreezeResult = {
  readonly frozen: boolean
  readonly digest: string
  readonly reasons: readonly string[]
  readonly provider_id: typeof REKOR_V1_PROVIDER_ID | null
  readonly declared_provider_selection: typeof DECLARED_PROVIDER_SELECTION
  readonly selected_provider_pass: boolean
  readonly dummy_gate_status: string | null
  readonly dummy_gate_class: string | null
  readonly sufficient_for_real_object_a: false
  readonly sufficient_for_proven_grounding: false
  readonly production_publishable: false
  readonly independently_grounded: "UNPROVEN"
}

export type ParsedRekorV1Policy = {
  readonly api: "rekor-v1"
  readonly artifact_kind: "hashedrekord"
  readonly artifact_version: "0.0.1"
  readonly authority_identity_selector: { readonly oidc_issuer: string; readonly san_email: string }
  readonly digest_algorithm: "sha256"
  readonly dummy_gate: {
    readonly class: typeof DUMMY_GATE_ELIGIBILITY_CLASS
    readonly d0_sha256: string
    readonly d1_sha256: string
    readonly d2_sha256: string
    readonly global_log_index_order: readonly number[]
    readonly observed_dummy_tree_id: string
    readonly production_tree_pin: "capture_at_e0_not_dummy_tree"
    readonly run: string
    readonly status: "REAL_EXTERNAL_PROVIDER_DRY_RUN_PASS"
  }
  readonly endpoint: "https://rekor.sigstore.dev"
  readonly event_order: {
    readonly domain: "single_log_single_tree"
    readonly field: "top_level_logIndex"
    readonly ignore_inclusion_proof_logIndex: true
    readonly ignore_integratedTime_as_trusted_clock: true
    readonly require_e0_tree_capture: true
    readonly require_e1_e2_same_tree_as_e0: true
    readonly strict: "E0_lt_E1_lt_E2"
  }
  readonly fulcio: { readonly intermediate_cn: "sigstore-intermediate"; readonly oidc_issuer: string }
  readonly log_id: string
  readonly originator_identity_selector: { readonly oidc_issuer: string; readonly san_email: string }
  readonly provider_id: typeof REKOR_V1_PROVIDER_ID
  readonly rfc3161: { readonly required_for_event_order: false; readonly required_for_wall_clock_claim: true }
  readonly schema: typeof PROVIDER_POLICY_SCHEMA
  readonly search: { readonly by: "sha256_hash"; readonly zero_or_multiple_matches: "fail_closed" }
  readonly tuf: {
    readonly forbid_signing_config: "signing_config_rekor_v2.v0.2.json"
    readonly signing_config: "signing_config.v0.2.json"
    readonly signing_config_sha256: string
  }
  readonly uniqueness: "exactly_one_verified_match"
  readonly v: 0
}

export type ParsedRekorV1P0Policy = Omit<ParsedRekorV1Policy, "event_order" | "schema" | "v"> & {
  readonly event_order: {
    readonly domain: "single_log_single_tree"
    readonly field: "top_level_logIndex"
    readonly ignore_inclusion_proof_logIndex: true
    readonly ignore_integratedTime_as_trusted_clock: true
    readonly require_p0_tree_capture: true
    readonly require_e0_e1_e2_same_tree_as_p0: true
    readonly strict: "P0_lt_E0_lt_E1_lt_E2"
  }
  readonly schema: typeof PROVIDER_POLICY_P0_SCHEMA
  readonly v: 1
}

export type ParsedRekorV1P0PolicyV1 = Omit<ParsedRekorV1P0Policy, "dummy_gate" | "schema" | "v"> & {
  readonly dummy_gate: Omit<ParsedRekorV1P0Policy["dummy_gate"], "production_tree_pin"> & {
    readonly production_tree_pin: "capture_at_p0_not_dummy_tree"
  }
  readonly schema: typeof PROVIDER_POLICY_P0_V1_SCHEMA
  readonly v: 2
}

export type RekorV1IntendedEligibilitySequenceResult = {
  readonly ok: boolean
  readonly reasons: readonly string[]
  readonly captured_tree_id: string | null
  readonly global_log_indexes: readonly number[]
  readonly publications: readonly RekorV1PublicationResult[]
}

export type RekorV1ProductionSequenceResult = {
  readonly ok: boolean
  readonly reasons: readonly string[]
  readonly captured_tree_id: string | null
  readonly global_log_indexes: readonly number[]
  readonly publications: readonly RekorV1PublicationResult[]
  readonly sufficient_for_proven_grounding: false
  readonly production_publishable: false
}

type PublicationPolicyFields = {
  readonly endpoint: "https://rekor.sigstore.dev"
  readonly log_id: string
  readonly originator_identity_selector: { readonly oidc_issuer: string; readonly san_email: string }
  readonly authority_identity_selector: { readonly oidc_issuer: string; readonly san_email: string }
}

const POLICY_TOP_KEYS = [
  "api",
  "artifact_kind",
  "artifact_version",
  "authority_identity_selector",
  "digest_algorithm",
  "dummy_gate",
  "endpoint",
  "event_order",
  "fulcio",
  "log_id",
  "originator_identity_selector",
  "provider_id",
  "rfc3161",
  "schema",
  "search",
  "tuf",
  "uniqueness",
  "v",
] as const

const HEX64 = /^[0-9a-f]{64}$/
const TREE_ID = /^[0-9]+$/

function sha256Hex(bytes: Uint8Array | Buffer): string {
  return createHash("sha256").update(bytes).digest("hex")
}

function strictBase64(value: unknown): Buffer | null {
  if (typeof value !== "string" || value.length === 0 || value.length % 4 !== 0) return null
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) return null
  const decoded = Buffer.from(value, "base64")
  return decoded.toString("base64") === value ? decoded : null
}

function canonicalJson(value: unknown): string | null {
  if (value === null) return "null"
  if (typeof value === "boolean") return value ? "true" : "false"
  if (typeof value === "string") return JSON.stringify(value)
  if (typeof value === "number") return Number.isFinite(value) ? JSON.stringify(value) : null
  if (Array.isArray(value)) {
    const items = value.map(canonicalJson)
    return items.every((item): item is string => item !== null) ? `[${items.join(",")}]` : null
  }
  if (isRecord(value)) {
    const entries: string[] = []
    for (const key of Object.keys(value).sort()) {
      const encoded = canonicalJson(value[key])
      if (encoded === null) return null
      entries.push(`${JSON.stringify(key)}:${encoded}`)
    }
    return `{${entries.join(",")}}`
  }
  return null
}

type DerValue = { readonly tag: number; readonly contentStart: number; readonly end: number; readonly next: number }

function readDerValue(bytes: Buffer, offset: number, limit = bytes.length): DerValue | null {
  if (!Number.isInteger(offset) || offset < 0 || offset + 2 > limit) return null
  const tag = bytes[offset]!
  const firstLength = bytes[offset + 1]!
  let length = 0
  let contentStart = offset + 2
  if (firstLength < 0x80) {
    length = firstLength
  } else {
    const count = firstLength & 0x7f
    if (count === 0 || count > 4 || contentStart + count > limit) return null
    if (bytes[contentStart] === 0) return null
    for (let i = 0; i < count; i += 1) length = length * 256 + bytes[contentStart + i]!
    contentStart += count
    if (length < 0x80) return null
  }
  const end = contentStart + length
  if (!Number.isSafeInteger(end) || end > limit) return null
  return { tag, contentStart, end, next: end }
}

function directDerChildren(bytes: Buffer, value: DerValue): DerValue[] | null {
  const children: DerValue[] = []
  let offset = value.contentStart
  while (offset < value.end) {
    const child = readDerValue(bytes, offset, value.end)
    if (!child) return null
    children.push(child)
    offset = child.next
  }
  return offset === value.end ? children : null
}

function decodeOid(bytes: Buffer): string | null {
  if (bytes.length === 0) return null
  const first = bytes[0]!
  const parts = [Math.min(2, Math.floor(first / 40)), first - Math.min(2, Math.floor(first / 40)) * 40]
  let current = 0
  let open = false
  for (let i = 1; i < bytes.length; i += 1) {
    const octet = bytes[i]!
    current = current * 128 + (octet & 0x7f)
    if (!Number.isSafeInteger(current)) return null
    open = (octet & 0x80) !== 0
    if (!open) {
      parts.push(current)
      current = 0
    }
  }
  return open ? null : parts.join(".")
}

function certificateExtensions(cert: X509Certificate): Map<string, Buffer> | null {
  const bytes = Buffer.from(cert.raw)
  const certificate = readDerValue(bytes, 0)
  if (!certificate || certificate.tag !== 0x30 || certificate.next !== bytes.length) return null
  const certificateChildren = directDerChildren(bytes, certificate)
  const tbs = certificateChildren?.[0]
  if (!tbs || tbs.tag !== 0x30) return null
  const tbsChildren = directDerChildren(bytes, tbs)
  if (!tbsChildren) return null
  const extensionContainers = tbsChildren.filter((item) => item.tag === 0xa3)
  if (extensionContainers.length !== 1) return null
  const containerChildren = directDerChildren(bytes, extensionContainers[0]!)
  const sequence = containerChildren?.[0]
  if (!sequence || sequence.tag !== 0x30 || containerChildren?.length !== 1) return null
  const extensionValues = directDerChildren(bytes, sequence)
  if (!extensionValues) return null
  const result = new Map<string, Buffer>()
  for (const extension of extensionValues) {
    if (extension.tag !== 0x30) return null
    const fields = directDerChildren(bytes, extension)
    if (!fields || fields.length < 2 || fields.length > 3 || fields[0]?.tag !== 0x06) return null
    const valueField = fields.at(-1)!
    if (valueField.tag !== 0x04) return null
    const oid = decodeOid(bytes.subarray(fields[0]!.contentStart, fields[0]!.end))
    if (!oid || result.has(oid)) return null
    result.set(oid, bytes.subarray(valueField.contentStart, valueField.end))
  }
  return result
}

function exactOidcIssuer(cert: X509Certificate): string | null {
  const extensions = certificateExtensions(cert)
  if (!extensions) return null
  const legacy = extensions.get(FULCIO_OIDC_ISSUER_V1_OID)
  const v2 = extensions.get(FULCIO_OIDC_ISSUER_V2_OID)
  if (!legacy && !v2) return null
  const values: string[] = []
  if (legacy) values.push(legacy.toString("utf8"))
  if (v2) {
    const encoded = readDerValue(v2, 0)
    if (!encoded || encoded.tag !== 0x0c || encoded.next !== v2.length) return null
    values.push(v2.subarray(encoded.contentStart, encoded.end).toString("utf8"))
  }
  return values.length > 0 && values.every((value) => value === values[0]) ? values[0]! : null
}

function validAt(cert: X509Certificate, unixSeconds: number): boolean {
  const instant = unixSeconds * 1000
  const from = Date.parse(cert.validFrom)
  const to = Date.parse(cert.validTo)
  return Number.isFinite(instant) && Number.isFinite(from) && Number.isFinite(to) && from <= instant && instant <= to
}

export function verifyPinnedFulcioCertificate(input: {
  readonly certificate_pem: string
  readonly expected_san_email: string
  readonly expected_oidc_issuer: string
  readonly integrated_time: number
}): { readonly ok: boolean; readonly reasons: readonly string[]; readonly certificate: X509Certificate | null } {
  try {
    const cert = new X509Certificate(input.certificate_pem)
    const emails = parseSanEmails(cert)
    if (emails.length !== 1 || emails[0] !== input.expected_san_email) {
      return { ok: false, reasons: ["wrong_san"], certificate: cert }
    }
    if (exactOidcIssuer(cert) !== input.expected_oidc_issuer) {
      return { ok: false, reasons: ["wrong_oidc_issuer"], certificate: cert }
    }
    const chainOk =
      cert.issuer === FULCIO_INTERMEDIATE.subject &&
      cert.checkIssued(FULCIO_INTERMEDIATE) &&
      cert.verify(FULCIO_INTERMEDIATE.publicKey) &&
      FULCIO_INTERMEDIATE.issuer === FULCIO_ROOT.subject &&
      FULCIO_INTERMEDIATE.checkIssued(FULCIO_ROOT) &&
      FULCIO_INTERMEDIATE.verify(FULCIO_ROOT.publicKey) &&
      FULCIO_ROOT.verify(FULCIO_ROOT.publicKey) &&
      validAt(cert, input.integrated_time) &&
      validAt(FULCIO_INTERMEDIATE, input.integrated_time) &&
      validAt(FULCIO_ROOT, input.integrated_time)
    if (!chainOk) return { ok: false, reasons: ["untrusted_fulcio_chain"], certificate: cert }
    return { ok: true, reasons: [], certificate: cert }
  } catch {
    return { ok: false, reasons: ["invalid_certificate"], certificate: null }
  }
}

function verifySignedEntryTimestamp(record: Record<string, unknown>): boolean {
  const verification = isRecord(record["verification"]) ? record["verification"] : null
  const signature = strictBase64(verification?.["signedEntryTimestamp"])
  const body = asString(record["body"])
  const logID = asString(record["logID"])
  const logIndex = record["logIndex"]
  const integratedTime = record["integratedTime"]
  if (!signature || !body || !logID || typeof logIndex !== "number" || !Number.isInteger(logIndex) || logIndex < 0) return false
  if (typeof integratedTime !== "number" || !Number.isInteger(integratedTime) || integratedTime < 0) return false
  const payload = canonicalJson({ body, integratedTime, logID, logIndex })
  if (payload === null) return false
  try {
    return cryptoVerify("SHA256", Buffer.from(payload, "utf8"), REKOR_V1_PUBLIC_KEY, signature)
  } catch {
    return false
  }
}

function verifyCheckpointSignature(checkpoint: string): boolean {
  const lines = checkpoint.split("\n")
  if (lines.length !== 6 || lines[3] !== "" || lines[5] !== "") return false
  const prefix = "— rekor.sigstore.dev "
  if (!lines[4]?.startsWith(prefix)) return false
  const signature = strictBase64(lines[4].slice(prefix.length))
  if (!signature || signature.length <= REKOR_V1_KEY_ID.length) return false
  if (!signature.subarray(0, REKOR_V1_KEY_ID.length).equals(REKOR_V1_KEY_ID)) return false
  const note = Buffer.from(lines.slice(0, 4).join("\n"), "utf8")
  try {
    return cryptoVerify("SHA256", note, REKOR_V1_PUBLIC_KEY, signature.subarray(REKOR_V1_KEY_ID.length))
  } catch {
    return false
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function failPublication(reasons: readonly string[], extra?: Partial<RekorV1PublicationResult>): RekorV1PublicationResult {
  return {
    ok: false,
    reasons,
    provider_id: REKOR_V1_PROVIDER_ID,
    injection_kind: "production",
    uuid: extra?.uuid ?? null,
    global_log_index: extra?.global_log_index ?? null,
    shard_local_log_index: extra?.shard_local_log_index ?? null,
    tree_id: extra?.tree_id ?? null,
    artifact_sha256: extra?.artifact_sha256 ?? null,
    san_email: extra?.san_email ?? null,
  }
}

function keysExact(record: Record<string, unknown>, allowed: readonly string[]): boolean {
  const keys = Object.keys(record)
  if (keys.length !== allowed.length) return false
  return allowed.every((key) => keys.includes(key))
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null
}

function asBooleanTrue(value: unknown): boolean {
  return value === true
}

function asBooleanFalse(value: unknown): boolean {
  return value === false
}

function parseIdentitySelector(value: unknown): { oidc_issuer: string; san_email: string } | null {
  if (!isRecord(value) || !keysExact(value, ["oidc_issuer", "san_email"])) return null
  const oidc_issuer = asString(value["oidc_issuer"])
  const san_email = asString(value["san_email"])
  if (!oidc_issuer || !san_email) return null
  return { oidc_issuer, san_email }
}

export function parseRekorV1ProviderPolicy(bytes: Uint8Array | Buffer): { ok: true; policy: ParsedRekorV1Policy } | { ok: false; reasons: readonly string[] } {
  try {
    const text = Buffer.from(bytes).toString("utf8")
    if (text.includes("\u0000") || text.includes("\r") || text.charCodeAt(0) === 0xfeff) {
      return { ok: false, reasons: ["malformed_policy_bytes"] }
    }
    const parsed: unknown = JSON.parse(text)
    if (!isRecord(parsed) || !keysExact(parsed, POLICY_TOP_KEYS)) {
      return { ok: false, reasons: ["malformed_policy_schema"] }
    }
    const originator = parseIdentitySelector(parsed["originator_identity_selector"])
    const authority = parseIdentitySelector(parsed["authority_identity_selector"])
    const dummy = isRecord(parsed["dummy_gate"]) ? parsed["dummy_gate"] : null
    const event_order = isRecord(parsed["event_order"]) ? parsed["event_order"] : null
    const fulcio = isRecord(parsed["fulcio"]) ? parsed["fulcio"] : null
    const rfc3161 = isRecord(parsed["rfc3161"]) ? parsed["rfc3161"] : null
    const search = isRecord(parsed["search"]) ? parsed["search"] : null
    const tuf = isRecord(parsed["tuf"]) ? parsed["tuf"] : null
    if (!originator || !authority || !dummy || !event_order || !fulcio || !rfc3161 || !search || !tuf) {
      return { ok: false, reasons: ["malformed_policy_schema"] }
    }
    if (!keysExact(dummy, ["class", "d0_sha256", "d1_sha256", "d2_sha256", "global_log_index_order", "observed_dummy_tree_id", "production_tree_pin", "run", "status"])) {
      return { ok: false, reasons: ["malformed_policy_schema"] }
    }
    if (!keysExact(event_order, ["domain", "field", "ignore_inclusion_proof_logIndex", "ignore_integratedTime_as_trusted_clock", "require_e0_tree_capture", "require_e1_e2_same_tree_as_e0", "strict"])) {
      return { ok: false, reasons: ["malformed_policy_schema"] }
    }
    if (!keysExact(fulcio, ["intermediate_cn", "oidc_issuer"])) return { ok: false, reasons: ["malformed_policy_schema"] }
    if (!keysExact(rfc3161, ["required_for_event_order", "required_for_wall_clock_claim"])) return { ok: false, reasons: ["malformed_policy_schema"] }
    if (!keysExact(search, ["by", "zero_or_multiple_matches"])) return { ok: false, reasons: ["malformed_policy_schema"] }
    if (!keysExact(tuf, ["forbid_signing_config", "signing_config", "signing_config_sha256"])) return { ok: false, reasons: ["malformed_policy_schema"] }
    const order = dummy["global_log_index_order"]
    if (!Array.isArray(order) || order.length !== 3 || !order.every((item) => typeof item === "number" && Number.isInteger(item) && item >= 0)) {
      return { ok: false, reasons: ["malformed_policy_schema"] }
    }
    const policy: ParsedRekorV1Policy = {
      api: parsed["api"] === "rekor-v1" ? "rekor-v1" : (null as never),
      artifact_kind: parsed["artifact_kind"] === "hashedrekord" ? "hashedrekord" : (null as never),
      artifact_version: parsed["artifact_version"] === "0.0.1" ? "0.0.1" : (null as never),
      authority_identity_selector: authority,
      digest_algorithm: parsed["digest_algorithm"] === "sha256" ? "sha256" : (null as never),
      dummy_gate: {
        class: dummy["class"] === DUMMY_GATE_ELIGIBILITY_CLASS ? DUMMY_GATE_ELIGIBILITY_CLASS : (null as never),
        d0_sha256: asString(dummy["d0_sha256"]) ?? "",
        d1_sha256: asString(dummy["d1_sha256"]) ?? "",
        d2_sha256: asString(dummy["d2_sha256"]) ?? "",
        global_log_index_order: order as number[],
        observed_dummy_tree_id: asString(dummy["observed_dummy_tree_id"]) ?? "",
        production_tree_pin: dummy["production_tree_pin"] === "capture_at_e0_not_dummy_tree" ? "capture_at_e0_not_dummy_tree" : (null as never),
        run: asString(dummy["run"]) ?? "",
        status: dummy["status"] === "REAL_EXTERNAL_PROVIDER_DRY_RUN_PASS" ? "REAL_EXTERNAL_PROVIDER_DRY_RUN_PASS" : (null as never),
      },
      endpoint: parsed["endpoint"] === "https://rekor.sigstore.dev" ? "https://rekor.sigstore.dev" : (null as never),
      event_order: {
        domain: event_order["domain"] === "single_log_single_tree" ? "single_log_single_tree" : (null as never),
        field: event_order["field"] === "top_level_logIndex" ? "top_level_logIndex" : (null as never),
        ignore_inclusion_proof_logIndex: asBooleanTrue(event_order["ignore_inclusion_proof_logIndex"]) ? true : (null as never),
        ignore_integratedTime_as_trusted_clock: asBooleanTrue(event_order["ignore_integratedTime_as_trusted_clock"]) ? true : (null as never),
        require_e0_tree_capture: asBooleanTrue(event_order["require_e0_tree_capture"]) ? true : (null as never),
        require_e1_e2_same_tree_as_e0: asBooleanTrue(event_order["require_e1_e2_same_tree_as_e0"]) ? true : (null as never),
        strict: event_order["strict"] === "E0_lt_E1_lt_E2" ? "E0_lt_E1_lt_E2" : (null as never),
      },
      fulcio: {
        intermediate_cn: fulcio["intermediate_cn"] === "sigstore-intermediate" ? "sigstore-intermediate" : (null as never),
        oidc_issuer: asString(fulcio["oidc_issuer"]) ?? "",
      },
      log_id: asString(parsed["log_id"]) ?? "",
      originator_identity_selector: originator,
      provider_id: parsed["provider_id"] === REKOR_V1_PROVIDER_ID ? REKOR_V1_PROVIDER_ID : (null as never),
      rfc3161: {
        required_for_event_order: asBooleanFalse(rfc3161["required_for_event_order"]) ? false : (null as never),
        required_for_wall_clock_claim: asBooleanTrue(rfc3161["required_for_wall_clock_claim"]) ? true : (null as never),
      },
      schema: parsed["schema"] === PROVIDER_POLICY_SCHEMA ? PROVIDER_POLICY_SCHEMA : (null as never),
      search: {
        by: search["by"] === "sha256_hash" ? "sha256_hash" : (null as never),
        zero_or_multiple_matches: search["zero_or_multiple_matches"] === "fail_closed" ? "fail_closed" : (null as never),
      },
      tuf: {
        forbid_signing_config: tuf["forbid_signing_config"] === "signing_config_rekor_v2.v0.2.json" ? "signing_config_rekor_v2.v0.2.json" : (null as never),
        signing_config: tuf["signing_config"] === "signing_config.v0.2.json" ? "signing_config.v0.2.json" : (null as never),
        signing_config_sha256: asString(tuf["signing_config_sha256"]) ?? "",
      },
      uniqueness: parsed["uniqueness"] === "exactly_one_verified_match" ? "exactly_one_verified_match" : (null as never),
      v: parsed["v"] === 0 ? 0 : (null as never),
    }
    const reasons: string[] = []
    if (policy.api !== "rekor-v1") reasons.push("wrong_provider")
    if (policy.artifact_kind !== "hashedrekord" || policy.artifact_version !== "0.0.1") reasons.push("wrong_kind_or_version")
    if (policy.digest_algorithm !== "sha256") reasons.push("wrong_digest_algorithm")
    if (policy.endpoint !== REKOR_V1_ENDPOINT) reasons.push("wrong_endpoint")
    if (policy.provider_id !== REKOR_V1_PROVIDER_ID || policy.provider_id !== DECLARED_PROVIDER_SELECTION) reasons.push("wrong_provider")
    if (policy.log_id !== REKOR_V1_LOG_ID) reasons.push("wrong_log_id")
    if (policy.originator_identity_selector.san_email !== ORIGINATOR_SAN_EMAIL) reasons.push("wrong_san")
    if (policy.authority_identity_selector.san_email !== AUTHORITY_SAN_EMAIL) reasons.push("wrong_san")
    if (policy.originator_identity_selector.oidc_issuer !== OIDC_ISSUER_GITHUB_OAUTH) reasons.push("wrong_oidc_issuer")
    if (policy.authority_identity_selector.oidc_issuer !== OIDC_ISSUER_GITHUB_OAUTH) reasons.push("wrong_oidc_issuer")
    if (policy.fulcio.oidc_issuer !== OIDC_ISSUER_GITHUB_OAUTH) reasons.push("wrong_oidc_issuer")
    if (policy.dummy_gate.d0_sha256 !== DUMMY_GATE_D0_SHA256 || policy.dummy_gate.d1_sha256 !== DUMMY_GATE_D1_SHA256 || policy.dummy_gate.d2_sha256 !== DUMMY_GATE_D2_SHA256) {
      reasons.push("dummy_gate_digest_drift")
    }
    if (policy.dummy_gate.run !== DUMMY_GATE_RUN) reasons.push("dummy_gate_run_drift")
    if (policy.dummy_gate.class !== DUMMY_GATE_ELIGIBILITY_CLASS) reasons.push("dummy_gate_cannot_mint_object_a")
    if (policy.dummy_gate.production_tree_pin !== "capture_at_e0_not_dummy_tree") reasons.push("dummy_tree_must_not_pin_production")
    if (!TREE_ID.test(policy.dummy_gate.observed_dummy_tree_id)) reasons.push("malformed_dummy_gate")
    if (policy.fulcio.oidc_issuer !== originator.oidc_issuer || originator.oidc_issuer !== authority.oidc_issuer) {
      reasons.push("oidc_issuer_mismatch")
    }
    if (!HEX64.test(policy.tuf.signing_config_sha256)) reasons.push("malformed_tuf_digest")
    if (policy.v !== 0) reasons.push("malformed_policy_schema")
    if (Object.values(policy.event_order).some((value) => value === null)) reasons.push("malformed_policy_schema")
    if (Object.values(policy.rfc3161).some((value) => value === null)) reasons.push("malformed_policy_schema")
    if (reasons.length > 0) return { ok: false, reasons }
    return { ok: true, policy }
  } catch {
    return { ok: false, reasons: ["malformed_policy_bytes"] }
  }
}

const EVENT_ORDER_P0_KEYS = [
  "domain",
  "field",
  "ignore_inclusion_proof_logIndex",
  "ignore_integratedTime_as_trusted_clock",
  "require_e0_e1_e2_same_tree_as_p0",
  "require_p0_tree_capture",
  "strict",
] as const

export function parseRekorV1P0ProviderPolicy(
  bytes: Uint8Array | Buffer,
): { ok: true; policy: ParsedRekorV1P0Policy } | { ok: false; reasons: readonly string[] } {
  try {
    const text = Buffer.from(bytes).toString("utf8")
    if (text.includes("\u0000") || text.includes("\r") || text.charCodeAt(0) === 0xfeff) {
      return { ok: false, reasons: ["malformed_policy_bytes"] }
    }
    const parsed: unknown = JSON.parse(text)
    if (!isRecord(parsed) || !keysExact(parsed, POLICY_TOP_KEYS)) {
      return { ok: false, reasons: ["malformed_policy_schema"] }
    }
    const originator = parseIdentitySelector(parsed["originator_identity_selector"])
    const authority = parseIdentitySelector(parsed["authority_identity_selector"])
    const dummy = isRecord(parsed["dummy_gate"]) ? parsed["dummy_gate"] : null
    const event_order = isRecord(parsed["event_order"]) ? parsed["event_order"] : null
    const fulcio = isRecord(parsed["fulcio"]) ? parsed["fulcio"] : null
    const rfc3161 = isRecord(parsed["rfc3161"]) ? parsed["rfc3161"] : null
    const search = isRecord(parsed["search"]) ? parsed["search"] : null
    const tuf = isRecord(parsed["tuf"]) ? parsed["tuf"] : null
    if (!originator || !authority || !dummy || !event_order || !fulcio || !rfc3161 || !search || !tuf) {
      return { ok: false, reasons: ["malformed_policy_schema"] }
    }
    if (!keysExact(dummy, ["class", "d0_sha256", "d1_sha256", "d2_sha256", "global_log_index_order", "observed_dummy_tree_id", "production_tree_pin", "run", "status"])) {
      return { ok: false, reasons: ["malformed_policy_schema"] }
    }
    if (!keysExact(event_order, EVENT_ORDER_P0_KEYS)) {
      return { ok: false, reasons: ["malformed_policy_schema"] }
    }
    if (!keysExact(fulcio, ["intermediate_cn", "oidc_issuer"])) return { ok: false, reasons: ["malformed_policy_schema"] }
    if (!keysExact(rfc3161, ["required_for_event_order", "required_for_wall_clock_claim"])) return { ok: false, reasons: ["malformed_policy_schema"] }
    if (!keysExact(search, ["by", "zero_or_multiple_matches"])) return { ok: false, reasons: ["malformed_policy_schema"] }
    if (!keysExact(tuf, ["forbid_signing_config", "signing_config", "signing_config_sha256"])) return { ok: false, reasons: ["malformed_policy_schema"] }
    const order = dummy["global_log_index_order"]
    if (!Array.isArray(order) || order.length !== 3 || !order.every((item) => typeof item === "number" && Number.isInteger(item) && item >= 0)) {
      return { ok: false, reasons: ["malformed_policy_schema"] }
    }
    const policy: ParsedRekorV1P0Policy = {
      api: parsed["api"] === "rekor-v1" ? "rekor-v1" : (null as never),
      artifact_kind: parsed["artifact_kind"] === "hashedrekord" ? "hashedrekord" : (null as never),
      artifact_version: parsed["artifact_version"] === "0.0.1" ? "0.0.1" : (null as never),
      authority_identity_selector: authority,
      digest_algorithm: parsed["digest_algorithm"] === "sha256" ? "sha256" : (null as never),
      dummy_gate: {
        class: dummy["class"] === DUMMY_GATE_ELIGIBILITY_CLASS ? DUMMY_GATE_ELIGIBILITY_CLASS : (null as never),
        d0_sha256: asString(dummy["d0_sha256"]) ?? "",
        d1_sha256: asString(dummy["d1_sha256"]) ?? "",
        d2_sha256: asString(dummy["d2_sha256"]) ?? "",
        global_log_index_order: order as number[],
        observed_dummy_tree_id: asString(dummy["observed_dummy_tree_id"]) ?? "",
        production_tree_pin: dummy["production_tree_pin"] === "capture_at_e0_not_dummy_tree" ? "capture_at_e0_not_dummy_tree" : (null as never),
        run: asString(dummy["run"]) ?? "",
        status: dummy["status"] === "REAL_EXTERNAL_PROVIDER_DRY_RUN_PASS" ? "REAL_EXTERNAL_PROVIDER_DRY_RUN_PASS" : (null as never),
      },
      endpoint: parsed["endpoint"] === "https://rekor.sigstore.dev" ? "https://rekor.sigstore.dev" : (null as never),
      event_order: {
        domain: event_order["domain"] === "single_log_single_tree" ? "single_log_single_tree" : (null as never),
        field: event_order["field"] === "top_level_logIndex" ? "top_level_logIndex" : (null as never),
        ignore_inclusion_proof_logIndex: asBooleanTrue(event_order["ignore_inclusion_proof_logIndex"]) ? true : (null as never),
        ignore_integratedTime_as_trusted_clock: asBooleanTrue(event_order["ignore_integratedTime_as_trusted_clock"]) ? true : (null as never),
        require_p0_tree_capture: asBooleanTrue(event_order["require_p0_tree_capture"]) ? true : (null as never),
        require_e0_e1_e2_same_tree_as_p0: asBooleanTrue(event_order["require_e0_e1_e2_same_tree_as_p0"]) ? true : (null as never),
        strict: event_order["strict"] === "P0_lt_E0_lt_E1_lt_E2" ? "P0_lt_E0_lt_E1_lt_E2" : (null as never),
      },
      fulcio: {
        intermediate_cn: fulcio["intermediate_cn"] === "sigstore-intermediate" ? "sigstore-intermediate" : (null as never),
        oidc_issuer: asString(fulcio["oidc_issuer"]) ?? "",
      },
      log_id: asString(parsed["log_id"]) ?? "",
      originator_identity_selector: originator,
      provider_id: parsed["provider_id"] === REKOR_V1_PROVIDER_ID ? REKOR_V1_PROVIDER_ID : (null as never),
      rfc3161: {
        required_for_event_order: asBooleanFalse(rfc3161["required_for_event_order"]) ? false : (null as never),
        required_for_wall_clock_claim: asBooleanTrue(rfc3161["required_for_wall_clock_claim"]) ? true : (null as never),
      },
      schema: parsed["schema"] === PROVIDER_POLICY_P0_SCHEMA ? PROVIDER_POLICY_P0_SCHEMA : (null as never),
      search: {
        by: search["by"] === "sha256_hash" ? "sha256_hash" : (null as never),
        zero_or_multiple_matches: search["zero_or_multiple_matches"] === "fail_closed" ? "fail_closed" : (null as never),
      },
      tuf: {
        forbid_signing_config: tuf["forbid_signing_config"] === "signing_config_rekor_v2.v0.2.json" ? "signing_config_rekor_v2.v0.2.json" : (null as never),
        signing_config: tuf["signing_config"] === "signing_config.v0.2.json" ? "signing_config.v0.2.json" : (null as never),
        signing_config_sha256: asString(tuf["signing_config_sha256"]) ?? "",
      },
      uniqueness: parsed["uniqueness"] === "exactly_one_verified_match" ? "exactly_one_verified_match" : (null as never),
      v: parsed["v"] === 1 ? 1 : (null as never),
    }
    const reasons: string[] = []
    if (policy.api !== "rekor-v1") reasons.push("wrong_provider")
    if (policy.artifact_kind !== "hashedrekord" || policy.artifact_version !== "0.0.1") reasons.push("wrong_kind_or_version")
    if (policy.digest_algorithm !== "sha256") reasons.push("wrong_digest_algorithm")
    if (policy.endpoint !== REKOR_V1_ENDPOINT) reasons.push("wrong_endpoint")
    if (policy.provider_id !== REKOR_V1_PROVIDER_ID || policy.provider_id !== DECLARED_PROVIDER_SELECTION) reasons.push("wrong_provider")
    if (policy.log_id !== REKOR_V1_LOG_ID) reasons.push("wrong_log_id")
    if (policy.originator_identity_selector.san_email !== ORIGINATOR_SAN_EMAIL) reasons.push("wrong_san")
    if (policy.authority_identity_selector.san_email !== AUTHORITY_SAN_EMAIL) reasons.push("wrong_san")
    if (policy.originator_identity_selector.oidc_issuer !== OIDC_ISSUER_GITHUB_OAUTH) reasons.push("wrong_oidc_issuer")
    if (policy.authority_identity_selector.oidc_issuer !== OIDC_ISSUER_GITHUB_OAUTH) reasons.push("wrong_oidc_issuer")
    if (policy.fulcio.oidc_issuer !== OIDC_ISSUER_GITHUB_OAUTH) reasons.push("wrong_oidc_issuer")
    if (policy.dummy_gate.d0_sha256 !== DUMMY_GATE_D0_SHA256 || policy.dummy_gate.d1_sha256 !== DUMMY_GATE_D1_SHA256 || policy.dummy_gate.d2_sha256 !== DUMMY_GATE_D2_SHA256) {
      reasons.push("dummy_gate_digest_drift")
    }
    if (policy.dummy_gate.run !== DUMMY_GATE_RUN) reasons.push("dummy_gate_run_drift")
    if (policy.dummy_gate.class !== DUMMY_GATE_ELIGIBILITY_CLASS) reasons.push("dummy_gate_cannot_mint_object_a")
    if (policy.dummy_gate.production_tree_pin !== "capture_at_e0_not_dummy_tree") reasons.push("dummy_tree_must_not_pin_production")
    if (!TREE_ID.test(policy.dummy_gate.observed_dummy_tree_id)) reasons.push("malformed_dummy_gate")
    if (policy.fulcio.oidc_issuer !== originator.oidc_issuer || originator.oidc_issuer !== authority.oidc_issuer) {
      reasons.push("oidc_issuer_mismatch")
    }
    if (!HEX64.test(policy.tuf.signing_config_sha256)) reasons.push("malformed_tuf_digest")
    if (policy.v !== 1) reasons.push("malformed_policy_schema")
    if (Object.values(policy.event_order).some((value) => value === null)) reasons.push("malformed_policy_schema")
    if (Object.values(policy.rfc3161).some((value) => value === null)) reasons.push("malformed_policy_schema")
    if (reasons.length > 0) return { ok: false, reasons }
    return { ok: true, policy }
  } catch {
    return { ok: false, reasons: ["malformed_policy_bytes"] }
  }
}

/**
 * Protocol-v2 policy parser. The policy intentionally carries forward every
 * verified trust/select/order leaf from the v1 P0 policy while changing only
 * schema, version, and the explicit P0 tree-capture label.
 */
export function parseRekorV1P0ProviderPolicyV1(
  bytes: Uint8Array | Buffer,
): { ok: true; policy: ParsedRekorV1P0PolicyV1 } | { ok: false; reasons: readonly string[] } {
  try {
    const text = Buffer.from(bytes).toString("utf8")
    if (text.includes("\u0000") || text.includes("\r") || text.charCodeAt(0) === 0xfeff) {
      return { ok: false, reasons: ["malformed_policy_bytes"] }
    }
    const parsed: unknown = JSON.parse(text)
    if (!isRecord(parsed) || !keysExact(parsed, POLICY_TOP_KEYS)) {
      return { ok: false, reasons: ["malformed_policy_schema"] }
    }
    const dummy = isRecord(parsed["dummy_gate"]) ? parsed["dummy_gate"] : null
    if (!dummy || parsed["schema"] !== PROVIDER_POLICY_P0_V1_SCHEMA || parsed["v"] !== 2) {
      return { ok: false, reasons: ["malformed_policy_schema"] }
    }
    if (dummy["production_tree_pin"] !== "capture_at_p0_not_dummy_tree") {
      return { ok: false, reasons: ["production_tree_pin_mismatch"] }
    }
    const translated = {
      ...parsed,
      schema: PROVIDER_POLICY_P0_SCHEMA,
      v: 1,
      dummy_gate: { ...dummy, production_tree_pin: "capture_at_e0_not_dummy_tree" },
    }
    const canonical = canonicalJson(translated)
    if (canonical === null) return { ok: false, reasons: ["malformed_policy_schema"] }
    const legacy = parseRekorV1P0ProviderPolicy(Buffer.from(`${canonical}\n`, "utf8"))
    if (!legacy.ok) return legacy
    const policy: ParsedRekorV1P0PolicyV1 = {
      ...legacy.policy,
      dummy_gate: { ...legacy.policy.dummy_gate, production_tree_pin: "capture_at_p0_not_dummy_tree" },
      schema: PROVIDER_POLICY_P0_V1_SCHEMA,
      v: 2,
    }
    return { ok: true, policy }
  } catch {
    return { ok: false, reasons: ["malformed_policy_bytes"] }
  }
}

export function providerPolicySha256(bytes: Uint8Array | Buffer): string {
  return sha256Hex(Buffer.from(bytes))
}

function parseFrozenRekorV1ProviderPolicy(bytes: Uint8Array | Buffer): ReturnType<typeof parseRekorV1ProviderPolicy> {
  if (providerPolicySha256(bytes) !== REKOR_V1_PROVIDER_POLICY_SHA256) {
    return { ok: false, reasons: ["provider_policy_digest_mismatch"] }
  }
  return parseRekorV1ProviderPolicy(bytes)
}

function parseFrozenRekorV1P0ProviderPolicy(
  bytes: Uint8Array | Buffer,
): ReturnType<typeof parseRekorV1P0ProviderPolicy> {
  if (providerPolicySha256(bytes) !== REKOR_V1_P0_PROVIDER_POLICY_SHA256) {
    return { ok: false, reasons: ["provider_policy_digest_mismatch"] }
  }
  return parseRekorV1P0ProviderPolicy(bytes)
}

function parseFrozenRekorV1P0ProviderPolicyV1(
  bytes: Uint8Array | Buffer,
): ReturnType<typeof parseRekorV1P0ProviderPolicyV1> {
  if (providerPolicySha256(bytes) !== REKOR_V1_P0_PROVIDER_POLICY_V1_SHA256) {
    return { ok: false, reasons: ["provider_policy_digest_mismatch"] }
  }
  return parseRekorV1P0ProviderPolicyV1(bytes)
}

function parsePolicyForPublication(
  bytes: Uint8Array | Buffer,
): { ok: true; policy: PublicationPolicyFields } | { ok: false; reasons: readonly string[] } {
  const digest = providerPolicySha256(bytes)
  if (digest === REKOR_V1_PROVIDER_POLICY_SHA256) {
    const parsed = parseFrozenRekorV1ProviderPolicy(bytes)
    if (!parsed.ok) return parsed
    return {
      ok: true,
      policy: {
        endpoint: parsed.policy.endpoint,
        log_id: parsed.policy.log_id,
        originator_identity_selector: parsed.policy.originator_identity_selector,
        authority_identity_selector: parsed.policy.authority_identity_selector,
      },
    }
  }
  if (digest === REKOR_V1_P0_PROVIDER_POLICY_SHA256) {
    const parsed = parseFrozenRekorV1P0ProviderPolicy(bytes)
    if (!parsed.ok) return parsed
    return {
      ok: true,
      policy: {
        endpoint: parsed.policy.endpoint,
        log_id: parsed.policy.log_id,
        originator_identity_selector: parsed.policy.originator_identity_selector,
        authority_identity_selector: parsed.policy.authority_identity_selector,
      },
    }
  }
  if (digest === REKOR_V1_P0_PROVIDER_POLICY_V1_SHA256) {
    const parsed = parseFrozenRekorV1P0ProviderPolicyV1(bytes)
    if (!parsed.ok) return parsed
    return {
      ok: true,
      policy: {
        endpoint: parsed.policy.endpoint,
        log_id: parsed.policy.log_id,
        originator_identity_selector: parsed.policy.originator_identity_selector,
        authority_identity_selector: parsed.policy.authority_identity_selector,
      },
    }
  }
  return { ok: false, reasons: ["provider_policy_digest_mismatch"] }
}

function hashLeaf(data: Buffer): Buffer {
  return createHash("sha256").update(Buffer.concat([Buffer.from([0]), data])).digest()
}

function hashChildren(left: Buffer, right: Buffer): Buffer {
  return createHash("sha256").update(Buffer.concat([Buffer.from([1]), left, right])).digest()
}

function rootFromInclusion(leafIndex: number, treeSize: number, leafHash: Buffer, proof: readonly Buffer[]): Buffer | null {
  try {
    if (!Number.isInteger(leafIndex) || !Number.isInteger(treeSize) || leafIndex < 0 || treeSize <= 0 || leafIndex >= treeSize) {
      return null
    }
    let seed = leafHash
    let index = BigInt(leafIndex)
    let last = BigInt(treeSize) - 1n
    let p = 0
    while (last !== 0n) {
      if (p >= proof.length) return null
      if (index % 2n === 1n || index === last) {
        seed = hashChildren(proof[p]!, seed)
        p += 1
        while (index % 2n === 0n && index !== 0n) {
          index >>= 1n
          last >>= 1n
        }
      } else {
        seed = hashChildren(seed, proof[p]!)
        p += 1
      }
      index >>= 1n
      last >>= 1n
    }
    if (p !== proof.length) return null
    return seed
  } catch {
    return null
  }
}

function parseSanEmails(cert: X509Certificate): string[] {
  const san = cert.subjectAltName ?? ""
  return san
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.startsWith("email:"))
    .map((part) => part.slice("email:".length))
}

function decodeEntryDocument(document: unknown): { uuid: string; record: Record<string, unknown> } | null {
  if (!isRecord(document)) return null
  if (typeof document["ok"] === "boolean" || typeof document["frozen"] === "boolean") return null
  const keys = Object.keys(document)
  if (keys.length === 1 && isRecord(document[keys[0]!])) {
    return { uuid: keys[0]!, record: document[keys[0]!] as Record<string, unknown> }
  }
  return null
}

function decodeBody(record: Record<string, unknown>): { raw: Buffer; canon: Record<string, unknown> } | null {
  const body = asString(record["body"])
  if (!body) return null
  try {
    const raw = Buffer.from(body, "base64")
    const canon: unknown = JSON.parse(raw.toString("utf8"))
    if (!isRecord(canon)) return null
    return { raw, canon }
  } catch {
    return null
  }
}

export function verifyRekorV1Publication(input: {
  readonly policy_bytes: Uint8Array | Buffer
  readonly artifact_bytes: Uint8Array | Buffer
  readonly controller: RekorV1Controller
  readonly lookup: RekorV1LogLookup
  readonly observed_endpoint?: unknown
  readonly captured_tree_id?: string | null
}): RekorV1PublicationResult {
  try {
    const parsed = parsePolicyForPublication(input.policy_bytes)
    if (!parsed.ok) return failPublication(parsed.reasons)
    const policy = parsed.policy
    if (input.observed_endpoint !== undefined && input.observed_endpoint !== policy.endpoint) {
      return failPublication(["wrong_endpoint"])
    }
    const artifact = Buffer.from(input.artifact_bytes)
    const digest = sha256Hex(artifact)
    let uuids: unknown
    try {
      uuids = input.lookup.searchByHash(digest)
    } catch {
      return failPublication(["malformed_lookup"])
    }
    if (!Array.isArray(uuids)) return failPublication(["malformed_lookup"])
    if (uuids.length === 0) return failPublication(["zero_matches"])
    if (uuids.length !== 1) return failPublication(["multiple_matches"])
    const uuid = uuids[0]
    if (typeof uuid !== "string" || uuid.length === 0) return failPublication(["malformed_lookup"])
    let retrieved: unknown
    try {
      retrieved = input.lookup.getEntry(uuid)
    } catch {
      return failPublication(["malformed_lookup"])
    }
    const decoded = decodeEntryDocument(retrieved)
    if (!decoded) return failPublication(["malformed_structure"])
    if (decoded.uuid !== uuid) return failPublication(["malformed_structure"])
    const record = decoded.record
    if (!verifySignedEntryTimestamp(record)) return failPublication(["invalid_signed_entry_timestamp"])
    if (asString(record["logID"]) !== policy.log_id) return failPublication(["wrong_log_id"])
    const globalIndex = record["logIndex"]
    if (typeof globalIndex !== "number" || !Number.isInteger(globalIndex) || globalIndex < 0) {
      return failPublication(["malformed_structure"])
    }
    const integratedTime = record["integratedTime"]
    if (typeof integratedTime !== "number" || !Number.isInteger(integratedTime) || integratedTime < 0) {
      return failPublication(["malformed_structure"])
    }
    const body = decodeBody(record)
    if (!body) return failPublication(["malformed_structure"])
    if (body.canon["kind"] !== "hashedrekord" || body.canon["apiVersion"] !== "0.0.1") {
      return failPublication(["wrong_kind_or_version"])
    }
    const spec = isRecord(body.canon["spec"]) ? body.canon["spec"] : null
    const data = spec && isRecord(spec["data"]) ? spec["data"] : null
    const hash = data && isRecord(data["hash"]) ? data["hash"] : null
    const signature = spec && isRecord(spec["signature"]) ? spec["signature"] : null
    const publicKey = signature && isRecord(signature["publicKey"]) ? signature["publicKey"] : null
    if (!hash || hash["algorithm"] !== "sha256" || asString(hash["value"]) !== digest) {
      return failPublication(["digest_mismatch"], { artifact_sha256: digest })
    }
    const artifactSignature = strictBase64(signature?.["content"])
    const certificateBytes = strictBase64(publicKey?.["content"])
    if (!artifactSignature || !certificateBytes) return failPublication(["malformed_structure"])
    const expected = input.controller === "originator" ? policy.originator_identity_selector : policy.authority_identity_selector
    const pem = certificateBytes.toString("utf8")
    const certResult = verifyPinnedFulcioCertificate({
      certificate_pem: pem,
      expected_san_email: expected.san_email,
      expected_oidc_issuer: expected.oidc_issuer,
      integrated_time: integratedTime,
    })
    const cert = certResult.certificate
    const emails = cert ? parseSanEmails(cert) : []
    if (!certResult.ok || !cert) {
      return failPublication(certResult.reasons, { artifact_sha256: digest, san_email: emails[0] ?? null })
    }
    let signatureOk = false
    try {
      signatureOk = cryptoVerify("SHA256", artifact, cert.publicKey, artifactSignature)
    } catch {
      signatureOk = false
    }
    if (!signatureOk) return failPublication(["invalid_signature"], { artifact_sha256: digest, san_email: emails[0] ?? null })
    const verification = isRecord(record["verification"]) ? record["verification"] : null
    const inclusion = verification && isRecord(verification["inclusionProof"]) ? verification["inclusionProof"] : null
    if (!inclusion) return failPublication(["invalid_inclusion_proof"])
    const localIndex = inclusion["logIndex"]
    const treeSize = inclusion["treeSize"]
    const rootHash = asString(inclusion["rootHash"])
    const checkpoint = asString(inclusion["checkpoint"])
    const hashes = inclusion["hashes"]
    if (typeof localIndex !== "number" || typeof treeSize !== "number" || !rootHash || !HEX64.test(rootHash) || !checkpoint || !Array.isArray(hashes)) {
      return failPublication(["invalid_inclusion_proof"])
    }
    const proofBuffers: Buffer[] = []
    for (const item of hashes) {
      if (typeof item !== "string" || !HEX64.test(item)) return failPublication(["invalid_inclusion_proof"])
      proofBuffers.push(Buffer.from(item, "hex"))
    }
    const computed = rootFromInclusion(localIndex, treeSize, hashLeaf(body.raw), proofBuffers)
    if (!computed || computed.toString("hex") !== rootHash) return failPublication(["invalid_inclusion_proof"])
    if (!verifyCheckpointSignature(checkpoint)) return failPublication(["invalid_checkpoint_signature"])
    const ckptLines = checkpoint.split("\n")
    if (ckptLines.length < 3) return failPublication(["invalid_checkpoint"])
    const origin = ckptLines[0] ?? ""
    const treeId = origin.startsWith("rekor.sigstore.dev - ") ? origin.slice("rekor.sigstore.dev - ".length) : ""
    if (!TREE_ID.test(treeId)) return failPublication(["invalid_checkpoint"])
    if ((ckptLines[1] ?? "") !== String(treeSize)) return failPublication(["invalid_checkpoint"])
    const ckptRoot = strictBase64(ckptLines[2])
    if (!ckptRoot || ckptRoot.length !== 32) return failPublication(["invalid_checkpoint"])
    if (!computed.equals(ckptRoot)) return failPublication(["invalid_checkpoint"])
    if (input.captured_tree_id != null && input.captured_tree_id !== treeId) {
      return failPublication(["tree_rotation"], { tree_id: treeId, artifact_sha256: digest, san_email: emails[0] ?? null })
    }
    return {
      ok: true,
      reasons: [],
      provider_id: REKOR_V1_PROVIDER_ID,
      injection_kind: "production",
      uuid,
      global_log_index: globalIndex,
      shard_local_log_index: localIndex,
      tree_id: treeId,
      artifact_sha256: digest,
      san_email: emails[0] ?? null,
    }
  } catch {
    return failPublication(["malformed_structure"])
  }
}

export function verifyRekorV1OrderedEvents(input: {
  readonly policy_bytes: Uint8Array | Buffer
  readonly events: readonly {
    readonly artifact_bytes: Uint8Array | Buffer
    readonly controller: RekorV1Controller
  }[]
  readonly lookup: RekorV1LogLookup
  readonly observed_endpoint?: unknown
}): RekorV1OrderedResult {
  const empty: RekorV1OrderedResult = {
    ok: false,
    reasons: ["malformed_structure"],
    captured_tree_id: null,
    global_log_indexes: [],
    publications: [],
    dummy_gate_eligibility_only: true,
    sufficient_for_proven_grounding: false,
    production_publishable: false,
  }
  try {
    if (!Array.isArray(input.events) || input.events.length < 2) {
      return { ...empty, reasons: ["malformed_structure"] }
    }
    const publications: RekorV1PublicationResult[] = []
    let captured: string | null = null
    for (let i = 0; i < input.events.length; i += 1) {
      const event = input.events[i]!
      const publication = verifyRekorV1Publication({
        policy_bytes: input.policy_bytes,
        artifact_bytes: event.artifact_bytes,
        controller: event.controller,
        lookup: input.lookup,
        observed_endpoint: input.observed_endpoint,
        captured_tree_id: i === 0 ? null : captured,
      })
      publications.push(publication)
      if (!publication.ok) {
        return {
          ...empty,
          reasons: publication.reasons,
          captured_tree_id: captured,
          global_log_indexes: publications.map((item) => item.global_log_index).filter((item): item is number => item !== null),
          publications,
        }
      }
      if (i === 0) captured = publication.tree_id
    }
    const indexes = publications.map((item) => item.global_log_index).filter((item): item is number => item !== null)
    const reasons: string[] = []
    for (let i = 1; i < indexes.length; i += 1) {
      if (indexes[i]! === indexes[i - 1]!) reasons.push("equal_log_index")
      if (indexes[i]! < indexes[i - 1]!) reasons.push("reversed_log_index")
    }
    const trees = new Set(publications.map((item) => item.tree_id))
    if (trees.size !== 1) reasons.push("tree_rotation")
    if (reasons.length > 0) {
      return { ...empty, reasons, captured_tree_id: captured, global_log_indexes: indexes, publications }
    }
    return {
      ok: true,
      reasons: [],
      captured_tree_id: captured,
      global_log_indexes: indexes,
      publications,
      dummy_gate_eligibility_only: true,
      sufficient_for_proven_grounding: false,
      production_publishable: false,
    }
  } catch {
    return empty
  }
}

const DUMMY_GATE_ARTIFACT_DIGESTS = new Set([DUMMY_GATE_D0_SHA256, DUMMY_GATE_D1_SHA256, DUMMY_GATE_D2_SHA256])

function emptyProductionSequence(reasons: readonly string[]): RekorV1ProductionSequenceResult {
  return {
    ok: false,
    reasons,
    captured_tree_id: null,
    global_log_indexes: [],
    publications: [],
    sufficient_for_proven_grounding: false,
    production_publishable: false,
  }
}

/**
 * Four-event production sequence P0 < E0 < E1 < E2 under the v1 P0-capable
 * provider policy. Dummy-gate artifact digests cannot authorize this path.
 * Cryptographic success here is not production PROVEN.
 */
export function verifyRekorV1ProductionSequence(input: {
  readonly policy_bytes: Uint8Array | Buffer
  readonly events: {
    readonly p0_artifact_bytes: Uint8Array | Buffer
    readonly e0_artifact_bytes: Uint8Array | Buffer
    readonly e1_artifact_bytes: Uint8Array | Buffer
    readonly e2_artifact_bytes: Uint8Array | Buffer
  }
  readonly lookup: RekorV1LogLookup
  readonly observed_endpoint?: unknown
}): RekorV1ProductionSequenceResult {
  try {
    if (providerPolicySha256(input.policy_bytes) !== REKOR_V1_P0_PROVIDER_POLICY_SHA256) {
      return emptyProductionSequence(["provider_policy_digest_mismatch"])
    }
    const parsed = parseFrozenRekorV1P0ProviderPolicy(input.policy_bytes)
    if (!parsed.ok) return emptyProductionSequence(parsed.reasons)
    const named: readonly { bytes: Buffer; controller: RekorV1Controller; label: string }[] = [
      { bytes: Buffer.from(input.events.p0_artifact_bytes), controller: "originator", label: "p0" },
      { bytes: Buffer.from(input.events.e0_artifact_bytes), controller: "originator", label: "e0" },
      { bytes: Buffer.from(input.events.e1_artifact_bytes), controller: "authority", label: "e1" },
      { bytes: Buffer.from(input.events.e2_artifact_bytes), controller: "originator", label: "e2" },
    ]
    for (const event of named) {
      const digest = sha256Hex(event.bytes)
      if (DUMMY_GATE_ARTIFACT_DIGESTS.has(digest)) {
        return emptyProductionSequence(["dummy_gate_artifact_forbidden"])
      }
    }
    const publications: RekorV1PublicationResult[] = []
    let captured: string | null = null
    for (let i = 0; i < named.length; i += 1) {
      const event = named[i]!
      const publication = verifyRekorV1Publication({
        policy_bytes: input.policy_bytes,
        artifact_bytes: event.bytes,
        controller: event.controller,
        lookup: input.lookup,
        observed_endpoint: input.observed_endpoint,
        captured_tree_id: i === 0 ? null : captured,
      })
      publications.push(publication)
      if (!publication.ok) {
        return {
          ok: false,
          reasons: publication.reasons,
          captured_tree_id: captured,
          global_log_indexes: publications
            .map((item) => item.global_log_index)
            .filter((item): item is number => item !== null),
          publications,
          sufficient_for_proven_grounding: false,
          production_publishable: false,
        }
      }
      if (i === 0) captured = publication.tree_id
    }
    const indexes = publications.map((item) => item.global_log_index).filter((item): item is number => item !== null)
    const reasons: string[] = []
    for (let i = 1; i < indexes.length; i += 1) {
      if (indexes[i]! === indexes[i - 1]!) reasons.push("equal_log_index")
      if (indexes[i]! < indexes[i - 1]!) reasons.push("reversed_log_index")
    }
    const trees = new Set(publications.map((item) => item.tree_id))
    if (trees.size !== 1) reasons.push("tree_rotation")
    if (reasons.length > 0) {
      return {
        ok: false,
        reasons,
        captured_tree_id: captured,
        global_log_indexes: indexes,
        publications,
        sufficient_for_proven_grounding: false,
        production_publishable: false,
      }
    }
    return {
      ok: true,
      reasons: [],
      captured_tree_id: captured,
      global_log_indexes: indexes,
      publications,
      sufficient_for_proven_grounding: false,
      production_publishable: false,
    }
  } catch {
    return emptyProductionSequence(["malformed_structure"])
  }
}

export function verifyRekorV1IntendedEligibilitySequenceV1(input: {
  readonly policy_bytes: Uint8Array | Buffer
  readonly p0_artifact_bytes: Uint8Array | Buffer
  readonly e0_artifact_bytes: Uint8Array | Buffer
  readonly lookup: RekorV1LogLookup
  readonly observed_endpoint?: unknown
}): RekorV1IntendedEligibilitySequenceResult {
  try {
    if (providerPolicySha256(input.policy_bytes) !== REKOR_V1_P0_PROVIDER_POLICY_V1_SHA256) {
      return { ok: false, reasons: ["provider_policy_digest_mismatch"], captured_tree_id: null, global_log_indexes: [], publications: [] }
    }
    const parsed = parseFrozenRekorV1P0ProviderPolicyV1(input.policy_bytes)
    if (!parsed.ok) return { ok: false, reasons: parsed.reasons, captured_tree_id: null, global_log_indexes: [], publications: [] }
    const named = [Buffer.from(input.p0_artifact_bytes), Buffer.from(input.e0_artifact_bytes)] as const
    for (const bytes of named) {
      if (DUMMY_GATE_ARTIFACT_DIGESTS.has(sha256Hex(bytes))) {
        return { ok: false, reasons: ["dummy_gate_artifact_forbidden"], captured_tree_id: null, global_log_indexes: [], publications: [] }
      }
    }
    const p0 = verifyRekorV1Publication({
      policy_bytes: input.policy_bytes,
      artifact_bytes: named[0],
      controller: "originator",
      lookup: input.lookup,
      observed_endpoint: input.observed_endpoint,
      captured_tree_id: null,
    })
    if (!p0.ok) return { ok: false, reasons: p0.reasons, captured_tree_id: null, global_log_indexes: [], publications: [p0] }
    const e0 = verifyRekorV1Publication({
      policy_bytes: input.policy_bytes,
      artifact_bytes: named[1],
      controller: "originator",
      lookup: input.lookup,
      observed_endpoint: input.observed_endpoint,
      captured_tree_id: p0.tree_id,
    })
    const publications = [p0, e0] as const
    const indexes = publications.map((item) => item.global_log_index).filter((item): item is number => item !== null)
    if (!e0.ok) return { ok: false, reasons: e0.reasons, captured_tree_id: p0.tree_id, global_log_indexes: indexes, publications }
    const reasons: string[] = []
    if (indexes.length !== 2) reasons.push("malformed_structure")
    else {
      if (indexes[0] === indexes[1]) reasons.push("equal_log_index")
      if (indexes[0]! > indexes[1]!) reasons.push("reversed_log_index")
    }
    if (p0.tree_id !== e0.tree_id) reasons.push("tree_rotation")
    return {
      ok: reasons.length === 0,
      reasons,
      captured_tree_id: p0.tree_id,
      global_log_indexes: indexes,
      publications,
    }
  } catch {
    return { ok: false, reasons: ["malformed_structure"], captured_tree_id: null, global_log_indexes: [], publications: [] }
  }
}

/** Full protocol-v2 P0 < E0 < E1 < E2 production sequence. */
export function verifyRekorV1ProductionSequenceV1(input: {
  readonly policy_bytes: Uint8Array | Buffer
  readonly events: {
    readonly p0_artifact_bytes: Uint8Array | Buffer
    readonly e0_artifact_bytes: Uint8Array | Buffer
    readonly e1_artifact_bytes: Uint8Array | Buffer
    readonly e2_artifact_bytes: Uint8Array | Buffer
  }
  readonly lookup: RekorV1LogLookup
  readonly observed_endpoint?: unknown
}): RekorV1ProductionSequenceResult {
  try {
    if (providerPolicySha256(input.policy_bytes) !== REKOR_V1_P0_PROVIDER_POLICY_V1_SHA256) {
      return emptyProductionSequence(["provider_policy_digest_mismatch"])
    }
    const parsed = parseFrozenRekorV1P0ProviderPolicyV1(input.policy_bytes)
    if (!parsed.ok) return emptyProductionSequence(parsed.reasons)
    const named: readonly { bytes: Buffer; controller: RekorV1Controller }[] = [
      { bytes: Buffer.from(input.events.p0_artifact_bytes), controller: "originator" },
      { bytes: Buffer.from(input.events.e0_artifact_bytes), controller: "originator" },
      { bytes: Buffer.from(input.events.e1_artifact_bytes), controller: "authority" },
      { bytes: Buffer.from(input.events.e2_artifact_bytes), controller: "originator" },
    ]
    for (const event of named) {
      if (DUMMY_GATE_ARTIFACT_DIGESTS.has(sha256Hex(event.bytes))) {
        return emptyProductionSequence(["dummy_gate_artifact_forbidden"])
      }
    }
    const publications: RekorV1PublicationResult[] = []
    let captured: string | null = null
    for (let index = 0; index < named.length; index += 1) {
      const event = named[index]!
      const publication = verifyRekorV1Publication({
        policy_bytes: input.policy_bytes,
        artifact_bytes: event.bytes,
        controller: event.controller,
        lookup: input.lookup,
        observed_endpoint: input.observed_endpoint,
        captured_tree_id: index === 0 ? null : captured,
      })
      publications.push(publication)
      if (!publication.ok) {
        return {
          ok: false,
          reasons: publication.reasons,
          captured_tree_id: captured,
          global_log_indexes: publications.map((item) => item.global_log_index).filter((item): item is number => item !== null),
          publications,
          sufficient_for_proven_grounding: false,
          production_publishable: false,
        }
      }
      if (index === 0) captured = publication.tree_id
    }
    const indexes = publications.map((item) => item.global_log_index).filter((item): item is number => item !== null)
    const reasons: string[] = []
    if (indexes.length !== 4) reasons.push("malformed_structure")
    for (let index = 1; index < indexes.length; index += 1) {
      if (indexes[index] === indexes[index - 1]) reasons.push("equal_log_index")
      if (indexes[index]! < indexes[index - 1]!) reasons.push("reversed_log_index")
    }
    if (new Set(publications.map((item) => item.tree_id)).size !== 1) reasons.push("tree_rotation")
    return {
      ok: reasons.length === 0,
      reasons,
      captured_tree_id: captured,
      global_log_indexes: indexes,
      publications,
      sufficient_for_proven_grounding: false,
      production_publishable: false,
    }
  } catch {
    return emptyProductionSequence(["malformed_structure"])
  }
}

function emptyLookup(): RekorV1LogLookup {
  return {
    searchByHash: () => [],
    getEntry: () => null,
  }
}

export function evaluateProviderPolicyFreeze(policy_bytes: Uint8Array | Buffer): ProviderPolicyFreezeResult {
  const digest = providerPolicySha256(policy_bytes)
  const base = {
    digest,
    declared_provider_selection: DECLARED_PROVIDER_SELECTION,
    sufficient_for_real_object_a: false as const,
    sufficient_for_proven_grounding: false as const,
    production_publishable: false as const,
    independently_grounded: "UNPROVEN" as const,
  }
  if (digest !== REKOR_V1_PROVIDER_POLICY_SHA256) {
    return {
      frozen: false,
      reasons: ["provider_policy_digest_mismatch"],
      provider_id: null,
      selected_provider_pass: false,
      dummy_gate_status: null,
      dummy_gate_class: null,
      ...base,
    }
  }
  const parsed = parseFrozenRekorV1ProviderPolicy(policy_bytes)
  if (!parsed.ok) {
    return {
      frozen: false,
      reasons: parsed.reasons,
      provider_id: null,
      selected_provider_pass: false,
      dummy_gate_status: null,
      dummy_gate_class: null,
      ...base,
    }
  }
  const selfCheck = verifyRekorV1Publication({
    policy_bytes,
    artifact_bytes: Buffer.from("not-a-rekor-artifact", "utf8"),
    controller: "originator",
    lookup: emptyLookup(),
    observed_endpoint: parsed.policy.endpoint,
  })
  if (selfCheck.ok) {
    return {
      frozen: false,
      reasons: ["verifier_accepted_empty_lookup"],
      provider_id: parsed.policy.provider_id,
      selected_provider_pass: false,
      dummy_gate_status: parsed.policy.dummy_gate.status,
      dummy_gate_class: parsed.policy.dummy_gate.class,
      ...base,
    }
  }
  if (!selfCheck.reasons.includes("zero_matches")) {
    return {
      frozen: false,
      reasons: ["verifier_self_check_failed", ...selfCheck.reasons],
      provider_id: parsed.policy.provider_id,
      selected_provider_pass: false,
      dummy_gate_status: parsed.policy.dummy_gate.status,
      dummy_gate_class: parsed.policy.dummy_gate.class,
      ...base,
    }
  }
  return {
    frozen: true,
    reasons: [],
    provider_id: parsed.policy.provider_id,
    selected_provider_pass: true,
    dummy_gate_status: parsed.policy.dummy_gate.status,
    dummy_gate_class: parsed.policy.dummy_gate.class,
    ...base,
  }
}

export function evaluateP0ProviderPolicyFreeze(policy_bytes: Uint8Array | Buffer): ProviderPolicyFreezeResult {
  const digest = providerPolicySha256(policy_bytes)
  const base = {
    digest,
    declared_provider_selection: DECLARED_PROVIDER_SELECTION,
    sufficient_for_real_object_a: false as const,
    sufficient_for_proven_grounding: false as const,
    production_publishable: false as const,
    independently_grounded: "UNPROVEN" as const,
  }
  if (digest !== REKOR_V1_P0_PROVIDER_POLICY_SHA256) {
    return {
      frozen: false,
      reasons: ["provider_policy_digest_mismatch"],
      provider_id: null,
      selected_provider_pass: false,
      dummy_gate_status: null,
      dummy_gate_class: null,
      ...base,
    }
  }
  const parsed = parseFrozenRekorV1P0ProviderPolicy(policy_bytes)
  if (!parsed.ok) {
    return {
      frozen: false,
      reasons: parsed.reasons,
      provider_id: null,
      selected_provider_pass: false,
      dummy_gate_status: null,
      dummy_gate_class: null,
      ...base,
    }
  }
  const selfCheck = verifyRekorV1Publication({
    policy_bytes,
    artifact_bytes: Buffer.from("not-a-rekor-artifact", "utf8"),
    controller: "originator",
    lookup: emptyLookup(),
    observed_endpoint: parsed.policy.endpoint,
  })
  if (selfCheck.ok) {
    return {
      frozen: false,
      reasons: ["verifier_accepted_empty_lookup"],
      provider_id: parsed.policy.provider_id,
      selected_provider_pass: false,
      dummy_gate_status: parsed.policy.dummy_gate.status,
      dummy_gate_class: parsed.policy.dummy_gate.class,
      ...base,
    }
  }
  if (!selfCheck.reasons.includes("zero_matches")) {
    return {
      frozen: false,
      reasons: ["verifier_self_check_failed", ...selfCheck.reasons],
      provider_id: parsed.policy.provider_id,
      selected_provider_pass: false,
      dummy_gate_status: parsed.policy.dummy_gate.status,
      dummy_gate_class: parsed.policy.dummy_gate.class,
      ...base,
    }
  }
  return {
    frozen: true,
    reasons: [],
    provider_id: parsed.policy.provider_id,
    selected_provider_pass: true,
    dummy_gate_status: parsed.policy.dummy_gate.status,
    dummy_gate_class: parsed.policy.dummy_gate.class,
    ...base,
  }
}

export function evaluateP0ProviderPolicyFreezeV1(policy_bytes: Uint8Array | Buffer): ProviderPolicyFreezeResult {
  const digest = providerPolicySha256(policy_bytes)
  const base = {
    digest,
    declared_provider_selection: DECLARED_PROVIDER_SELECTION,
    sufficient_for_real_object_a: false as const,
    sufficient_for_proven_grounding: false as const,
    production_publishable: false as const,
    independently_grounded: "UNPROVEN" as const,
  }
  if (digest !== REKOR_V1_P0_PROVIDER_POLICY_V1_SHA256) {
    return {
      frozen: false,
      reasons: ["provider_policy_digest_mismatch"],
      provider_id: null,
      selected_provider_pass: false,
      dummy_gate_status: null,
      dummy_gate_class: null,
      ...base,
    }
  }
  const parsed = parseFrozenRekorV1P0ProviderPolicyV1(policy_bytes)
  if (!parsed.ok) {
    return {
      frozen: false,
      reasons: parsed.reasons,
      provider_id: null,
      selected_provider_pass: false,
      dummy_gate_status: null,
      dummy_gate_class: null,
      ...base,
    }
  }
  const selfCheck = verifyRekorV1Publication({
    policy_bytes,
    artifact_bytes: Buffer.from("not-a-rekor-artifact", "utf8"),
    controller: "originator",
    lookup: emptyLookup(),
    observed_endpoint: parsed.policy.endpoint,
  })
  if (selfCheck.ok || !selfCheck.reasons.includes("zero_matches")) {
    return {
      frozen: false,
      reasons: selfCheck.ok ? ["verifier_accepted_empty_lookup"] : ["verifier_self_check_failed", ...selfCheck.reasons],
      provider_id: parsed.policy.provider_id,
      selected_provider_pass: false,
      dummy_gate_status: parsed.policy.dummy_gate.status,
      dummy_gate_class: parsed.policy.dummy_gate.class,
      ...base,
    }
  }
  return {
    frozen: true,
    reasons: [],
    provider_id: parsed.policy.provider_id,
    selected_provider_pass: true,
    dummy_gate_status: parsed.policy.dummy_gate.status,
    dummy_gate_class: parsed.policy.dummy_gate.class,
    ...base,
  }
}

export function lookupFromRekorDocuments(documents: readonly unknown[]): RekorV1LogLookup {
  const byHash = new Map<string, string[]>()
  const byUuid = new Map<string, unknown>()
  for (const document of documents) {
    const decoded = decodeEntryDocument(document)
    if (!decoded) continue
    const body = decodeBody(decoded.record)
    const spec = body && isRecord(body.canon["spec"]) ? body.canon["spec"] : null
    const data = spec && isRecord(spec["data"]) ? spec["data"] : null
    const hash = data && isRecord(data["hash"]) ? asString(data["hash"]["value"]) : null
    if (hash) {
      const current = byHash.get(hash) ?? []
      current.push(decoded.uuid)
      byHash.set(hash, current)
    }
    byUuid.set(decoded.uuid, document)
  }
  return {
    searchByHash: (sha256Hex) => byHash.get(sha256Hex) ?? [],
    getEntry: (uuid) => (typeof uuid === "string" ? byUuid.get(uuid) ?? null : null),
  }
}
