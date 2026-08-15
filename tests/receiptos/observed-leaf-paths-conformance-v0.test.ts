/**
 * observedLeafPathsV0 conformance v0.
 *
 * SPEC_READINESS_CLOSURE_V0, closure item A. Closed-world observed-pair
 * coverage rests on two distinct mechanically-checked primitives:
 * canonicalIdentityJson (value comparison, see
 * canonical-identity-json-conformance-v0) and the structural PATH WALKER
 * (observedLeafPathsV0), which enumerates which paths exist at all. Prior
 * to this closure, only the former had a conformance vector corpus. This
 * file supplies the latter, freezing exact current behavior rather than
 * inventing prettier semantics -- every vector below was verified against
 * the real implementation before being written.
 *
 * The vectors themselves live in
 * conformance/observed-leaf-paths-conformance-v0/vectors.json, a
 * plain-data JSON artifact with no TypeScript/production-code dependency,
 * consumable by a future non-TypeScript implementation without importing
 * this repository's source.
 *
 * Four deliberately-broken mutants are exercised here (array
 * index-decomposition, null-leaf dropping, empty-object-as-present-leaf,
 * target-only-path ignoring), each reimplemented independently in this
 * file -- never derived from or delegating to the real walker. This is
 * load-bearing: if a mutant passed, the vector set would be insufficient
 * to distinguish the real walker from a broken one.
 */

import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { observedLeafPathsV0 } from "../../src/receiptos/challenge/transformation-stability-coverage"

const VECTORS_PATH = resolve(import.meta.dir, "..", "..", "conformance", "observed-leaf-paths-conformance-v0", "vectors.json")

type WalkVectorV0 = {
  readonly vector_id: string
  readonly description: string
  readonly root?: unknown
  readonly roots?: readonly unknown[]
  readonly expected_paths: Record<string, unknown>
}

type PairwiseVectorV0 = {
  readonly vector_id: string
  readonly description: string
  readonly source: unknown
  readonly target: unknown
  readonly expected_universe: readonly string[]
  readonly expected_presence: Record<string, { source: boolean; target: boolean }>
}

type MutantV0 = {
  readonly mutant_id: string
  readonly description: string
  readonly wrongly_diverges_on_vector_ids?: readonly string[]
  readonly wrongly_diverges_on_pairwise_vector_ids?: readonly string[]
}

type VectorFileV0 = {
  readonly schema: string
  readonly walk_vectors: readonly WalkVectorV0[]
  readonly pairwise_vectors: readonly PairwiseVectorV0[]
  readonly mutants: readonly MutantV0[]
}

const VECTOR_FILE: VectorFileV0 = JSON.parse(readFileSync(VECTORS_PATH, "utf8"))

// ---------------------------------------------------------------------------
// Special-marker resolution, matching vectors.json's format_notes.
// ---------------------------------------------------------------------------

const SPECIAL_UNDEFINED = "$special:undefined"
const SPECIAL_NON_FINITE = "$special:non_finite"

function resolveSpecials(value: unknown): unknown {
  if (value === SPECIAL_UNDEFINED) return undefined
  if (value === SPECIAL_NON_FINITE) return Infinity
  if (Array.isArray(value)) return value.map((entry) => resolveSpecials(entry))
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(record)) out[key] = resolveSpecials(record[key])
    return out
  }
  return value
}

function walkResultToPlainObject(map: Map<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [path, value] of map) out[path] = value
  return out
}

// deepEqual that treats NaN/undefined/Infinity correctly for this file's
// purposes (bun's `toEqual` already handles this, but a plain-object
// wrapper keeps the per-vector assertions uniform regardless of whether a
// path's value is itself `undefined`-containing).
function vectorById(vectorId: string): WalkVectorV0 {
  const found = VECTOR_FILE.walk_vectors.find((v) => v.vector_id === vectorId)
  if (!found) throw new Error(`walk vector not found: ${vectorId}`)
  return found
}

function pairwiseVectorById(vectorId: string): PairwiseVectorV0 {
  const found = VECTOR_FILE.pairwise_vectors.find((v) => v.vector_id === vectorId)
  if (!found) throw new Error(`pairwise vector not found: ${vectorId}`)
  return found
}

