export type EvidenceCapsuleV0Like = {
  receipt_root: {
    match: boolean
    status: "verified" | "mismatch" | "missing"
  }
  verifier_result: {
    ok: boolean
    status: "verified" | "mismatch" | "missing"
  }
  proof_refs: {
    anchor: {
      status: "anchored" | "pending" | "missing" | "unknown"
    }
  }
  capsule: {
    sections: {
      id: string
      status: string
    }[]
  }
}

export type InvariantValidationResult = {
  ok: boolean
  errors: string[]
}

export function validateEvidenceCapsuleInvariants(doc: EvidenceCapsuleV0Like): InvariantValidationResult {
  const errors: string[] = []

  if (!doc.receipt_root.match) {
    errors.push("receipt_root.match must be true for an invariant-valid substrate")
  }

  if (!doc.verifier_result.ok) {
    errors.push("verifier_result.ok must be true for an invariant-valid substrate")
  }

  if (doc.receipt_root.status !== doc.verifier_result.status) {
    errors.push("receipt_root.status must match verifier_result.status")
  }

  const anchorSection = doc.capsule.sections.find((section) => section.id === "anchor")
  if (!anchorSection) {
    errors.push("capsule.sections must include an anchor section")
  } else if (anchorSection.status !== doc.proof_refs.anchor.status) {
    errors.push("proof_refs.anchor.status must match capsule.sections[id=anchor].status")
  }

  return {
    ok: errors.length === 0,
    errors,
  }
}
