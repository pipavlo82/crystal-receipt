import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { expect, test } from "bun:test"
import {
  evaluateP0ProviderPolicyFreeze,
  evaluateP0ProviderPolicyFreezeV1,
  parseRekorV1P0ProviderPolicyV1,
  REKOR_V1_P0_PROVIDER_POLICY_V1_SHA256,
} from "../../conformance/tsei-invariant-discrimination-v0/rekor-v1-verifier"

const ROOT = resolve(import.meta.dir, "..", "..", "conformance", "tsei-invariant-discrimination-v0")
const PROTOCOL = resolve(ROOT, "INDEPENDENT_AUTHORITY_BLIND_GROUNDING_PROTOCOL_V2.md")
const POLICY_V0 = resolve(ROOT, "provider-policy.rekor-v1.p0-e0-e1-e2.json")
const POLICY_V1 = resolve(ROOT, "provider-policy.rekor-v1.p0-e0-e1-e2.v1.json")
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex")

test("implementation remains pinned to exact normative protocol and policy bytes", () => {
  const protocol = readFileSync(PROTOCOL)
  const policy = readFileSync(POLICY_V1)
  expect(protocol.length).toBe(16828)
  expect(sha(protocol)).toBe("3150b5ae09d9b14d706cb64473de63917804e002bd79b5f60473927460b454d0")
  expect(policy.length).toBe(1905)
  expect(sha(policy)).toBe(REKOR_V1_P0_PROVIDER_POLICY_V1_SHA256)
  expect(protocol.includes(Buffer.from(REKOR_V1_P0_PROVIDER_POLICY_V1_SHA256, "utf8"))).toBe(true)
})

test("normative protocol bytes contain no mutable candidate or lifecycle status", () => {
  const protocol = readFileSync(PROTOCOL, "utf8")
  expect(protocol).not.toContain("FUTURE_CONTRACT_CANDIDATE_NOT_IMPLEMENTED_NOT_FROZEN")
  expect(protocol).not.toContain("PROTOCOL_V2_APPROVED")
  expect(protocol).not.toContain("PROVIDER_POLICY_V1_APPROVED")
  expect(protocol).not.toContain("IMPLEMENTATION_AUTHORIZED")
  expect(protocol).not.toContain("REPOSITORY_CHANGED")
  expect(protocol).not.toContain("NEXT_GATE")
  expect(protocol).not.toContain("provider-policy.rekor-v1.p0-e0-e1-e2.v1.candidate.json")
  expect(protocol).toContain("schema = tsei-invariant-discrimination-v1.protocol-v2-ratification.v0")
  expect(protocol).toContain("status = RATIFIED_FOR_NEW_INSTANCES")
})

test("new policy is canonical and fixes the P0 tree-capture pin", () => {
  const bytes = readFileSync(POLICY_V1)
  const parsed = JSON.parse(bytes.toString("utf8"))
  const stable = (value: any): string => {
    if (value === null || typeof value !== "object") return JSON.stringify(value)
    if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`
  }
  expect(bytes.equals(Buffer.from(`${stable(parsed)}\n`, "utf8"))).toBe(true)
  expect(parsed.dummy_gate.production_tree_pin).toBe("capture_at_p0_not_dummy_tree")
  expect(parseRekorV1P0ProviderPolicyV1(bytes).ok).toBe(true)
  expect(evaluateP0ProviderPolicyFreezeV1(bytes).frozen).toBe(true)
})

test("old and new exact policy bytes cross-reject", () => {
  const oldBytes = readFileSync(POLICY_V0)
  const newBytes = readFileSync(POLICY_V1)
  expect(evaluateP0ProviderPolicyFreezeV1(oldBytes).frozen).toBe(false)
  expect(evaluateP0ProviderPolicyFreeze(newBytes).frozen).toBe(false)
})