// ---------------------------------------------------------------------------
// Real walker, run against every vector.
// ---------------------------------------------------------------------------

describe("observedLeafPathsV0 conformance v0: real walker", () => {
  test("vector file is self-consistent (schema present, required minimum coverage)", () => {
    expect(VECTOR_FILE.schema).toBe("receiptos.observed_leaf_paths_conformance_vectors.v0")
    expect(VECTOR_FILE.walk_vectors.length).toBeGreaterThanOrEqual(15)
    expect(VECTOR_FILE.pairwise_vectors.length).toBeGreaterThanOrEqual(3)
    expect(VECTOR_FILE.mutants.length).toBeGreaterThanOrEqual(4)
  })

  for (const vector of VECTOR_FILE.walk_vectors) {
    test(`${vector.vector_id}: ${vector.description}`, () => {
      const expected = resolveSpecials(vector.expected_paths)
      if (vector.roots) {
        for (const root of vector.roots) {
          const actual = walkResultToPlainObject(observedLeafPathsV0(resolveSpecials(root)))
          expect(actual).toEqual(expected as Record<string, unknown>)
        }
      } else {
        const actual = walkResultToPlainObject(observedLeafPathsV0(resolveSpecials(vector.root)))
        expect(actual).toEqual(expected as Record<string, unknown>)
      }
    })
  }
})

describe("observedLeafPathsV0 conformance v0: pairwise observed-pair universe", () => {
  for (const vector of VECTOR_FILE.pairwise_vectors) {
    test(`${vector.vector_id}: ${vector.description}`, () => {
      const sourceLeaves = observedLeafPathsV0(resolveSpecials(vector.source))
      const targetLeaves = observedLeafPathsV0(resolveSpecials(vector.target))
      const universe = new Set<string>([...sourceLeaves.keys(), ...targetLeaves.keys()])

      expect([...universe].sort()).toEqual([...vector.expected_universe].sort())

      for (const [path, presence] of Object.entries(vector.expected_presence)) {
        expect(sourceLeaves.has(path)).toBe(presence.source)
        expect(targetLeaves.has(path)).toBe(presence.target)
      }
    })
  }
})

// ---------------------------------------------------------------------------
// Mutant walkers. Each is a full, independent reimplementation with
// exactly one deliberate flaw -- never derived from or delegating to the
// real observedLeafPathsV0.
// ---------------------------------------------------------------------------

