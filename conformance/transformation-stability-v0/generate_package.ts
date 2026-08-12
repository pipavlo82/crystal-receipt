#!/usr/bin/env bun
/**
 * Deterministic Transformation Stability v0 conformance package generator.
 *
 * Package-local only. Imports the already-merged PR #185 Transformation
 * Stability evaluators read-only to materialize a frozen, byte-deterministic
 * package snapshot. Adds no exports to src/** and changes no implementation
 * semantics.
 *
 * Usage:
 *   bun conformance/transformation-stability-v0/generate_package.ts --check
 *   bun conformance/transformation-stability-v0/generate_package.ts --write
 */
import { createHash } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import {
  defineTransformationCycleEdgeV0,
  defineTransformationCycleProfileV0,
  evaluateTransformationCycleV0,
  type AuthenticatedTransformationCycleEdgeV0,
  type HistorySensitivePolicyV0,
  type TransformationStabilityCycleResultV0,
} from "../../src/receiptos/challenge/transformation-stability-cycle"
import { evaluateHandoffTransformationMatrixV0 } from "../../src/receiptos/challenge/transformation-stability-handoff-matrix"

const HERE = resolve(fileURLToPath(new URL(".", import.meta.url)))
const ROOT = resolve(HERE, "../..")
const PACKAGE_DIR = resolve(ROOT, "conformance/transformation-stability-v0")
const FIXTURE_REL = "src/receiptos/fixtures/session-evidence.sample.json"

function usage(): never {
  console.error(
    "Usage: bun conformance/transformation-stability-v0/generate_package.ts --check|--write",
  )
  process.exit(2)
}

const modeArg = process.argv[2]
if (modeArg !== "--check" && modeArg !== "--write") usage()
const mode = modeArg === "--check" ? "check" : "write"

// ---------------------------------------------------------------------------
// Closed-cycle synthetic node domain (package-local; not a src/** addition).
// This is the exact abstract Node/Output shape merged in
// tests/receiptos/transformation-stability-cycle-v0.test.ts, extended with
// one additional frozen vector exercising the already-supported
// "unresolved" recompute path via the `unresolved` field.
// ---------------------------------------------------------------------------

type Node = {
  readonly value: number
  readonly observation: string
  readonly telemetry: string
  readonly forbidden: string
  readonly inDomain: boolean
  readonly unresolved: boolean
}

type Output = {
  readonly verdict: "accept" | "reject"
  readonly observation: string
  readonly telemetry: string
  readonly forbidden: string
}

type FieldOpV0 = {
  readonly op: "set_field"
  readonly field: "value" | "observation" | "telemetry" | "forbidden" | "inDomain" | "unresolved"
  readonly value: string | number | boolean
}

type CycleEdgeSpecV0 = {
  readonly edge_id: string
  readonly ops: readonly FieldOpV0[]
}

type CycleVectorSpecV0 = {
  readonly cycle_id: string
  readonly start_node: Node
  readonly history_sensitive_policy: HistorySensitivePolicyV0
  readonly edges: readonly CycleEdgeSpecV0[]
}

const CYCLE_VECTOR_SPECS: readonly CycleVectorSpecV0[] = [
  {
    cycle_id: "stable_closed_cycle",
    start_node: {
      value: 1,
      observation: "canonical",
      telemetry: "pid-a",
      forbidden: "fixed",
      inDomain: true,
      unresolved: false,
    },
    history_sensitive_policy: "classify",
    edges: [
      { edge_id: "to-pid-b", ops: [{ op: "set_field", field: "telemetry", value: "pid-b" }] },
      { edge_id: "to-pid-a", ops: [{ op: "set_field", field: "telemetry", value: "pid-a" }] },
    ],
  },
  {
    cycle_id: "intermediate_violation_restored_endpoint",
    start_node: {
      value: 1,
      observation: "canonical",
      telemetry: "pid-a",
      forbidden: "fixed",
      inDomain: true,
      unresolved: false,
    },
    history_sensitive_policy: "classify",
    edges: [
      { edge_id: "flip", ops: [{ op: "set_field", field: "value", value: -1 }] },
      { edge_id: "restore", ops: [{ op: "set_field", field: "value", value: 1 }] },
    ],
  },
  {
    cycle_id: "failed_applicability_out_of_domain",
    start_node: {
      value: 1,
      observation: "canonical",
      telemetry: "pid-a",
      forbidden: "fixed",
      inDomain: false,
      unresolved: false,
    },
    history_sensitive_policy: "classify",
    edges: [{ edge_id: "domain", ops: [] }],
  },
  {
    cycle_id: "recompute_unresolved_worker_timeout",
    start_node: {
      value: 1,
      observation: "canonical",
      telemetry: "pid-a",
      forbidden: "fixed",
      inDomain: true,
      unresolved: false,
    },
    history_sensitive_policy: "classify",
    edges: [
      {
        edge_id: "trigger_unresolved",
        ops: [{ op: "set_field", field: "unresolved", value: true }],
      },
    ],
  },
] as const

