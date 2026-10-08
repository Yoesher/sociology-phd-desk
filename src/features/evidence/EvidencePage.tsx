import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { BookOpenCheck, Link2, Scale, ShieldQuestion } from 'lucide-react'
import {
  EVIDENCE_TYPES,
  SUPPORT_LEVELS,
  type EvidenceItem,
} from '../../models/domain'
import { useProjectWorkspace as useWorkspace } from '../../hooks/useProjectWorkspace'
import { entityMeta, truncate } from '../../app/format'
import { QUICK_ADD_EVENT, type QuickAddEvent } from '../../app/navigationEvents'
import { useModuleSearch } from '../../hooks/useModuleSearch'
import { useI18n, type MessageKey } from '../../i18n'
import { previewProvenanceDeletion } from '../../utils/provenance-graph'
import { Link } from 'react-router-dom'
import { ProjectSelect } from '../../components/ProjectSelect'
import { ProvenanceWorkspace } from './ProvenanceWorkspace'
import {
  AddButton,
  Badge,
  Button,
  EmptyState,
  Field,
  FilterChips,
  DisclosureSection,
  Modal,
  PageHeader,
  SearchField,
  StatCard,
  TableActions,
  type Tone,
} from '../../components/ui'

interface EvidenceDraft {
  projectId: string
  claim: string
  evidenceType: EvidenceItem['evidenceType']
  source: string
  locator: string
  finding: string
  supportLevel: EvidenceItem['supportLevel']
  limitations: string
  manuscriptLocation: string
}

const emptyDraft = (): EvidenceDraft => ({
  projectId: '',
  claim: '',
  evidenceType: 'Literature',
  source: '',
  locator: '',
  finding: '',
  supportLevel: 'Unclear',
  limitations: '',
  manuscriptLocation: '',
})

const supportTone = (level: EvidenceItem['supportLevel']): Tone => {
  if (level === 'Strong') return 'success'
  if (level === 'Moderate') return 'accent'
  if (level === 'Weak' || level === 'Unclear') return 'warning'
  return 'danger'
}

type EvidenceView = 'all' | 'by-type' | 'contradictory' | 'provenance'

function matchesEvidenceView(item: EvidenceItem, view: EvidenceView): boolean {
  if (view === 'contradictory') return item.supportLevel === 'Contradictory' || item.supportLevel === 'Unclear'
  return true
}

