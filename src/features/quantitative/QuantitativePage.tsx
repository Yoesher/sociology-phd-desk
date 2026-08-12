import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { BarChart3, Code2, Database, FolderLock } from 'lucide-react'
import {
  ANALYSIS_RUN_STATUSES,
  ANALYSIS_SOFTWARE,
  type AnalysisRun,
  type Dataset,
} from '../../models/domain'
import { useWorkspace } from '../../hooks/useWorkspace'
import { entityMeta, todayIso, truncate } from '../../app/format'
import { QUICK_ADD_EVENT, type QuickAddEvent } from '../../app/navigationEvents'
import { useI18n } from '../../i18n'
import { ProjectSelect } from '../../components/ProjectSelect'
import {
  AddButton,
  Badge,
  Button,
  EmptyState,
  Field,
  Modal,
  PageHeader,
  SearchField,
  StatCard,
} from '../../components/ui'

type RegistryTab = 'datasets' | 'runs'

const QUANTITATIVE_VIEWS = ['overview', 'datasets', 'planned', 'running', 'completed', 'failed', 'superseded'] as const
type QuantitativeView = (typeof QUANTITATIVE_VIEWS)[number]

function readQuantitativeView(): QuantitativeView {
  const requested = new URLSearchParams(window.location.hash.split('?')[1] || '').get('view')
  return QUANTITATIVE_VIEWS.includes(requested as QuantitativeView) ? requested as QuantitativeView : 'overview'
}

const datasetDraft = () => ({ name: '', wave: '', source: '', localPath: '', projectId: '', notes: '' })
const runDraft = () => ({
  projectId: '',
  date: todayIso(),
  software: 'Stata' as AnalysisRun['software'],
  scriptPath: '',
  datasetId: '',
  sample: '',
  model: '',
  outcome: '',
  keyPredictor: '',
  status: 'Planned' as AnalysisRun['status'],
  resultSummary: '',
  outputPath: '',
})

