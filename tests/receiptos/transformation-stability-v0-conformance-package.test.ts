import { describe, expect, test } from "bun:test"
import { spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { evaluateHandoffTransformationMatrixV0 } from "../../src/receiptos/challenge/transformation-stability-handoff-matrix"

const root = resolve(import.meta.dir, "../..")
const PACKAGE = "conformance/transformation-stability-v0"

const readJson = (relativePath: string) =>
  JSON.parse(readFileSync(resolve(root, relativePath), "utf8"))

const EXPECTED_AGGREGATE = {
  stable: 2,
  history_sensitive: 0,
  unresolved: 1,
  out_of_domain: 1,
  violation: 2,
}

const HANDOFF_VECTOR_IDS = [
  "H-ROUNDTRIP-STABLE",
  "H-KEY-ORDER-REVERSE",
  "H-NORMATIVE-SESSION-ID-MUTATION",
  "H-FORBIDDEN-ANCHOR-CONTRACT-MUTATION",
  "H-SOURCE-SCHEMA-MISMATCH",
  "H-TARGET-RECOMPUTE-UNRESOLVED",
]

const CYCLE_VECTOR_IDS = [
  "stable_closed_cycle",
  "intermediate_violation_restored_endpoint",
  "failed_applicability_out_of_domain",
  "recompute_unresolved_worker_timeout",
]

describe("transformation stability v0 conformance package", () => {
  test("generator reports zero drift", () => {
    const result = spawnSync("bun", [`${PACKAGE}/generate_package.ts`, "--check"], {
      cwd: root,
      encoding: "utf8",
    })
    expect(result.status).toBe(0)
    const parsed = JSON.parse(result.stdout)
    expect(parsed.ok).toBe(true)
    expect(parsed.drifted_paths).toEqual([])
  })

  test("independent TypeScript auditor passes with zero production imports", () => {
    const result = spawnSync("bun", [`${PACKAGE}/audit_package.ts`], {
      cwd: root,
      encoding: "utf8",
    })
    expect(result.status).toBe(0)
    const parsed = JSON.parse(result.stdout)
    expect(parsed.ok).toBe(true)
    expect(parsed.production_imports).toBe(0)
  })

  test("independent Python auditor passes with zero production imports", () => {
    const result = spawnSync("python", [`${PACKAGE}/verify_independent.py`], {
      cwd: root,
      encoding: "utf8",
    })
    expect(result.status).toBe(0)
    const parsed = JSON.parse(result.stdout)
    expect(parsed.ok).toBe(true)
    expect(parsed.production_imports).toBe(0)
  })

  test("contract pins exact Handoff matrix authority", () => {
    const contract = readJson(`${PACKAGE}/contract.json`)
    expect(contract.claim).toBe("normative_preservation")
    expect(contract.handoff_matrix.vector_inventory).toEqual(HANDOFF_VECTOR_IDS)
    expect(contract.handoff_matrix.expected_aggregate).toEqual(EXPECTED_AGGREGATE)
    expect(contract.handoff_matrix.sample_receipt_root).toBe(
      "0x687dc5c00d9241469138bb1c17a06af1b8713b0f84663b55e11d476f4171a6bc",
    )
    expect(contract.handoff_matrix.normative_session_id_mutation_root).toBe(
      "0x41479b4374e63fb0d9f42c03323c6949458a67cadb728e5a2d187c59582bf53e",
    )
    expect(contract.handoff_matrix.anchor_contract_mutation_root).toBe(
      contract.handoff_matrix.sample_receipt_root,
    )
  })

  test("frozen matrix set matches a fresh live recompute from the merged evaluator", async () => {
    const fixture = readJson("src/receiptos/fixtures/session-evidence.sample.json")
    const live = await evaluateHandoffTransformationMatrixV0(fixture)
    const frozen = readJson(`${PACKAGE}/vectors/handoff-matrix-set.json`)

    expect(frozen.aggregate).toEqual(live.aggregate)
    expect(frozen.aggregate).toEqual(EXPECTED_AGGREGATE)
    expect(frozen.pass).toBe(true)
    expect(frozen.members.map((m: { vector_id: string }) => m.vector_id)).toEqual(
      live.members.map((m) => m.vector_id),
    )
    for (let i = 0; i < live.members.length; i += 1) {
      expect(frozen.members[i].observed.classification).toBe(live.members[i]!.observed.classification)
    }
  })

  test("closed-cycle set covers the required four vectors in normative order", () => {
    const contract = readJson(`${PACKAGE}/contract.json`)
    const cycleSet = readJson(`${PACKAGE}/cycles/cycle-set.json`)

    expect(contract.cycle.cycle_vector_inventory).toEqual(CYCLE_VECTOR_IDS)
    expect(cycleSet.cycles.map((c: { cycle_id: string }) => c.cycle_id)).toEqual(CYCLE_VECTOR_IDS)

    const byId = new Map(
      cycleSet.cycles.map((c: { cycle_id: string; observed: unknown }) => [c.cycle_id, c.observed]),
    )
    expect((byId.get("stable_closed_cycle") as { classification: string }).classification).toBe("stable")
    expect(
      (byId.get("intermediate_violation_restored_endpoint") as { classification: string }).classification,
    ).toBe("violation")
    expect(
      (byId.get("failed_applicability_out_of_domain") as { classification: string }).classification,
    ).toBe("out_of_domain")
    expect(
      (byId.get("recompute_unresolved_worker_timeout") as { classification: string }).classification,
    ).toBe("unresolved")
  })

  test("endpoint closure cannot erase the intermediate violation", () => {
    const cycleSet = readJson(`${PACKAGE}/cycles/cycle-set.json`)
    const entry = cycleSet.cycles.find(
      (c: { cycle_id: string }) => c.cycle_id === "intermediate_violation_restored_endpoint",
    )
    // The profile declares two edges (flip, restore) whose normative
    // projections agree again at the endpoint, but the cycle must terminate
    // at the first violating edge and never reach the endpoint comparison.
    expect(entry.input.edges.length).toBe(2)
    expect(entry.observed.edges.length).toBe(1)
    expect(entry.observed.edges[0].edge_id).toBe("flip")
    expect(entry.observed.classification).toBe("violation")
    expect(entry.observed.failed_edge_id).toBe("flip")
    expect(entry.observed.failure_reason).toBe("normative_projection_mismatch")
  })

  test("Lane K observational_stability_evidence claim is not generalized into this package", () => {
    const contract = readJson(`${PACKAGE}/contract.json`)
    expect(contract.forbidden_semantics).toContain("lane_k_violation_class_generalization")
    expect(contract.forbidden_semantics).toContain("endpoint_equality_erases_intermediate_violation")
  })
})
