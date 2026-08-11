import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { SociologyPhdDeskDatabase } from './database'
import { createDemoWorkspace } from '../models/demo'

describe('database migrations', () => {
  it('upgrades a v1 workspace without a revision to revision zero', async () => {
    const databaseName = `sociology-phd-desk-migration-${crypto.randomUUID()}`
    const legacyDatabase = new Dexie(databaseName)
    legacyDatabase.version(1).stores({ workspaces: '&id, updatedAt' })

    const legacyWorkspace: Record<string, unknown> = {
      ...createDemoWorkspace(new Date('2026-04-10T09:30:00.000Z')).workspace,
    }
    delete legacyWorkspace['revision']
    await legacyDatabase.table('workspaces').put(legacyWorkspace)
    legacyDatabase.close()

    const upgradedDatabase = new SociologyPhdDeskDatabase(databaseName)
    try {
      const migrated = await upgradedDatabase.workspaces.get(String(legacyWorkspace['id']))
      expect(migrated?.revision).toBe(0)
    } finally {
      upgradedDatabase.close()
      await Dexie.delete(databaseName)
    }
  })
})
