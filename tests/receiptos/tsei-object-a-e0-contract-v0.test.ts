/**
 * Object A + Originator E0 contract scaffold tests (PR #204).
 *
 * Synthetic scaffold values only. Not a real Object A corpus, not a real
 * internal oracle, not a cryptographically generated nonce, and not E0/E1/E2
 * materialization. production_publishable remains false; PROVEN cannot be
 * minted from this scaffold.
 */

import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { afterEach, describe, expect, spyOn, test } from "bun:test"
import {
  AUTHORITY_RELATIONSHIP_CLASS,
  BLIND_PROBLEM_SCHEMA,
  type BlindProblemPackage,
} from "../../conformance/tsei-invariant-discrimination-v0/independent-authority-model"
import * as IndependentAuthority from "../../conformance/tsei-invariant-discrimination-v0/independent-authority"
import {
  asProductionGroundingEvidence,
  evaluateProductionIndependentGrounding,
  normativeDefinitionIdentity,
} from "../../conformance/tsei-invariant-discrimination-v0/independent-authority"
import {
  E0_E2_ORIGINATOR,
  E0_RECORD_KEYS,
  E1_AUTHORITY,
  FROZEN_PROTOCOL_SHA256,
  INTERNAL_ORACLE_CODEC,
  acceptE0Record,
  acceptObjectA,
  acceptObjectAFromBytes,
  bindOracleCommitment,
  commitOriginatorE0,
  encodeInternalOracleUtf8Lf,
} from "../../conformance/tsei-invariant-discrimination-v0/object-a-e0-contract"

const PROTOCOL_PATH = resolve(
  import.meta.dir,
  "..",
  "..",
  "conformance",
  "tsei-invariant-discrimination-v0",
  "INDEPENDENT_AUTHORITY_BLIND_GROUNDING_PROTOCOL_V0.md",
)
const POLICY_PATH = resolve(
  import.meta.dir,
  "..",
  "..",
  "conformance",
  "tsei-invariant-discrimination-v0",
  "provider-policy.rekor-v1.json",
)

const DEF_P = "p is an even integer."
const DEF_Q = 'q does not contain the marker substring "QUARANTINE".'
const DEF_R = "r is a strictly increasing sequence of numbers."
const BASELINE = { p: 2, q: "clean", r: [1, 2, 3] as const }

/** Test-only 32-byte vector. Not a real commitment nonce and not CSPRNG output. */
const TEST_ONLY_NONCE_32_0x11 = Uint8Array.from({ length: 32 }, () => 0x11)

function scaffoldPackage(): BlindProblemPackage {
  return {
    schema: BLIND_PROBLEM_SCHEMA,
    instance_id: "scaffold-test-instance.not-production",
    evaluation_instruction:
      "For each mutant_id, report the exact set of invariant_id values whose normative definitions do not hold on the mutated case value.",
    invariants: {
      I_P: {
        invariant_id: "I_P",
        normative_definition: DEF_P,
        normative_definition_identity: normativeDefinitionIdentity(DEF_P),
      },
      I_Q: {
        invariant_id: "I_Q",
        normative_definition: DEF_Q,
        normative_definition_identity: normativeDefinitionIdentity(DEF_Q),
      },
      I_R: {
        invariant_id: "I_R",
        normative_definition: DEF_R,
        normative_definition_identity: normativeDefinitionIdentity(DEF_R),
      },
    },
    cases: {
      M_P: { mutant_id: "M_P", baseline: BASELINE, mutated: { p: 3, q: "clean", r: [1, 2, 3] } },
      M_Q: { mutant_id: "M_Q", baseline: BASELINE, mutated: { p: 2, q: "QUARANTINE-here", r: [1, 2, 3] } },
      M_PQ: { mutant_id: "M_PQ", baseline: BASELINE, mutated: { p: 3, q: "QUARANTINE-here", r: [1, 2, 3] } },
    },
  }
}

function intendedFrom(pkg: BlindProblemPackage) {
  return {
    invariants: Object.fromEntries(
      Object.entries(pkg.invariants).map(([id, row]) => [
        id,
        { normative_definition: row.normative_definition, normative_definition_identity: row.normative_definition_identity },
      ]),
    ),
    cases: Object.fromEntries(
      Object.entries(pkg.cases).map(([id, row]) => [id, { baseline: row.baseline, mutated: row.mutated }]),
    ),
  }
}

function testOnlyOracleBytes(): Buffer {
  const encoded = encodeInternalOracleUtf8Lf({
    schema: INTERNAL_ORACLE_CODEC,
    note: "scaffold-test-only.not-a-real-oracle",
  })
  if (!encoded.ok) throw new Error("test-only oracle codec fixture failed")
  return encoded.bytes
}

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex")
}

const spies: Array<{ mockRestore: () => void }> = []

afterEach(() => {
  while (spies.length > 0) spies.pop()?.mockRestore()
})

function spyEncode() {
  const spy = spyOn(IndependentAuthority, "encodeJsonUtf8Lf")
  spies.push(spy)
  return spy
}

function spyFaithfulness() {
  const spy = spyOn(IndependentAuthority, "checkBlindPackageFaithfulness")
  spies.push(spy)
  return spy
}

function spyLeak() {
  const spy = spyOn(IndependentAuthority, "leakCheckBlindPackage")
  spies.push(spy)
  return spy
}

function expectObjectAFailClosed(
  result: ReturnType<typeof acceptObjectA>,
  gate: (reason: string) => boolean,
  label?: string,
): void {
  expect(result.ok, label).toBe(false)
  if (result.ok) return
  expect(result.bytes, label).toBeNull()
  expect(result.digest, label).toBeNull()
  expect(result.package, label).toBeNull()
  expect(result.reasons.some(gate), `${label ?? "gate"}: ${result.reasons.join(" | ")}`).toBe(true)
}

