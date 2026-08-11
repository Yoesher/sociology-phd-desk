import { useMemo, useState, type FormEvent } from 'react'
import { ArrowRight, Link2, Network } from 'lucide-react'
import {
  CLAIM_STATUSES,
  RESEARCH_QUESTION_STATUSES,
  type Claim,
  type ClaimQuestionLink,
  type ClaimStatus,
  type ResearchQuestion,
  type ResearchQuestionStatus,
} from '../../models/domain'
import { entityMeta, truncate } from '../../app/format'
import { useWorkspace } from '../../hooks/useWorkspace'
import { useI18n } from '../../i18n'
import {
  AddButton,
  Badge,
  Button,
  ConfirmDialog,
  Field,
  Modal,
  SectionHeader,
  type Tone,
} from '../../components/ui'

const RESEARCH_TEXT_MAX_LENGTH = 250_000

const questionStatusLabelKeys = {
  draft: 'projects.graph.status.question.draft',
  active: 'projects.graph.status.question.active',
  addressed: 'projects.graph.status.question.addressed',
  retired: 'projects.graph.status.question.retired',
} as const satisfies Record<ResearchQuestionStatus, string>

const claimStatusLabelKeys = {
  draft: 'projects.graph.status.claim.draft',
  active: 'projects.graph.status.claim.active',
  superseded: 'projects.graph.status.claim.superseded',
  retired: 'projects.graph.status.claim.retired',
} as const satisfies Record<ClaimStatus, string>

interface QuestionDraft {
  text: string
  status: ResearchQuestionStatus
  notes: string
}

interface ClaimDraft {
  text: string
  status: ClaimStatus
  notes: string
  researchQuestionIds: string[]
}

const emptyQuestionDraft = (): QuestionDraft => ({ text: '', status: 'draft', notes: '' })
const emptyClaimDraft = (): ClaimDraft => ({ text: '', status: 'draft', notes: '', researchQuestionIds: [] })

function questionTone(status: ResearchQuestionStatus): Tone {
  if (status === 'addressed') return 'success'
  if (status === 'active') return 'blue'
  if (status === 'retired') return 'neutral'
  return 'warning'
}

function claimTone(status: ClaimStatus): Tone {
  if (status === 'active') return 'accent'
  if (status === 'superseded') return 'violet'
  if (status === 'retired') return 'neutral'
  return 'warning'
}

