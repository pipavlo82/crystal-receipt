import { describe, expect, test } from "bun:test"
import { spawnSync } from "node:child_process"
import { readFileSync, statSync } from "node:fs"
import { resolve } from "node:path"
import {
  COUNTERFACTUAL_NEIGHBORHOOD_SCHEMA,
  canonicalIdentityJson,
  computeCounterfactualChallengeIdentitySha256,
  computeFrozenCounterfactualNeighborhoodSha256,
  projectCounterfactualChallengeIdentity,
  projectFrozenCounterfactualNeighborhood,
  type CounterfactualChallengeIdentityV0,
  type FrozenCounterfactualNeighborhoodV0,
} from "../../src/receiptos/challenge/counterfactual-neighborhood"
import { projectVerifierChallengeVector } from "../../src/receiptos/challenge/verifier-challenge-model"

const root = resolve(import.meta.dir, "../..")

function loadModel(relativePath: string) {
  const absolute = resolve(root, relativePath)
  const before = statSync(absolute)
  const raw = JSON.parse(readFileSync(absolute, "utf8"))
  const model = projectVerifierChallengeVector(raw)
  const after = statSync(absolute)
  expect(after.size).toBe(before.size)
  expect(after.mtimeMs).toBe(before.mtimeMs)
  return model
}

const VECTORS = {
  observed: "conformance/verifier-challenge-observed-not-validated-v0/vectors/V-OBSERVED-NOT-VALIDATED.json",
  missing: "conformance/verifier-challenge-missing-required-input-unverifiable-v0/vectors/V-MISSING-REQUIRED-INPUT.json",
  integrity: "conformance/verifier-challenge-integrity-mismatch-rejected-v0/vectors/V-INTEGRITY-MISMATCH.json",
  admission: "conformance/verifier-challenge-chronicle-proof-root-mismatch-rejected-v0/vectors/V-CHRONICLE-PROOF-ROOT-MISMATCH.json",
  predecessorUnknown:
    "conformance/verifier-challenge-chronicle-predecessor-unknown-unverifiable-v0/vectors/V-CHRONICLE-PREDECESSOR-UNKNOWN.json",
  sequenceGap: "conformance/verifier-challenge-chronicle-sequence-gap-rejected-v0/vectors/V-CHRONICLE-SEQUENCE-GAP.json",
  checkpointRoot:
    "conformance/verifier-challenge-chronicle-checkpoint-root-mismatch-rejected-v0/vectors/V-CHRONICLE-CHECKPOINT-ROOT-MISMATCH.json",
  checkpointRefs:
    "conformance/verifier-challenge-chronicle-checkpoint-entry-refs-noncanonical-rejected-v0/vectors/V-CHRONICLE-CHECKPOINT-ENTRY-REFS-NONCANONICAL.json",
  cabReject: "conformance/counterfactual-audit-boundary-v0/vectors/V-AT-NEST-OBJ.json",
  cabManifest: "conformance/counterfactual-audit-boundary-v0/vectors/V-MAN-HASH-DIFF.json",
} as const

function fixtureNeighborhood(): FrozenCounterfactualNeighborhoodV0 {
  return projectFrozenCounterfactualNeighborhood({
    neighborhood_id: "receiptos-counterfactual-neighborhood-lane-b-fixture-v0",
    members: Object.values(VECTORS).map((path) => loadModel(path)),
  })
}

function withMemberMutation(
  neighborhood: FrozenCounterfactualNeighborhoodV0,
  index: number,
  mutate: (member: CounterfactualChallengeIdentityV0) => CounterfactualChallengeIdentityV0,
): FrozenCounterfactualNeighborhoodV0 {
  return {
    ...neighborhood,
    members: neighborhood.members.map((member, i) => (i === index ? mutate(member) : member)),
  }
}

