export const WORKSPACE_SESSION_CHANNEL_NAME = 'sociology-phd-desk:workspace-session:v1'

export const WORKSPACE_SESSION_MESSAGE_TYPES = ['registry', 'revision', 'lock'] as const
export type WorkspaceSessionMessageType = (typeof WORKSPACE_SESSION_MESSAGE_TYPES)[number]

/**
 * Cross-tab messages deliberately contain routing metadata only. Display names,
 * research content, passphrases, keys, and encrypted payloads never belong here.
 */
export interface WorkspaceSessionMessage {
  version: 1
  type: WorkspaceSessionMessageType
  workspaceId: string
  storageId: string
  revision: number
  lockEpoch: number
}

export interface WorkspaceSessionChannel {
  onmessage: ((event: MessageEvent<unknown>) => void) | null
  postMessage(message: WorkspaceSessionMessage): void
  close(): void
}

export type WorkspaceSessionChannelFactory = () => WorkspaceSessionChannel | null

const messageKeys = [
  'version',
  'type',
  'workspaceId',
  'storageId',
  'revision',
  'lockEpoch',
] as const

const isNonNegativeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0

export function isWorkspaceSessionMessage(value: unknown): value is WorkspaceSessionMessage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  const keys = Object.keys(record)
  if (
    keys.length !== messageKeys.length ||
    !keys.every((key) => (messageKeys as readonly string[]).includes(key))
  ) return false

  return record.version === 1 &&
    WORKSPACE_SESSION_MESSAGE_TYPES.some((type) => type === record.type) &&
    typeof record.workspaceId === 'string' && record.workspaceId.length > 0 &&
    typeof record.storageId === 'string' && record.storageId.length > 0 &&
    isNonNegativeInteger(record.revision) &&
    isNonNegativeInteger(record.lockEpoch)
}

export const createWorkspaceSessionChannel: WorkspaceSessionChannelFactory = () => {
  if (typeof BroadcastChannel === 'undefined') return null
  try {
    return new BroadcastChannel(WORKSPACE_SESSION_CHANNEL_NAME)
  } catch {
    return null
  }
}
