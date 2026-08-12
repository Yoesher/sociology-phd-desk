import { useEffect, useMemo, useState, type FormEvent } from 'react'
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
import { useI18n, type MessageKey } from '../../i18n'
import { entityMeta, todayIso, truncate } from '../../app/format'
import { QUICK_ADD_EVENT, type QuickAddEvent } from '../../app/navigationEvents'
import { matchesFieldworkInterviewView } from './fieldworkViews'
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

const FIELDWORK_VIEWS = ['overview', 'sites', 'visits', 'interviews', 'transcription', 'coding', 'memos', 'completed'] as const
type FieldworkView = (typeof FIELDWORK_VIEWS)[number]

function readFieldworkView(): FieldworkView {
  const requested = new URLSearchParams(window.location.hash.split('?')[1] || '').get('view')
  return FIELDWORK_VIEWS.includes(requested as FieldworkView) ? requested as FieldworkView : 'overview'
}

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
  const { t, formatDate, formatNumber, labelEnum } = useI18n()
  const [tab, setTab] = useState<RegistryTab>('sites')
  const [search, setSearch] = useState('')
  const [projectFilter, setProjectFilter] = useState('')
  const [formKind, setFormKind] = useState<RecordKind | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ kind: RecordKind; id: string; label: string } | null>(null)
  const [site, setSite] = useState(siteDraft)
  const [interview, setInterview] = useState(interviewDraft)
  const [visit, setVisit] = useState(visitDraft)
  const [validationMessageKey, setValidationMessageKey] = useState<MessageKey | null>(null)
  const [view, setView] = useState<FieldworkView>(readFieldworkView)

  useEffect(() => {
    const syncView = () => setView(readFieldworkView())
    window.addEventListener('hashchange', syncView)
    window.addEventListener('popstate', syncView)
    return () => {
      window.removeEventListener('hashchange', syncView)
      window.removeEventListener('popstate', syncView)
    }
  }, [])
  const effectiveTab: RegistryTab = view === 'sites' ? 'sites' : view === 'visits' ? 'visits' : view === 'overview' ? tab : 'interviews'

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
          matchesFieldworkInterviewView(item, view) &&
          (!projectFilter || item.projectId === projectFilter) &&
          (!query || `${item.participantAlias} ${item.notes}`.toLowerCase().includes(query)),
      ) ?? [],
    [data?.interviews, projectFilter, query, view],
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

  useEffect(() => {
    const handleQuickAdd = (event: Event) => {
      const detail = (event as QuickAddEvent).detail
      if (detail?.module !== 'fieldwork') return
      if (detail.action !== 'interview' && detail.action !== 'field-visit') return
      const kind: RecordKind = detail.action === 'field-visit' ? 'visit' : 'interview'
      setEditingId(null)
      setValidationMessageKey(null)
      const projectId = data?.workspace.activeProjectId || ''
      if (kind === 'interview') setInterview({ ...interviewDraft(), projectId })
      else setVisit({ ...visitDraft(), projectId })
      setFormKind(kind)
    }
    window.addEventListener(QUICK_ADD_EVENT, handleQuickAdd)
    return () => window.removeEventListener(QUICK_ADD_EVENT, handleQuickAdd)
  }, [data?.workspace.activeProjectId])

  if (!data) return null

  const closeForm = () => {
    setFormKind(null)
    setValidationMessageKey(null)
  }

  const openCreate = (kind: RecordKind) => {
    setEditingId(null)
    setValidationMessageKey(null)
    const activeProjectId = data.workspace.activeProjectId || ''
    if (kind === 'site') setSite({ ...siteDraft(), projectId: activeProjectId })
    if (kind === 'interview') setInterview({ ...interviewDraft(), projectId: activeProjectId })
    if (kind === 'visit') setVisit({ ...visitDraft(), projectId: activeProjectId })
    setFormKind(kind)
  }

  const editSite = (item: FieldSite) => {
    setEditingId(item.id)
    setValidationMessageKey(null)
    setSite({ nameOrAlias: item.nameOrAlias, projectId: item.projectId, status: item.status, notes: item.notes })
    setFormKind('site')
  }

  const editInterview = (item: Interview) => {
    setEditingId(item.id)
    setValidationMessageKey(null)
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
    setValidationMessageKey(null)
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
    setValidationMessageKey(null)
    const projectExists = data.projects.some((item) => item.id === site.projectId)
    if (editingId) {
      const original = data.fieldSites.find((item) => item.id === editingId)
      const hasLinkedRecords =
        data.interviews.some((item) => item.fieldSiteId === editingId) ||
        data.fieldVisits.some((item) => item.fieldSiteId === editingId)
      if (!projectExists || !original || (hasLinkedRecords && original.projectId !== site.projectId)) {
        setValidationMessageKey('fieldwork.validation.siteProject')
        return
      }
      await updateData((current) => ({
        ...current,
        fieldSites: current.fieldSites.map((item) =>
          item.id === editingId ? { ...item, ...site, updatedAt: new Date().toISOString() } : item,
        ),
      }))
    } else {
      if (!projectExists) {
        setValidationMessageKey('fieldwork.validation.siteProject')
        return
      }
      const record: FieldSite = { ...entityMeta('site'), ...site }
      await updateData((current) => ({ ...current, fieldSites: [record, ...current.fieldSites] }))
    }
    closeForm()
  }

  const saveInterview = async (event: FormEvent) => {
    event.preventDefault()
    setValidationMessageKey(null)
    const projectExists = data.projects.some((item) => item.id === interview.projectId)
    const selectedSite = interview.fieldSiteId
      ? data.fieldSites.find((item) => item.id === interview.fieldSiteId)
      : undefined
    if (!projectExists || (interview.fieldSiteId && selectedSite?.projectId !== interview.projectId)) {
      setValidationMessageKey('fieldwork.validation.interviewProject')
      return
    }
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
    closeForm()
  }

  const saveVisit = async (event: FormEvent) => {
    event.preventDefault()
    setValidationMessageKey(null)
    const projectExists = data.projects.some((item) => item.id === visit.projectId)
    const selectedSite = data.fieldSites.find((item) => item.id === visit.fieldSiteId)
    if (!projectExists || !selectedSite || selectedSite.projectId !== visit.projectId) {
      setValidationMessageKey('fieldwork.validation.visitProject')
      return
    }
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
    closeForm()
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

  const siteLabel = (siteId?: string) => data.fieldSites.find((item) => item.id === siteId)?.nameOrAlias || t('fieldwork.fallback.noSite')
  const localizedProjectLabel = (projectId?: string) => {
    const project = data.projects.find((item) => item.id === projectId)
    return project?.shortTitle || project?.title || t('common.unassigned')
  }
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
        index="05"
        eyebrow={t('fieldwork.header.eyebrow')}
        title={t('fieldwork.header.title')}
        description={t('fieldwork.header.description')}
        actions={<AddButton onClick={() => openCreate(effectiveTab === 'sites' ? 'site' : effectiveTab === 'interviews' ? 'interview' : 'visit')}>{t(effectiveTab === 'sites' ? 'fieldwork.actions.addSite' : effectiveTab === 'interviews' ? 'fieldwork.actions.addInterview' : 'fieldwork.actions.addVisit')}</AddButton>}
      />

      <PrivacyNotice />

      <div className="stats-grid stats-grid--four">
        <StatCard label={t('fieldwork.stats.activeSites')} value={formatNumber(activeSites)} detail={t('fieldwork.stats.registeredSites', { count: formatNumber(data.fieldSites.length) })} tone="blue" />
        <StatCard label={t('fieldwork.stats.completedInterviews')} value={formatNumber(completedInterviews)} detail={t('fieldwork.stats.totalInterviews', { count: formatNumber(data.interviews.length) })} tone="success" />
        <StatCard label={t('fieldwork.stats.awaitingCoding')} value={formatNumber(uncoded)} detail={t('fieldwork.stats.awaitingCodingDetail')} tone={uncoded ? 'warning' : 'neutral'} />
        <StatCard label={t('fieldwork.stats.visits')} value={formatNumber(data.fieldVisits.length)} detail={t('fieldwork.stats.visitsDetail')} tone="violet" />
      </div>

      <section className="panel">
        <div className="segmented-tabs" role="tablist" aria-label={t('fieldwork.tabs.aria')}>
          <button type="button" role="tab" aria-selected={effectiveTab === 'sites'} className={effectiveTab === 'sites' ? 'active' : ''} onClick={() => setTab('sites')}>
            <MapPinned size={15} /> {t('fieldwork.tabs.sites')} <span>{formatNumber(data.fieldSites.length)}</span>
          </button>
          <button type="button" role="tab" aria-selected={effectiveTab === 'interviews'} className={effectiveTab === 'interviews' ? 'active' : ''} onClick={() => setTab('interviews')}>
            <MessageSquareText size={15} /> {t('fieldwork.tabs.interviews')} <span>{formatNumber(data.interviews.length)}</span>
          </button>
          <button type="button" role="tab" aria-selected={effectiveTab === 'visits'} className={effectiveTab === 'visits' ? 'active' : ''} onClick={() => setTab('visits')}>
            <NotebookTabs size={15} /> {t('fieldwork.tabs.visits')} <span>{formatNumber(data.fieldVisits.length)}</span>
          </button>
        </div>
        <div className="toolbar toolbar--under-tabs">
          <SearchField value={search} onChange={setSearch} placeholder={t(effectiveTab === 'sites' ? 'fieldwork.search.sites' : effectiveTab === 'interviews' ? 'fieldwork.search.interviews' : 'fieldwork.search.visits')} />
          <ProjectSelect projects={data.projects} value={projectFilter} onChange={setProjectFilter} includeAll />
          <Button size="sm" variant="ghost" onClick={() => openCreate(effectiveTab === 'sites' ? 'site' : effectiveTab === 'interviews' ? 'interview' : 'visit')}>
            {t('fieldwork.actions.addRecord')}
          </Button>
        </div>

        {effectiveTab === 'sites' && (filteredSites.length ? (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead><tr><th>{t('fieldwork.table.siteAlias')}</th><th>{t('fieldwork.table.project')}</th><th>{t('fieldwork.table.status')}</th><th>{t('fieldwork.table.notes')}</th><th><span className="sr-only">{t('fieldwork.table.actions')}</span></th></tr></thead>
              <tbody>
                {filteredSites.map((item) => (
                  <tr key={item.id}>
                    <td data-label={t('fieldwork.table.siteAlias')}><span className="record-title"><strong>{item.nameOrAlias}</strong><span className="mono-id">{item.id}</span></span></td>
                    <td data-label={t('fieldwork.table.project')}>{localizedProjectLabel(item.projectId)}</td>
                    <td data-label={t('fieldwork.table.status')}><Badge tone={item.status === 'Active' ? 'success' : 'neutral'}>{labelEnum(item.status)}</Badge></td>
                    <td data-label={t('fieldwork.table.notes')}>{truncate(item.notes || t('fieldwork.fallback.noNotes'), 70)}</td>
                    <td><TableActions onEdit={() => editSite(item)} onDelete={() => setDeleteTarget({ kind: 'site', id: item.id, label: item.nameOrAlias })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title={t('fieldwork.empty.sitesTitle')} description={t('fieldwork.empty.sitesDescription')} action={<AddButton onClick={() => openCreate('site')}>{t('fieldwork.empty.sitesAction')}</AddButton>} />)}

        {effectiveTab === 'interviews' && (filteredInterviews.length ? (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead><tr><th>{t('fieldwork.table.participantAlias')}</th><th>{t('fieldwork.table.siteDate')}</th><th>{t('fieldwork.table.status')}</th><th>{t('fieldwork.table.workProducts')}</th><th><span className="sr-only">{t('fieldwork.table.actions')}</span></th></tr></thead>
              <tbody>
                {filteredInterviews.map((item) => (
                  <tr key={item.id}>
                    <td data-label={t('fieldwork.table.participantAlias')}><span className="record-title"><strong>{item.participantAlias}</strong><span>{localizedProjectLabel(item.projectId)}</span></span></td>
                    <td data-label={t('fieldwork.table.siteDate')}><span className="date-cell">{siteLabel(item.fieldSiteId)}<small>{formatDate(item.interviewDate)}</small></span></td>
                    <td data-label={t('fieldwork.table.status')}><Badge tone={item.status === 'Completed' ? 'success' : item.status === 'Cancelled' ? 'danger' : 'blue'}>{labelEnum(item.status)}</Badge></td>
                    <td data-label={t('fieldwork.table.workProducts')}>
                      <div className="work-product-stack">
                        <Badge tone={workTone(item.transcriptStatus)}>{t('fieldwork.workProduct.transcript', { status: labelEnum(item.transcriptStatus) })}</Badge>
                        <Badge tone={workTone(item.codingStatus)}>{t('fieldwork.workProduct.coding', { status: labelEnum(item.codingStatus) })}</Badge>
                        <Badge tone={workTone(item.memoStatus)}>{t('fieldwork.workProduct.memo', { status: labelEnum(item.memoStatus) })}</Badge>
                      </div>
                    </td>
                    <td><TableActions onEdit={() => editInterview(item)} onDelete={() => setDeleteTarget({ kind: 'interview', id: item.id, label: item.participantAlias })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title={t('fieldwork.empty.interviewsTitle')} description={t('fieldwork.empty.interviewsDescription')} action={<AddButton onClick={() => openCreate('interview')}>{t('fieldwork.empty.interviewsAction')}</AddButton>} />)}

        {effectiveTab === 'visits' && (filteredVisits.length ? (
          <div className="field-visit-grid">
            {filteredVisits.map((item) => (
              <article className="field-visit-card" key={item.id}>
                <header>
                  <div><p className="eyebrow">{formatDate(item.date)}</p><h3>{item.purpose}</h3></div>
                  <Badge tone="blue">{siteLabel(item.fieldSiteId)}</Badge>
                </header>
                <p>{truncate(item.observations || t('fieldwork.fallback.noObservations'), 180)}</p>
                <dl>
                  <div><dt>{t('fieldwork.visit.project')}</dt><dd>{localizedProjectLabel(item.projectId)}</dd></div>
                  <div><dt>{t('fieldwork.visit.followUp')}</dt><dd>{truncate(item.followUp || t('fieldwork.fallback.noFollowUp'), 72)}</dd></div>
                </dl>
                <TableActions onEdit={() => editVisit(item)} onDelete={() => setDeleteTarget({ kind: 'visit', id: item.id, label: item.purpose })} />
              </article>
            ))}
          </div>
        ) : <EmptyState title={t('fieldwork.empty.visitsTitle')} description={t('fieldwork.empty.visitsDescription')} action={<AddButton onClick={() => openCreate('visit')}>{t('fieldwork.empty.visitsAction')}</AddButton>} />)}
      </section>

      <Modal
        open={formKind === 'site'}
        title={editingId ? t('fieldwork.siteForm.editTitle') : t('fieldwork.siteForm.addTitle')}
        description={t('fieldwork.siteForm.description')}
        onClose={closeForm}
        footer={<><Button onClick={closeForm}>{t('common.cancel')}</Button><Button type="submit" form="site-form" variant="primary">{editingId ? t('fieldwork.siteForm.save') : t('fieldwork.siteForm.add')}</Button></>}
      >
        <PrivacyNotice compact />
        <form id="site-form" className="form-grid form-grid--spaced" onSubmit={(event) => void saveSite(event)}>
          {validationMessageKey && <p className="text-danger form-span-2" role="alert">{t(validationMessageKey)}</p>}
          <Field label={t('fieldwork.siteForm.name')} required className="form-span-2"><input autoFocus required value={site.nameOrAlias} onChange={(event) => setSite({ ...site, nameOrAlias: event.target.value })} placeholder={t('fieldwork.siteForm.namePlaceholder')} /></Field>
          <Field
            label={t('fieldwork.siteForm.project')}
            required
            hint={editingSiteLinks ? t('fieldwork.siteForm.linkedHint', { count: formatNumber(editingSiteLinks) }) : undefined}
          >
            <ProjectSelect
              required
              disabled={editingSiteLinks > 0}
              projects={data.projects}
              value={site.projectId}
              onChange={(projectId) => setSite({ ...site, projectId })}
            />
          </Field>
          <Field label={t('fieldwork.siteForm.status')}><select value={site.status} onChange={(event) => setSite({ ...site, status: event.target.value as FieldSite['status'] })}>{FIELD_SITE_STATUSES.map((status) => <option key={status} value={status}>{labelEnum(status)}</option>)}</select></Field>
          <Field label={t('fieldwork.siteForm.notes')} className="form-span-2"><textarea rows={4} value={site.notes} onChange={(event) => setSite({ ...site, notes: event.target.value })} placeholder={t('fieldwork.siteForm.notesPlaceholder')} /></Field>
        </form>
      </Modal>

      <Modal
        open={formKind === 'interview'}
        title={editingId ? t('fieldwork.interviewForm.editTitle') : t('fieldwork.interviewForm.addTitle')}
        description={t('fieldwork.interviewForm.description')}
        onClose={closeForm}
        size="lg"
        footer={<><Button onClick={closeForm}>{t('common.cancel')}</Button><Button type="submit" form="interview-form" variant="primary">{editingId ? t('fieldwork.interviewForm.save') : t('fieldwork.interviewForm.add')}</Button></>}
      >
        <PrivacyNotice compact />
        <form id="interview-form" className="form-grid form-grid--spaced" onSubmit={(event) => void saveInterview(event)}>
          {validationMessageKey && <p className="text-danger form-span-2" role="alert">{t(validationMessageKey)}</p>}
          <Field label={t('fieldwork.interviewForm.alias')} required><input autoFocus required value={interview.participantAlias} onChange={(event) => setInterview({ ...interview, participantAlias: event.target.value })} placeholder={t('fieldwork.interviewForm.aliasPlaceholder')} /></Field>
          <Field label={t('fieldwork.interviewForm.project')} required><ProjectSelect required projects={data.projects} value={interview.projectId} onChange={(projectId) => setInterview({ ...interview, projectId, fieldSiteId: '' })} /></Field>
          <Field label={t('fieldwork.interviewForm.site')}><select value={interview.fieldSiteId} onChange={(event) => setInterview({ ...interview, fieldSiteId: event.target.value })}><option value="">{t('fieldwork.interviewForm.noSite')}</option>{data.fieldSites.filter((item) => item.projectId === interview.projectId).map((item) => <option key={item.id} value={item.id}>{item.nameOrAlias}</option>)}</select></Field>
          <Field label={t('fieldwork.interviewForm.date')}><input type="date" value={interview.interviewDate} onChange={(event) => setInterview({ ...interview, interviewDate: event.target.value })} /></Field>
          <Field label={t('fieldwork.interviewForm.status')}><select value={interview.status} onChange={(event) => setInterview({ ...interview, status: event.target.value as Interview['status'] })}>{INTERVIEW_STATUSES.map((status) => <option key={status} value={status}>{labelEnum(status)}</option>)}</select></Field>
          <Field label={t('fieldwork.interviewForm.transcript')}><select value={interview.transcriptStatus} onChange={(event) => setInterview({ ...interview, transcriptStatus: event.target.value as Interview['transcriptStatus'] })}>{WORK_PRODUCT_STATUSES.map((status) => <option key={status} value={status}>{labelEnum(status)}</option>)}</select></Field>
          <Field label={t('fieldwork.interviewForm.coding')}><select value={interview.codingStatus} onChange={(event) => setInterview({ ...interview, codingStatus: event.target.value as Interview['codingStatus'] })}>{WORK_PRODUCT_STATUSES.map((status) => <option key={status} value={status}>{labelEnum(status)}</option>)}</select></Field>
          <Field label={t('fieldwork.interviewForm.memo')}><select value={interview.memoStatus} onChange={(event) => setInterview({ ...interview, memoStatus: event.target.value as Interview['memoStatus'] })}>{WORK_PRODUCT_STATUSES.map((status) => <option key={status} value={status}>{labelEnum(status)}</option>)}</select></Field>
          <Field label={t('fieldwork.interviewForm.notes')} className="form-span-2"><textarea rows={4} value={interview.notes} onChange={(event) => setInterview({ ...interview, notes: event.target.value })} /></Field>
        </form>
      </Modal>

      <Modal
        open={formKind === 'visit'}
        title={editingId ? t('fieldwork.visitForm.editTitle') : t('fieldwork.visitForm.addTitle')}
        description={t('fieldwork.visitForm.description')}
        onClose={closeForm}
        size="lg"
        footer={<><Button onClick={closeForm}>{t('common.cancel')}</Button><Button type="submit" form="visit-form" variant="primary">{editingId ? t('fieldwork.visitForm.save') : t('fieldwork.visitForm.add')}</Button></>}
      >
        <PrivacyNotice compact />
        <form id="visit-form" className="form-grid form-grid--spaced" onSubmit={(event) => void saveVisit(event)}>
          {validationMessageKey && <p className="text-danger form-span-2" role="alert">{t(validationMessageKey)}</p>}
          <Field label={t('fieldwork.visitForm.date')} required><input required type="date" value={visit.date} onChange={(event) => setVisit({ ...visit, date: event.target.value })} /></Field>
          <Field label={t('fieldwork.visitForm.project')} required><ProjectSelect required projects={data.projects} value={visit.projectId} onChange={(projectId) => setVisit({ ...visit, projectId, fieldSiteId: '' })} /></Field>
          <Field label={t('fieldwork.visitForm.site')} required className="form-span-2"><select required value={visit.fieldSiteId} onChange={(event) => setVisit({ ...visit, fieldSiteId: event.target.value })}><option value="">{t('fieldwork.visitForm.selectSite')}</option>{data.fieldSites.filter((item) => item.projectId === visit.projectId).map((item) => <option key={item.id} value={item.id}>{item.nameOrAlias}</option>)}</select></Field>
          <Field label={t('fieldwork.visitForm.purpose')} required className="form-span-2"><input autoFocus required value={visit.purpose} onChange={(event) => setVisit({ ...visit, purpose: event.target.value })} /></Field>
          <Field label={t('fieldwork.visitForm.observations')}><textarea rows={5} value={visit.observations} onChange={(event) => setVisit({ ...visit, observations: event.target.value })} /></Field>
          <Field label={t('fieldwork.visitForm.followUp')}><textarea rows={5} value={visit.followUp} onChange={(event) => setVisit({ ...visit, followUp: event.target.value })} /></Field>
          <Field label={t('fieldwork.visitForm.memo')} className="form-span-2"><textarea rows={4} value={visit.memo} onChange={(event) => setVisit({ ...visit, memo: event.target.value })} /></Field>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget) && blockingSiteVisits === 0}
        title={t('fieldwork.delete.title', { name: deleteTarget?.label || t('fieldwork.delete.fallbackName') })}
        description={deleteTarget?.kind === 'site' ? t('fieldwork.delete.siteDescription') : t('fieldwork.delete.recordDescription')}
        confirmLabel={t('fieldwork.delete.confirm')}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={deleteRecord}
      />
      <Modal
        open={Boolean(deleteTarget) && blockingSiteVisits > 0}
        title={t('fieldwork.delete.blockedTitle')}
        description={t('fieldwork.delete.blockedDescription')}
        onClose={() => setDeleteTarget(null)}
        size="sm"
        footer={<Button variant="primary" onClick={() => setDeleteTarget(null)}>{t('fieldwork.delete.keep')}</Button>}
      >
        <div className="confirm-panel confirm-panel--primary">
          <MapPinned size={20} />
          <p>{t(blockingSiteVisits === 1 ? 'fieldwork.delete.blockedOne' : 'fieldwork.delete.blockedMany', { count: formatNumber(blockingSiteVisits) })}</p>
        </div>
      </Modal>
    </div>
  )
}