export function QuantitativePage() {
  const { data, updateData } = useWorkspace()
  const { t, formatDate, formatNumber, labelEnum } = useI18n()
  const [tab, setTab] = useState<RegistryTab>('datasets')
  const [search, setSearch] = useState('')
  const [projectFilter, setProjectFilter] = useState('')
  const [datasetOpen, setDatasetOpen] = useState(false)
  const [runOpen, setRunOpen] = useState(false)
  const [dataset, setDataset] = useState(datasetDraft)
  const [run, setRun] = useState(runDraft)
  const [view, setView] = useState<QuantitativeView>(readQuantitativeView)

  useEffect(() => {
    const syncView = () => setView(readQuantitativeView())
    window.addEventListener('hashchange', syncView)
    window.addEventListener('popstate', syncView)
    return () => {
      window.removeEventListener('hashchange', syncView)
      window.removeEventListener('popstate', syncView)
    }
  }, [])
  const effectiveTab: RegistryTab = view === 'datasets' || view === 'overview' && tab === 'datasets' ? 'datasets' : 'runs'

  const recordCount = (count: number) => t(
    count === 1 ? 'quantitative.count.recordsOne' : 'quantitative.count.recordsOther',
    { count: formatNumber(count) },
  )
  const totalSpecifications = (count: number) => t(
    count === 1
      ? 'quantitative.stats.completed.detailOne'
      : 'quantitative.stats.completed.detailOther',
    { count: formatNumber(count) },
  )
  const registeredRuns = (count: number) => t(
    count === 1
      ? 'quantitative.stats.software.detailOne'
      : 'quantitative.stats.software.detailOther',
    { count: formatNumber(count) },
  )
  const localizedProjectLabel = (projectId?: string) => {
    const project = data?.projects.find((item) => item.id === projectId)
    return project?.shortTitle || project?.title || t('common.unassigned')
  }

  const query = search.trim().toLowerCase()
  const filteredDatasets = useMemo(
    () =>
      data?.datasets.filter(
        (item) =>
          (!projectFilter || item.projectId === projectFilter) &&
          (!query || `${item.name} ${item.wave} ${item.source} ${item.notes}`.toLowerCase().includes(query)),
      ) ?? [],
    [data?.datasets, projectFilter, query],
  )
  const filteredRuns = useMemo(
    () =>
      data?.analysisRuns.filter(
        (item) =>
          (view === 'overview' || view === 'datasets' || item.status.toLowerCase() === view) &&
          (!projectFilter || item.projectId === projectFilter) &&
          (!query || `${item.model} ${item.outcome} ${item.keyPredictor} ${item.sample} ${item.resultSummary}`.toLowerCase().includes(query)),
      ) ?? [],
    [data?.analysisRuns, projectFilter, query, view],
  )

  useEffect(() => {
    const handleQuickAdd = (event: Event) => {
      const detail = (event as QuickAddEvent).detail
      if (detail?.module !== 'quantitative' || detail.action !== 'analysis-run') return
      const projectId = data?.workspace.activeProjectId || data?.projects[0]?.id || ''
      setRun({
        ...runDraft(),
        projectId,
        datasetId: data?.datasets.find((item) => item.projectId === projectId)?.id || '',
      })
      setRunOpen(true)
    }
    window.addEventListener(QUICK_ADD_EVENT, handleQuickAdd)
    return () => window.removeEventListener(QUICK_ADD_EVENT, handleQuickAdd)
  }, [data?.datasets, data?.projects, data?.workspace.activeProjectId])

  if (!data) return null

  const activeProject = data.workspace.activeProjectId || data.projects[0]?.id || ''

  const openDataset = () => {
    setDataset({ ...datasetDraft(), projectId: activeProject })
    setDatasetOpen(true)
  }

  const openRun = () => {
    const projectId = activeProject
    setRun({ ...runDraft(), projectId, datasetId: data.datasets.find((item) => item.projectId === projectId)?.id || '' })
    setRunOpen(true)
  }

  const saveDataset = async (event: FormEvent) => {
    event.preventDefault()
    const record: Dataset = {
      ...entityMeta('dataset'),
      ...dataset,
      localPath: dataset.localPath.trim() || undefined,
    }
    await updateData((current) => ({ ...current, datasets: [record, ...current.datasets] }))
    setDatasetOpen(false)
  }

  const saveRun = async (event: FormEvent) => {
    event.preventDefault()
    const record: AnalysisRun = {
      ...entityMeta('run'),
      ...run,
      scriptPath: run.scriptPath.trim() || undefined,
      outputPath: run.outputPath.trim() || undefined,
    }
    await updateData((current) => ({ ...current, analysisRuns: [record, ...current.analysisRuns] }))
    setRunOpen(false)
  }

  const updateRunStatus = async (id: string, status: AnalysisRun['status']) => {
    await updateData((current) => ({
      ...current,
      analysisRuns: current.analysisRuns.map((item) =>
        item.id === id ? { ...item, status, updatedAt: new Date().toISOString() } : item,
      ),
    }))
  }

  const completed = data.analysisRuns.filter((item) => item.status === 'Completed').length
  const failed = data.analysisRuns.filter((item) => item.status === 'Failed').length
  const software = ANALYSIS_SOFTWARE.map((name) => ({ name, count: data.analysisRuns.filter((item) => item.software === name).length })).sort((a, b) => b.count - a.count)[0]

  return (
    <div className="page">
      <PageHeader
        index="06"
        eyebrow={t('quantitative.header.eyebrow')}
        title={t('quantitative.header.title')}
        description={t('quantitative.header.description')}
        actions={
          <AddButton onClick={effectiveTab === 'datasets' ? openDataset : openRun}>
            {t(effectiveTab === 'datasets' ? 'quantitative.action.addDataset' : 'quantitative.action.addAnalysisRun')}
          </AddButton>
        }
      />

      <section className="boundary-note boundary-note--blue">
        <FolderLock size={18} />
        <div><strong>{t('quantitative.boundary.title')}</strong><p>{t('quantitative.boundary.body')}</p></div>
      </section>

      <div className="stats-grid stats-grid--four">
        <StatCard label={t('quantitative.stats.datasets.label')} value={formatNumber(data.datasets.length)} detail={t('quantitative.stats.datasets.detail')} tone="blue" />
        <StatCard label={t('quantitative.stats.completed.label')} value={formatNumber(completed)} detail={totalSpecifications(data.analysisRuns.length)} tone="success" />
        <StatCard label={t('quantitative.stats.failed.label')} value={formatNumber(failed)} detail={t('quantitative.stats.failed.detail')} tone={failed ? 'danger' : 'neutral'} />
        <StatCard label={t('quantitative.stats.software.label')} value={software ? labelEnum(software.name) : '—'} detail={software ? registeredRuns(software.count) : t('quantitative.stats.software.none')} tone="violet" />
      </div>

      <section className="panel">
        <div className="segmented-tabs" role="tablist" aria-label={t('quantitative.tabs.label')}>
          <button type="button" role="tab" aria-selected={effectiveTab === 'datasets'} className={effectiveTab === 'datasets' ? 'active' : ''} onClick={() => setTab('datasets')}><Database size={15} /> {t('quantitative.tabs.datasets')} <span>{formatNumber(data.datasets.length)}</span></button>
          <button type="button" role="tab" aria-selected={effectiveTab === 'runs'} className={effectiveTab === 'runs' ? 'active' : ''} onClick={() => setTab('runs')}><BarChart3 size={15} /> {t('quantitative.tabs.analysisRuns')} <span>{formatNumber(data.analysisRuns.length)}</span></button>
        </div>
        <div className="toolbar toolbar--under-tabs">
          <SearchField value={search} onChange={setSearch} placeholder={t(effectiveTab === 'datasets' ? 'quantitative.search.datasets' : 'quantitative.search.runs')} />
          <ProjectSelect projects={data.projects} value={projectFilter} onChange={setProjectFilter} includeAll />
          <span className="toolbar__count">{recordCount(effectiveTab === 'datasets' ? filteredDatasets.length : filteredRuns.length)}</span>
        </div>

        {effectiveTab === 'datasets' && (filteredDatasets.length ? (
          <div className="dataset-grid">
            {filteredDatasets.map((item) => (
              <article className="dataset-card" key={item.id}>
                <header><span className="object-mark"><Database size={17} /></span><Badge>{item.wave || t('quantitative.dataset.noWave')}</Badge></header>
                <h3>{item.name}</h3>
                <p>{truncate(item.source || t('quantitative.dataset.noSource'), 130)}</p>
                <dl>
                  <div><dt>{t('quantitative.dataset.project')}</dt><dd>{localizedProjectLabel(item.projectId)}</dd></div>
                  <div><dt>{t('quantitative.dataset.localPath')}</dt><dd className="path-value">{item.localPath || t('quantitative.dataset.notConfigured')}</dd></div>
                </dl>
              </article>
            ))}
          </div>
        ) : <EmptyState title={t('quantitative.empty.datasets.title')} description={t('quantitative.empty.datasets.description')} action={<AddButton onClick={openDataset}>{t('quantitative.action.addDataset')}</AddButton>} />)}

        {effectiveTab === 'runs' && (filteredRuns.length ? (
          <div className="data-table-wrap">
            <table className="data-table analysis-table">
              <thead><tr><th>{t('quantitative.table.specification')}</th><th>{t('quantitative.table.software')}</th><th>{t('quantitative.table.datasetSample')}</th><th>{t('quantitative.table.date')}</th><th>{t('quantitative.table.status')}</th></tr></thead>
              <tbody>
                {filteredRuns.map((item) => {
                  const source = data.datasets.find((datasetItem) => datasetItem.id === item.datasetId)
                  return (
                    <tr key={item.id}>
                      <td data-label={t('quantitative.table.specification')}><span className="record-title"><strong>{item.model || t('quantitative.run.unnamedModel')}</strong><span>{item.outcome} ← {item.keyPredictor}</span></span></td>
                      <td data-label={t('quantitative.table.software')}><Badge tone="violet"><Code2 size={12} /> {labelEnum(item.software)}</Badge></td>
                      <td data-label={t('quantitative.table.datasetSample')}><span className="date-cell">{source?.name || t('quantitative.run.unknownDataset')}<small>{truncate(item.sample, 64)}</small></span></td>
                      <td data-label={t('quantitative.table.date')}>{formatDate(item.date)}</td>
                      <td data-label={t('quantitative.table.status')}><select aria-label={t('quantitative.run.updateStatusAria', { name: item.model || t('quantitative.run.unnamedModel') })} className={`status-select status-select--${item.status.toLowerCase()}`} value={item.status} onChange={(event) => void updateRunStatus(item.id, event.target.value as AnalysisRun['status'])}>{ANALYSIS_RUN_STATUSES.map((status) => <option key={status} value={status}>{labelEnum(status)}</option>)}</select></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title={t('quantitative.empty.runs.title')} description={t(data.datasets.length ? 'quantitative.empty.runs.withDatasets' : 'quantitative.empty.runs.withoutDatasets')} action={<AddButton onClick={data.datasets.length ? openRun : openDataset}>{t(data.datasets.length ? 'quantitative.action.addAnalysisRun' : 'quantitative.action.addDatasetFirst')}</AddButton>} />)}
      </section>

      <Modal
        open={datasetOpen}
        title={t('quantitative.datasetDialog.title')}
        description={t('quantitative.datasetDialog.description')}
        onClose={() => setDatasetOpen(false)}
        footer={<><Button onClick={() => setDatasetOpen(false)}>{t('common.cancel')}</Button><Button type="submit" form="dataset-form" variant="primary">{t('quantitative.action.addDataset')}</Button></>}
      >
        <form id="dataset-form" className="form-grid" onSubmit={(event) => void saveDataset(event)}>
          <Field label={t('quantitative.datasetForm.name')} required className="form-span-2"><input autoFocus required value={dataset.name} onChange={(event) => setDataset({ ...dataset, name: event.target.value })} /></Field>
          <Field label={t('quantitative.datasetForm.wave')}><input value={dataset.wave} onChange={(event) => setDataset({ ...dataset, wave: event.target.value })} placeholder={t('quantitative.datasetForm.wavePlaceholder')} /></Field>
          <Field label={t('quantitative.datasetForm.project')} required><ProjectSelect required projects={data.projects} value={dataset.projectId} onChange={(projectId) => setDataset({ ...dataset, projectId })} /></Field>
          <Field label={t('quantitative.datasetForm.source')} required className="form-span-2"><textarea required rows={3} value={dataset.source} onChange={(event) => setDataset({ ...dataset, source: event.target.value })} placeholder={t('quantitative.datasetForm.sourcePlaceholder')} /></Field>
          <Field label={t('quantitative.datasetForm.localPath')} className="form-span-2" hint={t('quantitative.datasetForm.localPathHint')}><input value={dataset.localPath} onChange={(event) => setDataset({ ...dataset, localPath: event.target.value })} placeholder={t('quantitative.datasetForm.localPathPlaceholder')} /></Field>
          <Field label={t('quantitative.datasetForm.notes')} className="form-span-2"><textarea rows={4} value={dataset.notes} onChange={(event) => setDataset({ ...dataset, notes: event.target.value })} placeholder={t('quantitative.datasetForm.notesPlaceholder')} /></Field>
        </form>
      </Modal>

      <Modal
        open={runOpen}
        title={t('quantitative.runDialog.title')}
        description={t('quantitative.runDialog.description')}
        onClose={() => setRunOpen(false)}
        size="lg"
        footer={<><Button onClick={() => setRunOpen(false)}>{t('common.cancel')}</Button><Button type="submit" form="run-form" variant="primary">{t('quantitative.action.addAnalysisRun')}</Button></>}
      >
        <form id="run-form" className="form-grid" onSubmit={(event) => void saveRun(event)}>
          <Field label={t('quantitative.runForm.project')} required><ProjectSelect required projects={data.projects} value={run.projectId} onChange={(projectId) => setRun({ ...run, projectId, datasetId: data.datasets.find((item) => item.projectId === projectId)?.id || '' })} /></Field>
          <Field label={t('quantitative.runForm.dataset')} required><select required value={run.datasetId} onChange={(event) => setRun({ ...run, datasetId: event.target.value })}><option value="">{t('quantitative.runForm.selectDataset')}</option>{data.datasets.filter((item) => item.projectId === run.projectId).map((item) => <option key={item.id} value={item.id}>{item.name} {item.wave && `— ${item.wave}`}</option>)}</select></Field>
          <Field label={t('quantitative.runForm.date')} required><input required type="date" value={run.date} onChange={(event) => setRun({ ...run, date: event.target.value })} /></Field>
          <Field label={t('quantitative.runForm.software')} required><select value={run.software} onChange={(event) => setRun({ ...run, software: event.target.value as AnalysisRun['software'] })}>{ANALYSIS_SOFTWARE.map((item) => <option key={item} value={item}>{labelEnum(item)}</option>)}</select></Field>
          <Field label={t('quantitative.runForm.model')} required className="form-span-2"><textarea required rows={3} value={run.model} onChange={(event) => setRun({ ...run, model: event.target.value })} placeholder={t('quantitative.runForm.modelPlaceholder')} /></Field>
          <Field label={t('quantitative.runForm.sample')} required className="form-span-2"><textarea required rows={2} value={run.sample} onChange={(event) => setRun({ ...run, sample: event.target.value })} placeholder={t('quantitative.runForm.samplePlaceholder')} /></Field>
          <Field label={t('quantitative.runForm.outcome')} required><input required value={run.outcome} onChange={(event) => setRun({ ...run, outcome: event.target.value })} /></Field>
          <Field label={t('quantitative.runForm.predictor')} required><input required value={run.keyPredictor} onChange={(event) => setRun({ ...run, keyPredictor: event.target.value })} /></Field>
          <Field label={t('quantitative.runForm.status')}><select value={run.status} onChange={(event) => setRun({ ...run, status: event.target.value as AnalysisRun['status'] })}>{ANALYSIS_RUN_STATUSES.map((status) => <option key={status} value={status}>{labelEnum(status)}</option>)}</select></Field>
          <Field label={t('quantitative.runForm.scriptPath')}><input value={run.scriptPath} onChange={(event) => setRun({ ...run, scriptPath: event.target.value })} /></Field>
          <Field label={t('quantitative.runForm.resultSummary')} className="form-span-2"><textarea rows={4} value={run.resultSummary} onChange={(event) => setRun({ ...run, resultSummary: event.target.value })} placeholder={t('quantitative.runForm.resultSummaryPlaceholder')} /></Field>
          <Field label={t('quantitative.runForm.outputPath')} className="form-span-2"><input value={run.outputPath} onChange={(event) => setRun({ ...run, outputPath: event.target.value })} /></Field>
        </form>
      </Modal>
    </div>
  )
}
