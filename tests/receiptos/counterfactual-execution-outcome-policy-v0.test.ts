import { describe, expect, test } from "bun:test"
import { readFileSync, readdirSync } from "node:fs"
import { resolve } from "node:path"
import { spawnSync } from "node:child_process"
import * as CabModule from "../../src/receiptos/challenge/counterfactual-audit-boundary"
import {
  CAB_CONTRACT_CODE_TO_EXPECTED_MESSAGE_TOKEN,
  COUNTERFACTUAL_AUDIT_BOUNDARY_CONTRACT,
  COUNTERFACTUAL_AUDIT_BOUNDARY_CONTRACT_CODES,
  extractCabContractRejection,
  snapshotCounterfactualSemanticJson,
} from "../../src/receiptos/challenge/counterfactual-audit-boundary"
import * as RunnerModule from "../../src/receiptos/challenge/counterfactual-verifier-runner"
import {
  compareCabSubjectContractRejection,
  evaluateVerifierChallengeConformance,
} from "../../src/receiptos/challenge/counterfactual-conformance-evaluator"
import {
  COUNTERFACTUAL_EXECUTION_OUTCOME_SCHEMA,
  COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
  RunnerContractError,
  normalizeSubjectReturnedResult,
  runVerifierChallenge,
} from "../../src/receiptos/challenge/counterfactual-verifier-runner"
import {
  computeFrozenCounterfactualNeighborhoodSha256,
  projectCounterfactualChallengeIdentity,
  type FrozenCounterfactualNeighborhoodV0,
} from "../../src/receiptos/challenge/counterfactual-neighborhood"
import {
  projectVerifierChallengeVector,
  type VerifierChallengeVectorModelV0,
} from "../../src/receiptos/challenge/verifier-challenge-model"
import type { CounterfactualChallengeIdentityV0 } from "../../src/receiptos/challenge/counterfactual-neighborhood"

const root = resolve(import.meta.dir, "../..")
const LANE_B_SHA256 = "37a213cff7a34e28df165c282f2b9e7460e31fbd37794bf5020c1e91158ed36d"
const CAB_PKG = "conformance/counterfactual-audit-boundary-v0"

function readJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(resolve(root, relativePath), "utf8"))
}

function identityFromVector(vector: Record<string, unknown>): {
  model: VerifierChallengeVectorModelV0
  challenge: CounterfactualChallengeIdentityV0
} {
  const model = projectVerifierChallengeVector(vector)
  return { model, challenge: projectCounterfactualChallengeIdentity(model) }
}

function buildAccessorTrap(construction: {
  property: string
  first_value: unknown
  second_value: unknown
}): { input: unknown; reads: () => number } {
  let reads = 0
  const input = Object.defineProperty({}, construction.property, {
    enumerable: true,
    get() {
      reads += 1
      return reads === 1 ? construction.first_value : construction.second_value
    },
  })
  return { input, reads: () => reads }
}

