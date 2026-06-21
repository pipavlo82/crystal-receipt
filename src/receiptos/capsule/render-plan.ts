import { buildEvidenceCapsuleViewModel, type CapsuleStatus, type EvidenceCapsuleSection, type EvidenceCapsuleViewModel } from "./evidence-capsule"
import type { HandoffEvidence } from "../schema/types"

export type RenderPlanZoneId = "core" | "inner_ring" | "facets" | "outer_shell" | "anchor_edge" | "seal"

export type RenderPlanSectionRef = {
  id: EvidenceCapsuleSection["id"]
  label: string
  status: CapsuleStatus
}

export type RenderPlanZone = {
  id: RenderPlanZoneId
  label: string
  semantic_role: string
  section_ids: EvidenceCapsuleSection["id"][]
  sections: RenderPlanSectionRef[]
}

export type RenderPlanV0 = {
  schema: "receiptos.render_plan.v0"
  source: {
    schema: string
    session_id: string
    section_count: number
  }
  zones: RenderPlanZone[]
  invariants: {
    all_section_ids: EvidenceCapsuleSection["id"][]
    mapped_section_ids: EvidenceCapsuleSection["id"][]
    unmapped_section_ids: EvidenceCapsuleSection["id"][]
    duplicate_section_ids: EvidenceCapsuleSection["id"][]
    complete: boolean
    unique: boolean
  }
}

const RENDER_PLAN_ZONE_DEFINITIONS: Array<{
  id: RenderPlanZoneId
  label: string
  semantic_role: string
  section_ids: EvidenceCapsuleSection["id"][]
}> = [
  {
    id: "core",
    label: "Core",
    semantic_role: "Primary claimed payload/action at the center of the visual composition.",
    section_ids: ["payload"],
  },
  {
    id: "inner_ring",
    label: "Inner Ring",
    semantic_role: "Immediate execution boundary: policy scope, authorization, and decision trace around the core action.",
    section_ids: ["policy_boundary", "authorization", "decision_trace"],
  },
  {
    id: "facets",
    label: "Facets",
    semantic_role: "Operational evidence surfaces: execution, evidence record, and counterfactual/denied-action interpretation.",
    section_ids: ["execution", "evidence", "counterfactual"],
  },
  {
    id: "outer_shell",
    label: "Outer Shell",
    semantic_role: "Portable replay and integrity shell: result, receipt root, and replay manifest.",
    section_ids: ["result", "receipt_root", "replay_manifest"],
  },
  {
    id: "anchor_edge",
    label: "Anchor Edge",
    semantic_role: "Proof attachment perimeter: local Merkle proof and external anchor state.",
    section_ids: ["merkle", "anchor"],
  },
  {
    id: "seal",
    label: "Seal",
    semantic_role: "Verifier seal showing the portable verifier outcome without changing proof semantics.",
    section_ids: ["verifier"],
  },
]

function buildSectionRefMap(capsule: EvidenceCapsuleViewModel): Map<EvidenceCapsuleSection["id"], RenderPlanSectionRef> {
  return new Map(
    capsule.sections.map((section) => [
      section.id,
      {
        id: section.id,
        label: section.label,
        status: section.status,
      },
    ]),
  )
}

export function getRenderPlanZoneDefinitions(): ReadonlyArray<RenderPlanZone> {
  return RENDER_PLAN_ZONE_DEFINITIONS.map((zone) => ({
    ...zone,
    section_ids: [...zone.section_ids],
    sections: [],
  }))
}

export function buildRenderPlanFromCapsule(capsule: EvidenceCapsuleViewModel): RenderPlanV0 {
  const refs = buildSectionRefMap(capsule)
  const allSectionIds = capsule.sections.map((section) => section.id)
  const mappedSectionIds = RENDER_PLAN_ZONE_DEFINITIONS.flatMap((zone) => zone.section_ids)
  const duplicates = mappedSectionIds.filter((id, index) => mappedSectionIds.indexOf(id) !== index)
  const unmapped = allSectionIds.filter((id) => !mappedSectionIds.includes(id))

  return {
    schema: "receiptos.render_plan.v0",
    source: {
      schema: capsule.schema,
      session_id: capsule.session_id,
      section_count: capsule.sections.length,
    },
    zones: RENDER_PLAN_ZONE_DEFINITIONS.map((zone) => ({
      ...zone,
      section_ids: [...zone.section_ids],
      sections: zone.section_ids.map((id) => {
        const ref = refs.get(id)
        if (!ref) throw new Error(`render plan zone ${zone.id} references missing capsule section: ${id}`)
        return ref
      }),
    })),
    invariants: {
      all_section_ids: allSectionIds,
      mapped_section_ids: mappedSectionIds,
      unmapped_section_ids: unmapped,
      duplicate_section_ids: duplicates,
      complete: unmapped.length === 0,
      unique: duplicates.length === 0,
    },
  }
}

export async function buildRenderPlan(evidence: HandoffEvidence): Promise<RenderPlanV0> {
  const capsule = await buildEvidenceCapsuleViewModel(evidence)
  return buildRenderPlanFromCapsule(capsule)
}