function expectE0FailClosed(
  result: ReturnType<typeof acceptE0Record> | ReturnType<typeof commitOriginatorE0>,
  gate: (reason: string) => boolean,
  label?: string,
): void {
  expect(result.ok, label).toBe(false)
  if (result.ok) return
  expect(result.bytes, label).toBeNull()
  expect(result.record, label).toBeNull()
  expect(result.reasons.some(gate), `${label ?? "gate"}: ${result.reasons.join(" | ")}`).toBe(true)
}

function scaffoldE0Fields() {
  return {
    protocol_sha256: FROZEN_PROTOCOL_SHA256,
    provider_policy_sha256: IndependentAuthority.REKOR_V1_PROVIDER_POLICY_SHA256,
    instance_id: "scaffold-test-instance.not-production",
    problem_package_sha256: "ab".repeat(32),
    authority_relationship_class: AUTHORITY_RELATIONSHIP_CLASS,
    oracle_commitment: "cd".repeat(32),
  }
}

const SHARED_ARRAY_BUFFER_AVAILABLE = (() => {
  try {
    return typeof SharedArrayBuffer === "function" && new SharedArrayBuffer(8).byteLength === 8
  } catch {
    return false
  }
})()

const SUBCLASSED_UINT8ARRAY_AVAILABLE = (() => {
  try {
    class ProbeUint8Array extends Uint8Array {}
    return new ProbeUint8Array(8) instanceof Uint8Array
  } catch {
    return false
  }
})()

describe("frozen origin/main hashes", () => {
  test("protocol and provider-policy bytes are unchanged", () => {
    expect(sha256File(PROTOCOL_PATH)).toBe(FROZEN_PROTOCOL_SHA256)
    expect(sha256File(PROTOCOL_PATH)).toBe("d0850ea0b9609fc99bb1ae97bbb8e6daf4455438649a0924f8de9d58736cfd8b")
    expect(sha256File(POLICY_PATH)).toBe(IndependentAuthority.REKOR_V1_PROVIDER_POLICY_SHA256)
    expect(sha256File(POLICY_PATH)).toBe("9efefd8e00950e21c121a88a0886b20eb6bc8b1ee04737f1d69c96e4b02ffd77")
  })
})

describe("Object A round-trip", () => {
  test("accepted package round-trips exact bytes and digest", () => {
    const pkg = scaffoldPackage()
    const intended = intendedFrom(pkg)
    const accepted = acceptObjectA({ pkg, intended })
    expect(accepted.ok).toBe(true)
    if (!accepted.ok) return
    expect(accepted.bytes[accepted.bytes.length - 1]).toBe(0x0a)
    expect(accepted.bytes.includes(0x0d)).toBe(false)
    expect(accepted.digest).toBe(IndependentAuthority.digestBlindProblemBytes(accepted.bytes))
    expect(accepted.digest).toBe(IndependentAuthority.sha256ExactBytes(accepted.bytes))
    expect(accepted.digest).toMatch(/^[0-9a-f]{64}$/)
    expect(JSON.parse(accepted.bytes.toString("utf8"))).toEqual(JSON.parse(IndependentAuthority.encodeJsonUtf8Lf(pkg).toString("utf8")))
    const again = acceptObjectA({
      pkg: JSON.parse(accepted.bytes.toString("utf8")),
      intended,
      claimed_bytes: accepted.bytes,
    })
    expect(again.ok).toBe(true)
    if (!again.ok) return
    expect(again.digest).toBe(accepted.digest)
    expect(again.bytes.equals(accepted.bytes)).toBe(true)
    expect(accepted.production_publishable).toBe(false)
    expect(accepted.sufficient_for_real_object_a).toBe(false)
  })

  test("one mutation per allowed Object A field changes digest", () => {
    const pkg = scaffoldPackage()
    const baseBytes = IndependentAuthority.encodeJsonUtf8Lf(pkg)
    const baseDigest = IndependentAuthority.digestBlindProblemBytes(baseBytes)
    const mutated = {
      schema: IndependentAuthority.encodeJsonUtf8Lf({ ...pkg, schema: "tsei-invariant-discrimination-v0.blind-problem.mutated-test-only" }),
      instance_id: IndependentAuthority.encodeJsonUtf8Lf({ ...pkg, instance_id: "scaffold-test-instance.not-production.mutated" }),
      evaluation_instruction: IndependentAuthority.encodeJsonUtf8Lf({ ...pkg, evaluation_instruction: `${pkg.evaluation_instruction} mutated-test-only.` }),
      invariants: IndependentAuthority.encodeJsonUtf8Lf({
        ...pkg,
        invariants: {
          ...pkg.invariants,
          I_P: {
            invariant_id: "I_P",
            normative_definition: "p is an even integer. mutated-test-only.",
            normative_definition_identity: normativeDefinitionIdentity("p is an even integer. mutated-test-only."),
          },
        },
      }),
      cases: IndependentAuthority.encodeJsonUtf8Lf({
        ...pkg,
        cases: {
          ...pkg.cases,
          M_P: { mutant_id: "M_P", baseline: BASELINE, mutated: { p: 5, q: "clean", r: [1, 2, 3] } },
        },
      }),
    }
    for (const [field, bytes] of Object.entries(mutated)) {
      expect(IndependentAuthority.digestBlindProblemBytes(bytes), field).not.toBe(baseDigest)
      expect(bytes.equals(baseBytes), field).toBe(false)
    }
    const acceptedBase = acceptObjectA({ pkg, intended: intendedFrom(pkg) })
    expect(acceptedBase.ok).toBe(true)
    if (!acceptedBase.ok) return
    const instanceMut = { ...pkg, instance_id: "scaffold-test-instance.not-production.mutated" }
    const instructionMut = { ...pkg, evaluation_instruction: `${pkg.evaluation_instruction} mutated-test-only.` }
    const invariantMut = {
      ...pkg,
      invariants: {
        ...pkg.invariants,
        I_P: {
          invariant_id: "I_P",
          normative_definition: "p is an even integer. mutated-test-only.",
          normative_definition_identity: normativeDefinitionIdentity("p is an even integer. mutated-test-only."),
        },
      },
    }
    const caseMut = {
      ...pkg,
      cases: {
        ...pkg.cases,
        M_P: { mutant_id: "M_P", baseline: BASELINE, mutated: { p: 5, q: "clean", r: [1, 2, 3] } },
      },
    }
    for (const next of [instanceMut, instructionMut, invariantMut, caseMut]) {
      const accepted = acceptObjectA({ pkg: next, intended: intendedFrom(next) })
      expect(accepted.ok).toBe(true)
      if (!accepted.ok) continue
      expect(accepted.digest).not.toBe(acceptedBase.digest)
    }
  })
})

