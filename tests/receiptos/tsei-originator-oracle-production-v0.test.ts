/**
 * Production Originator-oracle private artifact tests.
 *
 * Synthetic grammar only. Not a real worksheet, not a production instance,
 * not Object A/B bytes, and not E0/E1/E2 materialization.
 */

import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, test } from "bun:test"
import { AUTHORITY_ORACLE_SCHEMA } from "../../conformance/tsei-invariant-discrimination-v0/independent-authority-model"
import * as IndependentAuthority from "../../conformance/tsei-invariant-discrimination-v0/independent-authority"
import {
  FROZEN_PROTOCOL_SHA256,
  INTERNAL_ORACLE_CODEC,
  encodeInternalOracleUtf8Lf,
} from "../../conformance/tsei-invariant-discrimination-v0/object-a-e0-contract"
import {
  ORIGINATOR_ASSISTANT_ROLE,
  ORIGINATOR_DECLARED_CASE_IDS,
  ORIGINATOR_DECLARED_INVARIANT_IDS,
  ORIGINATOR_ORACLE_CONSTITUTES_E0,
  ORIGINATOR_ORACLE_LIFECYCLE,
  ORIGINATOR_ORACLE_PRIVATE_PRE_E0_FILENAME,
  ORIGINATOR_ORACLE_SCHEMA,
  ORIGINATOR_SEMANTIC_JUDGMENT,
  POST_E2_INTERNAL_ORACLE_REVEAL_FILENAME,
  acceptOriginatorOracle,
  digestOriginatorOracleBytes,
  materializeOriginatorOracle,
} from "../../conformance/tsei-invariant-discrimination-v0/originator-oracle"

const PROTOCOL_PATH = resolve(
  import.meta.dir,
  "..",
  "..",
  "conformance",
  "tsei-invariant-discrimination-v0",
  "INDEPENDENT_AUTHORITY_BLIND_GROUNDING_PROTOCOL_V0.md",
)
const ORIGINATOR_ORACLE_SOURCE_PATH = resolve(
  import.meta.dir,
  "..",
  "..",
  "conformance",
  "tsei-invariant-discrimination-v0",
  "originator-oracle.ts",
)

const SYNTHETIC_INSTANCE_ID = "scaffold-originator-oracle.not-production"
const SYNTHETIC_PROBLEM_PACKAGE_SHA256 = "ab".repeat(32)

const SYNTHETIC_SETS: { readonly [id: string]: readonly string[] } = {
  c01: [],
  c02: ["I_A"],
  c03: ["I_B"],
  c04: ["I_C"],
  c05: ["I_A", "I_B"],
  c06: ["I_A", "I_C"],
  c07: ["I_B", "I_C"],
  c08: ["I_A", "I_B", "I_C"],
  c09: [],
  c10: ["I_A"],
  c11: ["I_B"],
  c12: ["I_C"],
}

const GOLDEN_ORIGINATOR_ORACLE_UTF8 =
  '{"cases":{"c01":{"mutant_id":"c01","originator_attribution_set":[]},"c02":{"mutant_id":"c02","originator_attribution_set":["I_A"]},"c03":{"mutant_id":"c03","originator_attribution_set":["I_B"]},"c04":{"mutant_id":"c04","originator_attribution_set":["I_C"]},"c05":{"mutant_id":"c05","originator_attribution_set":["I_A","I_B"]},"c06":{"mutant_id":"c06","originator_attribution_set":["I_A","I_C"]},"c07":{"mutant_id":"c07","originator_attribution_set":["I_B","I_C"]},"c08":{"mutant_id":"c08","originator_attribution_set":["I_A","I_B","I_C"]},"c09":{"mutant_id":"c09","originator_attribution_set":[]},"c10":{"mutant_id":"c10","originator_attribution_set":["I_A"]},"c11":{"mutant_id":"c11","originator_attribution_set":["I_B"]},"c12":{"mutant_id":"c12","originator_attribution_set":["I_C"]}},"declared_invariant_ids":["I_A","I_B","I_C"],"instance_id":"scaffold-originator-oracle.not-production","problem_package_sha256":"abababababababababababababababababababababababababababababababab","schema":"tsei-invariant-discrimination-v0.internal-oracle.v0"}\n'

