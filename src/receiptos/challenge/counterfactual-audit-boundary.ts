import { createHash } from "node:crypto"
import { canonicalize } from "../canon/canonicalize"

const AUDIT_TIMESTAMP = "audit_timestamp"

function validateSemanticValue(value: unknown, path: string): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") return

  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`${path} must contain only finite JSON numbers`)
    return
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => validateSemanticValue(item, `${path}[${index}]`))
    return
  }

  if (typeof value !== "object") {
    throw new Error(`${path} must be in the JSON value domain`)
  }

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const childPath = `${path}.${key}`
    if (key === AUDIT_TIMESTAMP) {
      throw new Error(`${childPath} is non-semantic audit metadata and is forbidden in the semantic canonicalization domain`)
    }
    validateSemanticValue(child, childPath)
  }
}

/** Reject reserved audit metadata before a semantic object reaches canonicalization. */
export function validateCounterfactualSemanticArtifact(value: unknown): void {
  validateSemanticValue(value, "$semantic_artifact")
}

/** Derive an artifact reference from the validated semantic object only. */
export function computeCounterfactualSemanticArtifactRef(value: unknown): string {
  validateCounterfactualSemanticArtifact(value)
  const bytes = new TextEncoder().encode(canonicalize(value))
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`
}

/** Hash the exact serialized manifest bytes, including audit metadata bytes. */
export function computeCounterfactualManifestFileSha256(bytes: string | Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex")
}
