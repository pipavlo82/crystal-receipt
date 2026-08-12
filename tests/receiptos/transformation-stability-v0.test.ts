import { describe, expect, test } from "bun:test"
import {
  defineTransformationProfileV0,
  evaluateTransformationStabilityV0,
  type RecomputeOutcomeV0,
} from "../../src/receiptos/challenge/transformation-stability"

type Input = {
  readonly inDomain: boolean
  readonly value: number
  readonly observation: string
  readonly telemetry: string
  readonly forbidden: string
  readonly targetValue?: number
  readonly targetObservation?: string
  readonly targetTelemetry?: string
  readonly targetForbidden?: string
  readonly unresolved?: "source" | "target"
}

type Output = {
  readonly verdict: "accept" | "reject"
  readonly observation: string
  readonly telemetry: string
  readonly forbidden: string
}

const evaluated = (value: Output): RecomputeOutcomeV0<Output> => ({
  state: "evaluated",
  value,
})

function makeProfile(policy: "classify" | "violation" = "classify") {
  return defineTransformationProfileV0<Input, Input, Output>({
    transformation_profile_id: "test-profile-v0",
    transformation_family: "test",
    source_object_kind: "input",
    target_object_kind: "input",
    recompute_procedure_id: "test-recompute-v0",
    comparison_rule_id: "test-comparison-v0",
    history_sensitive_policy: policy,
    precondition: (source) =>
      source.inDomain ? { ok: true } : { ok: false, reason: "not_applicable_here" },
    transform: (source) => ({
      ...source,
      value: source.targetValue ?? source.value,
      observation: source.targetObservation ?? source.observation,
      telemetry: source.targetTelemetry ?? source.telemetry,
      forbidden: source.targetForbidden ?? source.forbidden,
    }),
    recompute_source: (source) =>
      source.unresolved === "source"
        ? { state: "unresolved", reason: "source_worker_timeout" }
        : evaluated({
            verdict: source.value >= 0 ? "accept" : "reject",
            observation: source.observation,
            telemetry: source.telemetry,
            forbidden: source.forbidden,
          }),
    recompute_target: (target) =>
      target.unresolved === "target"
        ? { state: "unresolved", reason: "target_worker_timeout" }
        : evaluated({
            verdict: target.value >= 0 ? "accept" : "reject",
            observation: target.observation,
            telemetry: target.telemetry,
            forbidden: target.forbidden,
          }),
    normative_projection: (result) => ({ verdict: result.verdict }),
    stability_projection: (result) => ({ observation: result.observation }),
    allowed_variant_projection: (result) => ({ telemetry: result.telemetry }),
    forbidden_variant_projection: (result) => ({ forbidden: result.forbidden }),
  })
}

const base: Input = {
  inDomain: true,
  value: 1,
  observation: "same",
  telemetry: "pid-a",
  forbidden: "fixed",
}

describe("transformation stability v0 generic core", () => {
  test("stable", async () => {
    const result = await evaluateTransformationStabilityV0(makeProfile(), base)
    expect(result.classification).toBe("stable")
    expect(result.normative_match).toBe(true)
    expect(result.stability_match).toBe(true)
    expect(result.forbidden_variant_match).toBe(true)
  })

  test("allowed variant may change", async () => {
    const result = await evaluateTransformationStabilityV0(makeProfile(), {
      ...base,
      targetTelemetry: "pid-b",
    })
    expect(result.classification).toBe("stable")
    expect(result.allowed_variant_changed).toBe(true)
  })

  test("stability-only mismatch is history_sensitive", async () => {
    const result = await evaluateTransformationStabilityV0(makeProfile(), {
      ...base,
      targetObservation: "history",
    })
    expect(result.classification).toBe("history_sensitive")
  })

  test("normative mismatch is violation", async () => {
    const result = await evaluateTransformationStabilityV0(makeProfile(), {
      ...base,
      targetValue: -1,
    })
    expect(result.classification).toBe("violation")
    expect(result.normative_match).toBe(false)
  })

  test("forbidden variant mismatch is violation", async () => {
    const result = await evaluateTransformationStabilityV0(makeProfile(), {
      ...base,
      targetForbidden: "changed",
    })
    expect(result.classification).toBe("violation")
    expect(result.forbidden_variant_match).toBe(false)
  })

  test("failed applicability is out_of_domain", async () => {
    const result = await evaluateTransformationStabilityV0(makeProfile(), {
      ...base,
      inDomain: false,
    })
    expect(result.classification).toBe("out_of_domain")
    expect(result.out_of_domain_reason).toBe("not_applicable_here")
  })

  test("bounded target recompute failure is unresolved", async () => {
    const result = await evaluateTransformationStabilityV0(makeProfile(), {
      ...base,
      unresolved: "target",
    })
    expect(result.classification).toBe("unresolved")
    expect(result.unresolved_reason).toBe("target_worker_timeout")
  })
})