describe("counterfactual neighborhood identity v0", () => {
  test("same ordered neighborhood yields same digest", () => {
    const a = fixtureNeighborhood()
    const b = fixtureNeighborhood()
    expect(computeFrozenCounterfactualNeighborhoodSha256(a)).toBe(
      computeFrozenCounterfactualNeighborhoodSha256(b),
    )
  })

  test("deep-cloned equivalent neighborhood yields same digest", () => {
    const neighborhood = fixtureNeighborhood()
    const clone = structuredClone(neighborhood)
    expect(computeFrozenCounterfactualNeighborhoodSha256(clone)).toBe(
      computeFrozenCounterfactualNeighborhoodSha256(neighborhood),
    )
  })

  test("member order swap changes digest", () => {
    const neighborhood = fixtureNeighborhood()
    const swapped: FrozenCounterfactualNeighborhoodV0 = {
      ...neighborhood,
      members: [
        neighborhood.members[1]!,
        neighborhood.members[0]!,
        ...neighborhood.members.slice(2),
      ],
    }
    expect(computeFrozenCounterfactualNeighborhoodSha256(swapped)).not.toBe(
      computeFrozenCounterfactualNeighborhoodSha256(neighborhood),
    )
  })

  test("challenge removal changes digest", () => {
    const neighborhood = fixtureNeighborhood()
    const removed: FrozenCounterfactualNeighborhoodV0 = {
      ...neighborhood,
      members: neighborhood.members.slice(0, -1),
    }
    expect(computeFrozenCounterfactualNeighborhoodSha256(removed)).not.toBe(
      computeFrozenCounterfactualNeighborhoodSha256(neighborhood),
    )
  })

  test("challenge addition changes digest", () => {
    const neighborhood = fixtureNeighborhood()
    const added: FrozenCounterfactualNeighborhoodV0 = {
      ...neighborhood,
      members: [...neighborhood.members, neighborhood.members[0]!],
    }
    expect(computeFrozenCounterfactualNeighborhoodSha256(added)).not.toBe(
      computeFrozenCounterfactualNeighborhoodSha256(neighborhood),
    )
  })

  test("challenge_id / vector_id change changes digest", () => {
    const neighborhood = fixtureNeighborhood()
    const changedId = withMemberMutation(neighborhood, 0, (member) => ({
      ...member,
      challenge_id: "mutated-challenge-id",
    }))
    const changedVector = withMemberMutation(neighborhood, 0, (member) => ({
      ...member,
      vector_id: "V-MUTATED",
    }))
    const base = computeFrozenCounterfactualNeighborhoodSha256(neighborhood)
    expect(computeFrozenCounterfactualNeighborhoodSha256(changedId)).not.toBe(base)
    expect(computeFrozenCounterfactualNeighborhoodSha256(changedVector)).not.toBe(base)
  })

  test("derivation / mutation change changes digest", () => {
    const neighborhood = fixtureNeighborhood()
    const changed = withMemberMutation(neighborhood, 0, (member) => ({
      ...member,
      derivation: {
        kind: "path_mutation",
        operation: "set",
        path: ["anchor", "verifier_status"],
        from: "not verified",
        to: "mutated",
      },
    }))
    expect(computeFrozenCounterfactualNeighborhoodSha256(changed)).not.toBe(
      computeFrozenCounterfactualNeighborhoodSha256(neighborhood),
    )
  })

  test("source Git blob pin change changes digest", () => {
    const neighborhood = fixtureNeighborhood()
    const changed = withMemberMutation(neighborhood, 0, (member) => ({
      ...member,
      source: {
        repository_path: member.source!.repository_path,
        git_blob_oid: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      },
    }))
    expect(computeFrozenCounterfactualNeighborhoodSha256(changed)).not.toBe(
      computeFrozenCounterfactualNeighborhoodSha256(neighborhood),
    )
  })

  test("subject verifier blob pin change changes digest where subject exists", () => {
    const neighborhood = fixtureNeighborhood()
    expect(neighborhood.members[0]!.subject).not.toBeNull()
    const changed = withMemberMutation(neighborhood, 0, (member) => ({
      ...member,
      subject: {
        entrypoint: member.subject!.entrypoint,
        module_path: member.subject!.module_path,
        git_blob_oid: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      },
    }))
    expect(computeFrozenCounterfactualNeighborhoodSha256(changed)).not.toBe(
      computeFrozenCounterfactualNeighborhoodSha256(neighborhood),
    )
  })

  test("expected observation change only leaves neighborhood digest unchanged", () => {
    const model = loadModel(VECTORS.observed)
    const before = projectFrozenCounterfactualNeighborhood({
      neighborhood_id: "expected-separation",
      members: [model],
    })
    const mutatedModel = {
      ...model,
      expected: { ...structuredClone(model.expected as object), outcomes: ["mutated-only"] },
    }
    const after = projectFrozenCounterfactualNeighborhood({
      neighborhood_id: "expected-separation",
      members: [mutatedModel],
    })
    expect(computeFrozenCounterfactualNeighborhoodSha256(after)).toBe(
      computeFrozenCounterfactualNeighborhoodSha256(before),
    )
    expect(projectCounterfactualChallengeIdentity(mutatedModel)).toEqual(
      projectCounterfactualChallengeIdentity(model),
    )
  })

  test("native / field_classification changes outside identity projection leave digest unchanged", () => {
    const model = loadModel(VECTORS.observed)
    const before = computeCounterfactualChallengeIdentitySha256(projectCounterfactualChallengeIdentity(model))
    const mutated = {
      ...model,
      field_classification: { ...model.field_classification, extra: ["not-in-identity"] },
      native: { ...model.native, descriptive_note: "ignored" },
    }
    const after = computeCounterfactualChallengeIdentitySha256(projectCounterfactualChallengeIdentity(mutated))
    expect(after).toBe(before)
  })

  test("CAB typed operation change changes digest", () => {
    const model = loadModel(VECTORS.cabReject)
    const identity = projectCounterfactualChallengeIdentity(model)
    expect(identity.challenge_id).toBeNull()
    expect(identity.subject).toBeNull()
    expect(identity.source).toBeNull()
    expect(identity.derivation).toEqual({
      kind: "audit_boundary_operation",
      operation: "semantic_snapshot",
    })
    const base = computeCounterfactualChallengeIdentitySha256(identity)
    const changed = computeCounterfactualChallengeIdentitySha256({
      ...identity,
      derivation: { kind: "audit_boundary_operation", operation: "manifest_file_sha256" },
    })
    expect(changed).not.toBe(base)
  })

  test("null CAB subject/source/challenge_id fields are deterministic in canonical JSON", () => {
    const identity = projectCounterfactualChallengeIdentity(loadModel(VECTORS.cabManifest))
    const json = canonicalIdentityJson(identity)
    expect(json).toContain('"challenge_id":null')
    expect(json).toContain('"subject":null')
    expect(json).toContain('"source":null')
    expect(computeCounterfactualChallengeIdentitySha256(identity)).toBe(
      computeCounterfactualChallengeIdentitySha256(structuredClone(identity)),
    )
  })

  test("identity APIs do not mutate caller-owned model or neighborhood objects", () => {
    const model = loadModel(VECTORS.integrity)
    const beforeModel = structuredClone(model)
    const identity = projectCounterfactualChallengeIdentity(model)
    computeCounterfactualChallengeIdentitySha256(identity)
    expect(model).toEqual(beforeModel)

    const neighborhood = projectFrozenCounterfactualNeighborhood({
      neighborhood_id: "immutability",
      members: [model],
    })
    const beforeNeighborhood = structuredClone(neighborhood)
    computeFrozenCounterfactualNeighborhoodSha256(neighborhood)
    expect(neighborhood).toEqual(beforeNeighborhood)
    expect(model).toEqual(beforeModel)
  })

  test("frozen Lane B fixture digest matches TypeScript and independent Python", () => {
    const fixturePath = "tests/fixtures/counterfactual-neighborhood-identity-v0/neighborhood.json"
    const fixture = JSON.parse(readFileSync(resolve(root, fixturePath), "utf8")) as {
      neighborhood: FrozenCounterfactualNeighborhoodV0
      expected_neighborhood_sha256: string
    }
    expect(fixture.neighborhood.schema).toBe(COUNTERFACTUAL_NEIGHBORHOOD_SCHEMA)
    const fromApi = computeFrozenCounterfactualNeighborhoodSha256(fixtureNeighborhood())
    const fromFixtureObject = computeFrozenCounterfactualNeighborhoodSha256(fixture.neighborhood)
    expect(fromApi).toBe(fixture.expected_neighborhood_sha256)
    expect(fromFixtureObject).toBe(fixture.expected_neighborhood_sha256)

    const py = spawnSync("python", [resolve(root, "tests/fixtures/counterfactual-neighborhood-identity-v0/verify_independent.py")], {
      cwd: root,
      encoding: "utf8",
    })
    expect(py.status).toBe(0)
    expect(py.stdout.trim()).toBe(fixture.expected_neighborhood_sha256)
  })

  test("frozen production package digests remain unchanged", () => {
    // Touch projections first.
    fixtureNeighborhood()

    const checks: Array<{ packageDir: string; fixture: string; child?: string; expected?: string }> = [
      {
        packageDir: "conformance/counterfactual-audit-boundary-v0",
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

    for (const entry of checks) {
      const manifest = JSON.parse(readFileSync(resolve(root, `${entry.packageDir}/manifest.json`), "utf8"))
      expect(manifest.fixture_set_sha256).toBe(entry.fixture)
      const contract = JSON.parse(readFileSync(resolve(root, `${entry.packageDir}/contract.json`), "utf8"))
      if (entry.expected) expect(contract.expected_result_set_sha256).toBe(entry.expected)
      if (entry.child) {
        const child =
          contract.child_identity_set_sha256 ?? contract.aggregate?.child_identity_set_sha256
        expect(child).toBe(entry.child)
      }
    }
  })
})