function applyOps(node: Node, ops: readonly FieldOpV0[]): Node {
  const next: Record<string, unknown> = { ...node }
  for (const entry of ops) next[entry.field] = entry.value
  return next as unknown as Node
}

function buildCycleEdges(spec: CycleVectorSpecV0): AuthenticatedTransformationCycleEdgeV0<Node>[] {
  return spec.edges.map((edgeSpec) =>
    defineTransformationCycleEdgeV0<Node>({
      edge_id: edgeSpec.edge_id,
      precondition: (node) =>
        node.inDomain
          ? { ok: true }
          : { ok: false, reason: `${edgeSpec.edge_id}_out_of_domain` },
      transform: (node) => applyOps(node, edgeSpec.ops),
    }),
  )
}

async function evaluateCycleVector(
  spec: CycleVectorSpecV0,
): Promise<{ cycle_id: string; input: CycleVectorSpecV0; observed: TransformationStabilityCycleResultV0 }> {
  const profile = defineTransformationCycleProfileV0<Node, Output>({
    cycle_profile_id: `transformation-stability-v0:cycle:${spec.cycle_id}`,
    node_object_kind: "transformation-stability-v0-synthetic-node",
    recompute_procedure_id: "transformation-stability-v0-synthetic-recompute",
    comparison_rule_id: "transformation-stability-v0-synthetic-projection",
    history_sensitive_policy: spec.history_sensitive_policy,
    ordered_edges: buildCycleEdges(spec),
    recompute: (node) =>
      node.unresolved
        ? { state: "unresolved", reason: "worker_timeout" }
        : {
            state: "evaluated",
            value: {
              verdict: node.value >= 0 ? "accept" : "reject",
              observation: node.observation,
              telemetry: node.telemetry,
              forbidden: node.forbidden,
            },
          },
    normative_projection: (result) => ({ verdict: result.verdict }),
    stability_projection: (result) => ({ observation: result.observation }),
    allowed_variant_projection: (result) => ({ telemetry: result.telemetry }),
    forbidden_variant_projection: (result) => ({ forbidden: result.forbidden }),
  })

  const observed = await evaluateTransformationCycleV0(profile, spec.start_node)
  return { cycle_id: spec.cycle_id, input: spec, observed }
}

// ---------------------------------------------------------------------------
// Digest helpers (audit-convention canonical JSON; independent of production
// canonicalizer, matches the convention already used by every existing
// conformance package's generate_package.ts / audit_package.ts).
// ---------------------------------------------------------------------------

const shaBytes = (bytes: Uint8Array | Buffer) => createHash("sha256").update(bytes).digest("hex")

