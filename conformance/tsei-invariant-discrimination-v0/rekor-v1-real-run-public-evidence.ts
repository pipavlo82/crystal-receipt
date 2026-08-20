/**
 * Fail-closed acceptor for the sanitized real-run public-evidence receipt.
 *
 * This module does not mint production PROVEN, does not open the E0
 * commitment, and does not verify E1/E2 payload signatures.
 */

import { encodeJsonUtf8Lf, sha256ExactBytes } from "./independent-authority"
import { FROZEN_PROTOCOL_SHA256 } from "./object-a-e0-contract"
import { REKOR_V1_PROVIDER_POLICY_SHA256 } from "./rekor-v1-verifier"
import {
  AUTHORITY_SAN_EMAIL,
  OIDC_ISSUER_GITHUB_OAUTH,
  ORIGINATOR_SAN_EMAIL,
  REKOR_V1_LOG_ID,
} from "./independent-authority-model"

export const REAL_RUN_PUBLIC_EVIDENCE_SCHEMA =
  "tsei-invariant-discrimination-v0.rekor-v1-real-run-public-evidence.v0" as const
export const REAL_RUN_PUBLIC_EVIDENCE_STATUS =
  "REKOR_V1_PUBLIC_RECEIPT_RECORDED_PRODUCTION_UNPROVEN" as const
export const PRIVATE_ARTIFACT_REPORTED_RELATION = "REPORTED_EXACT_SET_AGREES" as const
export const CASE_IDS = [
  "c01",
  "c02",
  "c03",
  "c04",
  "c05",
  "c06",
  "c07",
  "c08",
  "c09",
  "c10",
  "c11",
  "c12",
] as const
export const ALLOWED_INVARIANT_IDS = ["I_A", "I_B", "I_C"] as const

const FORBIDDEN_STATUS_TOKEN = "VERIFIED_EXACT_SET_AGREES"
const FORBIDDEN_KEYS = ["mechanical_exact_set_relation", "exact_set_agreement"] as const

export type RealRunPublicEvidenceAcceptance =
  | { readonly ok: true; readonly reasons: readonly string[]; readonly digest: string; readonly bytes: Buffer }
  | { readonly ok: false; readonly reasons: readonly string[]; readonly digest: null; readonly bytes: null }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function fail(reasons: readonly string[]): RealRunPublicEvidenceAcceptance {
  return { ok: false, reasons, digest: null, bytes: null }
}

function walkStrings(value: unknown, acc: string[]): void {
  if (typeof value === "string") {
    acc.push(value)
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) walkStrings(item, acc)
    return
  }
  if (isRecord(value)) {
    for (const key of Object.keys(value)) {
      acc.push(key)
      walkStrings(value[key], acc)
    }
  }
}

function hasForbiddenKey(value: unknown, key: string): boolean {
  if (Array.isArray(value)) return value.some((item) => hasForbiddenKey(item, key))
  if (!isRecord(value)) return false
  if (Object.prototype.hasOwnProperty.call(value, key)) return true
  return Object.values(value).some((item) => hasForbiddenKey(item, key))
}

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) return null
  return value as string[]
}

/**
 * Accept a claimed public-evidence object. Never throws. Never infers
 * comparison operands. Status escalation fails closed.
 */
