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

test("protocol v2 and provider policy v1 remain pinned to approved exact bytes", () => {
  const protocol = readFileSync(PROTOCOL)
  const policy = readFileSync(POLICY_V1)
  expect(protocol.length).toBe(15150)
  expect(sha(protocol)).toBe("10ff58f08dc8dcac2e0ebe1e1012ba5e605729e29e73d5e966ba9241ecbd3e1d")
  expect(policy.length).toBe(1905)
  expect(sha(policy)).toBe(REKOR_V1_P0_PROVIDER_POLICY_V1_SHA256)
  expect(protocol.includes(Buffer.from(REKOR_V1_P0_PROVIDER_POLICY_V1_SHA256, "utf8"))).toBe(true)
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