describe("Object A rejection", () => {
  test("unknown and answer-bearing keys are rejected", () => {
    const pkg = scaffoldPackage()
    const intended = intendedFrom(pkg)
    const unknown = acceptObjectA({ pkg: { ...pkg, unexpected_top_level: true }, intended })
    expect(unknown.ok).toBe(false)
    if (unknown.ok) return
    expect(unknown.bytes).toBeNull()
    expect(unknown.digest).toBeNull()
    expect(unknown.reasons.some((reason) => reason.includes("unexpected") || reason === "object_a_leak")).toBe(true)
    const answerBearing = acceptObjectA({ pkg: { ...pkg, expected_attribution: ["I_P"] }, intended })
    expect(answerBearing.ok).toBe(false)
    if (answerBearing.ok) return
    expect(answerBearing.bytes).toBeNull()
    expect(answerBearing.digest).toBeNull()
  })

  test("nested answer leakage is rejected", () => {
    const pkg = scaffoldPackage()
    const leaked = {
      ...pkg,
      cases: {
        ...pkg.cases,
        M_P: {
          mutant_id: "M_P",
          baseline: { ...BASELINE, expected_attribution: ["I_P"] },
          mutated: { p: 3, q: "clean", r: [1, 2, 3] },
        },
      },
    }
    const accepted = acceptObjectA({ pkg: leaked, intended: intendedFrom(pkg) })
    expect(accepted.ok).toBe(false)
    if (accepted.ok) return
    expect(accepted.bytes).toBeNull()
    expect(accepted.digest).toBeNull()
    expect(accepted.reasons.some((reason) => reason.includes("forbidden") || reason.includes("expected_attribution"))).toBe(true)
  })

  test("malformed arrays, identity mismatch, unknown IDs, unsafe values, getter/prototype fail closed", () => {
    const pkg = scaffoldPackage()
    const intended = intendedFrom(pkg)
    const asArray = acceptObjectA({ pkg: { ...pkg, invariants: [{ invariant_id: "I_P" }] }, intended })
    expect(asArray.ok).toBe(false)
    if (!asArray.ok) {
      expect(asArray.bytes).toBeNull()
      expect(asArray.digest).toBeNull()
      expect(asArray.reasons.some((reason) => reason.includes("must be a map"))).toBe(true)
    }

    const identityMismatch = acceptObjectA({
      pkg: {
        ...pkg,
        cases: {
          ...pkg.cases,
          M_P: { mutant_id: "M_Q", baseline: BASELINE, mutated: { p: 3, q: "clean", r: [1, 2, 3] } },
        },
      },
      intended,
    })
    expect(identityMismatch.ok).toBe(false)
    if (!identityMismatch.ok) {
      expect(identityMismatch.bytes).toBeNull()
      expect(identityMismatch.reasons).toContain("A.cases.M_P: map key must equal mutant_id")
    }

    const unknownId = acceptObjectA({
      pkg,
      intended: {
        ...intended,
        invariants: { I_P: intended.invariants.I_P, I_Q: intended.invariants.I_Q },
      },
    })
    expect(unknownId.ok).toBe(false)
    if (!unknownId.ok) {
      expect(unknownId.reasons).toContain("object_a_not_faithful")
      expect(unknownId.bytes).toBeNull()
      expect(unknownId.digest).toBeNull()
    }

    const unsafe = acceptObjectA({
      pkg: {
        ...pkg,
        cases: {
          ...pkg.cases,
          M_P: { mutant_id: "M_P", baseline: { ...BASELINE, p: Number.MAX_SAFE_INTEGER + 1 }, mutated: { p: 3, q: "clean", r: [1, 2, 3] } },
        },
      },
      intended,
    })
    expect(unsafe.ok).toBe(false)
    if (!unsafe.ok) expect(unsafe.bytes).toBeNull()

    const nonFinite = acceptObjectA({
      pkg: {
        ...pkg,
        cases: {
          ...pkg.cases,
          M_P: { mutant_id: "M_P", baseline: { ...BASELINE, p: Number.POSITIVE_INFINITY }, mutated: { p: 3, q: "clean", r: [1, 2, 3] } },
        },
      },
      intended,
    })
    expect(nonFinite.ok).toBe(false)
    if (!nonFinite.ok) expect(nonFinite.bytes).toBeNull()

    const getterPkg = {
      ...pkg,
      evaluation_instruction: pkg.evaluation_instruction,
    }
    Object.defineProperty(getterPkg, "schema", {
      enumerable: true,
      get() {
        return BLIND_PROBLEM_SCHEMA
      },
    })
    const getter = acceptObjectA({ pkg: getterPkg, intended })
    expect(getter.ok).toBe(false)
    if (!getter.ok) {
      expect(getter.bytes).toBeNull()
      expect(getter.reasons.some((reason) => reason.includes("getter"))).toBe(true)
    }

    const protoPkg = Object.assign(Object.create({ expected_attribution: ["I_P"] }), pkg)
    const proto = acceptObjectA({ pkg: protoPkg, intended })
    expect(proto.ok).toBe(false)
    if (!proto.ok) {
      expect(proto.bytes).toBeNull()
      expect(proto.digest).toBeNull()
    }

    const throwing = {
      ...pkg,
    }
    Object.defineProperty(throwing, "evaluation_instruction", {
      enumerable: true,
      get() {
        throw new Error("getter boom")
      },
    })
    expect(() => acceptObjectA({ pkg: throwing, intended })).not.toThrow()
    const threw = acceptObjectA({ pkg: throwing, intended })
    expect(threw.ok).toBe(false)
    if (!threw.ok) {
      expect(threw.bytes).toBeNull()
      expect(threw.digest).toBeNull()
    }
  })

  test("BOM, CR, missing LF, extra LF, and non-canonical bytes are rejected", () => {
    const pkg = scaffoldPackage()
    const intended = intendedFrom(pkg)
    const canonical = IndependentAuthority.encodeJsonUtf8Lf(pkg)
    const bom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), canonical])
    const cr = Buffer.from(canonical.toString("utf8").replace(/\n$/u, "\r\n"), "utf8")
    const missingLf = canonical.subarray(0, canonical.length - 1)
    const extraLf = Buffer.concat([canonical, Buffer.from("\n")])
    const parsed = JSON.parse(canonical.toString("utf8"))
    const unsorted = Buffer.from(
      `{"schema":${JSON.stringify(parsed.schema)},"instance_id":${JSON.stringify(parsed.instance_id)},"evaluation_instruction":${JSON.stringify(parsed.evaluation_instruction)},"invariants":${JSON.stringify(parsed.invariants)},"cases":${JSON.stringify(parsed.cases)}}\n`,
      "utf8",
    )
    const encode = spyEncode()
    const faith = spyFaithfulness()
    for (const [label, bytes] of [
      ["bom", bom],
      ["cr", cr],
      ["missingLf", missingLf],
      ["extraLf", extraLf],
      ["unsorted", unsorted],
    ] as const) {
      encode.mockClear()
      faith.mockClear()
      const accepted = acceptObjectAFromBytes({ bytes, intended })
      expect(accepted.ok, label).toBe(false)
      if (accepted.ok) continue
      expect(accepted.bytes, label).toBeNull()
      expect(accepted.digest, label).toBeNull()
      if (label === "bom" || label === "cr" || label === "missingLf" || label === "extraLf") {
        expect(faith, label).not.toHaveBeenCalled()
        expect(encode, label).not.toHaveBeenCalled()
      }
    }
    expect(unsorted.equals(canonical)).toBe(false)
  })
})

