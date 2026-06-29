import type { SelectedLineRange } from "@/context/file"

type HandoffSession = {
  prompt: string
  files: Record<string, SelectedLineRange | null>
}

export type HandoffReceiptSummary = {
  schema: "stealth.session.evidence.v1"
  sessionID: string
  commandCount: number
  changedFiles: string[]
  diffSha256: string | null
  verifierStatus?: "OK" | "REJECT"
  reasonCode?: string
}

export type HandoffEvidenceCommand = {
  command?: string
  exit_code?: number
  stdout_summary?: string
}

export type HandoffAuthorizationAction = {
  permission?: string
  pattern?: string
  action?: string
}

export type HandoffExecutionRecord = {
  call_id?: string
  tool?: string
  action_performed?: string
  target?: string
  execution_timestamp?: number
  completed_timestamp?: number
  status?: "completed" | "error"
  scope_match?: boolean | null
}

export type HandoffEvidence = {
  schema?: "stealth.session.evidence.v0" | "stealth.session.evidence.v1"
  session_id?: string
  directory?: string
  task?: { title?: string; prompt?: string }
  agent?: { id?: string; runtime?: string; model?: string }
  scope?: {
    permission?: unknown
    lease?: {
      id?: string
      mode?: string
      target?: string
      allowed_actions?: HandoffAuthorizationAction[]
      issued_at?: number | null
      expires_at?: number | null
      status?: string
    }
  }
  authorization?: {
    delegation_ref?: string | null
    delegator?: string | null
    agent_operator?: string | null
    target?: string
    allowed_actions?: HandoffAuthorizationAction[]
    authorization_valid_from?: number | null
    authorization_expiry?: number | null
    authorization_checked_at?: number
    authorization_state_hash?: string
    authorized_at_execution?: boolean | null
  }
  execution?: HandoffExecutionRecord[]
  commands?: HandoffEvidenceCommand[]
  changes?: { files_changed?: string[]; diff_sha256?: string | null }
  metadata?: { message_count?: number; diff_count?: number; generated_by?: string }
}

const MAX = 40

const store = {
  session: new Map<string, HandoffSession>(),
  terminal: new Map<string, string[]>(),
  receipt: new Map<string, HandoffReceiptSummary>(),
}

const touch = <K, V>(map: Map<K, V>, key: K, value: V) => {
  map.delete(key)
  map.set(key, value)
  while (map.size > MAX) {
    const first = map.keys().next().value
    if (first === undefined) return
    map.delete(first)
  }
}

export const setSessionHandoff = (key: string, patch: Partial<HandoffSession>) => {
  const prev = store.session.get(key) ?? { prompt: "", files: {} }
  touch(store.session, key, { ...prev, ...patch })
}

export const getSessionHandoff = (key: string) => store.session.get(key)

export const setTerminalHandoff = (key: string, value: string[]) => {
  touch(store.terminal, key, value)
}

export const getTerminalHandoff = (key: string) => store.terminal.get(key)

export const setReceiptHandoff = (key: string, value: HandoffReceiptSummary) => {
  touch(store.receipt, key, value)
}

export const getReceiptHandoff = (key: string) => store.receipt.get(key)
