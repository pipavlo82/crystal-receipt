import type {
  HandoffAnchorProof,
  HandoffAuthorizationAction,
  HandoffEvidence,
  HandoffEvidenceCommand,
  HandoffExecutionRecord,
} from "./types"

export type ValidationResult<T> =
  | { success: true; value: T }
  | { success: false; errors: string[] }

function ok<T>(value: T): ValidationResult<T> {
  return { success: true, value }
}

function fail<T = never>(...errors: string[]): ValidationResult<T> {
  return { success: false, errors }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isString(value: unknown): value is string {
  return typeof value === "string"
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function isNullOrString(value: unknown): value is string | null {
  return value === null || isString(value)
}

function isNullOrNumber(value: unknown): value is number | null {
  return value === null || isNumber(value)
}

function isNullOrBoolean(value: unknown): value is boolean | null {
  return value === null || typeof value === "boolean"
}

function validateAuthorizationAction(value: unknown, path: string): ValidationResult<HandoffAuthorizationAction> {
  if (!isRecord(value)) return fail(`${path} must be an object`)
  if (!isString(value.permission)) return fail(`${path}.permission must be a string`)
  if (!isString(value.pattern)) return fail(`${path}.pattern must be a string`)
  if (!isString(value.action)) return fail(`${path}.action must be a string`)
  return ok(value as HandoffAuthorizationAction)
}

function validateExecutionRecord(value: unknown, path: string): ValidationResult<HandoffExecutionRecord> {
  if (!isRecord(value)) return fail(`${path} must be an object`)
  if (!isString(value.call_id)) return fail(`${path}.call_id must be a string`)
  if (!isString(value.tool)) return fail(`${path}.tool must be a string`)
  if (!isString(value.action_performed)) return fail(`${path}.action_performed must be a string`)
  if (!isString(value.target)) return fail(`${path}.target must be a string`)
  if (!isNumber(value.execution_timestamp)) return fail(`${path}.execution_timestamp must be a number`)
  if (!isNumber(value.completed_timestamp)) return fail(`${path}.completed_timestamp must be a number`)
  if (value.status !== "completed" && value.status !== "error") return fail(`${path}.status must be "completed" or "error"`)
  if (!isNullOrBoolean(value.scope_match)) return fail(`${path}.scope_match must be boolean or null`)
  return ok(value as HandoffExecutionRecord)
}

function validateCommand(value: unknown, path: string): ValidationResult<HandoffEvidenceCommand> {
  if (!isRecord(value)) return fail(`${path} must be an object`)
  if (!isString(value.command)) return fail(`${path}.command must be a string`)
  if (value.exit_code !== undefined && !isNumber(value.exit_code)) return fail(`${path}.exit_code must be a number when present`)
  if (value.stdout_summary !== undefined && !isString(value.stdout_summary)) return fail(`${path}.stdout_summary must be a string when present`)
  return ok(value as HandoffEvidenceCommand)
}

function validateAnchorProof(value: unknown, path: string): ValidationResult<HandoffAnchorProof> {
  if (!isRecord(value)) return fail(`${path} must be an object`)
  if (!isString(value.receipt_root)) return fail(`${path}.receipt_root must be a string`)
  if (value.merkle_proof_status !== "not attached" && value.merkle_proof_status !== "attached") {
    return fail(`${path}.merkle_proof_status must be "not attached" or "attached"`)
  }
  if (!isNullOrString(value.merkle_root)) return fail(`${path}.merkle_root must be string or null`)
  if (!isNullOrNumber(value.merkle_leaf_index)) return fail(`${path}.merkle_leaf_index must be number or null`)
  if (!Array.isArray(value.merkle_proof) || !value.merkle_proof.every(isString)) return fail(`${path}.merkle_proof must be an array of strings`)
  if (value.onchain_anchor_status !== "not anchored") return fail(`${path}.onchain_anchor_status must be "not anchored"`)
  if (value.network !== "local/off-chain") return fail(`${path}.network must be "local/off-chain"`)
  if (!isNullOrString(value.contract)) return fail(`${path}.contract must be string or null`)
  if (!isNullOrString(value.tx_hash)) return fail(`${path}.tx_hash must be string or null`)
  if (value.verifier_status !== "not verified") return fail(`${path}.verifier_status must be "not verified"`)
  return ok(value as HandoffAnchorProof)
}

export const AuthorizationActionSchema = {
  validate: validateAuthorizationAction,
}

export const ExecutionRecordSchema = {
  validate: validateExecutionRecord,
}

export const AnchorProofSchema = {
  validate: validateAnchorProof,
}

export const HandoffEvidenceSchema = {
  schema: "stealth.session.evidence.v1" as const,
  validate(value: unknown): ValidationResult<HandoffEvidence> {
    if (!isRecord(value)) return fail("evidence must be an object")
    if (value.schema !== "stealth.session.evidence.v1") return fail('schema must equal "stealth.session.evidence.v1"')
    if (!isString(value.session_id)) return fail("session_id must be a string")
    if (!isString(value.directory)) return fail("directory must be a string")

    if (!isRecord(value.task)) return fail("task must be an object")
    if (value.task.title !== undefined && !isString(value.task.title)) return fail("task.title must be a string when present")
    if (value.task.prompt !== undefined && !isString(value.task.prompt)) return fail("task.prompt must be a string when present")

    if (!isRecord(value.agent)) return fail("agent must be an object")
    if (value.agent.id !== undefined && !isString(value.agent.id)) return fail("agent.id must be a string when present")
    if (value.agent.runtime !== "Stealth") return fail('agent.runtime must be "Stealth"')

    if (!isRecord(value.scope)) return fail("scope must be an object")
    if (!(value.scope.permission === null || value.scope.permission !== undefined)) return fail("scope.permission must exist")
    if (value.scope.lease !== undefined) {
      if (!isRecord(value.scope.lease)) return fail("scope.lease must be an object when present")
      if (!isString(value.scope.lease.id)) return fail("scope.lease.id must be a string")
      if (value.scope.lease.mode !== "read_only" && value.scope.lease.mode !== "edit" && value.scope.lease.mode !== "execute") {
        return fail('scope.lease.mode must be "read_only", "edit", or "execute"')
      }
      if (!isString(value.scope.lease.target)) return fail("scope.lease.target must be a string")
      if (!Array.isArray(value.scope.lease.allowed_actions)) return fail("scope.lease.allowed_actions must be an array")
      for (let index = 0; index < value.scope.lease.allowed_actions.length; index += 1) {
        const result = validateAuthorizationAction(value.scope.lease.allowed_actions[index], `scope.lease.allowed_actions[${index}]`)
        if (!result.success) return result
      }
      if (!isNullOrNumber(value.scope.lease.issued_at)) return fail("scope.lease.issued_at must be number or null")
      if (!isNullOrNumber(value.scope.lease.expires_at)) return fail("scope.lease.expires_at must be number or null")
      if (value.scope.lease.status !== "active" && value.scope.lease.status !== "missing" && value.scope.lease.status !== "expired") {
        return fail('scope.lease.status must be "active", "missing", or "expired"')
      }
    }

    if (!isRecord(value.authorization)) return fail("authorization must be an object")
    if (!isNullOrString(value.authorization.delegation_ref)) return fail("authorization.delegation_ref must be string or null")
    if (!isNullOrString(value.authorization.delegator)) return fail("authorization.delegator must be string or null")
    if (!isNullOrString(value.authorization.agent_operator)) return fail("authorization.agent_operator must be string or null")
    if (!isString(value.authorization.target)) return fail("authorization.target must be a string")
    if (!Array.isArray(value.authorization.allowed_actions)) return fail("authorization.allowed_actions must be an array")
    for (let index = 0; index < value.authorization.allowed_actions.length; index += 1) {
      const result = validateAuthorizationAction(value.authorization.allowed_actions[index], `authorization.allowed_actions[${index}]`)
      if (!result.success) return result
    }
    if (!isNullOrNumber(value.authorization.authorization_valid_from)) return fail("authorization.authorization_valid_from must be number or null")
    if (!isNullOrNumber(value.authorization.authorization_expiry)) return fail("authorization.authorization_expiry must be number or null")
    if (!isNumber(value.authorization.authorization_checked_at)) return fail("authorization.authorization_checked_at must be a number")
    if (!isString(value.authorization.authorization_state_hash)) return fail("authorization.authorization_state_hash must be a string")
    if (!isNullOrBoolean(value.authorization.authorized_at_execution)) return fail("authorization.authorized_at_execution must be boolean or null")

    if (!Array.isArray(value.execution)) return fail("execution must be an array")
    for (let index = 0; index < value.execution.length; index += 1) {
      const result = validateExecutionRecord(value.execution[index], `execution[${index}]`)
      if (!result.success) return result
    }

    if (!Array.isArray(value.commands)) return fail("commands must be an array")
    for (let index = 0; index < value.commands.length; index += 1) {
      const result = validateCommand(value.commands[index], `commands[${index}]`)
      if (!result.success) return result
    }

    if (!isRecord(value.changes)) return fail("changes must be an object")
    if (!Array.isArray(value.changes.files_changed) || !value.changes.files_changed.every(isString)) return fail("changes.files_changed must be an array of strings")
    if (!isNullOrString(value.changes.diff_sha256)) return fail("changes.diff_sha256 must be string or null")

    const anchorResult = validateAnchorProof(value.anchor, "anchor")
    if (!anchorResult.success) return anchorResult

    if (!isRecord(value.metadata)) return fail("metadata must be an object")
    if (!isNumber(value.metadata.message_count)) return fail("metadata.message_count must be a number")
    if (!isNumber(value.metadata.diff_count)) return fail("metadata.diff_count must be a number")
    if (value.metadata.generated_by !== "stealth.handoff.evidence.builder.v1") {
      return fail('metadata.generated_by must be "stealth.handoff.evidence.builder.v1"')
    }

    return ok(value as HandoffEvidence)
  },
  parse(value: unknown): HandoffEvidence {
    const result = this.validate(value)
    if (!result.success) {
      throw new Error(result.errors.join("; "))
    }
    return result.value
  },
}
