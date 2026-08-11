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
import { useI18n, type MessageKey } from '../i18n'

type PendingAction = 'merge' | 'replace' | 'reset' | null
type WorkspaceStatusMessage =
  | { kind: 'translated'; key: MessageKey; parameters?: Record<string, string | number> }
  | { kind: 'merge'; result: MergeWorkspaceResult }
  | null

const collectionCounts = (workspace: WorkspaceData): Array<[MessageKey, number]> => [
  ['workspace.collection.projects', workspace.projects.length],
  ['workspace.collection.tasks', workspace.tasks.length],
  ['workspace.collection.literature', workspace.literature.length],
  ['workspace.collection.fieldRecords', workspace.fieldSites.length + workspace.interviews.length + workspace.fieldVisits.length],
  ['workspace.collection.analysisRecords', workspace.datasets.length + workspace.analysisRuns.length],
  ['workspace.collection.evidence', workspace.evidence.length],
  ['workspace.collection.researchLogs', workspace.researchLogs.length],
  ['workspace.collection.manuscripts', workspace.manuscripts.length],
  ['workspace.collection.submissionsReviews', workspace.submissions.length + workspace.reviewerComments.length],
] as const

const collectionLabelKeys: Record<WorkspaceCollectionName, MessageKey> = {
  projects: 'workspace.collection.projects',
  tasks: 'workspace.collection.tasks',
  literature: 'workspace.collection.literature',
  fieldSites: 'workspace.collection.fieldSites',
  interviews: 'workspace.collection.interviews',
  fieldVisits: 'workspace.collection.fieldVisits',
  datasets: 'workspace.collection.datasets',
  analysisRuns: 'workspace.collection.analysisRuns',
  evidence: 'workspace.collection.evidence',
  researchLogs: 'workspace.collection.researchLogs',
  manuscripts: 'workspace.collection.manuscripts',
  submissions: 'workspace.collection.submissions',
  reviewerComments: 'workspace.collection.reviewerComments',
}

const collectionNames = Object.keys(collectionLabelKeys) as WorkspaceCollectionName[]

const matchingIdCounts = (current: WorkspaceData, incoming: WorkspaceData) =>
  collectionNames.map((collection) => {
    const existingIds = new Set(current[collection].map((record) => record.id))
    return [collection, incoming[collection].filter((record) => existingIds.has(record.id)).length] as const
  })

