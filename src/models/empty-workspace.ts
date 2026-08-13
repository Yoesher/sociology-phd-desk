import {
  WORKSPACE_APPLICATION,
  WORKSPACE_SCHEMA_VERSION,
  type WorkspaceData,
} from './domain'

export const DEFAULT_PERSONAL_WORKSPACE_NAME = '我的研究工作台'

export interface EmptyWorkspaceOptions {
  id?: string
  name?: string
  now?: Date
}

function createWorkspaceId(): string {
  const random = globalThis.crypto?.randomUUID?.()
  if (random) return `workspace-${random}`
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('Secure random generation is unavailable.')
  }
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16))
  return `workspace-${[...bytes]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')}`
}

/** Creates a genuinely empty personal workspace; no demo rows are mixed in. */
export function createEmptyWorkspace(options: EmptyWorkspaceOptions = {}): WorkspaceData {
  const now = options.now ?? new Date()
  const timestamp = now.toISOString()

  return {
    application: WORKSPACE_APPLICATION,
    version: WORKSPACE_SCHEMA_VERSION,
    exportedAt: timestamp,
    workspace: {
      id: options.id ?? createWorkspaceId(),
      name: options.name?.trim() || DEFAULT_PERSONAL_WORKSPACE_NAME,
      revision: 0,
      todayGoals: [],
      createdAt: timestamp,
      updatedAt: timestamp,
      isDemo: false,
    },
    projects: [],
    researchQuestions: [],
    claims: [],
    claimQuestionLinks: [],
    theoryMemos: [],
    tasks: [],
    literature: [],
    literatureExternalReferences: [],
    fieldSites: [],
    interviews: [],
    fieldVisits: [],
    datasets: [],
    analysisRuns: [],
    evidence: [],
    researchLogs: [],
    manuscripts: [],
    submissions: [],
    reviewerComments: [],
  }
}
