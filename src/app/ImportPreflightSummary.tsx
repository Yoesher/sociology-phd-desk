import type { WorkspaceImportPreflight } from '../utils/import-preflight'
import { useI18n, type MessageKey } from '../i18n'
import { Badge } from '../components/ui'

const collectionLabels: Record<string, MessageKey> = {
  projects: 'workspace.collection.projects',
  researchQuestions: 'workspace.collection.researchQuestions',
  claims: 'workspace.collection.claims',
  claimQuestionLinks: 'workspace.collection.claimQuestionLinks',
  theoryMemos: 'workspace.collection.theoryMemos',
  tasks: 'workspace.collection.tasks',
  literature: 'workspace.collection.literature',
  literatureExternalReferences: 'workspace.collection.literatureExternalReferences',
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

export function ImportPreflightSummary({ preflight }: { preflight: WorkspaceImportPreflight }) {
  const { t, formatNumber } = useI18n()
  const migration = preflight.migrationSteps.length > 0
    ? preflight.migrationSteps.join(', ')
    : t('workspace.preflight.noMigration')
  return (
    <section className="import-preflight" aria-labelledby="import-preflight-title">
      <div className="import-preflight__heading">
        <div>
          <p className="eyebrow">{t('workspace.preflight.eyebrow')}</p>
          <h3 id="import-preflight-title">{t('workspace.preflight.title')}</h3>
        </div>
        <Badge tone={preflight.conflictCount > 0 ? 'danger' : 'success'}>
          {preflight.conflictCount > 0
            ? t('workspace.preflight.blocked')
            : t('workspace.preflight.writeFree')}
        </Badge>
      </div>
      <dl className="import-preflight__facts">
        <div><dt>{t('workspace.preflight.format')}</dt><dd>{t(`workspace.preflight.format.${preflight.sourceFormat}`)}</dd></div>
        <div><dt>{t('workspace.preflight.version')}</dt><dd>v{formatNumber(preflight.sourceVersion)} → v{formatNumber(preflight.targetVersion)}</dd></div>
        <div><dt>{t('workspace.preflight.records')}</dt><dd>{formatNumber(preflight.totalRecords)}</dd></div>
        <div><dt>{t('workspace.preflight.migrations')}</dt><dd>{migration}</dd></div>
        <div><dt>{t('workspace.preflight.duplicates')}</dt><dd>{formatNumber(preflight.duplicateCount)}</dd></div>
        <div><dt>{t('workspace.preflight.conflicts')}</dt><dd>{formatNumber(preflight.conflictCount)}</dd></div>
      </dl>
      <p className="import-preflight__risk">
        {t(preflight.sourceFormat === 'portable-workspace-json'
          ? 'workspace.preflight.riskPlaintext'
          : 'workspace.preflight.riskEncrypted')}
      </p>
      {preflight.duplicateCount > 0 && (
        <details className="import-preflight__details">
          <summary>{t('workspace.preflight.duplicateDetails')}</summary>
          <ul>
            {Object.entries(preflight.duplicateIds).map(([collection, ids]) => (
              <li key={collection}>
                <strong>{t(collectionLabels[collection] ?? 'workspace.preflight.root')}</strong>
                <code>{ids?.join(', ')}</code>
              </li>
            ))}
          </ul>
        </details>
      )}
      {preflight.conflictIssues.length > 0 && (
        <details className="import-preflight__details" open>
          <summary>{t('workspace.preflight.conflictDetails')}</summary>
          <ul className="import-preflight__issues">
            {preflight.conflictIssues.map((issue, index) => (
              <li key={`${issue.path.join('.')}-${index}`}>
                <code>{issue.path.join('.') || t('workspace.preflight.root')}</code>
                {' · '}{t('workspace.preflight.conflictReason')}
                {issue.message.match(/"([^"]+)"/)?.[1]
                  ? <> {' · '}ID <code>{issue.message.match(/"([^"]+)"/)?.[1]}</code></>
                  : null}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}
