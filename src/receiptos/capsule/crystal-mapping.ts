import type { HandoffEvidence } from "../schema/types"
import {
  buildEvidenceCapsuleViewModel,
  getProofSurfaceStatus,
  type CapsuleStatus,
  type EvidenceCapsuleSection,
} from "./evidence-capsule"

export type CrystalReceiptMapping = {
  core: EvidenceCapsuleSection[]
  inner_ring: EvidenceCapsuleSection[]
  facets: EvidenceCapsuleSection[]
  outer_shell: EvidenceCapsuleSection[]
  anchor_edge: EvidenceCapsuleSection[]
  seal: {
    status: CapsuleStatus
    sections: EvidenceCapsuleSection[]
  }
}

export async function buildCrystalReceiptMapping(evidence: HandoffEvidence): Promise<CrystalReceiptMapping> {
  const capsule = await buildEvidenceCapsuleViewModel(evidence)
  const byId = new Map(capsule.sections.map((section) => [section.id, section]))
  const proof = await getProofSurfaceStatus(evidence)

  return {
    core: [byId.get("payload")!],
    inner_ring: [byId.get("policy_boundary")!, byId.get("authorization")!, byId.get("decision_trace")!],
    facets: [byId.get("execution")!, byId.get("evidence")!, byId.get("counterfactual")!],
    outer_shell: [byId.get("result")!, byId.get("receipt_root")!, byId.get("replay_manifest")!],
    anchor_edge: [byId.get("merkle")!, byId.get("anchor")!],
    seal: {
      status: proof.verifier,
      sections: [byId.get("verifier")!],
    },
  }
}
