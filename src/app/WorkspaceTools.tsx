import { useRef, useState, type ChangeEvent } from 'react'
import { Download, FileJson, RotateCcw, Upload } from 'lucide-react'
import type { WorkspaceData } from '../models/domain'
import type {
  MergeWorkspaceResult,
  WorkspaceCollectionName,
} from '../db/workspaceRepository'
import { exportWorkspaceJson, importWorkspaceJson } from '../utils/workspace-transfer'
import { downloadTextFile, todayIso } from './format'
import { useWorkspace } from '../hooks/useWorkspace'
import { Badge, Button, ConfirmDialog, LocalDataNotice, Modal } from '../components/ui'

type PendingAction = 'merge' | 'replace' | 'reset' | null

const collectionCounts = (workspace: WorkspaceData) => [
  ['Projects', workspace.projects.length],
  ['Tasks', workspace.tasks.length],
  ['Literature', workspace.literature.length],
  ['Field records', workspace.fieldSites.length + workspace.interviews.length + workspace.fieldVisits.length],
  ['Analysis records', workspace.datasets.length + workspace.analysisRuns.length],
  ['Evidence', workspace.evidence.length],
  ['Research logs', workspace.researchLogs.length],
  ['Manuscripts', workspace.manuscripts.length],
  ['Submissions & reviews', workspace.submissions.length + workspace.reviewerComments.length],
] as const

const collectionLabels: Record<WorkspaceCollectionName, string> = {
  projects: 'Projects',
  tasks: 'Tasks',
  literature: 'Literature',
  fieldSites: 'Field sites',
  interviews: 'Interviews',
  fieldVisits: 'Field visits',
  datasets: 'Datasets',
  analysisRuns: 'Analysis runs',
  evidence: 'Evidence',
  researchLogs: 'Research logs',
  manuscripts: 'Manuscripts',
  submissions: 'Submissions',
  reviewerComments: 'Reviewer comments',
}

const collectionNames = Object.keys(collectionLabels) as WorkspaceCollectionName[]

const matchingIdCounts = (current: WorkspaceData, incoming: WorkspaceData) =>
  collectionNames.map((collection) => {
    const existingIds = new Set(current[collection].map((record) => record.id))
    return [collection, incoming[collection].filter((record) => existingIds.has(record.id)).length] as const
  })

const formatMergeResult = (result: MergeWorkspaceResult) => {
  const added = collectionNames.filter((name) => result.added[name] > 0)
  const skipped = collectionNames.filter((name) => result.skipped[name] > 0)
  const addedTotal = added.reduce((total, name) => total + result.added[name], 0)
  const skippedTotal = skipped.reduce((total, name) => total + result.skipped[name], 0)
  const addedDetail = added.map((name) => `${collectionLabels[name]} ${result.added[name]}`).join(', ')
  const skippedDetail = skipped.map((name) => `${collectionLabels[name]} ${result.skipped[name]}`).join(', ')
  return `Merge complete: ${addedTotal} added${addedDetail ? ` (${addedDetail})` : ''}; ${skippedTotal} skipped${skippedDetail ? ` (${skippedDetail})` : ''}. Existing local records were preserved.`
}