describe("acceptance gate order", () => {
  test("leak gate runs before faithfulness and leak failure never reaches encode", () => {
    const pkg = { ...scaffoldPackage(), expected_attribution: ["I_P"] }
    const intended = {
      ...intendedFrom(scaffoldPackage()),
      invariants: { I_P: intendedFrom(scaffoldPackage()).invariants.I_P },
    }
    const leak = spyLeak()
    const faith = spyFaithfulness()
    const encode = spyEncode()
    const accepted = acceptObjectA({ pkg, intended })
    expect(accepted.ok).toBe(false)
    if (!accepted.ok) {
      expect(accepted.bytes).toBeNull()
      expect(accepted.digest).toBeNull()
      expect(accepted.reasons).toContain("object_a_leak")
      expect(accepted.reasons).not.toContain("object_a_not_faithful")
    }
    expect(leak).toHaveBeenCalled()
    expect(faith).not.toHaveBeenCalled()
    expect(encode).not.toHaveBeenCalled()
  })

  test("faithfulness failure rejects before freeze/digest", () => {
    const pkg = scaffoldPackage()
    const intended = {
      ...intendedFrom(pkg),
      invariants: {
        ...intendedFrom(pkg).invariants,
        I_P: {
          normative_definition: "p is an odd integer. mutated-test-only.",
          normative_definition_identity: normativeDefinitionIdentity("p is an odd integer. mutated-test-only."),
        },
      },
    }
    const faith = spyFaithfulness()
    const encode = spyEncode()
    const accepted = acceptObjectA({ pkg, intended })
    expect(accepted.ok).toBe(false)
    if (!accepted.ok) {
      expect(accepted.bytes).toBeNull()
      expect(accepted.digest).toBeNull()
      expect(accepted.reasons).toContain("object_a_not_faithful")
    }
    expect(faith).toHaveBeenCalled()
    expect(encode).not.toHaveBeenCalled()
  })
})