export function EvidencePage() {
  const { data, fullData, updateData } = useWorkspace()
  const { t, formatNumber, labelEnum } = useI18n()
  const [search, setSearch] = useState('')
  const [projectFilter, setProjectFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [supportFilter, setSupportFilter] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<EvidenceItem | null>(null)
  const [deleting, setDeleting] = useState<EvidenceItem | null>(null)
  const [draft, setDraft] = useState<EvidenceDraft>(emptyDraft)
  const [formError, setFormError] = useState(false)
  const [deleteError, setDeleteError] = useState(false)
  const [saveBusy, setSaveBusy] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const { searchParams, updateSearch } = useModuleSearch('evidence')
  const view = (searchParams.get('view') || 'all') as EvidenceView
  const urlTypes = (searchParams.get('type') || '').split(',').filter(Boolean)

  const changeProjectFilter = (projectId: string) => {
    setProjectFilter(projectId)
  }

  const itemCount = (count: number) => t(
    count === 1 ? 'evidence.count.itemsOne' : 'evidence.count.itemsOther',
    { count: formatNumber(count) },
  )
  const localizedProjectLabel = (projectId?: string) => {
    const project = data?.projects.find((item) => item.id === projectId)
    return project?.shortTitle || project?.title || t('common.unassigned')
  }

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return (
      data?.evidence.filter((item) => {
        const corpus = `${item.claim} ${item.source} ${item.finding} ${item.locator} ${item.limitations}`.toLowerCase()
        return (
          (!query || corpus.includes(query)) &&
          matchesEvidenceView(item, view) &&
          (!urlTypes.length || urlTypes.includes(item.evidenceType)) &&
          (!projectFilter || item.projectId === projectFilter) &&
          (!typeFilter || item.evidenceType === typeFilter) &&
          (!supportFilter || item.supportLevel === supportFilter)
        )
      }) ?? []
    )
  }, [data?.evidence, projectFilter, search, supportFilter, typeFilter, urlTypes, view])

  useEffect(() => {
    const handleQuickAdd = (event: Event) => {
      const detail = (event as QuickAddEvent).detail
      if (detail?.module !== 'evidence' || detail.action !== 'evidence') return
      if (view === 'provenance') updateSearch({ view: 'all' })
      setFormError(false)
      setEditing(null)
      setDraft({ ...emptyDraft(), projectId: data?.workspace.activeProjectId || data?.projects[0]?.id || '' })
      setFormOpen(true)
    }
    window.addEventListener(QUICK_ADD_EVENT, handleQuickAdd)
    return () => window.removeEventListener(QUICK_ADD_EVENT, handleQuickAdd)
  }, [data?.projects, data?.workspace.activeProjectId, updateSearch, view])

  if (view === 'provenance') return <ProvenanceWorkspace />
  if (!data) return null

  const openCreate = () => {
    setFormError(false)
    setEditing(null)
    setDraft({ ...emptyDraft(), projectId: data.workspace.activeProjectId || data.projects[0]?.id || '' })
    setFormOpen(true)
  }

  const openEdit = (item: EvidenceItem) => {
    setFormError(false)
    setEditing(item)
    setDraft({
      projectId: item.projectId,
      claim: item.claim,
      evidenceType: item.evidenceType,
      source: item.source,
      locator: item.locator,
      finding: item.finding,
      supportLevel: item.supportLevel,
      limitations: item.limitations,
      manuscriptLocation: item.manuscriptLocation,
    })
    setFormOpen(true)
  }

  const saveEvidence = async (event: FormEvent) => {
    event.preventDefault()
    if (saveBusy) return
    setSaveBusy(true)
    setFormError(false)
    try {
      if (editing) {
        await updateData((current) => {
          if (!current.evidence.some((item) => item.id === editing.id)) throw new Error('Evidence is no longer available')
          return {
            ...current,
            evidence: current.evidence.map((item) =>
              item.id === editing.id ? { ...item, ...draft, updatedAt: new Date().toISOString() } : item,
            ),
          }
        })
      } else {
        const record: EvidenceItem = { ...entityMeta('evidence'), ...draft }
        await updateData((current) => ({ ...current, evidence: [record, ...current.evidence] }))
      }
      setFormOpen(false)
      setEditing(null)
    } catch {
      setFormError(true)
    } finally {
      setSaveBusy(false)
    }
  }

  const deleteEvidence = async () => {
    if (!deleting || deleteBusy) return
    setDeleteBusy(true)
    setDeleteError(false)
    try {
      await updateData((current) => {
        if (previewProvenanceDeletion(current, 'evidence', deleting.id).protected) throw new Error('Evidence is protected by provenance')
        return { ...current, evidence: current.evidence.filter((item) => item.id !== deleting.id) }
      })
      setDeleting(null)
    } catch {
      setDeleteError(true)
    } finally {
      setDeleteBusy(false)
    }
  }

  const deletionPreview = deleting && fullData ? previewProvenanceDeletion(fullData, 'evidence', deleting.id) : null
  const protectedEvidence = Boolean(deletionPreview?.protected)
  const traceRevisionId = deleting && fullData ? fullData.evidenceRevisions.filter((row) => row.evidenceId === deleting.id).sort((a, b) => b.revisionNo - a.revisionNo)[0]?.id : undefined

  const strong = data.evidence.filter((item) => item.supportLevel === 'Strong').length
  const contradictory = data.evidence.filter((item) => item.supportLevel === 'Contradictory').length
  const unresolved = data.evidence.filter((item) => ['Weak', 'Unclear'].includes(item.supportLevel)).length
  const inManuscript = data.evidence.filter((item) => item.manuscriptLocation.trim()).length

  return (
    <div className="page">
      <PageHeader
        index="07"
        eyebrow={t('evidence.header.eyebrow')}
        title={t('evidence.header.title')}
        description={t('evidence.header.description')}
        actions={<AddButton onClick={openCreate}>{t('evidence.action.add')}</AddButton>}
      />

      <div className="stats-grid stats-grid--four">
        <StatCard label={t('evidence.stats.items.label')} value={formatNumber(data.evidence.length)} detail={t('evidence.stats.items.detail')} tone="blue" />
        <StatCard label={t('evidence.stats.strong.label')} value={formatNumber(strong)} detail={t('evidence.stats.strong.detail')} tone="success" />
        <StatCard label={t('evidence.stats.contradictions.label')} value={formatNumber(contradictory)} detail={t('evidence.stats.contradictions.detail')} tone={contradictory ? 'danger' : 'neutral'} />
        <StatCard label={t('evidence.stats.manuscript.label')} value={formatNumber(inManuscript)} detail={t(unresolved === 1 ? 'evidence.stats.manuscript.detailOne' : 'evidence.stats.manuscript.detailOther', { count: formatNumber(unresolved) })} tone="violet" />
      </div>

      <section className="evidence-principle">
        <div className="evidence-principle__icon"><Scale size={20} /></div>
        <div>
          <strong>{t('evidence.principle.title')}</strong>
          <p>{t('evidence.principle.body')}</p>
        </div>
        <div className="evidence-chain" aria-label={t('evidence.trace.label')}>
          <span>{t('evidence.trace.claim')}</span><Link2 size={13} /><span>{t('evidence.trace.source')}</span><Link2 size={13} /><span>{t('evidence.trace.finding')}</span><Link2 size={13} /><span>{t('evidence.trace.manuscript')}</span>
        </div>
      </section>

      <section className="panel">
        {view === 'by-type' && <FilterChips ariaLabel={t('evidence.filter.typeLabel')} value={searchParams.get('type') || ''} onChange={(type) => updateSearch({ type })} options={[
          { value: '', label: t('common.all') },
          ...EVIDENCE_TYPES.map((type) => ({ value: type, label: labelEnum(type) })),
        ]} />}
        <div className="toolbar toolbar--wrap">
          <SearchField value={search} onChange={setSearch} placeholder={t('evidence.search.placeholder')} />
          <ProjectSelect projects={data.projects} value={projectFilter} onChange={changeProjectFilter} includeAll />
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} aria-label={t('evidence.filter.typeLabel')}>
            <option value="">{t('evidence.filter.allTypes')}</option>
            {EVIDENCE_TYPES.map((type) => <option key={type} value={type}>{labelEnum(type)}</option>)}
          </select>
          <select value={supportFilter} onChange={(event) => setSupportFilter(event.target.value)} aria-label={t('evidence.filter.supportLabel')}>
            <option value="">{t('evidence.filter.allSupport')}</option>
            {SUPPORT_LEVELS.map((level) => <option key={level} value={level}>{labelEnum(level)}</option>)}
          </select>
          <span className="toolbar__count">{itemCount(filtered.length)}</span>
        </div>

        {filtered.length ? (
          <div className="evidence-list">
            {filtered.map((item) => (
              <article className="evidence-card" key={item.id}>
                <div className="evidence-card__rail" aria-hidden="true"><span>{labelEnum(item.evidenceType).slice(0, 1)}</span></div>
                <div className="evidence-card__body">
                  <header>
                    <div>
                      <div className="badge-row">
                        <Badge tone={supportTone(item.supportLevel)}>{labelEnum(item.supportLevel)}</Badge>
                        <Badge>{labelEnum(item.evidenceType)}</Badge>
                        <span>{localizedProjectLabel(item.projectId)}</span>
                      </div>
                      <h3>{item.claim}</h3>
                    </div>
                    <TableActions onEdit={() => openEdit(item)} onDelete={() => { setDeleteError(false); setDeleting(item) }} />
                  </header>
                  <div className="evidence-card__finding">
                    <BookOpenCheck size={16} />
                    <div><span>{t('evidence.card.finding')}</span><p>{item.finding || t('evidence.card.noFinding')}</p></div>
                  </div>
                  <dl className="evidence-card__meta">
                    <div><dt>{t('evidence.card.source')}</dt><dd>{item.source || t('evidence.card.notRecorded')}</dd></div>
                    <div><dt>{t('evidence.card.locator')}</dt><dd>{item.locator || t('evidence.card.notRecorded')}</dd></div>
                    <div><dt>{t('evidence.card.manuscript')}</dt><dd>{item.manuscriptLocation || t('evidence.card.notPlaced')}</dd></div>
                  </dl>
                  {item.limitations && (
                    <div className="evidence-card__limits"><ShieldQuestion size={14} /><span>{truncate(item.limitations, 190)}</span></div>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title={t(data.evidence.length ? 'evidence.empty.filteredTitle' : 'evidence.empty.initialTitle')}
            description={t(data.evidence.length ? 'evidence.empty.filteredDescription' : 'evidence.empty.initialDescription')}
            action={data.evidence.length ? <Button onClick={() => { setSearch(''); changeProjectFilter(''); setTypeFilter(''); setSupportFilter('') }}>{t('evidence.action.clearFilters')}</Button> : <AddButton onClick={openCreate}>{t('evidence.action.addItem')}</AddButton>}
          />
        )}
      </section>

      <Modal
        open={formOpen}
        title={t(editing ? 'evidence.dialog.editTitle' : 'evidence.dialog.addTitle')}
        description={t('evidence.dialog.description')}
        onClose={saveBusy ? () => undefined : () => setFormOpen(false)}
        size="lg"
        footer={<><Button disabled={saveBusy} onClick={() => setFormOpen(false)}>{t('common.cancel')}</Button><Button disabled={saveBusy} aria-busy={saveBusy} variant="primary" type="submit" form="evidence-form">{t(editing ? 'evidence.action.saveChanges' : 'evidence.action.add')}</Button></>}
      >
        {formError && <p role="alert">{t('evidence.validation.saveFailed')}</p>}
        <form id="evidence-form" className="form-grid" onSubmit={(event) => void saveEvidence(event)}>
          <Field label={t('evidence.form.project')} required><ProjectSelect required projects={data.projects} value={draft.projectId} onChange={(projectId) => setDraft({ ...draft, projectId })} /></Field>
          <Field label={t('evidence.form.type')} required><select value={draft.evidenceType} onChange={(event) => setDraft({ ...draft, evidenceType: event.target.value as EvidenceItem['evidenceType'] })}>{EVIDENCE_TYPES.map((type) => <option key={type} value={type}>{labelEnum(type)}</option>)}</select></Field>
          <Field label={t('evidence.form.claim')} required className="form-span-2"><textarea autoFocus required rows={3} value={draft.claim} onChange={(event) => setDraft({ ...draft, claim: event.target.value })} placeholder={t('evidence.form.claimPlaceholder')} /></Field>
          <Field label={t('evidence.form.source')} required><input required value={draft.source} onChange={(event) => setDraft({ ...draft, source: event.target.value })} placeholder={t('evidence.form.sourcePlaceholder')} /></Field>
          <Field label={t('evidence.form.finding')} required className="form-span-2"><textarea required rows={4} value={draft.finding} onChange={(event) => setDraft({ ...draft, finding: event.target.value })} placeholder={t('evidence.form.findingPlaceholder')} /></Field>
          <Field label={t('evidence.form.support')} required><select value={draft.supportLevel} onChange={(event) => setDraft({ ...draft, supportLevel: event.target.value as EvidenceItem['supportLevel'] })}>{SUPPORT_LEVELS.map((level) => <option key={level} value={level}>{labelEnum(level)}</option>)}</select></Field>
          <DisclosureSection summary={t('common.details')}>
            <Field label={t('evidence.form.locator')}><input value={draft.locator} onChange={(event) => setDraft({ ...draft, locator: event.target.value })} placeholder={t('evidence.form.locatorPlaceholder')} /></Field>
            <Field label={t('evidence.form.manuscriptLocation')}><input value={draft.manuscriptLocation} onChange={(event) => setDraft({ ...draft, manuscriptLocation: event.target.value })} placeholder={t('evidence.form.manuscriptLocationPlaceholder')} /></Field>
            <Field label={t('evidence.form.limitations')} className="form-span-2"><textarea rows={4} value={draft.limitations} onChange={(event) => setDraft({ ...draft, limitations: event.target.value })} placeholder={t('evidence.form.limitationsPlaceholder')} /></Field>
          </DisclosureSection>
        </form>
      </Modal>

      <Modal
        open={Boolean(deleting)}
        title={t(protectedEvidence ? 'evidence.delete.blockedTitle' : 'evidence.delete.title')}
        description={t(protectedEvidence ? 'evidence.delete.blockedDescription' : 'evidence.delete.description')}
        onClose={deleteBusy ? () => undefined : () => setDeleting(null)}
        size="sm"
        footer={<><Button disabled={deleteBusy} onClick={() => setDeleting(null)}>{t(protectedEvidence ? 'evidence.delete.keep' : 'common.cancel')}</Button>{!protectedEvidence && <Button variant="danger" disabled={deleteBusy} aria-busy={deleteBusy} onClick={() => void deleteEvidence()}>{t('evidence.delete.confirm')}</Button>}</>}
      >
        {deleteError && <p role="alert">{t('evidence.validation.deleteFailed')}</p>}
        {protectedEvidence ? <>
          <p>{t('evidence.delete.blockedCount', { count: formatNumber(deletionPreview?.blockers.length || 0) })}</p>
          <ul>{deletionPreview?.blockers.slice(0, 40).map((blocker) => <li key={`${blocker.collection}/${blocker.id}`} style={{ overflowWrap: 'anywhere' }}>{t(`workspace.collection.${blocker.collection}` as MessageKey)} · {blocker.id} · {t(blocker.state === 'active' ? 'evidence.provenance.enum.active' : blocker.state === 'retired' ? 'evidence.provenance.enum.retired' : 'evidence.provenance.historical')}</li>)}</ul>
          {traceRevisionId && <Link to={`/evidence?view=provenance&evidenceRevision=${encodeURIComponent(traceRevisionId)}`} onClick={() => setDeleting(null)}>{t('evidence.delete.trace')}</Link>}
        </> : <p>{t('evidence.delete.unusedNotice')}</p>}
      </Modal>
    </div>
  )
}