function serialize(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

async function main() {
  const fixtureRaw = readFileSync(resolve(ROOT, FIXTURE_REL), "utf8")
  const fixture = JSON.parse(fixtureRaw)

  const matrix = await evaluateHandoffTransformationMatrixV0(fixture)
  const matrixDoc = {
    schema: matrix.schema,
    matrix_id: matrix.matrix_id,
    vector_count: matrix.vector_count,
    aggregate: matrix.aggregate,
    pass: matrix.pass,
    members: matrix.members,
  }

  const cycles = []
  for (const spec of CYCLE_VECTOR_SPECS) cycles.push(await evaluateCycleVector(spec))
  const cycleDoc = {
    schema: "receiptos.transformation_stability_cycle_set.v0",
    cycle_count: cycles.length,
    cycles,
  }

  const matrixPath = resolve(PACKAGE_DIR, "vectors/handoff-matrix-set.json")
  const cyclePath = resolve(PACKAGE_DIR, "cycles/cycle-set.json")
  const manifestPath = resolve(PACKAGE_DIR, "manifest.json")

  const matrixBytes = serialize(matrixDoc)
  const cycleBytes = serialize(cycleDoc)
  const handoffMatrixSetSha256 = shaBytes(Buffer.from(matrixBytes, "utf8"))
  const cycleSetSha256 = shaBytes(Buffer.from(cycleBytes, "utf8"))

  const drifted: string[] = []
  const contract = JSON.parse(readFileSync(resolve(PACKAGE_DIR, "contract.json"), "utf8"))
  if (contract.generated_digests?.handoff_matrix_set_sha256 !== handoffMatrixSetSha256) {
    drifted.push("contract.json:generated_digests.handoff_matrix_set_sha256")
  }
  if (contract.generated_digests?.cycle_set_sha256 !== cycleSetSha256) {
    drifted.push("contract.json:generated_digests.cycle_set_sha256")
  }
  if (contract.handoff_matrix?.expected_aggregate) {
    const expected = contract.handoff_matrix.expected_aggregate
    const actual = matrix.aggregate
    for (const key of ["stable", "history_sensitive", "unresolved", "out_of_domain", "violation"] as const) {
      if (expected[key] !== actual[key]) drifted.push(`contract.json:handoff_matrix.expected_aggregate.${key}`)
    }
  }
  function checkOrWrite(path: string, relLabel: string, bytes: string) {
    if (mode === "write") {
      writeFileSync(path, bytes, "utf8")
      return
    }
    let onDisk: string | null = null
    try {
      onDisk = readFileSync(path, "utf8")
    } catch {
      onDisk = null
    }
    if (onDisk !== bytes) drifted.push(relLabel)
  }

  checkOrWrite(matrixPath, "conformance/transformation-stability-v0/vectors/handoff-matrix-set.json", matrixBytes)
  checkOrWrite(cyclePath, "conformance/transformation-stability-v0/cycles/cycle-set.json", cycleBytes)

  // manifest.json covers every other authored/generated package file, sorted
  // by repo path (manifest path order is part of package authority).
  const manifestMembers = [
    "SPEC.md",
    "contract.json",
    "generate_package.ts",
    "audit_package.ts",
    "verify_independent.py",
    "vectors/handoff-matrix-set.json",
    "cycles/cycle-set.json",
  ].sort((a, b) => {
    const left = `conformance/transformation-stability-v0/${a}`
    const right = `conformance/transformation-stability-v0/${b}`
    return left < right ? -1 : left > right ? 1 : 0
  })

  const rows: string[] = []
  const files: Array<{ path: string; sha256: string }> = []
  for (const member of manifestMembers) {
    const absPath = resolve(PACKAGE_DIR, member)
    const bytes =
      member === "vectors/handoff-matrix-set.json"
        ? Buffer.from(matrixBytes, "utf8")
        : member === "cycles/cycle-set.json"
          ? Buffer.from(cycleBytes, "utf8")
          : readFileSync(absPath)
    const digest = shaBytes(bytes)
    const repoPath = `conformance/transformation-stability-v0/${member}`
    files.push({ path: repoPath, sha256: digest })
    rows.push(`${repoPath}\t${digest}\n`)
  }
  const fixtureSetSha256 = shaBytes(Buffer.from(rows.join(""), "utf8"))

  const manifestDoc = {
    schema: "transformation_stability_package_fixture_manifest.v0",
    package_id: "transformation-stability-v0",
    version: "v0",
    file_count: files.length,
    files,
    fixture_set_sha256: fixtureSetSha256,
    handoff_matrix_set_sha256: handoffMatrixSetSha256,
    cycle_set_sha256: cycleSetSha256,
  }
  const manifestBytes = serialize(manifestDoc)
  checkOrWrite(manifestPath, "conformance/transformation-stability-v0/manifest.json", manifestBytes)

  const ok = drifted.length === 0
  console.log(
    JSON.stringify(
      {
        mode,
        ok,
        drifted_paths: drifted,
        fixture_set_sha256: fixtureSetSha256,
        handoff_matrix_set_sha256: handoffMatrixSetSha256,
        cycle_set_sha256: cycleSetSha256,
        handoff_matrix_aggregate: matrix.aggregate,
        handoff_matrix_pass: matrix.pass,
        cycle_count: cycles.length,
      },
      null,
      2,
    ),
  )
  process.exit(ok || mode === "write" ? 0 : 1)
}

main().catch((error) => {
  console.log(
    JSON.stringify({ ok: false, reason: error instanceof Error ? error.message : "package_materialization_failure" }, null, 2),
  )
  process.exit(1)
})
