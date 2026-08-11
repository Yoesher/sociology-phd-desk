import { useMemo, useState, type FormEvent } from 'react'
import { BarChart3, Code2, Database, FolderLock } from 'lucide-react'
import {
  ANALYSIS_RUN_STATUSES,
  ANALYSIS_SOFTWARE,
  type AnalysisRun,
  type Dataset,
} from '../../models/domain'
import { useWorkspace } from '../../hooks/useWorkspace'
import { entityMeta, formatDate, projectLabel, todayIso, truncate } from '../../app/format'
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
  const [tab, setTab] = useState<RegistryTab>('datasets')
  const [search, setSearch] = useState('')
  const [projectFilter, setProjectFilter] = useState('')
  const [datasetOpen, setDatasetOpen] = useState(false)
  const [runOpen, setRunOpen] = useState(false)
  const [dataset, setDataset] = useState(datasetDraft)
  const [run, setRun] = useState(runDraft)

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
          (!projectFilter || item.projectId === projectFilter) &&
          (!query || `${item.model} ${item.outcome} ${item.keyPredictor} ${item.sample} ${item.resultSummary}`.toLowerCase().includes(query)),
      ) ?? [],
    [data?.analysisRuns, projectFilter, query],
  )

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
        index="05"
        eyebrow="Reproducibility registry"
        title="Quantitative analysis"
        description="Register datasets, specifications, scripts, samples, and outputs without trying to replace Stata, R, or Python."
        actions={<AddButton onClick={tab === 'datasets' ? openDataset : openRun}>Add {tab === 'datasets' ? 'dataset' : 'analysis run'}</AddButton>}
      />

      <section className="boundary-note boundary-note--blue">
        <FolderLock size={18} />
        <div><strong>Files stay where you keep them</strong><p>Paths are local pointers only. Sociology PhD Desk does not upload datasets or embed source files in JSON exports.</p></div>
      </section>

      <div className="stats-grid stats-grid--four">
        <StatCard label="Datasets" value={data.datasets.length} detail="registered local sources" tone="blue" />
        <StatCard label="Completed runs" value={completed} detail={`${data.analysisRuns.length} total specifications`} tone="success" />
        <StatCard label="Failed runs" value={failed} detail="retained for auditability" tone={failed ? 'danger' : 'neutral'} />
        <StatCard label="Primary software" value={software?.name || '—'} detail={software ? `${software.count} registered runs` : 'no runs yet'} tone="violet" />
      </div>

      <section className="panel">
        <div className="segmented-tabs" role="tablist" aria-label="Quantitative registry">
          <button type="button" className={tab === 'datasets' ? 'active' : ''} onClick={() => setTab('datasets')}><Database size={15} /> Datasets <span>{data.datasets.length}</span></button>
          <button type="button" className={tab === 'runs' ? 'active' : ''} onClick={() => setTab('runs')}><BarChart3 size={15} /> Analysis runs <span>{data.analysisRuns.length}</span></button>
        </div>
        <div className="toolbar toolbar--under-tabs">
          <SearchField value={search} onChange={setSearch} placeholder={tab === 'datasets' ? 'Search datasets' : 'Search models, samples, or outcomes'} />
          <ProjectSelect projects={data.projects} value={projectFilter} onChange={setProjectFilter} includeAll />
          <span className="toolbar__count">{tab === 'datasets' ? filteredDatasets.length : filteredRuns.length} records</span>
        </div>

        {tab === 'datasets' && (filteredDatasets.length ? (
          <div className="dataset-grid">
            {filteredDatasets.map((item) => (
              <article className="dataset-card" key={item.id}>
                <header><span className="object-mark"><Database size={17} /></span><Badge>{item.wave || 'No wave'}</Badge></header>
                <h3>{item.name}</h3>
                <p>{truncate(item.source || 'No source description', 130)}</p>
                <dl>
                  <div><dt>Project</dt><dd>{projectLabel(data.projects, item.projectId)}</dd></div>
                  <div><dt>Local path</dt><dd className="path-value">{item.localPath || 'Not configured'}</dd></div>
                </dl>
              </article>
            ))}
          </div>
        ) : <EmptyState title="No datasets found" description="Register a dataset source, wave, local pointer, and project relationship." action={<AddButton onClick={openDataset}>Add dataset</AddButton>} />)}

        {tab === 'runs' && (filteredRuns.length ? (
          <div className="data-table-wrap">
            <table className="data-table analysis-table">
              <thead><tr><th>Specification</th><th>Software</th><th>Dataset / sample</th><th>Date</th><th>Status</th></tr></thead>
              <tbody>
                {filteredRuns.map((item) => {
                  const source = data.datasets.find((datasetItem) => datasetItem.id === item.datasetId)
                  return (
                    <tr key={item.id}>
                      <td data-label="Specification"><span className="record-title"><strong>{item.model || 'Unnamed model'}</strong><span>{item.outcome} ← {item.keyPredictor}</span></span></td>
                      <td data-label="Software"><Badge tone="violet"><Code2 size={12} /> {item.software}</Badge></td>
                      <td data-label="Dataset / sample"><span className="date-cell">{source?.name || 'Unknown dataset'}<small>{truncate(item.sample, 64)}</small></span></td>
                      <td data-label="Date">{formatDate(item.date)}</td>
                      <td data-label="Status"><select className={`status-select status-select--${item.status.toLowerCase()}`} value={item.status} onChange={(event) => void updateRunStatus(item.id, event.target.value as AnalysisRun['status'])}>{ANALYSIS_RUN_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title="No analysis runs found" description={data.datasets.length ? 'Register a specification and the exact dataset, sample, script, and output.' : 'Add a dataset before registering an analysis run.'} action={<AddButton onClick={data.datasets.length ? openRun : openDataset}>{data.datasets.length ? 'Add analysis run' : 'Add dataset first'}</AddButton>} />)}
      </section>

      <Modal
        open={datasetOpen}
        title="Register a dataset"
        description="Record provenance and a local pointer; the dataset itself remains outside the browser database."
        onClose={() => setDatasetOpen(false)}
        footer={<><Button onClick={() => setDatasetOpen(false)}>Cancel</Button><Button type="submit" form="dataset-form" variant="primary">Add dataset</Button></>}
      >
        <form id="dataset-form" className="form-grid" onSubmit={(event) => void saveDataset(event)}>
          <Field label="Dataset name" required className="form-span-2"><input autoFocus required value={dataset.name} onChange={(event) => setDataset({ ...dataset, name: event.target.value })} /></Field>
          <Field label="Wave / version"><input value={dataset.wave} onChange={(event) => setDataset({ ...dataset, wave: event.target.value })} placeholder="e.g. Wave 5 or 2024 extract" /></Field>
          <Field label="Project" required><ProjectSelect required projects={data.projects} value={dataset.projectId} onChange={(projectId) => setDataset({ ...dataset, projectId })} /></Field>
          <Field label="Source" required className="form-span-2"><textarea required rows={3} value={dataset.source} onChange={(event) => setDataset({ ...dataset, source: event.target.value })} placeholder="Provenance, provider, access date, or construction notes" /></Field>
          <Field label="Local path" className="form-span-2" hint="Never hard-code a personal path into public source code."><input value={dataset.localPath} onChange={(event) => setDataset({ ...dataset, localPath: event.target.value })} placeholder="Your private local path or mounted location" /></Field>
          <Field label="Notes" className="form-span-2"><textarea rows={4} value={dataset.notes} onChange={(event) => setDataset({ ...dataset, notes: event.target.value })} placeholder="Restrictions, weights, identifiers, cleaning state, or version cautions" /></Field>
        </form>
      </Modal>

      <Modal
        open={runOpen}
        title="Register an analysis run"
        description="A run is an auditable specification, not only a successful result."
        onClose={() => setRunOpen(false)}
        size="lg"
        footer={<><Button onClick={() => setRunOpen(false)}>Cancel</Button><Button type="submit" form="run-form" variant="primary">Add analysis run</Button></>}
      >
        <form id="run-form" className="form-grid" onSubmit={(event) => void saveRun(event)}>
          <Field label="Project" required><ProjectSelect required projects={data.projects} value={run.projectId} onChange={(projectId) => setRun({ ...run, projectId, datasetId: data.datasets.find((item) => item.projectId === projectId)?.id || '' })} /></Field>
          <Field label="Dataset" required><select required value={run.datasetId} onChange={(event) => setRun({ ...run, datasetId: event.target.value })}><option value="">Select a dataset</option>{data.datasets.filter((item) => item.projectId === run.projectId).map((item) => <option key={item.id} value={item.id}>{item.name} {item.wave && `— ${item.wave}`}</option>)}</select></Field>
          <Field label="Run date" required><input required type="date" value={run.date} onChange={(event) => setRun({ ...run, date: event.target.value })} /></Field>
          <Field label="Software" required><select value={run.software} onChange={(event) => setRun({ ...run, software: event.target.value as AnalysisRun['software'] })}>{ANALYSIS_SOFTWARE.map((item) => <option key={item}>{item}</option>)}</select></Field>
          <Field label="Model specification" required className="form-span-2"><textarea required rows={3} value={run.model} onChange={(event) => setRun({ ...run, model: event.target.value })} placeholder="Estimator, controls, fixed effects, interactions, standard errors" /></Field>
          <Field label="Sample" required className="form-span-2"><textarea required rows={2} value={run.sample} onChange={(event) => setRun({ ...run, sample: event.target.value })} placeholder="Restrictions, exclusions, unit of analysis, N" /></Field>
          <Field label="Outcome" required><input required value={run.outcome} onChange={(event) => setRun({ ...run, outcome: event.target.value })} /></Field>
          <Field label="Key predictor" required><input required value={run.keyPredictor} onChange={(event) => setRun({ ...run, keyPredictor: event.target.value })} /></Field>
          <Field label="Status"><select value={run.status} onChange={(event) => setRun({ ...run, status: event.target.value as AnalysisRun['status'] })}>{ANALYSIS_RUN_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></Field>
          <Field label="Script path"><input value={run.scriptPath} onChange={(event) => setRun({ ...run, scriptPath: event.target.value })} /></Field>
          <Field label="Result summary" className="form-span-2"><textarea rows={4} value={run.resultSummary} onChange={(event) => setRun({ ...run, resultSummary: event.target.value })} placeholder="Direction, magnitude, uncertainty, robustness, and interpretation" /></Field>
          <Field label="Output path" className="form-span-2"><input value={run.outputPath} onChange={(event) => setRun({ ...run, outputPath: event.target.value })} /></Field>
        </form>
      </Modal>
    </div>
  )
}