describe("counterfactual execution outcome policy v0 (Lane F)", () => {
  test("schema identifier is explicit v0", () => {
    expect(COUNTERFACTUAL_EXECUTION_OUTCOME_SCHEMA).toBe("receiptos.counterfactual_execution_outcome.v0")
  })

  test("every frozen CAB rejected vector throws typed contract error with stable code/path", () => {
    const vectorIds = readdirSync(resolve(root, `${CAB_PKG}/vectors`))
      .filter((name) => name.startsWith("V-") && name.endsWith(".json"))
      .map((name) => name.slice(0, -5))
    const rejected = vectorIds
      .map((id) => readJson(`${CAB_PKG}/vectors/${id}.json`) as Record<string, unknown>)
      .filter((vector) => (vector.expected as { outcome?: string }).outcome === "rejected")

    expect(rejected.map((v) => v.vector_id).sort()).toEqual([
      "V-AT-ACCESSOR",
      "V-AT-NEST-ARR",
      "V-AT-NEST-OBJ",
      "V-AT-ORDER",
      "V-AT-ROOT",
    ])

    for (const vector of rejected) {
      const expected = vector.expected as {
        outcome: string
        error_path?: string
        error_message_contains: string
        property_get_invocation_count?: number
      }

      if (vector.runtime_construction) {
        const construction = vector.runtime_construction as {
          kind: string
          property: string
          first_value: unknown
          second_value: unknown
        }
        expect(construction.kind).toBe("changing_accessor_trap")
        const { input, reads } = buildAccessorTrap(construction)
        let thrown: unknown
        try {
          snapshotCounterfactualSemanticJson(input)
        } catch (error) {
          thrown = error
        }
        const rejection = extractCabContractRejection(thrown)
        expect(rejection).toEqual({
          contract: COUNTERFACTUAL_AUDIT_BOUNDARY_CONTRACT,
          code: "accessor_property_forbidden",
          path: '$semantic_artifact["payload"]',
        })
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain(expected.error_message_contains)
        expect(reads()).toBe(expected.property_get_invocation_count ?? 0)
        continue
      }

      const inputs: unknown[] = Array.isArray(vector.input_variants)
        ? (vector.input_variants as unknown[])
        : [vector.input]

      for (const input of inputs) {
        let thrown: unknown
        try {
          snapshotCounterfactualSemanticJson(input)
        } catch (error) {
          thrown = error
        }
        const rejection = extractCabContractRejection(thrown)
        expect(rejection).toEqual({
          contract: COUNTERFACTUAL_AUDIT_BOUNDARY_CONTRACT,
          code: "reserved_audit_timestamp",
          path: expected.error_path,
        })
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain(expected.error_message_contains)
        expect((thrown as Error).message).toContain(expected.error_path!)
        // Machine identity is not the message text.
        expect(rejection!.code).not.toBe((thrown as Error).message)
      }
    }
  })

  test("Lane D: recognized CAB typed rejection → subject_contract_rejected without native/message/stack", async () => {
    const cases = [
      ["V-AT-ROOT", '$semantic_artifact["audit_timestamp"]'],
      ["V-AT-NEST-OBJ", '$semantic_artifact["nested"]["audit_timestamp"]'],
      ["V-AT-NEST-ARR", '$semantic_artifact["nested"][0]["audit_timestamp"]'],
    ] as const

    for (const [vectorId, path] of cases) {
      const vector = readJson(`${CAB_PKG}/vectors/${vectorId}.json`) as Record<string, unknown>
      const { challenge, model } = identityFromVector(vector)
      const result = await runVerifierChallenge({
        schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
        surface: "counterfactual_audit_boundary",
        subject: null,
        operation: "semantic_snapshot",
        challenge,
        lane_a_model: model,
        input: { value: vector.input },
      })
      expect(result.execution_state).toBe("subject_contract_rejected")
      if (result.execution_state !== "subject_contract_rejected") throw new Error("unreachable")
      expect(result.rejection).toEqual({
        contract: COUNTERFACTUAL_AUDIT_BOUNDARY_CONTRACT,
        code: "reserved_audit_timestamp",
        path,
      })
      expect(result).not.toHaveProperty("native_result")
      expect(JSON.stringify(result)).not.toContain("non-semantic audit metadata")
      expect(JSON.stringify(result)).not.toContain("stack")
      expect(() => normalizeSubjectReturnedResult(result)).toThrow(RunnerContractError)
    }

    const order = readJson(`${CAB_PKG}/vectors/V-AT-ORDER.json`) as {
      input_variants: unknown[]
      expected: { error_path: string }
    } & Record<string, unknown>
    const { challenge, model } = identityFromVector(order)
    for (const value of order.input_variants) {
      const result = await runVerifierChallenge({
        schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
        surface: "counterfactual_audit_boundary",
        subject: null,
        operation: "semantic_snapshot",
        challenge,
        lane_a_model: model,
        input: { value },
      })
      expect(result.execution_state).toBe("subject_contract_rejected")
      if (result.execution_state !== "subject_contract_rejected") throw new Error("unreachable")
      expect(result.rejection.path).toBe(order.expected.error_path)
      expect(result.rejection.code).toBe("reserved_audit_timestamp")
    }
  })

  test("CAB module exposes no constructible contract-error class or mint helper", () => {
    expect(CabModule).not.toHaveProperty("CounterfactualAuditBoundaryContractError")
    expect(CabModule).not.toHaveProperty("isCabContractErrorInstance")
    expect(typeof CabModule.extractCabContractRejection).toBe("function")
    expect(typeof CabModule.snapshotCounterfactualSemanticJson).toBe("function")
    expect(RunnerModule).not.toHaveProperty("captureCabSubjectInvocationThrow")
    expect(RunnerModule).not.toHaveProperty("isRecognizedCabContractRejection")
    expect(RunnerModule).not.toHaveProperty("CounterfactualAuditBoundaryContractError")

    // Opaque extractor cannot mint or promote structural forgeries.
    expect(
      extractCabContractRejection({
        name: "CounterfactualAuditBoundaryContractError",
        contract: COUNTERFACTUAL_AUDIT_BOUNDARY_CONTRACT,
        code: "reserved_audit_timestamp",
        path: '$semantic_artifact["audit_timestamp"]',
      }),
    ).toBeNull()
    expect(extractCabContractRejection(new Error("non-semantic audit metadata is forbidden"))).toBeNull()
    expect(extractCabContractRejection("string-throw")).toBeNull()
  })

  test("prototype-style forgery from authentic error prototype is not recognized", () => {
    let authentic: unknown
    try {
      snapshotCounterfactualSemanticJson({ audit_timestamp: "root" })
    } catch (error) {
      authentic = error
    }
    const proto = Object.getPrototypeOf(authentic as object)
    const forgery = Object.create(proto) as {
      code: string
      path: string
      contract: string
      message: string
    }
    forgery.code = "reserved_audit_timestamp"
    forgery.path = '$semantic_artifact["audit_timestamp"]'
    forgery.contract = COUNTERFACTUAL_AUDIT_BOUNDARY_CONTRACT
    forgery.message = "forged via prototype"
    expect(extractCabContractRejection(forgery)).toBeNull()
    expect(extractCabContractRejection(authentic)).toEqual({
      contract: COUNTERFACTUAL_AUDIT_BOUNDARY_CONTRACT,
      code: "reserved_audit_timestamp",
      path: '$semantic_artifact["audit_timestamp"]',
    })
  })

  test("adapter-stage clone getter failures are execution_failure, including authentic CAB error replay", async () => {
    const vector = readJson(`${CAB_PKG}/vectors/V-AT-ROOT.json`) as Record<string, unknown>
    const { challenge, model } = identityFromVector(vector)
    const beforeChallenge = structuredClone(challenge)
    const beforeModel = structuredClone(model)

    const ordinaryGetter = Object.defineProperty({}, "payload", {
      enumerable: true,
      get() {
        throw new Error("caller-controlled clone diagnostic")
      },
    })
    const ordinary = await runVerifierChallenge({
      schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
      surface: "counterfactual_audit_boundary",
      subject: null,
      operation: "semantic_snapshot",
      challenge,
      lane_a_model: model,
      input: { value: ordinaryGetter },
    })
    expect(ordinary.execution_state).toBe("execution_failure")
    if (ordinary.execution_state !== "execution_failure") throw new Error("unreachable")
    expect(ordinary.failure.failure_stage).toBe("input_materialization")
    expect(ordinary.failure.safe_message).toBe("input materialization failed")
    expect(JSON.stringify(ordinary)).not.toContain("caller-controlled clone diagnostic")
    expect(JSON.stringify(ordinary)).not.toContain("\n")
    expect(ordinary).not.toHaveProperty("rejection")

    const structuralGetter = Object.defineProperty({}, "payload", {
      enumerable: true,
      get() {
        throw {
          name: "CounterfactualAuditBoundaryContractError",
          contract: COUNTERFACTUAL_AUDIT_BOUNDARY_CONTRACT,
          code: "reserved_audit_timestamp",
          path: '$semantic_artifact["audit_timestamp"]',
        }
      },
    })
    const structural = await runVerifierChallenge({
      schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
      surface: "counterfactual_audit_boundary",
      subject: null,
      operation: "semantic_snapshot",
      challenge,
      lane_a_model: model,
      input: { value: structuralGetter },
    })
    expect(structural.execution_state).toBe("execution_failure")

    // Mandatory: capture authentic private CAB error, rethrow from clone getter.
    let authentic: unknown
    try {
      snapshotCounterfactualSemanticJson({ audit_timestamp: "root" })
    } catch (error) {
      authentic = error
    }
    expect(extractCabContractRejection(authentic)).not.toBeNull()
    const replayGetter = Object.defineProperty({}, "payload", {
      enumerable: true,
      get() {
        throw authentic
      },
    })
    const replay = await runVerifierChallenge({
      schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
      surface: "counterfactual_audit_boundary",
      subject: null,
      operation: "semantic_snapshot",
      challenge,
      lane_a_model: model,
      input: { value: replayGetter },
    })
    expect(replay.execution_state).toBe("execution_failure")
    if (replay.execution_state !== "execution_failure") throw new Error("unreachable")
    expect(replay.failure.failure_stage).toBe("input_materialization")
    expect(replay).not.toHaveProperty("rejection")
    expect(JSON.stringify(replay)).not.toContain("non-semantic audit metadata")
    expect(JSON.stringify(replay)).not.toContain("stack")

    // Same authentic validation during real subject invocation remains typed rejection.
    const subject = await runVerifierChallenge({
      schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
      surface: "counterfactual_audit_boundary",
      subject: null,
      operation: "semantic_snapshot",
      challenge,
      lane_a_model: model,
      input: { value: vector.input },
    })
    expect(subject.execution_state).toBe("subject_contract_rejected")
    if (subject.execution_state !== "subject_contract_rejected") throw new Error("unreachable")
    expect(subject.rejection).toEqual({
      contract: COUNTERFACTUAL_AUDIT_BOUNDARY_CONTRACT,
      code: "reserved_audit_timestamp",
      path: '$semantic_artifact["audit_timestamp"]',
    })

    // Non-cloneable host values remain execution_failure.
    const nonCloneable = await runVerifierChallenge({
      schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
      surface: "counterfactual_audit_boundary",
      subject: null,
      operation: "semantic_snapshot",
      challenge,
      lane_a_model: model,
      input: { value: { fn: () => 1 } },
    })
    expect(nonCloneable.execution_state).toBe("execution_failure")
    if (nonCloneable.execution_state !== "execution_failure") throw new Error("unreachable")
    expect(nonCloneable.failure.failure_stage).toBe("input_materialization")

    expect(challenge).toEqual(beforeChallenge)
    expect(model).toEqual(beforeModel)
  })

  test("native verifier-local rejection remains subject_returned; RunnerContractError remains thrown", async () => {
    const vector = readJson(
      "conformance/verifier-challenge-integrity-mismatch-rejected-v0/vectors/V-INTEGRITY-MISMATCH.json",
    ) as Record<string, unknown>
    const model = projectVerifierChallengeVector(vector)
    const challenge = projectCounterfactualChallengeIdentity(model)
    const source = vector.source_fixture as { repository_path: string }
    const baseline = structuredClone(readJson(source.repository_path)) as Record<string, unknown>
    const mutation = vector.mutation as { path: string[]; to: unknown }
    let cursor = baseline
    for (let i = 0; i < mutation.path.length - 1; i += 1) {
      cursor = cursor[mutation.path[i]!] as Record<string, unknown>
    }
    cursor[mutation.path[mutation.path.length - 1]!] = mutation.to

    const result = await runVerifierChallenge({
      schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
      surface: "verify_handoff_receipt_root",
      subject: challenge.subject!,
      challenge,
      lane_a_model: model,
      input: { evidence: baseline as never },
    })
    expect(result.execution_state).toBe("subject_returned")

    await expect(
      runVerifierChallenge({
        schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
        surface: "counterfactual_audit_boundary",
        subject: {
          entrypoint: "fake",
          module_path: "x",
          git_blob_oid: "y",
        } as never,
        operation: "semantic_snapshot",
        challenge: identityFromVector(
          readJson(`${CAB_PKG}/vectors/V-AT-ROOT.json`) as Record<string, unknown>,
        ).challenge,
        input: { value: {} },
      }),
    ).rejects.toBeInstanceOf(RunnerContractError)
  })

  test("Lane E: matching / mismatched typed CAB rejection comparison matrix", async () => {
    const rootVector = readJson(`${CAB_PKG}/vectors/V-AT-ROOT.json`) as Record<string, unknown>
    const nest = readJson(`${CAB_PKG}/vectors/V-AT-NEST-OBJ.json`) as Record<string, unknown>
    const isolate = readJson(`${CAB_PKG}/vectors/V-AT-ISOLATE.json`) as Record<string, unknown> & {
      runtime_construction: { initial: unknown }
    }
    const accessor = readJson(`${CAB_PKG}/vectors/V-AT-ACCESSOR.json`) as Record<string, unknown>

    const { model: rootModel, challenge: rootChallenge } = identityFromVector(rootVector)
    const matching = await evaluateVerifierChallengeConformance({
      schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
      surface: "counterfactual_audit_boundary",
      subject: null,
      operation: "semantic_snapshot",
      challenge: rootChallenge,
      lane_a_model: rootModel,
      input: { value: rootVector.input },
    })
    expect(matching.evaluation_state).toBe("evaluated")
    if (matching.evaluation_state !== "evaluated") throw new Error("unreachable")
    expect(matching.verdict).toBe("conformant")
    expect(matching.subject_contract_rejection?.code).toBe("reserved_audit_timestamp")
    expect(matching.actual_observation).toBeNull()
    expect(matching.mismatch).toBeNull()

    // Wrong code token (ACCESSOR expected token vs audit_timestamp throw).
    const wrongCodeModel = structuredClone(rootModel)
    wrongCodeModel.expected = structuredClone(accessor.expected)
    const wrongCode = await evaluateVerifierChallengeConformance({
      schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
      surface: "counterfactual_audit_boundary",
      subject: null,
      operation: "semantic_snapshot",
      challenge: rootChallenge,
      lane_a_model: wrongCodeModel,
      input: { value: rootVector.input },
    })
    expect(wrongCode.evaluation_state).toBe("evaluated")
    if (wrongCode.evaluation_state !== "evaluated") throw new Error("unreachable")
    expect(wrongCode.verdict).toBe("nonconformant")
    expect(wrongCode.mismatch?.kind).toBe("subject_contract_rejection_mismatch")
    expect(wrongCode.subject_contract_rejection?.code).toBe("reserved_audit_timestamp")

    // Wrong path.
    const wrongPathModel = structuredClone(rootModel)
    wrongPathModel.expected = structuredClone(nest.expected)
    const wrongPath = await evaluateVerifierChallengeConformance({
      schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
      surface: "counterfactual_audit_boundary",
      subject: null,
      operation: "semantic_snapshot",
      challenge: rootChallenge,
      lane_a_model: wrongPathModel,
      input: { value: rootVector.input },
    })
    expect(wrongPath.evaluation_state).toBe("evaluated")
    if (wrongPath.evaluation_state !== "evaluated") throw new Error("unreachable")
    expect(wrongPath.verdict).toBe("nonconformant")
    expect(wrongPath.mismatch?.kind).toBe("subject_contract_rejection_mismatch")

    // Expected operation success + typed rejection.
    const { model: isolateModel, challenge: isolateChallenge } = identityFromVector(isolate)
    const unexpected = await evaluateVerifierChallengeConformance({
      schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
      surface: "counterfactual_audit_boundary",
      subject: null,
      operation: "semantic_snapshot",
      challenge: isolateChallenge,
      lane_a_model: isolateModel,
      input: { value: { audit_timestamp: "x" } },
    })
    expect(unexpected.evaluation_state).toBe("evaluated")
    if (unexpected.evaluation_state !== "evaluated") throw new Error("unreachable")
    expect(unexpected.verdict).toBe("nonconformant")
    expect(unexpected.mismatch?.kind).toBe("unexpected_subject_contract_rejection")
    expect(unexpected.subject_contract_rejection?.code).toBe("reserved_audit_timestamp")
    expect(unexpected.actual_observation).toBeNull()

    // Expected rejection + subject_returned operation.
    const missing = await evaluateVerifierChallengeConformance({
      schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
      surface: "counterfactual_audit_boundary",
      subject: null,
      operation: "semantic_snapshot",
      challenge: rootChallenge,
      lane_a_model: rootModel,
      input: { value: isolate.runtime_construction.initial },
    })
    expect(missing.evaluation_state).toBe("evaluated")
    if (missing.evaluation_state !== "evaluated") throw new Error("unreachable")
    expect(missing.verdict).toBe("nonconformant")
    expect(missing.mismatch?.kind).toBe("expected_subject_contract_rejection_missing")
    expect(missing.subject_contract_rejection).toBeNull()
    expect(missing.actual_observation?.observation_class).toBe("operation")
  })

  test("Lane E: adapter-stage failures → execution_unresolved; never conformant/nonconformant", async () => {
    const vector = readJson(`${CAB_PKG}/vectors/V-AT-ROOT.json`) as Record<string, unknown>
    const { model, challenge } = identityFromVector(vector)
    const result = await evaluateVerifierChallengeConformance({
      schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
      surface: "counterfactual_audit_boundary",
      subject: null,
      operation: "semantic_snapshot",
      challenge,
      lane_a_model: model,
      input: { value: { fn: () => "host" } },
    })
    expect(result.evaluation_state).toBe("execution_unresolved")
    if (result.evaluation_state !== "execution_unresolved") throw new Error("unreachable")
    expect(result.verdict).toBeNull()
    expect(result.execution_failure.failure_stage).toBe("input_materialization")
    expect(result.execution_failure.safe_message).toBe("input materialization failed")
    const serialized = JSON.stringify(result)
    expect(serialized).not.toContain('"conformant"')
    expect(serialized).not.toContain("nonconformant")
    expect(serialized).not.toContain("subject_contract_rejection")

    let authentic: unknown
    try {
      snapshotCounterfactualSemanticJson({ audit_timestamp: "root" })
    } catch (error) {
      authentic = error
    }
    const replayUnresolved = await evaluateVerifierChallengeConformance({
      schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
      surface: "counterfactual_audit_boundary",
      subject: null,
      operation: "semantic_snapshot",
      challenge,
      lane_a_model: model,
      input: {
        value: Object.defineProperty({}, "payload", {
          enumerable: true,
          get() {
            throw authentic
          },
        }),
      },
    })
    expect(replayUnresolved.evaluation_state).toBe("execution_unresolved")
    if (replayUnresolved.evaluation_state !== "execution_unresolved") throw new Error("unreachable")
    expect(replayUnresolved.verdict).toBeNull()
    expect(JSON.stringify(replayUnresolved)).not.toContain("nonconformant")
    expect(JSON.stringify(replayUnresolved)).not.toContain("subject_contract_rejection")
  })

  test("comparison never uses raw exception strings; typed rejection never enters Lane C normalizer", () => {
    const expected = {
      outcome: "rejected",
      error_path: '$semantic_artifact["audit_timestamp"]',
      error_message_contains: "non-semantic audit metadata is forbidden in semantic input",
    }
    const rejection = {
      contract: COUNTERFACTUAL_AUDIT_BOUNDARY_CONTRACT,
      code: "reserved_audit_timestamp" as const,
      path: '$semantic_artifact["audit_timestamp"]',
    }
    expect(compareCabSubjectContractRejection(expected, rejection)).toEqual({ match: true })
    expect(
      compareCabSubjectContractRejection(
        {
          outcome: "rejected",
          error_message_contains: "accessor properties are forbidden",
        },
        rejection,
      ),
    ).toEqual({
      match: false,
      mismatch: { kind: "subject_contract_rejection_mismatch" },
    })
    // Mapping is from typed code, not from a message substring search over Error.message.
    expect(CAB_CONTRACT_CODE_TO_EXPECTED_MESSAGE_TOKEN.reserved_audit_timestamp).toBe(
      expected.error_message_contains,
    )
    expect(CAB_CONTRACT_CODE_TO_EXPECTED_MESSAGE_TOKEN.accessor_property_forbidden).toBe(
      "accessor properties are forbidden",
    )
    expect(COUNTERFACTUAL_AUDIT_BOUNDARY_CONTRACT_CODES).toContain("reserved_audit_timestamp")
  })

  test("anti-collapse: distinct execution states and error classes", async () => {
    const vector = readJson(`${CAB_PKG}/vectors/V-AT-ROOT.json`) as Record<string, unknown>
    const { model, challenge } = identityFromVector(vector)
    const typed = await runVerifierChallenge({
      schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
      surface: "counterfactual_audit_boundary",
      subject: null,
      operation: "semantic_snapshot",
      challenge,
      lane_a_model: model,
      input: { value: vector.input },
    })
    const failure = await runVerifierChallenge({
      schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
      surface: "counterfactual_audit_boundary",
      subject: null,
      operation: "semantic_snapshot",
      challenge,
      lane_a_model: model,
      input: {
        value: Object.defineProperty({}, "payload", {
          enumerable: true,
          get() {
            throw new Error("boom")
          },
        }),
      },
    })
    const isolate = readJson(`${CAB_PKG}/vectors/V-AT-ISOLATE.json`) as Record<string, unknown> & {
      runtime_construction: { initial: unknown }
    }
    const { challenge: iChallenge, model: iModel } = identityFromVector(isolate)
    const returned = await runVerifierChallenge({
      schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
      surface: "counterfactual_audit_boundary",
      subject: null,
      operation: "semantic_snapshot",
      challenge: iChallenge,
      lane_a_model: iModel,
      input: { value: isolate.runtime_construction.initial },
    })

    expect(typed.execution_state).toBe("subject_contract_rejected")
    expect(failure.execution_state).toBe("execution_failure")
    if (failure.execution_state !== "execution_failure") throw new Error("unreachable")
    expect(failure.failure.failure_stage).toBe("input_materialization")
    expect(returned.execution_state).toBe("subject_returned")
    expect(typed.execution_state).not.toBe(failure.execution_state)
    expect(typed.execution_state).not.toBe(returned.execution_state)
    expect(failure.execution_state).not.toBe(returned.execution_state)

    const unresolved = await evaluateVerifierChallengeConformance({
      schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
      surface: "counterfactual_audit_boundary",
      subject: null,
      operation: "semantic_snapshot",
      challenge,
      lane_a_model: model,
      input: { value: { fn: () => 1 } },
    })
    expect(unresolved.evaluation_state).toBe("execution_unresolved")
    if (unresolved.evaluation_state !== "execution_unresolved") throw new Error("unreachable")
    expect(unresolved.verdict).toBeNull()
    expect(unresolved.verdict).not.toBe("conformant")
    expect(unresolved.verdict).not.toBe("nonconformant")

    try {
      await runVerifierChallenge({
        schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
        surface: "counterfactual_audit_boundary",
        subject: {
          entrypoint: "x",
          module_path: "y",
          git_blob_oid: "z",
        } as never,
        operation: "semantic_snapshot",
        challenge,
        input: { value: {} },
      })
      throw new Error("expected RunnerContractError")
    } catch (error) {
      expect(error).toBeInstanceOf(RunnerContractError)
      expect(error).not.toHaveProperty("execution_state")
    }

    expect(JSON.stringify(typed)).not.toContain("source_validity")
    expect(JSON.stringify(typed)).not.toContain("observation_class")
  })

  test("CAB accepted snapshot / manifest hash remain evaluated conformant; digests preserved", async () => {
    const isolate = readJson(`${CAB_PKG}/vectors/V-AT-ISOLATE.json`) as Record<string, unknown> & {
      runtime_construction: { initial: unknown }
    }
    const { model, challenge } = identityFromVector(isolate)
    const snapshot = await evaluateVerifierChallengeConformance({
      schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
      surface: "counterfactual_audit_boundary",
      subject: null,
      operation: "semantic_snapshot",
      challenge,
      lane_a_model: model,
      input: { value: isolate.runtime_construction.initial },
    })
    expect(snapshot.evaluation_state).toBe("evaluated")
    if (snapshot.evaluation_state !== "evaluated") throw new Error("unreachable")
    expect(snapshot.verdict).toBe("conformant")
    expect(snapshot.subject_contract_rejection).toBeNull()

    const manifest = readJson(`${CAB_PKG}/vectors/V-MAN-UINT8-EXACT.json`) as Record<string, unknown> & {
      inputs: Array<{ bytes: number[] }>
    }
    const { model: mModel, challenge: mChallenge } = identityFromVector(manifest)
    const hash = await evaluateVerifierChallengeConformance({
      schema: COUNTERFACTUAL_VERIFIER_RUNNER_SCHEMA,
      surface: "counterfactual_audit_boundary",
      subject: null,
      operation: "manifest_file_sha256",
      challenge: mChallenge,
      lane_a_model: mModel,
      input: { bytes: Uint8Array.from(manifest.inputs[0]!.bytes) },
    })
    expect(hash.evaluation_state).toBe("evaluated")
    if (hash.evaluation_state !== "evaluated") throw new Error("unreachable")
    expect(hash.verdict).toBe("conformant")

    const fixture = readJson("tests/fixtures/counterfactual-neighborhood-identity-v0/neighborhood.json") as {
      neighborhood: FrozenCounterfactualNeighborhoodV0
      expected_neighborhood_sha256: string
    }
    expect(fixture.expected_neighborhood_sha256).toBe(LANE_B_SHA256)
    expect(computeFrozenCounterfactualNeighborhoodSha256(fixture.neighborhood)).toBe(LANE_B_SHA256)
    const py = spawnSync(
      "python",
      [resolve(root, "tests/fixtures/counterfactual-neighborhood-identity-v0/verify_independent.py")],
      { cwd: root, encoding: "utf8" },
    )
    expect(py.status).toBe(0)
    expect(py.stdout.trim()).toBe(LANE_B_SHA256)

    const checks: Array<{ packageDir: string; fixture: string; child?: string; expected?: string }> = [
      {
        packageDir: CAB_PKG,
        fixture: "7503d5cac003a23489f194c5521ef90b01ac0b2ce345a2cec57ad12ffeb274f8",
        expected: "db664c5e8da2f0fb6d1d94a036eab572ae2941ffeb5193624365d4bdbaeec24a",
      },
      {
        packageDir: "conformance/verifier-challenge-set-v0",
        fixture: "6a4f84a109f633559c7df2e9dd86092e00ce52a81c4a3dcd46c112175748e284",
        child: "945ec30015490b3d92c01177124be5eddcee18b99308d3aed7701fedff67d326",
      },
      {
        packageDir: "conformance/verifier-challenge-chronicle-admission-set-v0",
        fixture: "dbf062131278b8164373725442e069eb53328729058960b52213dd74b78c83c5",
        child: "55c8f203255bf97c40ab76255a95db3447bc2dc30ec961fd65f6a39eba12f22a",
      },
      {
        packageDir: "conformance/verifier-challenge-chronicle-continuity-set-v0",
        fixture: "77261f48e3a712536e3cd37f4384c0b62a5063a3c6be7cf14ac648848feea716",
        child: "4448c728b264cc51d369de7b42430205b9dfdabedb09a282c619e5a42e0d61ac",
      },
      {
        packageDir: "conformance/verifier-challenge-chronicle-checkpoint-local-set-v0",
        fixture: "2c5b171806a253c32495a819d011087c46f4cfb8bad27b0821f6abd280a6ef89",
        child: "5bcdef8fa4fdb24287e29efb273b4e1998e443047ea1251ec12e3c8097269e28",
      },
    ]
    for (const check of checks) {
      const manifestJson = readJson(`${check.packageDir}/manifest.json`) as {
        fixture_set_sha256: string
      }
      expect(manifestJson.fixture_set_sha256).toBe(check.fixture)
      const contract = readJson(`${check.packageDir}/contract.json`) as Record<string, unknown>
      if (check.expected) expect(contract.expected_result_set_sha256).toBe(check.expected)
      if (check.child) {
        const child =
          contract.child_identity_set_sha256 ??
          (contract.aggregate as { child_identity_set_sha256?: string } | undefined)
            ?.child_identity_set_sha256
        expect(child).toBe(check.child)
      }
    }
  })
})