describe("E0 contract", () => {
  test("exact 32-byte test-only nonce is required; 31 and 33 fail closed", () => {
    const pkg = scaffoldPackage()
    const intended = intendedFrom(pkg)
    const oracle_bytes = testOnlyOracleBytes()
    const ok = commitOriginatorE0({ pkg, intended, nonce: TEST_ONLY_NONCE_32_0x11, oracle_bytes })
    expect(ok.ok).toBe(true)
    const shortNonce = commitOriginatorE0({ pkg, intended, nonce: Uint8Array.from({ length: 31 }, () => 0x11), oracle_bytes })
    const longNonce = commitOriginatorE0({ pkg, intended, nonce: Uint8Array.from({ length: 33 }, () => 0x11), oracle_bytes })
    expect(shortNonce.ok).toBe(false)
    expect(longNonce.ok).toBe(false)
    if (!shortNonce.ok) {
      expect(shortNonce.bytes).toBeNull()
      expect(shortNonce.record).toBeNull()
    }
    if (!longNonce.ok) {
      expect(longNonce.bytes).toBeNull()
      expect(longNonce.record).toBeNull()
    }
    expect(() =>
      commitOriginatorE0({ pkg, intended, nonce: Uint8Array.from({ length: 31 }, () => 0x11), oracle_bytes }),
    ).not.toThrow()
  })

  test("one-bit changes in instance_id, A digest, nonce, and oracle bytes change commitment", () => {
    const pkg = scaffoldPackage()
    const accepted = acceptObjectA({ pkg, intended: intendedFrom(pkg) })
    expect(accepted.ok).toBe(true)
    if (!accepted.ok) return
    const oracle_bytes = testOnlyOracleBytes()
    const base = bindOracleCommitment({
      instance_id: accepted.package.instance_id,
      problem_package_sha256: accepted.digest,
      nonce: TEST_ONLY_NONCE_32_0x11,
      oracle_bytes,
    })
    expect(base.ok).toBe(true)
    if (!base.ok) return
    const flippedNonce = Uint8Array.from(TEST_ONLY_NONCE_32_0x11)
    flippedNonce[0] = 0x10
    const flippedOracle = Buffer.from(oracle_bytes)
    flippedOracle[0] ^= 1
    const flippedDigest = `${accepted.digest.slice(0, -1)}${accepted.digest.endsWith("a") ? "b" : "a"}`
    const instance = bindOracleCommitment({
      instance_id: "scaffold-test-instance.not-production.x",
      problem_package_sha256: accepted.digest,
      nonce: TEST_ONLY_NONCE_32_0x11,
      oracle_bytes,
    })
    const digest = bindOracleCommitment({
      instance_id: accepted.package.instance_id,
      problem_package_sha256: flippedDigest,
      nonce: TEST_ONLY_NONCE_32_0x11,
      oracle_bytes,
    })
    const nonce = bindOracleCommitment({
      instance_id: accepted.package.instance_id,
      problem_package_sha256: accepted.digest,
      nonce: flippedNonce,
      oracle_bytes,
    })
    const oracle = bindOracleCommitment({
      instance_id: accepted.package.instance_id,
      problem_package_sha256: accepted.digest,
      nonce: TEST_ONLY_NONCE_32_0x11,
      oracle_bytes: flippedOracle,
    })
    expect(instance.ok && digest.ok && nonce.ok && oracle.ok).toBe(true)
    if (!instance.ok || !digest.ok || !nonce.ok || !oracle.ok) return
    expect(new Set([base.commitment, instance.commitment, digest.commitment, nonce.commitment, oracle.commitment]).size).toBe(5)
  })

  test("publishable E0 record never exposes nonce or oracle", () => {
    const pkg = scaffoldPackage()
    const oracle_bytes = testOnlyOracleBytes()
    const committed = commitOriginatorE0({
      pkg,
      intended: intendedFrom(pkg),
      nonce: TEST_ONLY_NONCE_32_0x11,
      oracle_bytes,
    })
    expect(committed.ok).toBe(true)
    if (!committed.ok) return
    expect(Object.keys(committed.record).sort()).toEqual([...E0_RECORD_KEYS].sort())
    expect(committed.record.protocol_sha256).toBe(FROZEN_PROTOCOL_SHA256)
    expect(committed.record.provider_policy_sha256).toBe(IndependentAuthority.REKOR_V1_PROVIDER_POLICY_SHA256)
    expect(committed.record.authority_relationship_class).toBe(AUTHORITY_RELATIONSHIP_CLASS)
    expect(committed.record.instance_id).toBe(pkg.instance_id)
    expect("nonce" in committed.record).toBe(false)
    expect("oracle" in committed.record).toBe(false)
    expect("oracle_bytes" in committed.record).toBe(false)
    const text = committed.bytes.toString("utf8")
    expect(text).not.toContain("nonce")
    expect(text).not.toContain("oracle_bytes")
    expect(text).not.toContain("scaffold-test-only.not-a-real-oracle")
    expect(text).not.toContain("\u0011".repeat(32))
    expect(committed.production_publishable).toBe(false)
    expect(committed.sufficient_for_real_object_a).toBe(false)
    expect(E0_E2_ORIGINATOR).toBe("Pavlo")
    expect(E1_AUTHORITY).toBe("Tiago")
  })

  test("malformed E0 and commitment inputs fail closed without throw", () => {
    expect(() => acceptE0Record(null)).not.toThrow()
    expect(acceptE0Record(null).ok).toBe(false)
    expect(acceptE0Record({}).ok).toBe(false)
    expect(acceptE0Record({ nonce: TEST_ONLY_NONCE_32_0x11, oracle_bytes: testOnlyOracleBytes() }).ok).toBe(false)
    const extra = acceptE0Record({
      protocol_sha256: FROZEN_PROTOCOL_SHA256,
      provider_policy_sha256: IndependentAuthority.REKOR_V1_PROVIDER_POLICY_SHA256,
      instance_id: "scaffold-test-instance.not-production",
      problem_package_sha256: "ab".repeat(32),
      authority_relationship_class: AUTHORITY_RELATIONSHIP_CLASS,
      oracle_commitment: "cd".repeat(32),
      nonce: TEST_ONLY_NONCE_32_0x11,
    })
    expect(extra.ok).toBe(false)
    if (!extra.ok) {
      expect(extra.bytes).toBeNull()
      expect(extra.record).toBeNull()
    }
    expect(() => bindOracleCommitment({ instance_id: "BAD ID", problem_package_sha256: "ab".repeat(32), nonce: TEST_ONLY_NONCE_32_0x11, oracle_bytes: testOnlyOracleBytes() })).not.toThrow()
    expect(
      bindOracleCommitment({
        instance_id: "BAD ID",
        problem_package_sha256: "ab".repeat(32),
        nonce: TEST_ONLY_NONCE_32_0x11,
        oracle_bytes: testOnlyOracleBytes(),
      }).ok,
    ).toBe(false)
    expect(() => commitOriginatorE0(undefined)).not.toThrow()
    expect(commitOriginatorE0(undefined).ok).toBe(false)
  })
})

