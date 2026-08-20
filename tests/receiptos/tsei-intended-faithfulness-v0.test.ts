/**
 * Intended-faithfulness contract tests. Scaffold fixtures only.
 * Not a real intended corpus, not P0, not Object A, not production PROVEN.
 */

import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, test } from "bun:test"
import {
  AUTHORITY_RELATIONSHIP_CLASS,
} from "../../conformance/tsei-invariant-discrimination-v0/independent-authority-model"
import * as IndependentAuthority from "../../conformance/tsei-invariant-discrimination-v0/independent-authority"
import {
  FROZEN_PROTOCOL_SHA256,
  acceptE0Record,
  acceptE0RecordV1,
  acceptObjectA,
  acceptObjectAFromBytes,
  commitOriginatorE0V1,
  E0_RECORD_KEYS,
} from "../../conformance/tsei-invariant-discrimination-v0/object-a-e0-contract"
import {
  acceptIntendedFaithfulnessFromBytes,
  FROZEN_PROTOCOL_V1_SHA256,
  HISTORICAL_IA_INSTANCE_ID,
  INTENDED_FAITHFULNESS_SCHEMA,
} from "../../conformance/tsei-invariant-discrimination-v0/intended-faithfulness"
import {
  REKOR_V1_P0_PROVIDER_POLICY_SHA256,
  REKOR_V1_PROVIDER_POLICY_SHA256,
} from "../../conformance/tsei-invariant-discrimination-v0/rekor-v1-verifier"
import type { BlindProblemPackage } from "../../conformance/tsei-invariant-discrimination-v0/independent-authority-model"
import { BLIND_PROBLEM_SCHEMA } from "../../conformance/tsei-invariant-discrimination-v0/independent-authority-model"

const PROTOCOL_V1_PATH = resolve(
  import.meta.dir,
  "..",
  "..",
  "conformance",
  "tsei-invariant-discrimination-v0",
  "INDEPENDENT_AUTHORITY_BLIND_GROUNDING_PROTOCOL_V1.md",
)
const PROTOCOL_V0_PATH = resolve(
  import.meta.dir,
  "..",
  "..",
  "conformance",
  "tsei-invariant-discrimination-v0",
  "INDEPENDENT_AUTHORITY_BLIND_GROUNDING_PROTOCOL_V0.md",
)
const POLICY_V0_PATH = resolve(
  import.meta.dir,
  "..",
  "..",
  "conformance",
  "tsei-invariant-discrimination-v0",
  "provider-policy.rekor-v1.json",
)
const POLICY_P0_PATH = resolve(
  import.meta.dir,
  "..",
  "..",
  "conformance",
  "tsei-invariant-discrimination-v0",
  "provider-policy.rekor-v1.p0-e0-e1-e2.json",
)

const DEF_P = "p is an even integer."
const DEF_Q = "q is a non-empty string."
const BASELINE = { p: 2, q: "clean" }

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex")
}

function scaffoldPkg(): BlindProblemPackage {
  return {
    schema: BLIND_PROBLEM_SCHEMA,
    instance_id: "scaffold-future-intended.not-production",
    evaluation_instruction: "Report the exact set of violated invariant_id values per mutant_id.",
    invariants: {
      I_P: {
        invariant_id: "I_P",
        normative_definition: DEF_P,
        normative_definition_identity: IndependentAuthority.normativeDefinitionIdentity(DEF_P),
      },
      I_Q: {
        invariant_id: "I_Q",
        normative_definition: DEF_Q,
        normative_definition_identity: IndependentAuthority.normativeDefinitionIdentity(DEF_Q),
      },
    },
    cases: {
      M_P: { mutant_id: "M_P", baseline: BASELINE, mutated: { p: 3, q: "clean" } },
      M_Q: { mutant_id: "M_Q", baseline: BASELINE, mutated: { p: 2, q: "" } },
    },
  }
}

function intendedArtifactFromPkg(pkg: BlindProblemPackage) {
  return {
    schema: INTENDED_FAITHFULNESS_SCHEMA,
    instance_id: pkg.instance_id,
    protocol_sha256: FROZEN_PROTOCOL_V1_SHA256,
    provider_policy_sha256: REKOR_V1_P0_PROVIDER_POLICY_SHA256,
    invariants: Object.fromEntries(
      Object.entries(pkg.invariants).map(([id, row]) => [
        id,
        { invariant_id: row.invariant_id, normative_definition: row.normative_definition, normative_definition_identity: row.normative_definition_identity },
      ]),
    ),
    cases: Object.fromEntries(
      Object.entries(pkg.cases).map(([id, row]) => [id, { mutant_id: row.mutant_id, baseline: row.baseline, mutated: row.mutated }]),
    ),
  }
}

