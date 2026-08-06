import { describe, expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { canonicalize } from "../../src/receiptos/canon/canonicalize"
import * as auditBoundary from "../../src/receiptos/challenge/counterfactual-audit-boundary"
import {
  computeCounterfactualManifestFileSha256,
  snapshotCounterfactualSemanticJson,
} from "../../src/receiptos/challenge/counterfactual-audit-boundary"

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

/** Non-normative test witness only; this is not a Counterfactual identity formula. */
function testOnlySemanticWitness(value: unknown): string {
  const snapshot = snapshotCounterfactualSemanticJson(value)
  const bytes = new TextEncoder().encode(canonicalize(snapshot))
  return `test-witness-sha256:${createHash("sha256").update(bytes).digest("hex")}`
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

describe("Counterfactual reserved audit metadata", () => {
  test("production exports no generic semantic digest or reference constructor", () => {
    expect("computeCounterfactualSemanticArtifactRef" in auditBoundary).toBe(false)
  })

  test("rejects audit_timestamp at the root and every tested nested shape", () => {
    expect(() => snapshotCounterfactualSemanticJson({ audit_timestamp: "root" }))
      .toThrow('$semantic_artifact["audit_timestamp"]')
    expect(() => snapshotCounterfactualSemanticJson({ nested: { audit_timestamp: "object" } }))
      .toThrow('$semantic_artifact["nested"]["audit_timestamp"]')
    expect(() => snapshotCounterfactualSemanticJson({ nested: [{ audit_timestamp: "array" }] }))
      .toThrow('$semantic_artifact["nested"][0]["audit_timestamp"]')
  })

  test("manifest-level timestamp changes and removal preserve only a test-local semantic witness", () => {
    const earlier = reviewManifest("2026-07-27T12:00:00Z")
    const later = reviewManifest("2026-08-05T12:00:00Z")
    const absent = reviewManifest()

    const witness = testOnlySemanticWitness(earlier.semantic_artifact)
    expect(testOnlySemanticWitness(later.semantic_artifact)).toBe(witness)
    expect(testOnlySemanticWitness(absent.semantic_artifact)).toBe(witness)
  })

  test("semantic mutation changes the non-normative test witness", () => {
    const baseline = reviewManifest()
    const mutated = reviewManifest()
    mutated.semantic_artifact.expected_conformance_observation = "incorrectly promote observation"

    expect(testOnlySemanticWitness(mutated.semantic_artifact)).not.toBe(
      testOnlySemanticWitness(baseline.semantic_artifact),
    )
  })
})

describe("strict descriptor-based JSON snapshot", () => {
  test("rejects a changing accessor without invoking it", () => {
    let reads = 0
    const input = Object.defineProperty({}, "payload", {
      enumerable: true,
      get() {
        reads += 1
        return reads === 1 ? "safe" : { audit_timestamp: "forbidden" }
      },
    })

    expect(() => snapshotCounterfactualSemanticJson(input)).toThrow("accessor properties are forbidden")
    expect(reads).toBe(0)
  })

  test("captures each accepted data descriptor once and never invokes property get", () => {
    let descriptorReads = 0
    let propertyReads = 0
    const target = { payload: "safe" }
    const input = new Proxy(target, {
      get() {
        propertyReads += 1
        throw new Error("property value was reread")
      },
      getOwnPropertyDescriptor(object, key) {
        descriptorReads += 1
        return Reflect.getOwnPropertyDescriptor(object, key)
      },
    })

    const snapshot = snapshotCounterfactualSemanticJson(input)
    expect(canonicalize(snapshot)).toBe('{"payload":"safe"}')
    expect(descriptorReads).toBe(1)
    expect(propertyReads).toBe(0)
  })

  test("rejects Date, Map, Set, RegExp, typed arrays, ArrayBuffer, and class instances", () => {
    class Example {}
    const invalid = [
      new Date("2026-08-05T00:00:00Z"),
      new Map(),
      new Set(),
      /audit_timestamp/,
      new Uint8Array([1, 2, 3]),
      new ArrayBuffer(4),
      new Example(),
    ]
    for (const value of invalid) {
      expect(() => snapshotCounterfactualSemanticJson(value)).toThrow("objects must use Object.prototype or null")
    }
  })

  test("accepts null-prototype plain objects and returns null-prototype snapshots", () => {
    const input: Record<string, unknown> = Object.create(null)
    input.z = 2
    input.a = { accepted: true }

    const snapshot = snapshotCounterfactualSemanticJson(input)
    expect(Object.getPrototypeOf(snapshot)).toBeNull()
    expect(canonicalize(snapshot)).toBe('{"a":{"accepted":true},"z":2}')
  })

  test("rejects inherited enumerable state", () => {
    const input = Object.create({ inherited: true })
    input.own = "value"
    expect(() => snapshotCounterfactualSemanticJson(input)).toThrow("objects must use Object.prototype or null")
  })

  test("rejects sparse arrays instead of colliding with empty arrays", () => {
    expect(() => snapshotCounterfactualSemanticJson(Array(1))).toThrow("sparse arrays are forbidden")
    expect(canonicalize(snapshotCounterfactualSemanticJson([]))).toBe("[]")
  })

  test("rejects arrays with extra string properties", () => {
    const input = ["value"] as string[] & { extra?: string }
    input.extra = "forbidden"
    expect(() => snapshotCounterfactualSemanticJson(input)).toThrow("extra array properties are forbidden")
  })

  test("rejects accessor, symbol-keyed, and non-enumerable object properties", () => {
    const accessor = Object.defineProperty({}, "value", { enumerable: true, get: () => "x" })
    const symbolKeyed = { accepted: true, [Symbol("hidden")]: "value" }
    const nonEnumerable = Object.defineProperty({ accepted: true }, "hidden", { value: "value" })

    expect(() => snapshotCounterfactualSemanticJson(accessor)).toThrow("accessor properties are forbidden")
    expect(() => snapshotCounterfactualSemanticJson(symbolKeyed)).toThrow("symbol-keyed own properties are forbidden")
    expect(() => snapshotCounterfactualSemanticJson(nonEnumerable)).toThrow("non-enumerable properties are forbidden")
  })

  test("rejects values outside the JSON domain and non-finite numbers", () => {
    const invalid = [undefined, 1n, () => "value", Symbol("value"), Number.NaN, Infinity, -Infinity]
    for (const value of invalid) {
      expect(() => snapshotCounterfactualSemanticJson(value)).toThrow()
    }
  })

  test("rejects proxy behavior that prevents a stable snapshot", () => {
    const input = new Proxy({}, {
      ownKeys() {
        throw new Error("unstable")
      },
    })
    expect(() => snapshotCounterfactualSemanticJson(input))
      .toThrow("unable to obtain a stable own-property snapshot")
  })

  test("selects the same first error regardless of object insertion order", () => {
    const zFirst = { z: { audit_timestamp: "x" }, a: { audit_timestamp: "x" } }
    const aFirst = { a: { audit_timestamp: "x" }, z: { audit_timestamp: "x" } }
    const first = capturedError(() => snapshotCounterfactualSemanticJson(zFirst))
    const second = capturedError(() => snapshotCounterfactualSemanticJson(aFirst))

    expect(first).toBe(second)
    expect(first).toContain('$semantic_artifact["a"]["audit_timestamp"]')
  })

  test("snapshot traversal is independent of object insertion order", () => {
    const zFirst = { z: 2, a: { y: true, b: null } }
    const aFirst = { a: { b: null, y: true }, z: 2 }
    expect(canonicalize(snapshotCounterfactualSemanticJson(zFirst))).toBe(
      canonicalize(snapshotCounterfactualSemanticJson(aFirst)),
    )
  })

  test("snapshot is isolated from later input mutation and is the only canonicalized value", () => {
    const input: Record<string, unknown> = { nested: { value: "original" }, items: [1, 2] }
    const snapshot = snapshotCounterfactualSemanticJson(input)
    const before = canonicalize(snapshot)

    ;(input.nested as Record<string, unknown>).value = "changed"
    ;(input.nested as Record<string, unknown>).audit_timestamp = "added later"
    ;(input.items as number[]).push(3)

    expect(canonicalize(snapshot)).toBe(before)
    expect(canonicalize(snapshot)).not.toContain("audit_timestamp")
  })
})

describe("exact manifest file-byte hashing", () => {
  test("changing timestamp bytes changes the raw manifest-file hash", () => {
    const earlierBytes = `${JSON.stringify(reviewManifest("2026-07-27T12:00:00Z"), null, 2)}\n`
    const laterBytes = `${JSON.stringify(reviewManifest("2026-08-05T12:00:00Z"), null, 2)}\n`
    expect(computeCounterfactualManifestFileSha256(earlierBytes)).not.toBe(
      computeCounterfactualManifestFileSha256(laterBytes),
    )
  })

  test("Unicode strings hash as one UTF-8 encoding of the same Uint8Array", () => {
    const input = "аудит Δ😀 2026-08-05T12:00:00Z"
    expect(computeCounterfactualManifestFileSha256(input)).toBe(
      computeCounterfactualManifestFileSha256(new TextEncoder().encode(input)),
    )
  })

  test("changing Unicode timestamp or adjacent audit metadata changes raw bytes and hash", () => {
    const first = JSON.stringify({ audit_timestamp: "епоха-α", audit_note: "перевірка" })
    const second = JSON.stringify({ audit_timestamp: "епоха-β", audit_note: "перевірка!" })
    expect(new TextEncoder().encode(first)).not.toEqual(new TextEncoder().encode(second))
    expect(computeCounterfactualManifestFileSha256(first)).not.toBe(
      computeCounterfactualManifestFileSha256(second),
    )
  })

  test("arbitrary Uint8Array input is hashed byte-exactly", () => {
    const bytes = new Uint8Array([0x00, 0xff, 0x01, 0x80, 0x0a])
    const independentOracle = createHash("sha256").update(bytes).digest("hex")
    expect(computeCounterfactualManifestFileSha256(bytes)).toBe(independentOracle)
  })
})