export function acceptRealRunPublicEvidence(input: unknown): RealRunPublicEvidenceAcceptance {
  try {
    if (!isRecord(input)) return fail(["malformed_public_evidence"])
    const reasons: string[] = []
    if (input["schema"] !== REAL_RUN_PUBLIC_EVIDENCE_SCHEMA) reasons.push("wrong_schema")
    const derived = input["derived_status"]
    if (!isRecord(derived)) {
      reasons.push("missing_derived_status")
      return fail(reasons)
    }
    if (derived["public_evidence_status"] !== REAL_RUN_PUBLIC_EVIDENCE_STATUS) {
      reasons.push("wrong_public_evidence_status")
    }
    const strings: string[] = []
    walkStrings(input, strings)
    if (strings.some((item) => item.includes(FORBIDDEN_STATUS_TOKEN))) {
      reasons.push("overclaim_verified_exact_set_agrees")
    }
    for (const key of FORBIDDEN_KEYS) {
      if (hasForbiddenKey(input, key)) reasons.push(`forbidden_key_${key}`)
    }
    const evaluator = derived["evaluateProductionIndependentGrounding"]
    if (!isRecord(evaluator)) {
      reasons.push("missing_production_evaluator_status")
    } else {
      if (evaluator["independent_grounding"] !== "UNPROVEN") reasons.push("production_independent_grounding_not_unproven")
      if (evaluator["production_publishable"] !== false) reasons.push("production_publishable_not_false")
    }
    const ordered = derived["verifyRekorV1OrderedEvents"]
    if (!isRecord(ordered)) {
      reasons.push("missing_ordered_events_status")
    } else {
      if (ordered["sufficient_for_proven_grounding"] !== false) reasons.push("sufficient_for_proven_grounding_not_false")
      if (ordered["production_publishable"] !== false) reasons.push("ordered_production_publishable_not_false")
      if (ordered["ran_on_public_e1_e2_payloads"] !== false) reasons.push("ordered_events_overclaim")
    }
    const privateResult = derived["private_artifact_run_result"]
    if (!isRecord(privateResult)) {
      reasons.push("missing_private_artifact_run_result")
    } else {
      if (privateResult["relation"] !== PRIVATE_ARTIFACT_REPORTED_RELATION) reasons.push("wrong_private_artifact_relation")
      if (privateResult["cases_equal"] !== 12 || privateResult["cases_total"] !== 12) reasons.push("wrong_reported_case_counts")
      if (privateResult["publicly_recomputable_from_package"] !== false) {
        reasons.push("publicly_recomputable_from_package_not_false")
      }
    }
    if (input["protocol_sha256"] !== FROZEN_PROTOCOL_SHA256) reasons.push("protocol_sha256_mismatch")
    if (input["provider_policy_sha256"] !== REKOR_V1_PROVIDER_POLICY_SHA256) reasons.push("provider_policy_sha256_mismatch")
    const provider = input["provider"]
    if (!isRecord(provider)) {
      reasons.push("missing_provider")
    } else {
      if (provider["log_id"] !== REKOR_V1_LOG_ID) reasons.push("wrong_log_id")
      if (provider["originator_san_email"] !== ORIGINATOR_SAN_EMAIL) reasons.push("wrong_originator_san")
      if (provider["authority_san_email"] !== AUTHORITY_SAN_EMAIL) reasons.push("wrong_authority_san")
      if (provider["oidc_issuer"] !== OIDC_ISSUER_GITHUB_OAUTH) reasons.push("wrong_oidc_issuer")
    }
    const reported = input["reported_exact_set_result"]
    if (!isRecord(reported)) {
      reasons.push("missing_reported_exact_set_result")
    } else {
      const keys = Object.keys(reported)
      if (keys.length !== CASE_IDS.length || CASE_IDS.some((id) => !keys.includes(id))) {
        reasons.push("reported_case_universe")
      }
      const allowed = new Set<string>(ALLOWED_INVARIANT_IDS)
      for (const id of CASE_IDS) {
        const set = asStringArray(reported[id])
        if (!set) {
          reasons.push(`reported_set_malformed_${id}`)
          continue
        }
        if (new Set(set).size !== set.length) reasons.push(`reported_set_duplicate_${id}`)
        if (set.some((item) => !allowed.has(item))) reasons.push(`reported_set_undeclared_${id}`)
      }
    }
    if (input["exact_set_agreement"] !== undefined) reasons.push("legacy_exact_set_agreement")
    if (reasons.length > 0) return fail(reasons)
    const bytes = encodeJsonUtf8Lf(input)
    return { ok: true, reasons: [], digest: sha256ExactBytes(bytes), bytes }
  } catch {
    return fail(["malformed_public_evidence"])
  }
}