export function WorkspaceTools({ compact = false }: { compact?: boolean }) {
  const { data, mergeWith, replaceWith, resetDemo, saving } = useWorkspace()
  const { locale, t, formatNumber } = useI18n()
  const [open, setOpen] = useState(false)
  const [pendingImport, setPendingImport] = useState<WorkspaceData | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [message, setMessage] = useState<WorkspaceStatusMessage>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const collisions = data && pendingImport ? matchingIdCounts(data, pendingImport) : []
  const collisionTotal = collisions.reduce((total, [, count]) => total + count, 0)

  const formatMergeResult = (result: MergeWorkspaceResult) => {
    const added = collectionNames.filter((name) => result.added[name] > 0)
    const skipped = collectionNames.filter((name) => result.skipped[name] > 0)
    const addedTotal = added.reduce((total, name) => total + result.added[name], 0)
    const skippedTotal = skipped.reduce((total, name) => total + result.skipped[name], 0)
    const listFormatter = new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' })
    const addedText = listFormatter.format(
      added.map((name) => `${t(collectionLabelKeys[name])} ${formatNumber(result.added[name])}`),
    )
    const skippedText = listFormatter.format(
      skipped.map((name) => `${t(collectionLabelKeys[name])} ${formatNumber(result.skipped[name])}`),
    )
    return t('workspace.merge.complete', {
      addedTotal: formatNumber(addedTotal),
      skippedTotal: formatNumber(skippedTotal),
      addedDetail: addedText ? ` (${addedText})` : '',
      skippedDetail: skippedText ? ` (${skippedText})` : '',
    })
  }

  const exportWorkspace = () => {
    if (!data) return
    try {
      const filename = `sociology-phd-desk-${todayIso()}.json`
      downloadTextFile(exportWorkspaceJson(data), filename)
      setMessage({ kind: 'translated', key: 'workspace.exported', parameters: { filename } })
    } catch (exportError) {
      void exportError
      setMessage({ kind: 'translated', key: 'workspace.error.export' })
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
      void importError
      setMessage({ kind: 'translated', key: 'workspace.error.import' })
    }
  }

  const completeAction = async () => {
    try {
      if (pendingAction === 'reset') {
        await resetDemo()
        setMessage({ kind: 'translated', key: 'workspace.reset.complete' })
      } else if (pendingAction === 'merge' && pendingImport) {
        const result = await mergeWith(pendingImport)
        setMessage({ kind: 'merge', result })
        setPendingImport(null)
      } else if (pendingAction === 'replace' && pendingImport) {
        await replaceWith(pendingImport)
        setMessage({ kind: 'translated', key: 'workspace.replace.complete' })
        setPendingImport(null)
      }
    } catch (actionError) {
      void actionError
      setMessage({ kind: 'translated', key: 'workspace.error.action' })
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
        {t('workspace.button')}
      </Button>
      <Modal
        open={open}
        title={t('workspace.modal.title')}
        description={t('workspace.modal.description')}
        onClose={() => setOpen(false)}
        size="lg"
      >
        <div className="workspace-tools">
          <LocalDataNotice />
          <section className="workspace-tools__section">
            <div>
              <h3>{t('workspace.portable.title')}</h3>
              <p>{t('workspace.portable.description')}</p>
            </div>
            <div className="button-row">
              <Button icon={<Download size={15} />} onClick={exportWorkspace} disabled={!data}>
                {t('workspace.action.exportJson')}
              </Button>
              <Button icon={<Upload size={15} />} onClick={() => fileRef.current?.click()}>
                {t('workspace.action.chooseImport')}
              </Button>
              <input
                ref={fileRef}
                className="sr-only"
                type="file"
                aria-label={t('workspace.action.chooseImport')}
                accept="application/json,.json"
                onChange={(event) => void readImport(event)}
              />
            </div>
          </section>

          {pendingImport && (
            <section className="import-preview">
              <div className="import-preview__heading">
                <div>
                  <p className="eyebrow">{t('workspace.import.validated')}</p>
                  <h3>{pendingImport.workspace.name}</h3>
                </div>
                <Badge tone="success">{t('workspace.import.ready')}</Badge>
              </div>
              <div className="import-preview__counts">
                {collectionCounts(pendingImport).map(([labelKey, value]) => (
                  <div key={labelKey}>
                    <span>{t(labelKey)}</span>
                    <strong>{formatNumber(value)}</strong>
                  </div>
                ))}
              </div>
              <p className="import-preview__warning">
                {t('workspace.import.neverAutomatic')} {collisionTotal > 0
                  ? t('workspace.import.collision', { count: formatNumber(collisionTotal) })
                  : t('workspace.import.noCollision')}
              </p>
              <div className="button-row">
                <Button variant="primary" onClick={() => setPendingAction('merge')} disabled={saving}>
                  {t('workspace.action.reviewMerge')}
                </Button>
                <Button variant="danger" onClick={() => setPendingAction('replace')} disabled={saving}>
                  {t('workspace.action.reviewReplacement')}
                </Button>
              </div>
            </section>
          )}

          <section className="workspace-tools__section workspace-tools__section--danger">
            <div>
              <h3>{t('workspace.reset.title')}</h3>
              <p>{t('workspace.reset.description')}</p>
            </div>
            <Button variant="danger" icon={<RotateCcw size={15} />} onClick={() => setPendingAction('reset')}>
              {t('workspace.action.resetDemo')}
            </Button>
          </section>
          {message && (
            <p className="workspace-tools__message" role="status">
              {message.kind === 'merge'
                ? formatMergeResult(message.result)
                : t(message.key, message.parameters)}
            </p>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={pendingAction === 'merge'}
        title={t('workspace.confirm.merge.title')}
        description={t('workspace.confirm.merge.description')}
        confirmLabel={t('workspace.confirm.merge.label')}
        tone="primary"
        onCancel={() => setPendingAction(null)}
        onConfirm={completeAction}
      />
      <ConfirmDialog
        open={pendingAction === 'replace'}
        title={t('workspace.confirm.replace.title')}
        description={t('workspace.confirm.replace.description')}
        confirmLabel={t('workspace.confirm.replace.label')}
        onCancel={() => setPendingAction(null)}
        onConfirm={completeAction}
      />
      <ConfirmDialog
        open={pendingAction === 'reset'}
        title={t('workspace.confirm.reset.title')}
        description={t('workspace.confirm.reset.description')}
        confirmLabel={t('workspace.confirm.reset.label')}
        onCancel={() => setPendingAction(null)}
        onConfirm={completeAction}
      />
    </>
  )
}