export function ResearchGraphWorkspace({ projectId }: { projectId: string }) {
  const { data, updateData } = useWorkspace()
  const { t, formatDate, formatNumber } = useI18n()
  const [questionFormOpen, setQuestionFormOpen] = useState(false)
  const [claimFormOpen, setClaimFormOpen] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<ResearchQuestion | null>(null)
  const [editingClaim, setEditingClaim] = useState<Claim | null>(null)
  const [viewingQuestion, setViewingQuestion] = useState<ResearchQuestion | null>(null)
  const [viewingClaim, setViewingClaim] = useState<Claim | null>(null)
  const [deletingQuestion, setDeletingQuestion] = useState<ResearchQuestion | null>(null)
  const [deletingClaim, setDeletingClaim] = useState<Claim | null>(null)
  const [blockedDelete, setBlockedDelete] = useState<{ kind: 'question' | 'claim'; count: number } | null>(null)
  const [questionDraft, setQuestionDraft] = useState<QuestionDraft>(emptyQuestionDraft)
  const [claimDraft, setClaimDraft] = useState<ClaimDraft>(emptyClaimDraft)

  const projectQuestions = useMemo(
    () => data?.researchQuestions.filter((question) => question.projectId === projectId) ?? [],
    [data?.researchQuestions, projectId],
  )
  const projectClaims = useMemo(
    () => data?.claims.filter((claim) => claim.projectId === projectId) ?? [],
    [data?.claims, projectId],
  )
  const projectLinks = useMemo(
    () => data?.claimQuestionLinks.filter((link) => link.projectId === projectId) ?? [],
    [data?.claimQuestionLinks, projectId],
  )

  if (!data) return null

  const questionStatusLabel = (status: ResearchQuestionStatus) => t(questionStatusLabelKeys[status])
  const claimStatusLabel = (status: ClaimStatus) => t(claimStatusLabelKeys[status])

  const openQuestionCreate = () => {
    setEditingQuestion(null)
    setQuestionDraft(emptyQuestionDraft())
    setQuestionFormOpen(true)
  }

  const openQuestionEdit = (question: ResearchQuestion) => {
    setViewingQuestion(null)
    setEditingQuestion(question)
    setQuestionDraft({ text: question.text, status: question.status, notes: question.notes })
    setQuestionFormOpen(true)
  }

  const openClaimCreate = () => {
    setEditingClaim(null)
    setClaimDraft(emptyClaimDraft())
    setClaimFormOpen(true)
  }

  const openClaimEdit = (claim: Claim) => {
    setViewingClaim(null)
    setEditingClaim(claim)
    setClaimDraft({
      text: claim.text,
      status: claim.status,
      notes: claim.notes,
      researchQuestionIds: projectLinks
        .filter((link) => link.claimId === claim.id)
        .map((link) => link.researchQuestionId),
    })
    setClaimFormOpen(true)
  }

  const saveQuestion = async (event: FormEvent) => {
    event.preventDefault()
    const text = questionDraft.text.trim()
    const notes = questionDraft.notes.trim()
    if (!text) return

    if (editingQuestion) {
      await updateData((current) => ({
        ...current,
        researchQuestions: current.researchQuestions.map((question) =>
          question.id === editingQuestion.id && question.projectId === projectId
            ? { ...question, text, notes, status: questionDraft.status, updatedAt: new Date().toISOString() }
            : question,
        ),
      }))
    } else {
      const record: ResearchQuestion = {
        ...entityMeta('research-question'),
        projectId,
        text,
        status: questionDraft.status,
        notes,
      }
      await updateData((current) => ({
        ...current,
        researchQuestions: [record, ...current.researchQuestions],
      }))
    }

    setQuestionFormOpen(false)
    setEditingQuestion(null)
  }

  const saveClaim = async (event: FormEvent) => {
    event.preventDefault()
    const text = claimDraft.text.trim()
    const notes = claimDraft.notes.trim()
    if (!text) return

    await updateData((current) => {
      const allowedQuestionIds = new Set(
        current.researchQuestions
          .filter((question) => question.projectId === projectId)
          .map((question) => question.id),
      )
      const selectedQuestionIds = [...new Set(claimDraft.researchQuestionIds)]
        .filter((questionId) => allowedQuestionIds.has(questionId))
      const newClaimMeta = editingClaim ? null : entityMeta('claim')
      const claimId = editingClaim?.id ?? newClaimMeta!.id
      const existingLinks = new Map(
        current.claimQuestionLinks
          .filter((link) => link.projectId === projectId && link.claimId === claimId)
          .map((link) => [link.researchQuestionId, link]),
      )
      const nextLinks: ClaimQuestionLink[] = selectedQuestionIds.map((researchQuestionId) =>
        existingLinks.get(researchQuestionId) ?? {
          ...entityMeta('claim-question-link'),
          projectId,
          claimId,
          researchQuestionId,
        },
      )

      if (editingClaim) {
        return {
          ...current,
          claims: current.claims.map((claim) =>
            claim.id === editingClaim.id && claim.projectId === projectId
              ? { ...claim, text, notes, status: claimDraft.status, updatedAt: new Date().toISOString() }
              : claim,
          ),
          claimQuestionLinks: [
            ...current.claimQuestionLinks.filter(
              (link) => !(link.projectId === projectId && link.claimId === editingClaim.id),
            ),
            ...nextLinks,
          ],
        }
      }

      const record: Claim = {
        ...newClaimMeta!,
        projectId,
        text,
        status: claimDraft.status,
        notes,
      }
      return {
        ...current,
        claims: [record, ...current.claims],
        claimQuestionLinks: [...current.claimQuestionLinks, ...nextLinks],
      }
    })

    setClaimFormOpen(false)
    setEditingClaim(null)
  }

  const requestQuestionDelete = (question: ResearchQuestion) => {
    const count = projectLinks.filter((link) => link.researchQuestionId === question.id).length
    if (count) {
      setBlockedDelete({ kind: 'question', count })
      return
    }
    setDeletingQuestion(question)
  }

  const requestClaimDelete = (claim: Claim) => {
    const count = projectLinks.filter((link) => link.claimId === claim.id).length
    if (count) {
      setBlockedDelete({ kind: 'claim', count })
      return
    }
    setDeletingClaim(claim)
  }

  const deleteQuestion = async () => {
    if (!deletingQuestion) return
    const questionId = deletingQuestion.id
    await updateData((current) => {
      if (current.claimQuestionLinks.some((link) => link.researchQuestionId === questionId)) return current
      return {
        ...current,
        researchQuestions: current.researchQuestions.filter(
          (question) => !(question.id === questionId && question.projectId === projectId),
        ),
      }
    })
    setDeletingQuestion(null)
    setViewingQuestion(null)
  }

  const deleteClaim = async () => {
    if (!deletingClaim) return
    const claimId = deletingClaim.id
    await updateData((current) => {
      if (current.claimQuestionLinks.some((link) => link.claimId === claimId)) return current
      return {
        ...current,
        claims: current.claims.filter((claim) => !(claim.id === claimId && claim.projectId === projectId)),
      }
    })
    setDeletingClaim(null)
    setViewingClaim(null)
  }

  const toggleQuestionLink = (questionId: string) => {
    setClaimDraft((current) => ({
      ...current,
      researchQuestionIds: current.researchQuestionIds.includes(questionId)
        ? current.researchQuestionIds.filter((id) => id !== questionId)
        : [...current.researchQuestionIds, questionId],
    }))
  }

  const claimsForQuestion = (questionId: string) => {
    const claimIds = new Set(
      projectLinks
        .filter((link) => link.researchQuestionId === questionId)
        .map((link) => link.claimId),
    )
    return projectClaims.filter((claim) => claimIds.has(claim.id))
  }

  const questionsForClaim = (claimId: string) => {
    const questionIds = new Set(
      projectLinks
        .filter((link) => link.claimId === claimId)
        .map((link) => link.researchQuestionId),
    )
    return projectQuestions.filter((question) => questionIds.has(question.id))
  }

  const unlinkedClaims = projectClaims.filter(
    (claim) => !projectLinks.some((link) => link.claimId === claim.id),
  )

  return (
    <div className="research-graph-workspace">
      <section aria-labelledby="research-questions-title">
        <SectionHeader
          title={t('projects.graph.questions.title')}
          description={t('projects.graph.questions.description')}
          action={<AddButton size="sm" onClick={openQuestionCreate}>{t('projects.graph.questions.add')}</AddButton>}
        />
        <span id="research-questions-title" className="sr-only">{t('projects.graph.questions.title')}</span>
        {projectQuestions.length ? (
          <div className="research-object-list" role="list">
            {projectQuestions.map((question) => {
              const linkedClaimCount = projectLinks.filter((link) => link.researchQuestionId === question.id).length
              const shortText = truncate(question.text, 72)
              return (
                <article key={question.id} className="research-object-card" role="listitem">
                  <div className="research-object-card__content">
                    <button type="button" className="research-object-card__title" onClick={() => setViewingQuestion(question)}>
                      {question.text}
                    </button>
                    {question.notes && <p>{truncate(question.notes, 150)}</p>}
                    <span>{linkedClaimCount
                      ? t('projects.graph.questions.linkedClaims', { count: formatNumber(linkedClaimCount) })
                      : t('projects.graph.questions.noLinkedClaims')}</span>
                  </div>
                  <Badge tone={questionTone(question.status)}>{questionStatusLabel(question.status)}</Badge>
                  <div className="research-object-card__actions">
                    <Button size="sm" variant="ghost" aria-label={t('projects.graph.actions.viewQuestion', { text: shortText })} onClick={() => setViewingQuestion(question)}>{t('common.view')}</Button>
                    <Button size="sm" variant="ghost" aria-label={t('projects.graph.actions.editQuestion', { text: shortText })} onClick={() => openQuestionEdit(question)}>{t('common.edit')}</Button>
                    <Button size="sm" variant="ghost" className="text-danger" aria-label={t('projects.graph.actions.deleteQuestion', { text: shortText })} onClick={() => requestQuestionDelete(question)}>{t('common.delete')}</Button>
                  </div>
                </article>
              )
            })}
          </div>
        ) : <p className="research-object-empty">{t('projects.graph.questions.empty')}</p>}
      </section>

      <section aria-labelledby="research-claims-title">
        <SectionHeader
          title={t('projects.graph.claims.title')}
          description={t('projects.graph.claims.description')}
          action={<AddButton size="sm" onClick={openClaimCreate}>{t('projects.graph.claims.add')}</AddButton>}
        />
        <span id="research-claims-title" className="sr-only">{t('projects.graph.claims.title')}</span>
        {projectClaims.length ? (
          <div className="research-object-list" role="list">
            {projectClaims.map((claim) => {
              const linkedQuestionCount = projectLinks.filter((link) => link.claimId === claim.id).length
              const shortText = truncate(claim.text, 72)
              return (
                <article key={claim.id} className="research-object-card" role="listitem">
                  <div className="research-object-card__content">
                    <button type="button" className="research-object-card__title" onClick={() => setViewingClaim(claim)}>
                      {claim.text}
                    </button>
                    {claim.notes && <p>{truncate(claim.notes, 150)}</p>}
                    <span>{linkedQuestionCount
                      ? t('projects.graph.claims.linkedQuestions', { count: formatNumber(linkedQuestionCount) })
                      : t('projects.graph.claims.noLinkedQuestions')}</span>
                  </div>
                  <Badge tone={claimTone(claim.status)}>{claimStatusLabel(claim.status)}</Badge>
                  <div className="research-object-card__actions">
                    <Button size="sm" variant="ghost" aria-label={t('projects.graph.actions.viewClaim', { text: shortText })} onClick={() => setViewingClaim(claim)}>{t('common.view')}</Button>
                    <Button size="sm" variant="ghost" aria-label={t('projects.graph.actions.editClaim', { text: shortText })} onClick={() => openClaimEdit(claim)}>{t('common.edit')}</Button>
                    <Button size="sm" variant="ghost" className="text-danger" aria-label={t('projects.graph.actions.deleteClaim', { text: shortText })} onClick={() => requestClaimDelete(claim)}>{t('common.delete')}</Button>
                  </div>
                </article>
              )
            })}
          </div>
        ) : <p className="research-object-empty">{t('projects.graph.claims.empty')}</p>}
      </section>

      <section aria-labelledby="research-graph-title">
        <SectionHeader
          title={t('projects.graph.map.title')}
          description={t('projects.graph.map.description')}
        />
        <span id="research-graph-title" className="sr-only">{t('projects.graph.map.title')}</span>
        {projectQuestions.length || projectClaims.length ? (
          <div className="research-graph" role="list" aria-label={t('projects.graph.map.aria')}>
            {projectQuestions.map((question) => {
              const linkedClaims = claimsForQuestion(question.id)
              return (
                <article key={question.id} className="research-graph__row" role="listitem">
                  <div className="research-graph__question">
                    <span>Q</span>
                    <strong>{question.text}</strong>
                  </div>
                  <ArrowRight size={16} aria-hidden="true" />
                  <div className="research-graph__claims">
                    {linkedClaims.length ? linkedClaims.map((claim) => (
                      <button key={claim.id} type="button" onClick={() => setViewingClaim(claim)}>
                        <Network size={14} aria-hidden="true" />
                        <span>{claim.text}</span>
                        <Badge tone={claimTone(claim.status)}>{claimStatusLabel(claim.status)}</Badge>
                      </button>
                    )) : <p>{t('projects.graph.map.noClaimsForQuestion')}</p>}
                  </div>
                </article>
              )
            })}
            {unlinkedClaims.length > 0 && (
              <div className="research-graph__unlinked" role="listitem">
                <strong>{t('projects.graph.map.unlinkedClaims')}</strong>
                {unlinkedClaims.map((claim) => (
                  <button key={claim.id} type="button" onClick={() => setViewingClaim(claim)}>
                    <Link2 size={14} aria-hidden="true" />
                    <span>{claim.text}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : <p className="research-object-empty">{t('projects.graph.map.empty')}</p>}
      </section>

      <Modal
        open={questionFormOpen}
        title={t(editingQuestion ? 'projects.graph.form.editQuestionTitle' : 'projects.graph.form.newQuestionTitle')}
        description={t('projects.graph.form.questionDescription')}
        onClose={() => { setQuestionFormOpen(false); setEditingQuestion(null) }}
        size="lg"
        footer={
          <>
            <Button onClick={() => { setQuestionFormOpen(false); setEditingQuestion(null) }}>{t('common.cancel')}</Button>
            <Button type="submit" form="research-question-form" variant="primary">
              {t(editingQuestion ? 'projects.graph.form.saveQuestion' : 'projects.graph.form.createQuestion')}
            </Button>
          </>
        }
      >
        <form id="research-question-form" className="form-grid" onSubmit={(event) => void saveQuestion(event)}>
          <Field label={t('projects.graph.form.questionText')} required className="form-span-2">
            <textarea autoFocus required rows={4} maxLength={RESEARCH_TEXT_MAX_LENGTH} value={questionDraft.text} onChange={(event) => setQuestionDraft({ ...questionDraft, text: event.target.value })} placeholder={t('projects.graph.form.questionPlaceholder')} />
          </Field>
          <Field label={t('projects.graph.form.status')} required>
            <select value={questionDraft.status} onChange={(event) => setQuestionDraft({ ...questionDraft, status: event.target.value as ResearchQuestionStatus })}>
              {RESEARCH_QUESTION_STATUSES.map((status) => <option key={status} value={status}>{questionStatusLabel(status)}</option>)}
            </select>
          </Field>
          <Field label={t('projects.graph.form.notes')} className="form-span-2">
            <textarea rows={4} maxLength={RESEARCH_TEXT_MAX_LENGTH} value={questionDraft.notes} onChange={(event) => setQuestionDraft({ ...questionDraft, notes: event.target.value })} placeholder={t('projects.graph.form.questionNotesPlaceholder')} />
          </Field>
        </form>
      </Modal>

      <Modal
        open={claimFormOpen}
        title={t(editingClaim ? 'projects.graph.form.editClaimTitle' : 'projects.graph.form.newClaimTitle')}
        description={t('projects.graph.form.claimDescription')}
        onClose={() => { setClaimFormOpen(false); setEditingClaim(null) }}
        size="lg"
        footer={
          <>
            <Button onClick={() => { setClaimFormOpen(false); setEditingClaim(null) }}>{t('common.cancel')}</Button>
            <Button type="submit" form="research-claim-form" variant="primary">
              {t(editingClaim ? 'projects.graph.form.saveClaim' : 'projects.graph.form.createClaim')}
            </Button>
          </>
        }
      >
        <form id="research-claim-form" className="form-grid" onSubmit={(event) => void saveClaim(event)}>
          <Field label={t('projects.graph.form.claimText')} required className="form-span-2">
            <textarea autoFocus required rows={4} maxLength={RESEARCH_TEXT_MAX_LENGTH} value={claimDraft.text} onChange={(event) => setClaimDraft({ ...claimDraft, text: event.target.value })} placeholder={t('projects.graph.form.claimPlaceholder')} />
          </Field>
          <Field label={t('projects.graph.form.status')} required>
            <select value={claimDraft.status} onChange={(event) => setClaimDraft({ ...claimDraft, status: event.target.value as ClaimStatus })}>
              {CLAIM_STATUSES.map((status) => <option key={status} value={status}>{claimStatusLabel(status)}</option>)}
            </select>
          </Field>
          <Field label={t('projects.graph.form.notes')} className="form-span-2">
            <textarea rows={4} maxLength={RESEARCH_TEXT_MAX_LENGTH} value={claimDraft.notes} onChange={(event) => setClaimDraft({ ...claimDraft, notes: event.target.value })} placeholder={t('projects.graph.form.claimNotesPlaceholder')} />
          </Field>
          <fieldset className="research-link-selector form-span-2">
            <legend>{t('projects.graph.form.questionLinks')}</legend>
            <p>{t('projects.graph.form.questionLinksHint')}</p>
            {projectQuestions.length ? (
              <div>
                {projectQuestions.map((question) => (
                  <label key={question.id}>
                    <input
                      type="checkbox"
                      checked={claimDraft.researchQuestionIds.includes(question.id)}
                      onChange={() => toggleQuestionLink(question.id)}
                    />
                    <span><strong>{question.text}</strong><small>{questionStatusLabel(question.status)}</small></span>
                  </label>
                ))}
              </div>
            ) : <span className="quiet-copy">{t('projects.graph.form.noQuestions')}</span>}
          </fieldset>
        </form>
      </Modal>

      {viewingQuestion && (
        <Modal
          open
          title={t('projects.graph.view.questionTitle')}
          description={viewingQuestion.text}
          onClose={() => setViewingQuestion(null)}
          size="md"
          footer={<Button variant="primary" onClick={() => openQuestionEdit(viewingQuestion)}>{t('common.edit')}</Button>}
        >
          <dl className="research-object-detail">
            <div><dt>{t('projects.graph.view.status')}</dt><dd><Badge tone={questionTone(viewingQuestion.status)}>{questionStatusLabel(viewingQuestion.status)}</Badge></dd></div>
            <div><dt>{t('projects.graph.view.notes')}</dt><dd>{viewingQuestion.notes || t('projects.graph.view.noNotes')}</dd></div>
            <div><dt>{t('projects.graph.view.linkedClaims')}</dt><dd>{claimsForQuestion(viewingQuestion.id).length
              ? claimsForQuestion(viewingQuestion.id).map((claim) => claim.text).join(t('projects.graph.view.linkSeparator'))
              : t('projects.graph.questions.noLinkedClaims')}</dd></div>
            <div><dt>{t('projects.graph.view.created')}</dt><dd>{formatDate(viewingQuestion.createdAt)}</dd></div>
            <div><dt>{t('projects.graph.view.updated')}</dt><dd>{formatDate(viewingQuestion.updatedAt)}</dd></div>
          </dl>
        </Modal>
      )}

      {viewingClaim && (
        <Modal
          open
          title={t('projects.graph.view.claimTitle')}
          description={viewingClaim.text}
          onClose={() => setViewingClaim(null)}
          size="md"
          footer={<Button variant="primary" onClick={() => openClaimEdit(viewingClaim)}>{t('common.edit')}</Button>}
        >
          <dl className="research-object-detail">
            <div><dt>{t('projects.graph.view.status')}</dt><dd><Badge tone={claimTone(viewingClaim.status)}>{claimStatusLabel(viewingClaim.status)}</Badge></dd></div>
            <div><dt>{t('projects.graph.view.notes')}</dt><dd>{viewingClaim.notes || t('projects.graph.view.noNotes')}</dd></div>
            <div><dt>{t('projects.graph.view.linkedQuestions')}</dt><dd>{questionsForClaim(viewingClaim.id).length
              ? questionsForClaim(viewingClaim.id).map((question) => question.text).join(t('projects.graph.view.linkSeparator'))
              : t('projects.graph.claims.noLinkedQuestions')}</dd></div>
            <div><dt>{t('projects.graph.view.created')}</dt><dd>{formatDate(viewingClaim.createdAt)}</dd></div>
            <div><dt>{t('projects.graph.view.updated')}</dt><dd>{formatDate(viewingClaim.updatedAt)}</dd></div>
          </dl>
        </Modal>
      )}

      <ConfirmDialog
        open={Boolean(deletingQuestion)}
        title={t('projects.graph.delete.questionTitle')}
        description={t('projects.graph.delete.questionDescription')}
        confirmLabel={t('projects.graph.delete.questionConfirm')}
        onCancel={() => setDeletingQuestion(null)}
        onConfirm={deleteQuestion}
      />
      <ConfirmDialog
        open={Boolean(deletingClaim)}
        title={t('projects.graph.delete.claimTitle')}
        description={t('projects.graph.delete.claimDescription')}
        confirmLabel={t('projects.graph.delete.claimConfirm')}
        onCancel={() => setDeletingClaim(null)}
        onConfirm={deleteClaim}
      />
      <Modal
        open={Boolean(blockedDelete)}
        title={t('projects.graph.delete.blockedTitle')}
        description={blockedDelete
          ? t(blockedDelete.kind === 'question' ? 'projects.graph.delete.blockedQuestion' : 'projects.graph.delete.blockedClaim', { count: formatNumber(blockedDelete.count) })
          : undefined}
        onClose={() => setBlockedDelete(null)}
        size="sm"
        footer={<Button variant="primary" onClick={() => setBlockedDelete(null)}>{t('projects.graph.delete.keep')}</Button>}
      >
        <div className="confirm-panel confirm-panel--primary">
          <Link2 size={20} aria-hidden="true" />
          <p>{t('projects.graph.delete.blockedBody')}</p>
        </div>
      </Modal>
    </div>
  )
}