describe("fail-closed negative controls", () => {
  test("Proxy wrapping a valid package is rejected at the Proxy gate", () => {
    const pkg = scaffoldPackage()
    const intended = intendedFrom(pkg)
    const proxyPkg = new Proxy(pkg, {})
    expect(() => acceptObjectA({ pkg: proxyPkg, intended })).not.toThrow()
    const accepted = acceptObjectA({ pkg: proxyPkg, intended })
    expectObjectAFailClosed(accepted, (reason) => reason.includes("Proxy values are forbidden"), "pkg proxy")
  })

  test("TOCTOU/answer-bearing injection Proxy fails closed", () => {
    const pkg = scaffoldPackage()
    const intended = intendedFrom(pkg)
    const injecting = new Proxy(pkg, {
      get(target, key, receiver) {
        if (key === "expected_attribution") return ["I_P"]
        return Reflect.get(target, key, receiver)
      },
      ownKeys(target) {
        return [...Reflect.ownKeys(target), "expected_attribution"]
      },
      getOwnPropertyDescriptor(target, key) {
        if (key === "expected_attribution") {
          return { configurable: true, enumerable: true, value: ["I_P"] }
        }
        return Reflect.getOwnPropertyDescriptor(target, key)
      },
      has(target, key) {
        if (key === "expected_attribution") return true
        return Reflect.has(target, key)
      },
    })
    expect(() => acceptObjectA({ pkg: injecting, intended })).not.toThrow()
    const injected = acceptObjectA({ pkg: injecting, intended })
    expectObjectAFailClosed(
      injected,
      (reason) =>
        reason === "object_a_leak" ||
        reason.includes("expected_attribution") ||
        reason.includes("forbidden") ||
        reason.includes("Proxy values are forbidden"),
      "injection proxy",
    )

    let ownKeysCalls = 0
    const delayed = new Proxy(pkg, {
      ownKeys(target) {
        ownKeysCalls += 1
        if (ownKeysCalls > 32) return [...Reflect.ownKeys(target), "expected_attribution"]
        return Reflect.ownKeys(target)
      },
      get(target, key, receiver) {
        if (key === "expected_attribution") return ["I_P"]
        return Reflect.get(target, key, receiver)
      },
      getOwnPropertyDescriptor(target, key) {
        if (key === "expected_attribution") {
          return { configurable: true, enumerable: true, value: ["I_P"] }
        }
        return Reflect.getOwnPropertyDescriptor(target, key)
      },
    })
    expect(() => acceptObjectA({ pkg: delayed, intended })).not.toThrow()
    const toctou = acceptObjectA({ pkg: delayed, intended })
    expectObjectAFailClosed(
      toctou,
      (reason) =>
        reason.includes("Proxy values are forbidden") ||
        reason === "object_a_leak" ||
        reason.includes("expected_attribution"),
      "delayed TOCTOU proxy",
    )
  })

  test("sparse arrays fail closed at the sparse-array gate", () => {
    const pkg = scaffoldPackage()
    const sparseMutated = { p: 3, q: "clean", r: [1, , 3] }
    const sparsePkg = {
      ...pkg,
      cases: {
        ...pkg.cases,
        M_P: { mutant_id: "M_P", baseline: BASELINE, mutated: sparseMutated },
      },
    }
    expect(() => acceptObjectA({ pkg: sparsePkg, intended: intendedFrom(pkg) })).not.toThrow()
    const accepted = acceptObjectA({ pkg: sparsePkg, intended: intendedFrom(pkg) })
    expectObjectAFailClosed(
      accepted,
      (reason) => reason.includes("sparse arrays are forbidden"),
      "hole in mutated.r",
    )
  })

  test("cyclic structures fail closed at the cycle gate", () => {
    const cyclicE0 = scaffoldE0Fields() as Record<string, unknown>
    cyclicE0.oracle_commitment = cyclicE0
    expect(() => acceptE0Record(cyclicE0)).not.toThrow()
    expectE0FailClosed(
      acceptE0Record(cyclicE0),
      (reason) => reason.includes("cyclic structure"),
      "E0 cycle",
    )

    const cyclicOracle: Record<string, unknown> = { schema: INTERNAL_ORACLE_CODEC, note: "scaffold-test-only.not-a-real-oracle" }
    cyclicOracle.self = cyclicOracle
    expect(() => encodeInternalOracleUtf8Lf(cyclicOracle)).not.toThrow()
    const encoded = encodeInternalOracleUtf8Lf(cyclicOracle)
    expect(encoded.ok).toBe(false)
    if (!encoded.ok) {
      expect(encoded.bytes).toBeNull()
      expect(encoded.reasons.some((reason) => reason.includes("cyclic structure"))).toBe(true)
    }
  })

  test("over-deep nesting is denied at the graph-depth gate", () => {
    let deep: unknown = { leaf: "scaffold-test-only" }
    for (let i = 0; i < 40; i += 1) deep = { nested: deep }
    expect(() => encodeInternalOracleUtf8Lf(deep)).not.toThrow()
    const encoded = encodeInternalOracleUtf8Lf(deep)
    expect(encoded.ok).toBe(false)
    if (!encoded.ok) {
      expect(encoded.bytes).toBeNull()
      expect(encoded.reasons.some((reason) => reason.includes("graph depth denied"))).toBe(true)
    }

    const nestedE0 = scaffoldE0Fields() as Record<string, unknown>
    nestedE0.oracle_commitment = deep
    expect(() => acceptE0Record(nestedE0)).not.toThrow()
    expectE0FailClosed(
      acceptE0Record(nestedE0),
      (reason) => reason.includes("graph depth denied"),
      "E0 depth",
    )
  })

  test.skipIf(!SHARED_ARRAY_BUFFER_AVAILABLE)(
    SHARED_ARRAY_BUFFER_AVAILABLE
      ? "SharedArrayBuffer-backed Uint8Array is copied on accept so later backing-store mutation cannot change digest"
      : "SharedArrayBuffer-backed Uint8Array skipped: runtime cannot construct SharedArrayBuffer",
    () => {
      const pkg = scaffoldPackage()
      const intended = intendedFrom(pkg)
      const accepted = acceptObjectA({ pkg, intended })
      expect(accepted.ok).toBe(true)
      if (!accepted.ok) return
      const sab = new SharedArrayBuffer(accepted.bytes.byteLength)
      const view = new Uint8Array(sab)
      view.set(accepted.bytes)
      const fromBytes = acceptObjectAFromBytes({ bytes: view, intended })
      expect(fromBytes.ok).toBe(true)
      if (!fromBytes.ok) return
      const digest = fromBytes.digest
      const firstByte = fromBytes.bytes[0]
      view[0] ^= 0xff
      expect(fromBytes.digest).toBe(digest)
      expect(fromBytes.bytes[0]).toBe(firstByte)
      expect(IndependentAuthority.digestBlindProblemBytes(fromBytes.bytes)).toBe(digest)
      expect(fromBytes.package).toEqual(accepted.package)

      const nonceSab = new SharedArrayBuffer(32)
      const nonceView = new Uint8Array(nonceSab)
      nonceView.fill(0x11)
      const oracle_bytes = testOnlyOracleBytes()
      const committed = commitOriginatorE0({ pkg, intended, nonce: nonceView, oracle_bytes })
      expect(committed.ok).toBe(true)
      if (!committed.ok) return
      const commitment = committed.record.oracle_commitment
      nonceView[0] = 0x22
      expect(committed.record.oracle_commitment).toBe(commitment)
      const rebound = bindOracleCommitment({
        instance_id: committed.record.instance_id,
        problem_package_sha256: committed.record.problem_package_sha256,
        nonce: nonceView,
        oracle_bytes,
      })
      expect(rebound.ok).toBe(true)
      if (!rebound.ok) return
      expect(rebound.commitment).not.toBe(commitment)
    },
  )

  test.skipIf(!SUBCLASSED_UINT8ARRAY_AVAILABLE)(
    SUBCLASSED_UINT8ARRAY_AVAILABLE
      ? "subclassed Uint8Array is copied on accept so later alias mutation cannot change digest"
      : "subclassed Uint8Array skipped: runtime cannot construct a Uint8Array subclass",
    () => {
      class TestOnlyUint8Array extends Uint8Array {}
      const pkg = scaffoldPackage()
      const intended = intendedFrom(pkg)
      const canonical = IndependentAuthority.encodeJsonUtf8Lf(pkg)
      const aliased = new TestOnlyUint8Array(canonical)
      const accepted = acceptObjectA({ pkg, intended, claimed_bytes: aliased })
      expect(accepted.ok).toBe(true)
      if (!accepted.ok) return
      const digest = accepted.digest
      const firstByte = accepted.bytes[0]
      aliased[0] ^= 0xff
      expect(accepted.digest).toBe(digest)
      expect(accepted.bytes[0]).toBe(firstByte)
      expect(accepted.bytes[0]).not.toBe(aliased[0])
      expect(IndependentAuthority.digestBlindProblemBytes(accepted.bytes)).toBe(digest)
    },
  )

  test("caller mutation after acceptance cannot change frozen package, record, or accepted digest", () => {
    const pkg = scaffoldPackage()
    const intended = intendedFrom(pkg)
    const accepted = acceptObjectA({ pkg, intended })
    expect(accepted.ok).toBe(true)
    if (!accepted.ok) return
    const committed = commitOriginatorE0({
      pkg,
      intended,
      nonce: TEST_ONLY_NONCE_32_0x11,
      oracle_bytes: testOnlyOracleBytes(),
    })
    expect(committed.ok).toBe(true)
    if (!committed.ok) return
    const digest = accepted.digest
    const instanceId = accepted.package.instance_id
    const mutatedR0 = accepted.package.cases.M_P.mutated.r[0]
    const commitment = committed.record.oracle_commitment
    pkg.instance_id = "scaffold-test-instance.not-production.mutated-after-accept"
    ;(pkg.cases.M_P.mutated.r as number[])[0] = 99
    expect(accepted.package.instance_id).toBe(instanceId)
    expect(accepted.package.cases.M_P.mutated.r[0]).toBe(mutatedR0)
    expect(accepted.digest).toBe(digest)
    expect(committed.record.oracle_commitment).toBe(commitment)
    expect(committed.record.instance_id).toBe(instanceId)
    expect(() => {
      ;(accepted.package as { instance_id: string }).instance_id = "frozen-mutation"
    }).toThrow()
    expect(() => {
      ;(committed.record as { oracle_commitment: string }).oracle_commitment = "ee".repeat(32)
    }).toThrow()
    expect(Object.isFrozen(accepted.package)).toBe(true)
    expect(Object.isFrozen(committed.record)).toBe(true)
  })

  test("map key !== invariant_id / mutant_id is an identity mismatch, not an Object.keys duplicate", () => {
    const pkg = scaffoldPackage()
    const intended = intendedFrom(pkg)
    const invariantMismatch = acceptObjectA({
      pkg: {
        ...pkg,
        invariants: {
          ...pkg.invariants,
          I_P: { ...pkg.invariants.I_P, invariant_id: "I_Q" },
        },
      },
      intended,
    })
    expectObjectAFailClosed(
      invariantMismatch,
      (reason) => reason === "A.invariants.I_P: map key must equal invariant_id",
      "invariant identity",
    )

    const caseMismatch = acceptObjectA({
      pkg: {
        ...pkg,
        cases: {
          ...pkg.cases,
          M_P: { ...pkg.cases.M_P, mutant_id: "M_Q" },
        },
      },
      intended,
    })
    expectObjectAFailClosed(
      caseMismatch,
      (reason) => reason === "A.cases.M_P: map key must equal mutant_id",
      "case identity",
    )
  })

  test("E0 JSON-domain nonce/oracle fields hit the extra/forbidden-key gate", () => {
    const withJsonSecrets = {
      ...scaffoldE0Fields(),
      nonce: "test-only-json-domain-nonce",
      oracle: { note: "test-only-json-domain-oracle" },
    }
    expect(() => acceptE0Record(withJsonSecrets)).not.toThrow()
    const rejected = acceptE0Record(withJsonSecrets)
    expectE0FailClosed(
      rejected,
      (reason) => reason === "E0.nonce: nonce/oracle/answer fields are forbidden on the public E0 record",
      "forbidden nonce",
    )
    expectE0FailClosed(
      rejected,
      (reason) => reason === "E0.oracle: nonce/oracle/answer fields are forbidden on the public E0 record",
      "forbidden oracle",
    )
    expect(rejected.ok).toBe(false)
    if (!rejected.ok) {
      expect(rejected.reasons).toContain("E0.nonce: unexpected key")
      expect(rejected.reasons).toContain("E0.oracle: unexpected key")
    }
  })

  test("returned byte buffers are copies; mutating them cannot change digest or record semantics", () => {
    // Returned `bytes` are copies of the canonical encoding, not aliases of
    // caller memory. In-place mutation of that copy must not rewrite the frozen
    // package/record or the already-returned digest string; re-encoding the
    // frozen snapshot must still match the accepted digest.
    const pkg = scaffoldPackage()
    const intended = intendedFrom(pkg)
    const accepted = acceptObjectA({ pkg, intended })
    expect(accepted.ok).toBe(true)
    if (!accepted.ok) return
    const digest = accepted.digest
    const originalFirst = accepted.bytes[0]
    accepted.bytes[0] ^= 0xff
    expect(accepted.digest).toBe(digest)
    expect(accepted.package.instance_id).toBe(pkg.instance_id)
    expect(IndependentAuthority.digestBlindProblemBytes(IndependentAuthority.encodeJsonUtf8Lf(accepted.package))).toBe(
      digest,
    )
    expect(accepted.bytes[0]).not.toBe(originalFirst)

    const committed = commitOriginatorE0({
      pkg,
      intended,
      nonce: TEST_ONLY_NONCE_32_0x11,
      oracle_bytes: testOnlyOracleBytes(),
    })
    expect(committed.ok).toBe(true)
    if (!committed.ok) return
    const record = { ...committed.record }
    const commitment = committed.record.oracle_commitment
    committed.bytes[0] ^= 0xff
    expect(committed.record.oracle_commitment).toBe(commitment)
    expect(committed.record).toEqual(record)
    expect(IndependentAuthority.encodeJsonUtf8Lf(committed.record).equals(IndependentAuthority.encodeJsonUtf8Lf(record))).toBe(
      true,
    )
  })
})

