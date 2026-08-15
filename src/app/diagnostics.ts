import type { UpdateManagerState } from './update-manager-context'
import { buildInfo } from './buildInfo'
import { downloadTextFile } from './format'
import { WORKSPACE_COLLECTIONS, type WorkspaceCollectionName } from '../db/workspaceRepository'
import type { WorkspaceData } from '../models/domain'
import type { WorkspaceRegistryEntry } from '../models/workspace-registry'

export const DIAGNOSTIC_REPORT_APPLICATION = 'sociology-phd-desk-diagnostics' as const
export const DIAGNOSTIC_REPORT_VERSION = 1 as const

export type PwaDisplayMode = 'browser' | 'standalone'
export type ServiceWorkerLifecycle =
  | 'unsupported'
  | 'inspection-failed'
  | 'not-registered'
  | 'installing'
  | 'waiting'
  | 'active'

export interface ServiceWorkerDiagnostics {
  supported: boolean
  controlled: boolean
  lifecycle: ServiceWorkerLifecycle
  updateManagerState: UpdateManagerState
}

export interface DiagnosticReport {
  application: typeof DIAGNOSTIC_REPORT_APPLICATION
  version: typeof DIAGNOSTIC_REPORT_VERSION
  generatedAt: string
  app: {
    version: string
    buildSha: string
    buildDate: string
  }
  environment: {
    userAgent: string
    pwaMode: PwaDisplayMode
  }
  schemas: {
    portable: number
    standardDatabase: number
    encryptedContainer: number
  }
  workspace: {
    mode: WorkspaceRegistryEntry['encryptionMode']
    recordCounts: Record<WorkspaceCollectionName, number>
    totalRecords: number
  }
  migration: {
    lastStatus: 'verified' | 'failed' | 'not-applicable'
    schemaStatus: 'current' | 'reconciliation-needed'
  }
  serviceWorker: ServiceWorkerDiagnostics
  privacy: {
    researchContentIncluded: false
    workspaceIdentifiersIncluded: false
    automaticallyUploaded: false
  }
}

export function detectPwaDisplayMode(): PwaDisplayMode {
  const iosStandalone = Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  const displayModeStandalone = typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches
  return iosStandalone || displayModeStandalone ? 'standalone' : 'browser'
}

export async function inspectServiceWorker(
  updateManagerState: UpdateManagerState,
): Promise<ServiceWorkerDiagnostics> {
  if (!('serviceWorker' in navigator)) {
    return {
      supported: false,
      controlled: false,
      lifecycle: 'unsupported',
      updateManagerState,
    }
  }

  const container = navigator.serviceWorker
  const controlled = Boolean(container.controller)
  try {
    const registration = typeof container.getRegistration === 'function'
      ? await container.getRegistration(document.baseURI)
      : undefined
    const lifecycle: ServiceWorkerLifecycle = registration?.waiting
      ? 'waiting'
      : registration?.installing
        ? 'installing'
        : registration?.active
          ? 'active'
          : 'not-registered'
    return { supported: true, controlled, lifecycle, updateManagerState }
  } catch {
    return {
      supported: true,
      controlled,
      lifecycle: 'inspection-failed',
      updateManagerState,
    }
  }
}

function recordCounts(snapshot: WorkspaceData): Record<WorkspaceCollectionName, number> {
  return Object.fromEntries(
    WORKSPACE_COLLECTIONS.map((collection) => [collection, snapshot[collection].length]),
  ) as Record<WorkspaceCollectionName, number>
}

function schemaStatus(entry: WorkspaceRegistryEntry): 'current' | 'reconciliation-needed' {
  const storageCurrent = entry.encryptionMode === 'encrypted'
    ? entry.storageSchemaVersion === 1
    : entry.storageSchemaVersion === buildInfo.databaseSchemaVersion
  return entry.schemaVersion === buildInfo.portableSchemaVersion && storageCurrent
    ? 'current'
    : 'reconciliation-needed'
}

function lastMigrationStatus(
  entry: WorkspaceRegistryEntry,
): DiagnosticReport['migration']['lastStatus'] {
  if (entry.state === 'migration-failed') return 'failed'
  if (entry.legacyMigrationKey && entry.state === 'ready') return 'verified'
  return 'not-applicable'
}

export function buildDiagnosticReport({
  generatedAt,
  entry,
  snapshot,
  userAgent,
  pwaMode,
  serviceWorker,
}: {
  generatedAt: string
  entry: WorkspaceRegistryEntry
  snapshot: WorkspaceData
  userAgent: string
  pwaMode: PwaDisplayMode
  serviceWorker: ServiceWorkerDiagnostics
}): DiagnosticReport {
  const counts = recordCounts(snapshot)
  return {
    application: DIAGNOSTIC_REPORT_APPLICATION,
    version: DIAGNOSTIC_REPORT_VERSION,
    generatedAt,
    app: {
      version: buildInfo.appVersion,
      buildSha: buildInfo.buildSha,
      buildDate: buildInfo.buildDate,
    },
    environment: { userAgent, pwaMode },
    schemas: {
      portable: buildInfo.portableSchemaVersion,
      standardDatabase: buildInfo.databaseSchemaVersion,
      encryptedContainer: buildInfo.encryptedContainerVersion,
    },
    workspace: {
      mode: entry.encryptionMode,
      recordCounts: counts,
      totalRecords: Object.values(counts).reduce((sum, count) => sum + count, 0),
    },
    migration: {
      lastStatus: lastMigrationStatus(entry),
      schemaStatus: schemaStatus(entry),
    },
    serviceWorker,
    privacy: {
      researchContentIncluded: false,
      workspaceIdentifiersIncluded: false,
      automaticallyUploaded: false,
    },
  }
}

export function serializeDiagnosticReport(report: DiagnosticReport): string {
  return `${JSON.stringify(report, null, 2)}\n`
}

export function diagnosticFilename(generatedAt: string): string {
  return `sociology-phd-desk-diagnostics-${generatedAt.replace(/[-:.]/g, '')}.json`
}

export function downloadDiagnosticReport(report: DiagnosticReport): void {
  downloadTextFile(
    serializeDiagnosticReport(report),
    diagnosticFilename(report.generatedAt),
  )
}