export function WorkspaceTools({ compact = false }: { compact?: boolean }) {
  const { data, mergeWith, replaceWith, resetDemo, saving } = useWorkspace()
  const [open, setOpen] = useState(false)
  const [pendingImport, setPendingImport] = useState<WorkspaceData | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [message, setMessage] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const collisions = data && pendingImport ? matchingIdCounts(data, pendingImport) : []
  const collisionTotal = collisions.reduce((total, [, count]) => total + count, 0)

  const exportWorkspace = () => {
    if (!data) return
    try {
      const filename = `sociology-phd-desk-${todayIso()}.json`
      downloadTextFile(exportWorkspaceJson(data), filename)
      setMessage(`Exported ${filename}`)
    } catch (exportError) {
      setMessage(exportError instanceof Error ? exportError.message : 'The workspace could not be exported.')
    }
  }

  const readImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const imported = importWorkspaceJson(await file.text())
      setPendingImport(imported)
      setMessage(null)
    } catch (importError) {
      setPendingImport(null)
      setMessage(importError instanceof Error ? importError.message : 'This file is not a valid workspace export.')
    }
  }

  const completeAction = async () => {
    try {
      if (pendingAction === 'reset') {
        await resetDemo()
        setMessage('Demo workspace restored.')
      } else if (pendingAction === 'merge' && pendingImport) {
        const result = await mergeWith(pendingImport)
        setMessage(formatMergeResult(result))
        setPendingImport(null)
      } else if (pendingAction === 'replace' && pendingImport) {
        await replaceWith(pendingImport)
        setMessage('Local workspace replaced with the imported snapshot.')
        setPendingImport(null)
      }
    } catch (actionError) {
      setMessage(actionError instanceof Error ? actionError.message : 'The workspace action could not be completed.')
    } finally {
      setPendingAction(null)
    }
  }

  return (
    <>
      <Button
        variant={compact ? 'ghost' : 'secondary'}
        size="sm"
        icon={<FileJson size={15} />}
        onClick={() => setOpen(true)}
      >
        Workspace
      </Button>
      <Modal
        open={open}
        title="Workspace data"
        description="Back up, import, or restore the private research workspace in this browser."
        onClose={() => setOpen(false)}
        size="lg"
      >
        <div className="workspace-tools">
          <LocalDataNotice />
          <section className="workspace-tools__section">
            <div>
              <h3>Portable backup</h3>
              <p>Export a complete JSON snapshot. Keep exported files in a protected location.</p>
            </div>
            <div className="button-row">
              <Button icon={<Download size={15} />} onClick={exportWorkspace} disabled={!data}>
                Export JSON
              </Button>
              <Button icon={<Upload size={15} />} onClick={() => fileRef.current?.click()}>
                Choose import
              </Button>
              <input
                ref={fileRef}
                className="sr-only"
                type="file"
                accept="application/json,.json"
                onChange={(event) => void readImport(event)}
              />
            </div>
          </section>

          {pendingImport && (
            <section className="import-preview">
              <div className="import-preview__heading">
                <div>
                  <p className="eyebrow">Validated import</p>
                  <h3>{pendingImport.workspace.name}</h3>
                </div>
                <Badge tone="success">Ready</Badge>
              </div>
              <div className="import-preview__counts">
                {collectionCounts(pendingImport).map(([label, value]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
              <p className="import-preview__warning">
                Import never runs automatically. {collisionTotal > 0
                  ? `${collisionTotal} matching IDs will be skipped during merge; new records that reference those IDs will link to the existing local records.`
                  : 'No matching record IDs were found in the current workspace.'}
              </p>
              <div className="button-row">
                <Button variant="primary" onClick={() => setPendingAction('merge')} disabled={saving}>
                  Review merge
                </Button>
                <Button variant="danger" onClick={() => setPendingAction('replace')} disabled={saving}>
                  Review replacement
                </Button>
              </div>
            </section>
          )}

          <section className="workspace-tools__section workspace-tools__section--danger">
            <div>
              <h3>Restore demonstration workspace</h3>
              <p>This replaces all current local records. Export a backup first if you may need them later.</p>
            </div>
            <Button variant="danger" icon={<RotateCcw size={15} />} onClick={() => setPendingAction('reset')}>
              Reset demo
            </Button>
          </section>
          {message && <p className="workspace-tools__message" role="status">{message}</p>}
        </div>
      </Modal>

      <ConfirmDialog
        open={pendingAction === 'merge'}
        title="Merge imported records?"
        description="Only records with new IDs will be added. Matching IDs are skipped, existing local records remain unchanged, and new records that reference a matching ID will link to that existing local record. Merge only workspaces from the same trusted research lineage."
        confirmLabel="Confirm merge"
        tone="primary"
        onCancel={() => setPendingAction(null)}
        onConfirm={completeAction}
      />
      <ConfirmDialog
        open={pendingAction === 'replace'}
        title="Replace the entire workspace?"
        description="Every current project and linked record in this browser will be removed before the imported snapshot is written. This cannot be undone without a backup."
        confirmLabel="Replace workspace"
        onCancel={() => setPendingAction(null)}
        onConfirm={completeAction}
      />
      <ConfirmDialog
        open={pendingAction === 'reset'}
        title="Restore demo data?"
        description="Every current local record will be replaced by the bundled demonstration workspace. Export first if this is not disposable data."
        confirmLabel="Restore demo data"
        onCancel={() => setPendingAction(null)}
        onConfirm={completeAction}
      />
    </>
  )
}