describe("scaffold cannot mint production claims", () => {
  test("production_publishable remains false and PROVEN cannot be minted", () => {
    const pkg = scaffoldPackage()
    const intended = intendedFrom(pkg)
    const accepted = acceptObjectA({ pkg, intended })
    expect(accepted.ok).toBe(true)
    if (!accepted.ok) return
    const committed = commitOriginatorE0({
      pkg,
      intended,
      nonce: TEST_ONLY_NONCE_32_0x11,
      oracle_bytes: testOnlyOracleBytes(),
    })
    expect(committed.ok).toBe(true)
    if (!committed.ok) return
    expect(accepted.production_publishable).toBe(false)
    expect(committed.production_publishable).toBe(false)
    expect(accepted.sufficient_for_real_object_a).toBe(false)
    expect(committed.sufficient_for_real_object_a).toBe(false)
    const production = evaluateProductionIndependentGrounding({
      pkg: accepted.package,
      intended,
      problem_package_digest: accepted.digest,
      observed_attribution: {},
      authority: null,
      authority_bytes_sha256: null,
      generic_envelope: null,
    })
    expect(production.independent_grounding).toBe("UNPROVEN")
    expect(production.production_publishable).toBe(false)
    expect(asProductionGroundingEvidence(production)).toBeNull()
  })
})
