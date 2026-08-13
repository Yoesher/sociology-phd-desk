import { beforeEach, describe, expect, it } from 'vitest'
import type { WorkspaceRegistryEntry } from '../models/workspace-registry'
import {
  backupReminderIsDue,
  readBackupReminderDays,
  snoozeBackupReminder,
  writeBackupReminderDays,
} from './backupReminder'

const workspace: WorkspaceRegistryEntry = {
  id: 'workspace',
  storageId: 'storage',
  displayName: 'Dissertation',
  kind: 'personal',
  encryptionMode: 'standard',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  schemaVersion: 4,
  storageSchemaVersion: 4,
  registryRevision: 1,
  autoLock: 'never',
  state: 'ready',
}

describe('backup reminder metadata', () => {
  beforeEach(() => window.localStorage.clear())

  it('uses the last successful export and supports exactly the configured intervals', () => {
    writeBackupReminderDays(30)
    expect(readBackupReminderDays()).toBe(30)
    expect(backupReminderIsDue({ ...workspace, lastExportedAt: '2026-07-20T00:00:00.000Z' }, 30, Date.parse('2026-08-12T00:00:00.000Z'))).toBe(false)
    expect(backupReminderIsDue({ ...workspace, lastExportedAt: '2026-07-01T00:00:00.000Z' }, 30, Date.parse('2026-08-12T00:00:00.000Z'))).toBe(true)
  })

  it('snoozes a due reminder for one week without changing workspace data', () => {
    const now = Date.parse('2026-08-12T00:00:00.000Z')
    expect(backupReminderIsDue(workspace, 7, now)).toBe(true)
    snoozeBackupReminder(workspace.id, now)
    expect(backupReminderIsDue(workspace, 7, now + 6 * 86_400_000)).toBe(false)
    expect(backupReminderIsDue(workspace, 7, now + 8 * 86_400_000)).toBe(true)
  })

  it('defaults to 14 days, can be disabled, and always excludes Demo workspaces', () => {
    const now = Date.parse('2026-08-12T00:00:00.000Z')
    expect(readBackupReminderDays()).toBe(14)
    writeBackupReminderDays('off')
    expect(readBackupReminderDays()).toBe('off')
    expect(backupReminderIsDue(workspace, 'off', now)).toBe(false)
    expect(backupReminderIsDue({ ...workspace, kind: 'demo' }, 7, now)).toBe(false)
  })
})
