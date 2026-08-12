import type { WorkspaceRegistryEntry } from '../models/workspace-registry'

const REMINDER_KEY = 'sociology-phd-desk:backup-reminder:v1'
const DAY_MS = 86_400_000
const SNOOZE_DAYS = 7
export const BACKUP_REMINDER_SETTINGS_CHANGED = 'sociology-phd-desk:backup-reminder-settings-changed'

export type BackupReminderDays = 7 | 14 | 30

interface BackupReminderSettings {
  days?: unknown
  snoozedUntilByWorkspace?: Record<string, string>
}

function readSettings(): BackupReminderSettings {
  try {
    return JSON.parse(window.localStorage.getItem(REMINDER_KEY) ?? '{}') as BackupReminderSettings
  } catch {
    return {}
  }
}

function writeSettings(settings: BackupReminderSettings) {
  try {
    window.localStorage.setItem(REMINDER_KEY, JSON.stringify(settings))
  } catch {
    // Reminder metadata is optional and stays browser-local.
  }
}

export function readBackupReminderDays(): BackupReminderDays {
  const value = readSettings().days
  return value === 7 || value === 14 || value === 30 ? value : 14
}

export function writeBackupReminderDays(days: BackupReminderDays) {
  writeSettings({ ...readSettings(), days })
  window.dispatchEvent(new Event(BACKUP_REMINDER_SETTINGS_CHANGED))
}

export function backupReminderIsDue(
  workspace: WorkspaceRegistryEntry | null,
  days = readBackupReminderDays(),
  now = Date.now(),
) {
  if (!workspace) return false
  const baseline = Date.parse(workspace.lastExportedAt ?? workspace.createdAt)
  if (!Number.isFinite(baseline) || now - baseline < days * DAY_MS) return false
  const snoozedUntil = Date.parse(readSettings().snoozedUntilByWorkspace?.[workspace.id] ?? '')
  return !Number.isFinite(snoozedUntil) || snoozedUntil <= now
}

export function snoozeBackupReminder(workspaceId: string, now = Date.now()) {
  const settings = readSettings()
  writeSettings({
    ...settings,
    snoozedUntilByWorkspace: {
      ...settings.snoozedUntilByWorkspace,
      [workspaceId]: new Date(now + SNOOZE_DAYS * DAY_MS).toISOString(),
    },
  })
}