function isPlainObjectLocal(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function mutantDecomposeArraysByIndex(value: unknown, prefix: string, out: Map<string, unknown>): void {
  if (Array.isArray(value)) {
    // The flaw: decompose per-index instead of storing the whole array.
    value.forEach((entry, index) => {
      const childPath = prefix.length > 0 ? `${prefix}.${index}` : String(index)
      mutantDecomposeArraysByIndex(entry, childPath, out)
    })
    return
  }
  if (isPlainObjectLocal(value)) {
    for (const key of Object.keys(value).sort()) {
      const childValue = value[key]
      if (childValue === undefined) continue
      const childPath = prefix.length > 0 ? `${prefix}.${key}` : key
      mutantDecomposeArraysByIndex(childValue, childPath, out)
    }
    return
  }
  if (prefix.length > 0) out.set(prefix, value)
}

function mutantDropNullValuedLeaves(value: unknown, prefix: string, out: Map<string, unknown>): void {
  if (Array.isArray(value)) {
    if (prefix.length > 0) out.set(prefix, value)
    return
  }
  if (isPlainObjectLocal(value)) {
    for (const key of Object.keys(value).sort()) {
      const childValue = value[key]
      // The flaw: treat a null-valued key the same as an absent one.
      if (childValue === undefined || childValue === null) continue
      const childPath = prefix.length > 0 ? `${prefix}.${key}` : key
      mutantDropNullValuedLeaves(childValue, childPath, out)
    }
    return
  }
  if (prefix.length > 0) out.set(prefix, value)
}

function mutantRecordEmptyObjectAsPresentLeaf(value: unknown, prefix: string, out: Map<string, unknown>): void {
  if (Array.isArray(value)) {
    if (prefix.length > 0) out.set(prefix, value)
    return
  }
  if (isPlainObjectLocal(value)) {
    const keys = Object.keys(value).sort()
    // The flaw: unlike the real walker, an empty object gets its own
    // recorded leaf instead of contributing zero paths.
    if (keys.length === 0 && prefix.length > 0) {
      out.set(prefix, value)
      return
    }
    for (const key of keys) {
      const childValue = value[key]
      if (childValue === undefined) continue
      const childPath = prefix.length > 0 ? `${prefix}.${key}` : key
      mutantRecordEmptyObjectAsPresentLeaf(childValue, childPath, out)
    }
    return
  }
  if (prefix.length > 0) out.set(prefix, value)
}

function runMutantWalker(walker: (value: unknown, prefix: string, out: Map<string, unknown>) => void, root: unknown): Map<string, unknown> {
  const out = new Map<string, unknown>()
  walker(root, "", out)
  return out
}

// Pairwise-level mutant: ignores target-only paths in the union.
function mutantUnionIgnoringTargetOnly(sourceLeaves: Map<string, unknown>, _targetLeaves: Map<string, unknown>): Set<string> {
  return new Set(sourceLeaves.keys())
}

const WALK_MUTANT_IMPLEMENTATIONS: Readonly<Record<string, (value: unknown, prefix: string, out: Map<string, unknown>) => void>> =
  Object.freeze({
    decompose_arrays_by_index: mutantDecomposeArraysByIndex,
    drop_null_valued_leaves: mutantDropNullValuedLeaves,
    record_empty_object_as_present_leaf: mutantRecordEmptyObjectAsPresentLeaf,
  })

describe("observedLeafPathsV0 conformance v0: mutant rejection (load-bearing)", () => {
  test("every walk mutant declared in vectors.json has a corresponding implementation in this file", () => {
    for (const mutant of VECTOR_FILE.mutants) {
      if (mutant.wrongly_diverges_on_vector_ids) {
        expect(WALK_MUTANT_IMPLEMENTATIONS[mutant.mutant_id]).toBeDefined()
      }
    }
  })

  for (const mutant of VECTOR_FILE.mutants.filter((m) => m.wrongly_diverges_on_vector_ids)) {
    describe(`mutant: ${mutant.mutant_id} -- ${mutant.description}`, () => {
      const implementation = WALK_MUTANT_IMPLEMENTATIONS[mutant.mutant_id]!

      for (const vectorId of mutant.wrongly_diverges_on_vector_ids!) {
        test(`diverges from the real walker on ${vectorId}`, () => {
          const vector = vectorById(vectorId)
          const root = resolveSpecials(vector.root)
          const expected = resolveSpecials(vector.expected_paths) as Record<string, unknown>

          const realResult = walkResultToPlainObject(observedLeafPathsV0(root))
          expect(realResult).toEqual(expected)

          const mutantResult = walkResultToPlainObject(runMutantWalker(implementation, root))
          expect(mutantResult).not.toEqual(realResult)
        })
      }
    })
  }

  for (const mutant of VECTOR_FILE.mutants.filter((m) => m.wrongly_diverges_on_pairwise_vector_ids)) {
    describe(`pairwise mutant: ${mutant.mutant_id} -- ${mutant.description}`, () => {
      for (const vectorId of mutant.wrongly_diverges_on_pairwise_vector_ids!) {
        test(`diverges from the real union on ${vectorId}`, () => {
          const vector = pairwiseVectorById(vectorId)
          const sourceLeaves = observedLeafPathsV0(resolveSpecials(vector.source))
          const targetLeaves = observedLeafPathsV0(resolveSpecials(vector.target))

          const realUniverse = new Set<string>([...sourceLeaves.keys(), ...targetLeaves.keys()])
          expect([...realUniverse].sort()).toEqual([...vector.expected_universe].sort())

          const mutantUniverse = mutantUnionIgnoringTargetOnly(sourceLeaves, targetLeaves)
          expect([...mutantUniverse].sort()).not.toEqual([...realUniverse].sort())
        })
      }
    })
  }
})
