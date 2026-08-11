import { useMemo, useState, type FormEvent } from 'react'
import { MapPinned, MessageSquareText, NotebookTabs } from 'lucide-react'
import {
  FIELD_SITE_STATUSES,
  INTERVIEW_STATUSES,
  WORK_PRODUCT_STATUSES,
  type FieldSite,
  type FieldVisit,
  type Interview,
} from '../../models/domain'
import { useWorkspace } from '../../hooks/useWorkspace'
import { entityMeta, formatDate, projectLabel, todayIso, truncate } from '../../app/format'
import { ProjectSelect } from '../../components/ProjectSelect'
import {
  AddButton,
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  Modal,
  PageHeader,
  PrivacyNotice,
  SearchField,
  StatCard,
  TableActions,
} from '../../components/ui'

type RegistryTab = 'sites' | 'interviews' | 'visits'
type RecordKind = 'site' | 'interview' | 'visit'

const siteDraft = () => ({ nameOrAlias: '', projectId: '', status: 'Planned' as FieldSite['status'], notes: '' })
const interviewDraft = () => ({
  participantAlias: '',
  projectId: '',
  fieldSiteId: '',
  interviewDate: '',
  status: 'Planned' as Interview['status'],
  transcriptStatus: 'Not Started' as Interview['transcriptStatus'],
  codingStatus: 'Not Started' as Interview['codingStatus'],
  memoStatus: 'Not Started' as Interview['memoStatus'],
  notes: '',
})
const visitDraft = () => ({
  date: todayIso(),
  projectId: '',
  fieldSiteId: '',
  purpose: '',
  observations: '',
  followUp: '',
  memo: '',
})

const workTone = (status: Interview['transcriptStatus']) => {
  if (status === 'Complete') return 'success' as const
  if (status === 'In Progress') return 'warning' as const
  return 'neutral' as const
}