const GOLDEN_ORIGINATOR_ORACLE_SHA256 =
  "36cd4e1a975effcb37dd55d0b034522daa6208fd7274b068703d2356a1998107"

function syntheticCases(sets: { readonly [id: string]: readonly string[] } = SYNTHETIC_SETS): Record<string, unknown> {
  const cases: Record<string, unknown> = {}
  for (const id of ORIGINATOR_DECLARED_CASE_IDS) {
    cases[id] = {
      mutant_id: id,
      originator_attribution_set: [...(sets[id] ?? [])],
    }
  }
  return cases
}

function syntheticArtifact(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema: ORIGINATOR_ORACLE_SCHEMA,
    instance_id: SYNTHETIC_INSTANCE_ID,
    problem_package_sha256: SYNTHETIC_PROBLEM_PACKAGE_SHA256,
    declared_invariant_ids: [...ORIGINATOR_DECLARED_INVARIANT_IDS],
    cases: syntheticCases(),
    ...overrides,
  }
}

function syntheticMaterializeInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    instance_id: SYNTHETIC_INSTANCE_ID,
    problem_package_sha256: SYNTHETIC_PROBLEM_PACKAGE_SHA256,
    cases: syntheticCases(),
    ...overrides,
  }
}

function expectFailClosed(
  result: ReturnType<typeof acceptOriginatorOracle>,
  gate: (reason: string) => boolean,
  label?: string,
): void {
  expect(result.ok, label).toBe(false)
  if (result.ok) return
  expect(result.bytes, label).toBeNull()
  expect(result.digest, label).toBeNull()
  expect(result.artifact, label).toBeNull()
  expect(result.production_publishable, label).toBe(false)
  expect(result.constitutes_e0, label).toBe(false)
  expect(result.lifecycle, label).toBe("PRIVATE_PRE_E0_NOT_E0")
  expect(result.reasons.some(gate), `${label ?? "gate"}: ${result.reasons.join(" | ")}`).toBe(true)
}