function intendedBytesFromPkg(pkg: BlindProblemPackage): Buffer {
  return IndependentAuthority.encodeJsonUtf8Lf(intendedArtifactFromPkg(pkg))
}

describe("frozen protocol v1 and P0 policy pins", () => {
  test("v1 protocol and P0 policy hashes match committed bytes", () => {
    expect(sha256File(PROTOCOL_V1_PATH)).toBe(FROZEN_PROTOCOL_V1_SHA256)
    expect(sha256File(POLICY_P0_PATH)).toBe(REKOR_V1_P0_PROVIDER_POLICY_SHA256)
  })

  test("historical v0 protocol and policy pins are unchanged", () => {
    expect(sha256File(PROTOCOL_V0_PATH)).toBe(FROZEN_PROTOCOL_SHA256)
    expect(sha256File(PROTOCOL_V0_PATH)).toBe("8f2cf22d77b5476c0619a186d4a889c428fc5565f3d838f88d57b3c6fc806301")
    expect(sha256File(POLICY_V0_PATH)).toBe(REKOR_V1_PROVIDER_POLICY_SHA256)
    expect(sha256File(POLICY_V0_PATH)).toBe("9efefd8e00950e21c121a88a0886b20eb6bc8b1ee04737f1d69c96e4b02ffd77")
  })
})

describe("acceptIntendedFaithfulnessFromBytes", () => {
  test("canonical scaffold intended round-trips and remains unpublished", () => {
    const bytes = intendedBytesFromPkg(scaffoldPkg())
    const accepted = acceptIntendedFaithfulnessFromBytes({ bytes })
    expect(accepted.ok).toBe(true)
    if (!accepted.ok) return
    expect(accepted.digest).toBe(IndependentAuthority.sha256ExactBytes(bytes))
    expect(accepted.bytes.equals(bytes)).toBe(true)
    expect(accepted.production_publishable).toBe(false)
    expect(accepted.sufficient_for_real_intended_instance).toBe(false)
  })

  test("caller-shaped intended object without exact bytes is rejected", () => {
    const pkg = scaffoldPkg()
    const result = acceptIntendedFaithfulnessFromBytes({ intended: intendedArtifactFromPkg(pkg) })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.digest).toBeNull()
    expect(result.reasons.some((reason) => reason.includes("caller_shaped_intended") || reason.includes("bytes_not_bytes") || reason.includes("malformed"))).toBe(true)
  })

  test("cross-instance historical id is rejected", () => {
    const artifact = intendedArtifactFromPkg(scaffoldPkg())
    artifact.instance_id = HISTORICAL_IA_INSTANCE_ID
    const result = acceptIntendedFaithfulnessFromBytes({ bytes: IndependentAuthority.encodeJsonUtf8Lf(artifact) })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reasons.some((reason) => reason.includes("forbidden historical"))).toBe(true)
  })

  test("v0 protocol hash in intended is rejected", () => {
    const artifact = intendedArtifactFromPkg(scaffoldPkg())
    ;(artifact as { protocol_sha256: string }).protocol_sha256 = FROZEN_PROTOCOL_SHA256
    const result = acceptIntendedFaithfulnessFromBytes({ bytes: IndependentAuthority.encodeJsonUtf8Lf(artifact) })
    expect(result.ok).toBe(false)
  })

  test("answer-bearing derived_attribution_set is rejected", () => {
    const artifact = intendedArtifactFromPkg(scaffoldPkg()) as Record<string, unknown>
    artifact["derived_attribution_set"] = ["I_P"]
    const result = acceptIntendedFaithfulnessFromBytes({ bytes: IndependentAuthority.encodeJsonUtf8Lf(artifact) })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reasons.some((reason) => reason.includes("forbidden") || reason.includes("unexpected"))).toBe(true)
  })

  test("disguised answers key and nested expected_attribution token fail closed", () => {
    const withAnswers = { ...intendedArtifactFromPkg(scaffoldPkg()), answers: { M_P: ["I_P"] } }
    expect(acceptIntendedFaithfulnessFromBytes({ bytes: IndependentAuthority.encodeJsonUtf8Lf(withAnswers) }).ok).toBe(false)
    const nested = intendedArtifactFromPkg(scaffoldPkg())
    nested.cases.M_P = { ...nested.cases.M_P, mutated: { p: 3, q: "expected_attribution" } }
    const nestedResult = acceptIntendedFaithfulnessFromBytes({ bytes: IndependentAuthority.encodeJsonUtf8Lf(nested) })
    expect(nestedResult.ok).toBe(false)
  })

  test("wrong, missing, and extra intended keys fail closed", () => {
    const extra = { ...intendedArtifactFromPkg(scaffoldPkg()), evaluation_instruction: "leak" }
    expect(acceptIntendedFaithfulnessFromBytes({ bytes: IndependentAuthority.encodeJsonUtf8Lf(extra) }).ok).toBe(false)
    const missing = intendedArtifactFromPkg(scaffoldPkg()) as Record<string, unknown>
    delete missing["cases"]
    expect(acceptIntendedFaithfulnessFromBytes({ bytes: IndependentAuthority.encodeJsonUtf8Lf(missing) }).ok).toBe(false)
    const wrong = { ...intendedArtifactFromPkg(scaffoldPkg()), schema: "tsei-invariant-discrimination-v0.e0-record.v1" }
    expect(acceptIntendedFaithfulnessFromBytes({ bytes: IndependentAuthority.encodeJsonUtf8Lf(wrong) }).ok).toBe(false)
  })

  test("BOM, CR, missing LF, extra LF, and duplicate keys fail closed", () => {
    const bytes = intendedBytesFromPkg(scaffoldPkg())
    const bom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), bytes])
    expect(acceptIntendedFaithfulnessFromBytes({ bytes: bom }).ok).toBe(false)
    const crlf = Buffer.from(bytes.toString("utf8").replace("\n", "\r\n"), "utf8")
    expect(acceptIntendedFaithfulnessFromBytes({ bytes: crlf }).ok).toBe(false)
    expect(acceptIntendedFaithfulnessFromBytes({ bytes: bytes.subarray(0, bytes.length - 1) }).ok).toBe(false)
    const extraLf = Buffer.concat([bytes, Buffer.from("\n")])
    expect(acceptIntendedFaithfulnessFromBytes({ bytes: extraLf }).ok).toBe(false)
    const body = bytes.toString("utf8").slice(0, -1)
    const dup = Buffer.from(body.replace("{", "{\"schema\":\"x\",\"schema\":\"y\",") + "\n", "utf8")
    expect(acceptIntendedFaithfulnessFromBytes({ bytes: dup }).ok).toBe(false)
  })
})