export function FieldworkPage() {
  const { data, updateData } = useWorkspace()
  const [tab, setTab] = useState<RegistryTab>('sites')
  const [search, setSearch] = useState('')
  const [projectFilter, setProjectFilter] = useState('')
  const [formKind, setFormKind] = useState<RecordKind | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ kind: RecordKind; id: string; label: string } | null>(null)
  const [site, setSite] = useState(siteDraft)
  const [interview, setInterview] = useState(interviewDraft)
  const [visit, setVisit] = useState(visitDraft)

  const query = search.trim().toLowerCase()
  const filteredSites = useMemo(
    () =>
      data?.fieldSites.filter(
        (item) =>
          (!projectFilter || item.projectId === projectFilter) &&
          (!query || `${item.nameOrAlias} ${item.notes}`.toLowerCase().includes(query)),
      ) ?? [],
    [data?.fieldSites, projectFilter, query],
  )
  const filteredInterviews = useMemo(
    () =>
      data?.interviews.filter(
        (item) =>
          (!projectFilter || item.projectId === projectFilter) &&
          (!query || `${item.participantAlias} ${item.notes}`.toLowerCase().includes(query)),
      ) ?? [],
    [data?.interviews, projectFilter, query],
  )
  const filteredVisits = useMemo(
    () =>
      data?.fieldVisits.filter(
        (item) =>
          (!projectFilter || item.projectId === projectFilter) &&
          (!query || `${item.purpose} ${item.observations} ${item.followUp} ${item.memo}`.toLowerCase().includes(query)),
      ) ?? [],
    [data?.fieldVisits, projectFilter, query],
  )

  if (!data) return null

  const openCreate = (kind: RecordKind) => {
    setEditingId(null)
    const activeProjectId = data.workspace.activeProjectId || ''
    if (kind === 'site') setSite({ ...siteDraft(), projectId: activeProjectId })
    if (kind === 'interview') setInterview({ ...interviewDraft(), projectId: activeProjectId })
    if (kind === 'visit') setVisit({ ...visitDraft(), projectId: activeProjectId })
    setFormKind(kind)
  }

  const editSite = (item: FieldSite) => {
    setEditingId(item.id)
    setSite({ nameOrAlias: item.nameOrAlias, projectId: item.projectId, status: item.status, notes: item.notes })
    setFormKind('site')
  }

  const editInterview = (item: Interview) => {
    setEditingId(item.id)
    setInterview({
      participantAlias: item.participantAlias,
      projectId: item.projectId,
      fieldSiteId: item.fieldSiteId || '',
      interviewDate: item.interviewDate || '',
      status: item.status,
      transcriptStatus: item.transcriptStatus,
      codingStatus: item.codingStatus,
      memoStatus: item.memoStatus,
      notes: item.notes,
    })
    setFormKind('interview')
  }

  const editVisit = (item: FieldVisit) => {
    setEditingId(item.id)
    setVisit({
      date: item.date,
      projectId: item.projectId,
      fieldSiteId: item.fieldSiteId,
      purpose: item.purpose,
      observations: item.observations,
      followUp: item.followUp,
      memo: item.memo,
    })
    setFormKind('visit')
  }

  const saveSite = async (event: FormEvent) => {
    event.preventDefault()
    if (editingId) {
      const original = data.fieldSites.find((item) => item.id === editingId)
      const hasLinkedRecords =
        data.interviews.some((item) => item.fieldSiteId === editingId) ||
        data.fieldVisits.some((item) => item.fieldSiteId === editingId)
      if (!original || (hasLinkedRecords && original.projectId !== site.projectId)) return
      await updateData((current) => ({
        ...current,
        fieldSites: current.fieldSites.map((item) =>
          item.id === editingId ? { ...item, ...site, updatedAt: new Date().toISOString() } : item,
        ),
      }))
    } else {
      const record: FieldSite = { ...entityMeta('site'), ...site }
      await updateData((current) => ({ ...current, fieldSites: [record, ...current.fieldSites] }))
    }
    setFormKind(null)
  }

  const saveInterview = async (event: FormEvent) => {
    event.preventDefault()
    const projectExists = data.projects.some((item) => item.id === interview.projectId)
    const selectedSite = interview.fieldSiteId
      ? data.fieldSites.find((item) => item.id === interview.fieldSiteId)
      : undefined
    if (!projectExists || (interview.fieldSiteId && selectedSite?.projectId !== interview.projectId)) return
    const values = { ...interview, fieldSiteId: interview.fieldSiteId || undefined, interviewDate: interview.interviewDate || undefined }
    if (editingId) {
      await updateData((current) => ({
        ...current,
        interviews: current.interviews.map((item) =>
          item.id === editingId ? { ...item, ...values, updatedAt: new Date().toISOString() } : item,
        ),
      }))
    } else {
      const record: Interview = { ...entityMeta('interview'), ...values }
      await updateData((current) => ({ ...current, interviews: [record, ...current.interviews] }))
    }
    setFormKind(null)
  }

  const saveVisit = async (event: FormEvent) => {
    event.preventDefault()
    const projectExists = data.projects.some((item) => item.id === visit.projectId)
    const selectedSite = data.fieldSites.find((item) => item.id === visit.fieldSiteId)
    if (!projectExists || !selectedSite || selectedSite.projectId !== visit.projectId) return
    if (editingId) {
      await updateData((current) => ({
        ...current,
        fieldVisits: current.fieldVisits.map((item) =>
          item.id === editingId ? { ...item, ...visit, updatedAt: new Date().toISOString() } : item,
        ),
      }))
    } else {
      const record: FieldVisit = { ...entityMeta('visit'), ...visit }
      await updateData((current) => ({ ...current, fieldVisits: [record, ...current.fieldVisits] }))
    }
    setFormKind(null)
  }

  const deleteRecord = async () => {
    if (!deleteTarget) return
    if (
      deleteTarget.kind === 'site' &&
      data.fieldVisits.some((item) => item.fieldSiteId === deleteTarget.id)
    ) return
    await updateData((current) => {
      if (deleteTarget.kind === 'site') {
        return {
          ...current,
          fieldSites: current.fieldSites.filter((item) => item.id !== deleteTarget.id),
          interviews: current.interviews.map((item) =>
            item.fieldSiteId === deleteTarget.id ? { ...item, fieldSiteId: undefined } : item,
          ),
        }
      }
      if (deleteTarget.kind === 'interview') {
        return { ...current, interviews: current.interviews.filter((item) => item.id !== deleteTarget.id) }
      }
      return { ...current, fieldVisits: current.fieldVisits.filter((item) => item.id !== deleteTarget.id) }
    })
    setDeleteTarget(null)
  }

  const siteLabel = (siteId?: string) => data.fieldSites.find((item) => item.id === siteId)?.nameOrAlias || 'No site linked'
  const completedInterviews = data.interviews.filter((item) => item.status === 'Completed').length
  const uncoded = data.interviews.filter((item) => item.status === 'Completed' && item.codingStatus !== 'Complete').length
  const activeSites = data.fieldSites.filter((item) => item.status === 'Active').length
  const blockingSiteVisits =
    deleteTarget?.kind === 'site'
      ? data.fieldVisits.filter((item) => item.fieldSiteId === deleteTarget.id).length
      : 0
  const editingSiteLinks = editingId && formKind === 'site'
    ? data.interviews.filter((item) => item.fieldSiteId === editingId).length +
      data.fieldVisits.filter((item) => item.fieldSiteId === editingId).length
    : 0

  return (
    <div className="page">
      <PageHeader
        index="04"
        eyebrow="Qualitative traceability"
        title="Fieldwork & interviews"
        description="Keep sites, anonymized interviews, visits, and analytical work products linked without collecting direct identifiers."
        actions={<AddButton onClick={() => openCreate(tab === 'sites' ? 'site' : tab === 'interviews' ? 'interview' : 'visit')}>Add {tab === 'sites' ? 'site' : tab === 'interviews' ? 'interview' : 'visit'}</AddButton>}
      />

      <PrivacyNotice />

      <div className="stats-grid stats-grid--four">
        <StatCard label="Active sites" value={activeSites} detail={`${data.fieldSites.length} registered`} tone="blue" />
        <StatCard label="Interviews complete" value={completedInterviews} detail={`${data.interviews.length} total interviews`} tone="success" />
        <StatCard label="Awaiting coding" value={uncoded} detail="completed but not fully coded" tone={uncoded ? 'warning' : 'neutral'} />
        <StatCard label="Field visits" value={data.fieldVisits.length} detail="observational records" tone="violet" />
      </div>

      <section className="panel">
        <div className="segmented-tabs" role="tablist" aria-label="Fieldwork registry">
          <button type="button" className={tab === 'sites' ? 'active' : ''} onClick={() => setTab('sites')}>
            <MapPinned size={15} /> Sites <span>{data.fieldSites.length}</span>
          </button>
          <button type="button" className={tab === 'interviews' ? 'active' : ''} onClick={() => setTab('interviews')}>
            <MessageSquareText size={15} /> Interviews <span>{data.interviews.length}</span>
          </button>
          <button type="button" className={tab === 'visits' ? 'active' : ''} onClick={() => setTab('visits')}>
            <NotebookTabs size={15} /> Field visits <span>{data.fieldVisits.length}</span>
          </button>
        </div>
        <div className="toolbar toolbar--under-tabs">
          <SearchField value={search} onChange={setSearch} placeholder={`Search ${tab}`} />
          <ProjectSelect projects={data.projects} value={projectFilter} onChange={setProjectFilter} includeAll />
          <Button size="sm" variant="ghost" onClick={() => openCreate(tab === 'sites' ? 'site' : tab === 'interviews' ? 'interview' : 'visit')}>
            Add record
          </Button>
        </div>

        {tab === 'sites' && (filteredSites.length ? (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead><tr><th>Site alias</th><th>Project</th><th>Status</th><th>Notes</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {filteredSites.map((item) => (
                  <tr key={item.id}>
                    <td data-label="Site alias"><span className="record-title"><strong>{item.nameOrAlias}</strong><span className="mono-id">{item.id}</span></span></td>
                    <td data-label="Project">{projectLabel(data.projects, item.projectId)}</td>
                    <td data-label="Status"><Badge tone={item.status === 'Active' ? 'success' : 'neutral'}>{item.status}</Badge></td>
                    <td data-label="Notes">{truncate(item.notes || 'No notes', 70)}</td>
                    <td><TableActions onEdit={() => editSite(item)} onDelete={() => setDeleteTarget({ kind: 'site', id: item.id, label: item.nameOrAlias })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title="No field sites found" description="Register an anonymized site or clear the active filters." action={<AddButton onClick={() => openCreate('site')}>Add field site</AddButton>} />)}

        {tab === 'interviews' && (filteredInterviews.length ? (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead><tr><th>Participant alias</th><th>Site / date</th><th>Status</th><th>Work products</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {filteredInterviews.map((item) => (
                  <tr key={item.id}>
                    <td data-label="Participant alias"><span className="record-title"><strong>{item.participantAlias}</strong><span>{projectLabel(data.projects, item.projectId)}</span></span></td>
                    <td data-label="Site / date"><span className="date-cell">{siteLabel(item.fieldSiteId)}<small>{formatDate(item.interviewDate)}</small></span></td>
                    <td data-label="Status"><Badge tone={item.status === 'Completed' ? 'success' : item.status === 'Cancelled' ? 'danger' : 'blue'}>{item.status}</Badge></td>
                    <td data-label="Work products">
                      <div className="work-product-stack">
                        <Badge tone={workTone(item.transcriptStatus)}>Transcript: {item.transcriptStatus}</Badge>
                        <Badge tone={workTone(item.codingStatus)}>Coding: {item.codingStatus}</Badge>
                        <Badge tone={workTone(item.memoStatus)}>Memo: {item.memoStatus}</Badge>
                      </div>
                    </td>
                    <td><TableActions onEdit={() => editInterview(item)} onDelete={() => setDeleteTarget({ kind: 'interview', id: item.id, label: item.participantAlias })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title="No interviews found" description="Add an anonymous participant alias or clear the active filters." action={<AddButton onClick={() => openCreate('interview')}>Add interview</AddButton>} />)}

        {tab === 'visits' && (filteredVisits.length ? (
          <div className="field-visit-grid">
            {filteredVisits.map((item) => (
              <article className="field-visit-card" key={item.id}>
                <header>
                  <div><p className="eyebrow">{formatDate(item.date)}</p><h3>{item.purpose}</h3></div>
                  <Badge tone="blue">{siteLabel(item.fieldSiteId)}</Badge>
                </header>
                <p>{truncate(item.observations || 'No observations recorded.', 180)}</p>
                <dl>
                  <div><dt>Project</dt><dd>{projectLabel(data.projects, item.projectId)}</dd></div>
                  <div><dt>Follow-up</dt><dd>{truncate(item.followUp || 'None recorded', 72)}</dd></div>
                </dl>
                <TableActions onEdit={() => editVisit(item)} onDelete={() => setDeleteTarget({ kind: 'visit', id: item.id, label: item.purpose })} />
              </article>
            ))}
          </div>
        ) : <EmptyState title="No field visits found" description="Document an observation session, purpose, follow-up, and memo." action={<AddButton onClick={() => openCreate('visit')}>Add field visit</AddButton>} />)}
      </section>

      <Modal
        open={formKind === 'site'}
        title={editingId ? 'Edit field site' : 'Add field site'}
        description="Use a site alias. Do not enter a precise private address or identifiable organization unless ethically cleared."
        onClose={() => setFormKind(null)}
        footer={<><Button onClick={() => setFormKind(null)}>Cancel</Button><Button type="submit" form="site-form" variant="primary">{editingId ? 'Save changes' : 'Add site'}</Button></>}
      >
        <PrivacyNotice compact />
        <form id="site-form" className="form-grid form-grid--spaced" onSubmit={(event) => void saveSite(event)}>
          <Field label="Site name or alias" required className="form-span-2"><input autoFocus required value={site.nameOrAlias} onChange={(event) => setSite({ ...site, nameOrAlias: event.target.value })} placeholder="e.g. Site North-02" /></Field>
          <Field
            label="Project"
            required
            hint={editingSiteLinks ? `${editingSiteLinks} linked records protect this project relationship.` : undefined}
          >
            <ProjectSelect
              required
              disabled={editingSiteLinks > 0}
              projects={data.projects}
              value={site.projectId}
              onChange={(projectId) => setSite({ ...site, projectId })}
            />
          </Field>
          <Field label="Status"><select value={site.status} onChange={(event) => setSite({ ...site, status: event.target.value as FieldSite['status'] })}>{FIELD_SITE_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></Field>
          <Field label="Notes" className="form-span-2"><textarea rows={4} value={site.notes} onChange={(event) => setSite({ ...site, notes: event.target.value })} placeholder="Access conditions, sampling relevance, or non-identifying context" /></Field>
        </form>
      </Modal>

      <Modal
        open={formKind === 'interview'}
        title={editingId ? 'Edit interview record' : 'Add interview'}
        description="This registry tracks workflow, not identity. Use an anonymous participant alias only."
        onClose={() => setFormKind(null)}
        size="lg"
        footer={<><Button onClick={() => setFormKind(null)}>Cancel</Button><Button type="submit" form="interview-form" variant="primary">{editingId ? 'Save changes' : 'Add interview'}</Button></>}
      >
        <PrivacyNotice compact />
        <form id="interview-form" className="form-grid form-grid--spaced" onSubmit={(event) => void saveInterview(event)}>
          <Field label="Participant alias" required><input autoFocus required value={interview.participantAlias} onChange={(event) => setInterview({ ...interview, participantAlias: event.target.value })} placeholder="e.g. P-017" /></Field>
          <Field label="Project" required><ProjectSelect required projects={data.projects} value={interview.projectId} onChange={(projectId) => setInterview({ ...interview, projectId, fieldSiteId: '' })} /></Field>
          <Field label="Field site"><select value={interview.fieldSiteId} onChange={(event) => setInterview({ ...interview, fieldSiteId: event.target.value })}><option value="">No site linked</option>{data.fieldSites.filter((item) => item.projectId === interview.projectId).map((item) => <option key={item.id} value={item.id}>{item.nameOrAlias}</option>)}</select></Field>
          <Field label="Interview date"><input type="date" value={interview.interviewDate} onChange={(event) => setInterview({ ...interview, interviewDate: event.target.value })} /></Field>
          <Field label="Interview status"><select value={interview.status} onChange={(event) => setInterview({ ...interview, status: event.target.value as Interview['status'] })}>{INTERVIEW_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></Field>
          <Field label="Transcript"><select value={interview.transcriptStatus} onChange={(event) => setInterview({ ...interview, transcriptStatus: event.target.value as Interview['transcriptStatus'] })}>{WORK_PRODUCT_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></Field>
          <Field label="Coding"><select value={interview.codingStatus} onChange={(event) => setInterview({ ...interview, codingStatus: event.target.value as Interview['codingStatus'] })}>{WORK_PRODUCT_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></Field>
          <Field label="Memo"><select value={interview.memoStatus} onChange={(event) => setInterview({ ...interview, memoStatus: event.target.value as Interview['memoStatus'] })}>{WORK_PRODUCT_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></Field>
          <Field label="Non-identifying notes" className="form-span-2"><textarea rows={4} value={interview.notes} onChange={(event) => setInterview({ ...interview, notes: event.target.value })} /></Field>
        </form>
      </Modal>

      <Modal
        open={formKind === 'visit'}
        title={editingId ? 'Edit field visit' : 'Add field visit'}
        description="Record what the visit changed analytically and what must happen next."
        onClose={() => setFormKind(null)}
        size="lg"
        footer={<><Button onClick={() => setFormKind(null)}>Cancel</Button><Button type="submit" form="visit-form" variant="primary">{editingId ? 'Save changes' : 'Add visit'}</Button></>}
      >
        <PrivacyNotice compact />
        <form id="visit-form" className="form-grid form-grid--spaced" onSubmit={(event) => void saveVisit(event)}>
          <Field label="Date" required><input required type="date" value={visit.date} onChange={(event) => setVisit({ ...visit, date: event.target.value })} /></Field>
          <Field label="Project" required><ProjectSelect required projects={data.projects} value={visit.projectId} onChange={(projectId) => setVisit({ ...visit, projectId, fieldSiteId: '' })} /></Field>
          <Field label="Field site" required className="form-span-2"><select required value={visit.fieldSiteId} onChange={(event) => setVisit({ ...visit, fieldSiteId: event.target.value })}><option value="">Select a registered site</option>{data.fieldSites.filter((item) => item.projectId === visit.projectId).map((item) => <option key={item.id} value={item.id}>{item.nameOrAlias}</option>)}</select></Field>
          <Field label="Purpose" required className="form-span-2"><input autoFocus required value={visit.purpose} onChange={(event) => setVisit({ ...visit, purpose: event.target.value })} /></Field>
          <Field label="Observations"><textarea rows={5} value={visit.observations} onChange={(event) => setVisit({ ...visit, observations: event.target.value })} /></Field>
          <Field label="Follow-up"><textarea rows={5} value={visit.followUp} onChange={(event) => setVisit({ ...visit, followUp: event.target.value })} /></Field>
          <Field label="Analytical memo" className="form-span-2"><textarea rows={4} value={visit.memo} onChange={(event) => setVisit({ ...visit, memo: event.target.value })} /></Field>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget) && blockingSiteVisits === 0}
        title={`Delete “${deleteTarget?.label || 'record'}”?`}
        description={deleteTarget?.kind === 'site' ? 'The site will be deleted. Any interview records are preserved and their optional site link is cleared.' : 'This registry record will be permanently removed from the local workspace.'}
        confirmLabel="Delete record"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={deleteRecord}
      />
      <Modal
        open={Boolean(deleteTarget) && blockingSiteVisits > 0}
        title="Field site still has visit records"
        description="A required provenance link cannot be cleared automatically. Move or delete the linked visits before removing this site."
        onClose={() => setDeleteTarget(null)}
        size="sm"
        footer={<Button variant="primary" onClick={() => setDeleteTarget(null)}>Keep field site</Button>}
      >
        <div className="confirm-panel confirm-panel--primary">
          <MapPinned size={20} />
          <p>{blockingSiteVisits} linked field {blockingSiteVisits === 1 ? 'visit is' : 'visits are'} protecting this site from deletion.</p>
        </div>
      </Modal>
    </div>
  )
}