describe("frozen identity and privacy boundary", () => {
  test("schema id is the frozen INTERNAL_ORACLE_CODEC name", () => {
    expect(ORIGINATOR_ORACLE_SCHEMA).toBe(INTERNAL_ORACLE_CODEC)
    expect(ORIGINATOR_ORACLE_SCHEMA).toBe("tsei-invariant-discrimination-v0.internal-oracle.v0")
  })

  test("pre-E0 private filename is not the post-E2 reveal name and is not E0", () => {
    expect(ORIGINATOR_ORACLE_PRIVATE_PRE_E0_FILENAME).toBe("originator-oracle.private.json")
    expect(POST_E2_INTERNAL_ORACLE_REVEAL_FILENAME).toBe("internal-oracle-reveal.json")
    expect(ORIGINATOR_ORACLE_PRIVATE_PRE_E0_FILENAME).not.toBe(POST_E2_INTERNAL_ORACLE_REVEAL_FILENAME)
    expect(ORIGINATOR_ORACLE_LIFECYCLE).toBe("PRIVATE_PRE_E0_NOT_E0")
    expect(ORIGINATOR_ORACLE_CONSTITUTES_E0).toBe(false)
  })

  test("semantic judgment is HUMAN_PRIMARY and the module is mechanical-only", () => {
    expect(ORIGINATOR_SEMANTIC_JUDGMENT).toBe("HUMAN_PRIMARY")
    expect(ORIGINATOR_ASSISTANT_ROLE).toBe("MECHANICAL_ONLY")
    const src = readFileSync(ORIGINATOR_ORACLE_SOURCE_PATH, "utf8")
    expect(src).toContain('ORIGINATOR_SEMANTIC_JUDGMENT = "HUMAN_PRIMARY"')
    expect(src).toContain("MECHANICAL_ONLY")
    expect(src).not.toMatch(/\bevaluateViolations\s*\(/)
    expect(src).not.toMatch(/from ["']\.\/model["']/)
    expect(src).not.toContain("readFileSync")
    expect(src).not.toContain("readFile(")
  })

  test("protocol §8.2 freezes production fields, filename, and non-E0 status", () => {
    const text = readFileSync(PROTOCOL_PATH, "utf8")
    expect(text).toContain("tsei-invariant-discrimination-v0.internal-oracle.v0")
    expect(text).toContain("originator_attribution_set")
    expect(text).toContain("originator-oracle.private.json")
    expect(text).toContain("PRIVATE_PRE_E0_NOT_E0")
    expect(text).toContain("internal-oracle-reveal.json")
    expect(text).toContain("This lane still does not mint E0")
    expect(createHash("sha256").update(readFileSync(PROTOCOL_PATH)).digest("hex")).toBe(FROZEN_PROTOCOL_SHA256)
  })
})

describe("synthetic golden bytes", () => {
  test("materialize and accept emit the pinned golden UTF-8/LF bytes and SHA-256", () => {
    const materialized = materializeOriginatorOracle(syntheticMaterializeInput())
    expect(materialized.ok).toBe(true)
    if (!materialized.ok) return
    const accepted = acceptOriginatorOracle(syntheticArtifact())
    expect(accepted.ok).toBe(true)
    if (!accepted.ok) return
    const golden = Buffer.from(GOLDEN_ORIGINATOR_ORACLE_UTF8, "utf8")
    expect(materialized.bytes.equals(golden)).toBe(true)
    expect(accepted.bytes.equals(golden)).toBe(true)
    expect(materialized.digest).toBe(GOLDEN_ORIGINATOR_ORACLE_SHA256)
    expect(accepted.digest).toBe(GOLDEN_ORIGINATOR_ORACLE_SHA256)
    expect(digestOriginatorOracleBytes(materialized.bytes)).toBe(GOLDEN_ORIGINATOR_ORACLE_SHA256)
    expect(IndependentAuthority.encodeJsonUtf8Lf(accepted.artifact).equals(golden)).toBe(true)
    expect(materialized.bytes[materialized.bytes.length - 1]).toBe(0x0a)
    expect(materialized.bytes.includes(0x0d)).toBe(false)
    expect(materialized.bytes.includes(0x00)).toBe(false)
    expect(materialized.bytes[0]).not.toBe(0xef)
    expect(materialized.lifecycle).toBe("PRIVATE_PRE_E0_NOT_E0")
    expect(materialized.constitutes_e0).toBe(false)
    expect(materialized.production_publishable).toBe(false)
  })

  test("empty, singleton, and multi-ID attribution sets round-trip", () => {
    const accepted = acceptOriginatorOracle(syntheticArtifact())
    expect(accepted.ok).toBe(true)
    if (!accepted.ok) return
    expect(accepted.artifact.cases.c01.originator_attribution_set).toEqual([])
    expect(accepted.artifact.cases.c02.originator_attribution_set).toEqual(["I_A"])
    expect(accepted.artifact.cases.c05.originator_attribution_set).toEqual(["I_A", "I_B"])
    expect(accepted.artifact.cases.c08.originator_attribution_set).toEqual(["I_A", "I_B", "I_C"])
  })

  test("unsorted case map insertion still canonicalizes to c01..c12 key order", () => {
    const reversed: Record<string, unknown> = {}
    for (const id of [...ORIGINATOR_DECLARED_CASE_IDS].reverse()) {
      reversed[id] = {
        mutant_id: id,
        originator_attribution_set: [...SYNTHETIC_SETS[id]!],
      }
    }
    const accepted = acceptOriginatorOracle(syntheticArtifact({ cases: reversed }))
    expect(accepted.ok).toBe(true)
    if (!accepted.ok) return
    expect(accepted.bytes.equals(Buffer.from(GOLDEN_ORIGINATOR_ORACLE_UTF8, "utf8"))).toBe(true)
    const body = accepted.bytes.toString("utf8")
    expect(body.indexOf('"c01"')).toBeLessThan(body.indexOf('"c02"'))
    expect(body.indexOf('"c11"')).toBeLessThan(body.indexOf('"c12"'))
  })
})

describe("scaffold {note} is not production", () => {
  test("encodeInternalOracleUtf8Lf still encodes the scaffold codec example", () => {
    const encoded = encodeInternalOracleUtf8Lf({
      schema: INTERNAL_ORACLE_CODEC,
      note: "scaffold-test-only.not-a-real-oracle",
    })
    expect(encoded.ok).toBe(true)
    if (!encoded.ok) return
    expect(encoded.bytes.includes(0x0a)).toBe(true)
  })

  test("accept and materialize reject scaffold {schema, note}", () => {
    const scaffold = {
      schema: INTERNAL_ORACLE_CODEC,
      note: "scaffold-test-only.not-a-real-oracle",
    }
    expect(() => acceptOriginatorOracle(scaffold)).not.toThrow()
    expectFailClosed(
      acceptOriginatorOracle(scaffold),
      (reason) => reason.includes("unexpected key") || reason.includes("missing required key"),
      "accept scaffold note",
    )
    expect(() => materializeOriginatorOracle(scaffold)).not.toThrow()
    expectFailClosed(
      materializeOriginatorOracle(scaffold),
      (reason) => reason.includes("unexpected key") || reason.includes("missing required key"),
      "materialize scaffold note",
    )
  })
})

describe("Object B cannot substitute", () => {
  test("acceptOriginatorOracle rejects AUTHORITY_ORACLE_SCHEMA payloads", () => {
    const objectB = {
      schema: AUTHORITY_ORACLE_SCHEMA,
      problem_package_digest: SYNTHETIC_PROBLEM_PACKAGE_SHA256,
      cases: {
        c01: { mutant_id: "c01", derived_attribution_set: ["I_A"] },
      },
    }
    expect(() => acceptOriginatorOracle(objectB)).not.toThrow()
    expectFailClosed(
      acceptOriginatorOracle(objectB),
      (reason) => reason.includes("authority-oracle") || reason.includes("Object B"),
      "Object B schema",
    )
    expectFailClosed(
      materializeOriginatorOracle({
        schema: AUTHORITY_ORACLE_SCHEMA,
        instance_id: SYNTHETIC_INSTANCE_ID,
        problem_package_sha256: SYNTHETIC_PROBLEM_PACKAGE_SHA256,
        cases: syntheticCases(),
      }),
      (reason) => reason.includes("Object B") || reason.includes("unexpected key"),
      "materialize Object B schema",
    )
  })
})

describe("field controls", () => {
  test("missing, extra, wrong-type, and wrong-version fields fail closed", () => {
    expectFailClosed(
      acceptOriginatorOracle({ ...syntheticArtifact(), schema: undefined }),
      (reason) => reason.includes("missing required key") || reason.includes("schema"),
      "missing schema",
    )
    const missingInstance = syntheticArtifact()
    delete missingInstance.instance_id
    expectFailClosed(
      acceptOriginatorOracle(missingInstance),
      (reason) => reason.includes("instance_id") && reason.includes("missing"),
      "missing instance_id",
    )
    expectFailClosed(
      acceptOriginatorOracle({ ...syntheticArtifact(), note: "forbidden" }),
      (reason) => reason.includes("note") && reason.includes("unexpected"),
      "extra note",
    )
    expectFailClosed(
      acceptOriginatorOracle({ ...syntheticArtifact(), nonce: "00".repeat(32) }),
      (reason) => reason.includes("nonce"),
      "extra nonce",
    )
    expectFailClosed(
      acceptOriginatorOracle({ ...syntheticArtifact(), expected_attribution: ["I_A"] }),
      (reason) => reason.includes("expected_attribution"),
      "extra expected_attribution",
    )
    expectFailClosed(
      acceptOriginatorOracle({
        ...syntheticArtifact(),
        schema: "tsei-invariant-discrimination-v0.internal-oracle.v1",
      }),
      (reason) => reason.includes("schema"),
      "wrong version",
    )
    expectFailClosed(
      acceptOriginatorOracle({ ...syntheticArtifact(), instance_id: "NOT VALID" }),
      (reason) => reason.includes("instance_id"),
      "wrong instance type/shape",
    )
    expectFailClosed(
      acceptOriginatorOracle({ ...syntheticArtifact(), problem_package_sha256: "AB".repeat(32) }),
      (reason) => reason.includes("problem_package_sha256"),
      "uppercase digest",
    )
    expectFailClosed(
      acceptOriginatorOracle({ ...syntheticArtifact(), problem_package_sha256: 1 }),
      (reason) => reason.includes("problem_package_sha256"),
      "digest type lie",
    )
    expectFailClosed(
      acceptOriginatorOracle({ ...syntheticArtifact(), declared_invariant_ids: "I_A,I_B,I_C" }),
      (reason) => reason.includes("declared_invariant_ids"),
      "declared ids type lie",
    )
    expectFailClosed(
      acceptOriginatorOracle({ ...syntheticArtifact(), cases: ORIGINATOR_DECLARED_CASE_IDS.map((id) => ({ mutant_id: id })) }),
      (reason) => reason.includes("must be a map"),
      "cases array",
    )
  })

  test("top-level key insertion order does not change canonical bytes", () => {
    const reordered = {
      cases: syntheticCases(),
      schema: ORIGINATOR_ORACLE_SCHEMA,
      declared_invariant_ids: [...ORIGINATOR_DECLARED_INVARIANT_IDS],
      problem_package_sha256: SYNTHETIC_PROBLEM_PACKAGE_SHA256,
      instance_id: SYNTHETIC_INSTANCE_ID,
    }
    const accepted = acceptOriginatorOracle(reordered)
    expect(accepted.ok).toBe(true)
    if (!accepted.ok) return
    expect(accepted.digest).toBe(GOLDEN_ORIGINATOR_ORACLE_SHA256)
  })
})

describe("case universe controls", () => {
  test("omission, unknown, duplicate-shaped, and mutant_id mismatch fail closed", () => {
    const omitted = syntheticCases()
    delete omitted.c07
    expectFailClosed(
      acceptOriginatorOracle(syntheticArtifact({ cases: omitted })),
      (reason) => reason.includes("c07") && reason.includes("missing"),
      "omit c07",
    )
    const extra = syntheticCases()
    extra.c13 = { mutant_id: "c13", originator_attribution_set: [] }
    expectFailClosed(
      acceptOriginatorOracle(syntheticArtifact({ cases: extra })),
      (reason) => reason.includes("c13") && reason.includes("unexpected"),
      "unknown c13",
    )
    const mismatch = syntheticCases()
    mismatch.c04 = { mutant_id: "c05", originator_attribution_set: ["I_C"] }
    expectFailClosed(
      acceptOriginatorOracle(syntheticArtifact({ cases: mismatch })),
      (reason) => reason.includes("map key must equal mutant_id"),
      "mutant_id mismatch",
    )
    const withDerived = syntheticCases()
    withDerived.c01 = {
      mutant_id: "c01",
      originator_attribution_set: [],
      derived_attribution_set: ["I_A"],
    }
    expectFailClosed(
      acceptOriginatorOracle(syntheticArtifact({ cases: withDerived })),
      (reason) => reason.includes("unexpected key"),
      "derived_attribution_set on case",
    )
  })
})

describe("invariant universe controls", () => {
  test("unsorted, duplicate, unknown, and wrong declared universe fail closed", () => {
    expectFailClosed(
      acceptOriginatorOracle(syntheticArtifact({ declared_invariant_ids: ["I_B", "I_A", "I_C"] })),
      (reason) => reason.includes("declared_invariant_ids"),
      "unsorted declared ids",
    )
    expectFailClosed(
      acceptOriginatorOracle(syntheticArtifact({ declared_invariant_ids: ["I_A", "I_A", "I_B"] })),
      (reason) => reason.includes("duplicate") || reason.includes("declared_invariant_ids"),
      "duplicate declared ids",
    )
    expectFailClosed(
      acceptOriginatorOracle(syntheticArtifact({ declared_invariant_ids: ["I_A", "I_B", "I_P"] })),
      (reason) => reason.includes("unknown") || reason.includes("declared_invariant_ids"),
      "unknown declared id",
    )
    expectFailClosed(
      acceptOriginatorOracle(syntheticArtifact({ declared_invariant_ids: ["I_A", "I_B"] })),
      (reason) => reason.includes("declared_invariant_ids"),
      "missing I_C",
    )
    const unsortedCase = syntheticCases()
    unsortedCase.c05 = { mutant_id: "c05", originator_attribution_set: ["I_B", "I_A"] }
    expectFailClosed(
      acceptOriginatorOracle(syntheticArtifact({ cases: unsortedCase })),
      (reason) => reason.includes("ascending UTF-8"),
      "unsorted attribution set",
    )
    const duplicateCase = syntheticCases()
    duplicateCase.c02 = { mutant_id: "c02", originator_attribution_set: ["I_A", "I_A"] }
    expectFailClosed(
      acceptOriginatorOracle(syntheticArtifact({ cases: duplicateCase })),
      (reason) => reason.includes("duplicate invariant id"),
      "duplicate attribution id",
    )
    const unknownCase = syntheticCases()
    unknownCase.c02 = { mutant_id: "c02", originator_attribution_set: ["I_P"] }
    expectFailClosed(
      acceptOriginatorOracle(syntheticArtifact({ cases: unknownCase })),
      (reason) => reason.includes("unknown invariant id"),
      "unknown attribution id",
    )
  })
})

describe("runtime-untrusted inputs fail closed without throwing", () => {
  test("Proxy, cyclic, getters, and extra keys never throw", () => {
    const proxy = new Proxy(syntheticArtifact(), {
      get(target, prop, receiver) {
        return Reflect.get(target, prop, receiver)
      },
    })
    expect(() => acceptOriginatorOracle(proxy)).not.toThrow()
    expectFailClosed(
      acceptOriginatorOracle(proxy),
      (reason) => reason.includes("Proxy"),
      "Proxy",
    )

    const cyclic = syntheticArtifact() as Record<string, unknown>
    cyclic.self = cyclic
    expect(() => acceptOriginatorOracle(cyclic)).not.toThrow()
    expectFailClosed(
      acceptOriginatorOracle(cyclic),
      (reason) => reason.includes("unexpected key") || reason.includes("cyclic"),
      "cyclic extra key",
    )

    const getterHost: Record<string, unknown> = {}
    Object.assign(getterHost, syntheticArtifact())
    Object.defineProperty(getterHost, "instance_id", {
      get() {
        return SYNTHETIC_INSTANCE_ID
      },
      enumerable: true,
    })
    expect(() => acceptOriginatorOracle(getterHost)).not.toThrow()
    expectFailClosed(
      acceptOriginatorOracle(getterHost),
      (reason) => reason.includes("getter/setter"),
      "getter",
    )

    expect(() => materializeOriginatorOracle(null)).not.toThrow()
    expectFailClosed(
      materializeOriginatorOracle(null),
      (reason) => reason.includes("malformed_originator_oracle_input"),
      "null",
    )
    expect(() => materializeOriginatorOracle("not-an-object")).not.toThrow()
    expectFailClosed(
      materializeOriginatorOracle("not-an-object"),
      (reason) => reason.includes("malformed_originator_oracle_input"),
      "string",
    )
  })
})