describe("historical E0 is not E0 v1", () => {
  test("six-key historical E0 cannot satisfy acceptE0RecordV1", () => {
    const historical = {
      protocol_sha256: FROZEN_PROTOCOL_SHA256,
      provider_policy_sha256: REKOR_V1_PROVIDER_POLICY_SHA256,
      instance_id: HISTORICAL_IA_INSTANCE_ID,
      problem_package_sha256: "ab".repeat(32),
      authority_relationship_class: AUTHORITY_RELATIONSHIP_CLASS,
      oracle_commitment: "cd".repeat(32),
    }
    expect(Object.keys(historical).sort().join(",")).toBe([...E0_RECORD_KEYS].sort().join(","))
    expect(acceptE0Record(historical).ok).toBe(true)
    const v1 = acceptE0RecordV1(historical)
    expect(v1.ok).toBe(false)
    if (v1.ok) return
    expect(v1.record).toBeNull()
  })

  test("commitOriginatorE0V1 rejects intendedFrom projection that uses v0 pins", () => {
    const pkg = scaffoldPkg()
    const projected = {
      invariants: Object.fromEntries(
        Object.entries(pkg.invariants).map(([id, row]) => [
          id,
          { normative_definition: row.normative_definition, normative_definition_identity: row.normative_definition_identity },
        ]),
      ),
      cases: Object.fromEntries(Object.entries(pkg.cases).map(([id, row]) => [id, { baseline: row.baseline, mutated: row.mutated }])),
    }
    const a = acceptObjectA({ pkg, intended: projected })
    expect(a.ok).toBe(true)
    const result = commitOriginatorE0V1({
      pkg,
      intended_faithfulness_bytes: IndependentAuthority.encodeJsonUtf8Lf(projected),
      nonce: Uint8Array.from({ length: 32 }, () => 0x11),
      oracle_bytes: IndependentAuthority.encodeJsonUtf8Lf({ schema: "scaffold", note: "not-oracle" }),
    })
    expect(result.ok).toBe(false)
  })
})

describe("Object A production intended path", () => {
  test("acceptObjectAFromBytes against independently parsed intended bytes succeeds for scaffold", () => {
    const pkg = scaffoldPkg()
    const intended = acceptIntendedFaithfulnessFromBytes({ bytes: intendedBytesFromPkg(pkg) })
    expect(intended.ok).toBe(true)
    if (!intended.ok) return
    const aBytes = IndependentAuthority.encodeJsonUtf8Lf(pkg)
    const accepted = acceptObjectAFromBytes({ bytes: aBytes, intended: intended.intended })
    expect(accepted.ok).toBe(true)
    if (!accepted.ok) return
    expect(accepted.sufficient_for_real_object_a).toBe(false)
  })
})
