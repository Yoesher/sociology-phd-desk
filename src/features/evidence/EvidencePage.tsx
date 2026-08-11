import { useMemo, useState, type FormEvent } from 'react'
import { BookOpenCheck, Link2, Scale, ShieldQuestion } from 'lucide-react'
import {
  EVIDENCE_TYPES,
  SUPPORT_LEVELS,
  type EvidenceItem,
} from '../../models/domain'
import { useWorkspace } from '../../hooks/useWorkspace'
import { entityMeta, projectLabel, truncate } from '../../app/format'
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

export function EvidencePage() {
  const { data, updateData } = useWorkspace()
  const [search, setSearch] = useState('')
  const [projectFilter, setProjectFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [supportFilter, setSupportFilter] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<EvidenceItem | null>(null)
  const [deleting, setDeleting] = useState<EvidenceItem | null>(null)
  const [draft, setDraft] = useState<EvidenceDraft>(emptyDraft)

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return (
      data?.evidence.filter((item) => {
        const corpus = `${item.claim} ${item.source} ${item.finding} ${item.locator} ${item.limitations}`.toLowerCase()
        return (
          (!query || corpus.includes(query)) &&
          (!projectFilter || item.projectId === projectFilter) &&
          (!typeFilter || item.evidenceType === typeFilter) &&
          (!supportFilter || item.supportLevel === supportFilter)
        )
      }) ?? []
    )
  }, [data?.evidence, projectFilter, search, supportFilter, typeFilter])

  if (!data) return null

  const openCreate = () => {
    setEditing(null)
    setDraft({ ...emptyDraft(), projectId: data.workspace.activeProjectId || data.projects[0]?.id || '' })
    setFormOpen(true)
  }

  const openEdit = (item: EvidenceItem) => {
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
    if (editing) {
      await updateData((current) => ({
        ...current,
        evidence: current.evidence.map((item) =>
          item.id === editing.id ? { ...item, ...draft, updatedAt: new Date().toISOString() } : item,
        ),
      }))
    } else {
      const record: EvidenceItem = { ...entityMeta('evidence'), ...draft }
      await updateData((current) => ({ ...current, evidence: [record, ...current.evidence] }))
    }
    setFormOpen(false)
    setEditing(null)
  }

  const deleteEvidence = async () => {
    if (!deleting) return
    await updateData((current) => ({
      ...current,
      evidence: current.evidence.filter((item) => item.id !== deleting.id),
    }))
    setDeleting(null)
  }

  const strong = data.evidence.filter((item) => item.supportLevel === 'Strong').length
  const contradictory = data.evidence.filter((item) => item.supportLevel === 'Contradictory').length
  const unresolved = data.evidence.filter((item) => ['Weak', 'Unclear'].includes(item.supportLevel)).length
  const inManuscript = data.evidence.filter((item) => item.manuscriptLocation.trim()).length

  return (
    <div className="page">
      <PageHeader
        index="06"
        eyebrow="Claim provenance"
        title="Evidence ledger"
        description="Trace each analytical claim backward to an exact source, finding, strength judgment, limitation, and manuscript location."
        actions={<AddButton onClick={openCreate}>Add evidence</AddButton>}
      />

      <div className="stats-grid stats-grid--four">
        <StatCard label="Evidence items" value={data.evidence.length} detail="traceable claim records" tone="blue" />
        <StatCard label="Strong support" value={strong} detail="highest confidence tier" tone="success" />
        <StatCard label="Contradictions" value={contradictory} detail="counter-evidence retained" tone={contradictory ? 'danger' : 'neutral'} />
        <StatCard label="In manuscript" value={inManuscript} detail={`${unresolved} need clarification`} tone="violet" />
      </div>

      <section className="evidence-principle">
        <div className="evidence-principle__icon"><Scale size={20} /></div>
        <div>
          <strong>A ledger, not a highlight collection</strong>
          <p>Contradictory and weak evidence belongs beside strong support. Limitations are part of the record, not a footnote to add later.</p>
        </div>
        <div className="evidence-chain" aria-label="Evidence traceability chain">
          <span>Claim</span><Link2 size={13} /><span>Exact source</span><Link2 size={13} /><span>Finding</span><Link2 size={13} /><span>Manuscript</span>
        </div>
      </section>

      <section className="panel">
        <div className="toolbar toolbar--wrap">
          <SearchField value={search} onChange={setSearch} placeholder="Search claims, sources, or findings" />
          <ProjectSelect projects={data.projects} value={projectFilter} onChange={setProjectFilter} includeAll />
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} aria-label="Filter by evidence type">
            <option value="">All evidence types</option>
            {EVIDENCE_TYPES.map((type) => <option key={type}>{type}</option>)}
          </select>
          <select value={supportFilter} onChange={(event) => setSupportFilter(event.target.value)} aria-label="Filter by support level">
            <option value="">All support levels</option>
            {SUPPORT_LEVELS.map((level) => <option key={level}>{level}</option>)}
          </select>
          <span className="toolbar__count">{filtered.length} items</span>
        </div>

        {filtered.length ? (
          <div className="evidence-list">
            {filtered.map((item) => (
              <article className="evidence-card" key={item.id}>
                <div className="evidence-card__rail"><span>{item.evidenceType.slice(0, 1)}</span></div>
                <div className="evidence-card__body">
                  <header>
                    <div>
                      <div className="badge-row">
                        <Badge tone={supportTone(item.supportLevel)}>{item.supportLevel}</Badge>
                        <Badge>{item.evidenceType}</Badge>
                        <span>{projectLabel(data.projects, item.projectId)}</span>
                      </div>
                      <h3>{item.claim}</h3>
                    </div>
                    <TableActions onEdit={() => openEdit(item)} onDelete={() => setDeleting(item)} />
                  </header>
                  <div className="evidence-card__finding">
                    <BookOpenCheck size={16} />
                    <div><span>Finding</span><p>{item.finding || 'No finding recorded.'}</p></div>
                  </div>
                  <dl className="evidence-card__meta">
                    <div><dt>Source</dt><dd>{item.source || 'Not recorded'}</dd></div>
                    <div><dt>Locator</dt><dd>{item.locator || 'Not recorded'}</dd></div>
                    <div><dt>Manuscript</dt><dd>{item.manuscriptLocation || 'Not placed'}</dd></div>
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
            title={data.evidence.length ? 'No evidence matches these filters' : 'Build the first traceable claim'}
            description={data.evidence.length ? 'Adjust the project, evidence type, support level, or search terms.' : 'Start from a claim and connect it to the exact empirical or theoretical source.'}
            action={data.evidence.length ? <Button onClick={() => { setSearch(''); setProjectFilter(''); setTypeFilter(''); setSupportFilter('') }}>Clear filters</Button> : <AddButton onClick={openCreate}>Add evidence item</AddButton>}
          />
        )}
      </section>

      <Modal
        open={formOpen}
        title={editing ? 'Edit evidence item' : 'Add evidence item'}
        description="Keep the claim distinct from the source finding, and record what the evidence cannot establish."
        onClose={() => setFormOpen(false)}
        size="lg"
        footer={<><Button onClick={() => setFormOpen(false)}>Cancel</Button><Button variant="primary" type="submit" form="evidence-form">{editing ? 'Save changes' : 'Add evidence'}</Button></>}
      >
        <form id="evidence-form" className="form-grid" onSubmit={(event) => void saveEvidence(event)}>
          <Field label="Project" required><ProjectSelect required projects={data.projects} value={draft.projectId} onChange={(projectId) => setDraft({ ...draft, projectId })} /></Field>
          <Field label="Evidence type" required><select value={draft.evidenceType} onChange={(event) => setDraft({ ...draft, evidenceType: event.target.value as EvidenceItem['evidenceType'] })}>{EVIDENCE_TYPES.map((type) => <option key={type}>{type}</option>)}</select></Field>
          <Field label="Claim" required className="form-span-2"><textarea autoFocus required rows={3} value={draft.claim} onChange={(event) => setDraft({ ...draft, claim: event.target.value })} placeholder="The analytical statement this item bears on" /></Field>
          <Field label="Source" required><input required value={draft.source} onChange={(event) => setDraft({ ...draft, source: event.target.value })} placeholder="Citation, interview alias, model, or document" /></Field>
          <Field label="Exact locator"><input value={draft.locator} onChange={(event) => setDraft({ ...draft, locator: event.target.value })} placeholder="Page, table, quotation line, model, or timestamp" /></Field>
          <Field label="Finding" required className="form-span-2"><textarea required rows={4} value={draft.finding} onChange={(event) => setDraft({ ...draft, finding: event.target.value })} placeholder="What this source or analysis actually shows" /></Field>
          <Field label="Support level" required><select value={draft.supportLevel} onChange={(event) => setDraft({ ...draft, supportLevel: event.target.value as EvidenceItem['supportLevel'] })}>{SUPPORT_LEVELS.map((level) => <option key={level}>{level}</option>)}</select></Field>
          <Field label="Manuscript location"><input value={draft.manuscriptLocation} onChange={(event) => setDraft({ ...draft, manuscriptLocation: event.target.value })} placeholder="e.g. Results §3.2, paragraph 4" /></Field>
          <Field label="Limitations" className="form-span-2"><textarea rows={4} value={draft.limitations} onChange={(event) => setDraft({ ...draft, limitations: event.target.value })} placeholder="Scope conditions, measurement limits, alternative explanations, or uncertainty" /></Field>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete this evidence item?"
        description="The claim-to-source trace will be permanently removed from this local workspace."
        confirmLabel="Delete evidence"
        onCancel={() => setDeleting(null)}
        onConfirm={deleteEvidence}
      />
    </div>
  )
}
