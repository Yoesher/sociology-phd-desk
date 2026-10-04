import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDemoWorkspace } from '../models/demo'
import { MAX_SERIALIZED_WORKSPACE_BYTES, WorkspaceCapacityError, assertInteractiveBackupBudget, workspacePdfBytes, workspaceSerializedBytes } from './workspace-capacity'

afterEach(() => vi.useRealTimers())

describe('complete workspace backup allowance', () => {
  it('counts readable export UTF8 bytes, including multibyte research text and refreshed export time', () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-10-04T00:00:00Z'))
    const workspace = createDemoWorkspace()
    workspace.projects[0]!.notes = '合成研究说明，保留原文。'
    workspace.exportedAt = '2026-08-01T00:00:00Z'
    const original = structuredClone(workspace)
    const expected = JSON.stringify({ ...workspace, exportedAt: new Date().toISOString() }, null, 2)
    expect(workspaceSerializedBytes(workspace)).toBe(new TextEncoder().encode(expected).byteLength)
    expect(workspaceSerializedBytes(workspace)).toBeGreaterThan(expected.length)
    expect(workspace).toEqual(original)
  })

  it('counts PDF attachments from all projects rather than the displayed scope', () => {
    const workspace = createDemoWorkspace()
    workspace.literature[0]!.localPdf = { fileName: 'SYNTHETIC-one.pdf', size: 10, base64: btoa('%PDF-demo!') }
    workspace.literature[1]!.localPdf = { fileName: 'SYNTHETIC-two.pdf', size: 15, base64: btoa('%PDF-second-demo') }
    expect(workspacePdfBytes(workspace)).toBe(25)
  })

  it('rejects newly unrestorable growth while preserving old oversized data and allowing reduction', () => {
    const current = createDemoWorkspace()
    const grown = structuredClone(current)
    grown.projects[0]!.notes = 'SYNTHETIC ' + 'x'.repeat(MAX_SERIALIZED_WORKSPACE_BYTES)
    const retained = structuredClone(grown)
    expect(() => assertInteractiveBackupBudget(current, grown)).toThrow(WorkspaceCapacityError)
    expect(grown).toEqual(retained)
    expect(() => assertInteractiveBackupBudget(grown, retained)).not.toThrow()
    const smaller = structuredClone(grown)
    smaller.projects[0]!.notes = smaller.projects[0]!.notes.slice(0, -1000)
    expect(workspaceSerializedBytes(smaller)).toBeGreaterThan(MAX_SERIALIZED_WORKSPACE_BYTES)
    expect(() => assertInteractiveBackupBudget(grown, smaller)).not.toThrow()
    smaller.projects[0]!.notes = 'SYNTHETIC reduced text'
    expect(() => assertInteractiveBackupBudget(grown, smaller)).not.toThrow()
  })
})
