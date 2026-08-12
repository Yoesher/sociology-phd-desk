import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { BookOpenText, Link2, Lightbulb } from 'lucide-react'
import { entityMeta, truncate } from '../../app/format'
import { ProjectSelect } from '../../components/ProjectSelect'
import {
  AddButton,
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  Modal,
  SectionHeader,
} from '../../components/ui'
import { useWorkspace } from '../../hooks/useWorkspace'
import { useI18n, type MessageKey } from '../../i18n'
import {
  THEORY_MEMO_TYPES,
  type TheoryMemo,
  type TheoryMemoType,
} from '../../models/domain'
import { prioritizeTheoryProjects, type TheoryView } from './theoryViews'

const MEMO_TITLE_MAX_LENGTH = 1_000
const MEMO_CONTENT_MAX_LENGTH = 250_000
type MemoView = Extract<TheoryView, 'concepts' | 'mechanisms' | 'dialogue' | 'counterarguments' | 'memos'>

const memoViewConfig: Record<MemoView, {
  titleKey: MessageKey
  descriptionKey: MessageKey
  types: readonly TheoryMemoType[]
}> = {
  concepts: {
    titleKey: 'theory.memo.conceptsTitle',
    descriptionKey: 'theory.memo.conceptsDescription',
    types: ['concept'],
  },
  mechanisms: {
    titleKey: 'theory.memo.mechanismsTitle',
    descriptionKey: 'theory.memo.mechanismsDescription',
    types: ['mechanism'],
  },
  dialogue: {
    titleKey: 'theory.memo.dialogueTitle',
    descriptionKey: 'theory.memo.dialogueDescription',
    types: ['dialogue'],
  },
  counterarguments: {
    titleKey: 'theory.memo.counterargumentsTitle',
    descriptionKey: 'theory.memo.counterargumentsDescription',
    types: ['counterargument', 'boundary'],
  },
  memos: {
    titleKey: 'theory.memo.allTitle',
    descriptionKey: 'theory.memo.allDescription',
    types: THEORY_MEMO_TYPES,
  },
}

const promptKeys = {
  concept: [
    'theory.prompts.concept.1', 'theory.prompts.concept.2', 'theory.prompts.concept.3',
    'theory.prompts.concept.4', 'theory.prompts.concept.5', 'theory.prompts.concept.6',
  ],
  mechanism: [
    'theory.prompts.mechanism.1', 'theory.prompts.mechanism.2', 'theory.prompts.mechanism.3',
    'theory.prompts.mechanism.4', 'theory.prompts.mechanism.5', 'theory.prompts.mechanism.6',
  ],
  dialogue: [
    'theory.prompts.dialogue.1', 'theory.prompts.dialogue.2', 'theory.prompts.dialogue.3',
    'theory.prompts.dialogue.4', 'theory.prompts.dialogue.5',
  ],
  counterargument: [
    'theory.prompts.counterargument.1', 'theory.prompts.counterargument.2',
    'theory.prompts.counterargument.3', 'theory.prompts.counterargument.4',
  ],
  boundary: [
    'theory.prompts.boundary.1', 'theory.prompts.boundary.2',
    'theory.prompts.boundary.3', 'theory.prompts.boundary.4',
  ],
  synthesis: [
    'theory.prompts.synthesis.1', 'theory.prompts.synthesis.2', 'theory.prompts.synthesis.3',
    'theory.prompts.synthesis.4', 'theory.prompts.synthesis.5', 'theory.prompts.synthesis.6',
    'theory.prompts.synthesis.7',
  ],
} as const satisfies Record<TheoryMemoType, readonly MessageKey[]>

interface MemoDraft {
  projectId: string
  memoType: TheoryMemoType
  title: string
  content: string
  relatedQuestionIds: string[]
  relatedClaimIds: string[]
  relatedLiteratureIds: string[]
}

function emptyDraft(projectId: string, memoType: TheoryMemoType): MemoDraft {
  return {
    projectId,
    memoType,
    title: '',
    content: '',
    relatedQuestionIds: [],
    relatedClaimIds: [],
    relatedLiteratureIds: [],
  }
}

function toggleId(values: string[], id: string) {
  return values.includes(id) ? values.filter((value) => value !== id) : [...values, id]
}

export function TheoryMemoWorkspace({
  view,
  projectFilter,
  onProjectFilterChange,
  createRequest = 0,
  onCreateRequestHandled,
}: {
  view: MemoView
  projectFilter: string
  onProjectFilterChange: (projectId: string) => void
  createRequest?: number
  onCreateRequestHandled?: () => void
}) {
  const { data, updateData } = useWorkspace()
  const { t, formatDate, formatNumber, labelEnum } = useI18n()
  const config = memoViewConfig[view]
  const [typeFilter, setTypeFilter] = useState<TheoryMemoType | ''>('')
  const [updatedFilter, setUpdatedFilter] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<TheoryMemo | null>(null)
  const [viewing, setViewing] = useState<TheoryMemo | null>(null)
  const [deleting, setDeleting] = useState<TheoryMemo | null>(null)
  const [draft, setDraft] = useState<MemoDraft>(() => emptyDraft('', config.types[0]))

  const projects = useMemo(() => prioritizeTheoryProjects(data?.projects ?? []), [data?.projects])
  const defaultProjectId = projectFilter || data?.workspace.activeProjectId || projects[0]?.id || ''

  const openCreate = () => {
    setEditing(null)
    setDraft(emptyDraft(defaultProjectId, config.types[0]))
    setFormOpen(true)
  }

  useEffect(() => {
    if (createRequest > 0 && data?.projects.length) {
      openCreate()
      onCreateRequestHandled?.()
    }
    // createRequest is an event token; defaults are intentionally read when it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createRequest])

  const visibleMemos = useMemo(() => {
    const now = Date.now()
    const days = Number(updatedFilter)
    return (data?.theoryMemos ?? [])
      .filter((memo) => config.types.includes(memo.memoType))
      .filter((memo) => !projectFilter || memo.projectId === projectFilter)
      .filter((memo) => view !== 'memos' || !typeFilter || memo.memoType === typeFilter)
      .filter((memo) => {
        if (view !== 'memos' || !days) return true
        const updated = new Date(memo.updatedAt).getTime()
        return Number.isFinite(updated) && now - updated <= days * 86_400_000
      })
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  }, [config.types, data?.theoryMemos, projectFilter, typeFilter, updatedFilter, view])

  if (!data) return null

  const projectLabel = (projectId: string) => {
    const project = data.projects.find((item) => item.id === projectId)
    return project?.shortTitle || project?.title || t('common.notSet')
  }

  const openEdit = (memo: TheoryMemo) => {
    setViewing(null)
    setEditing(memo)
    setDraft({
      projectId: memo.projectId,
      memoType: memo.memoType,
      title: memo.title,
      content: memo.content,
      relatedQuestionIds: [...memo.relatedQuestionIds],
      relatedClaimIds: [...memo.relatedClaimIds],
      relatedLiteratureIds: [...memo.relatedLiteratureIds],
    })
    setFormOpen(true)
  }

  const changeProject = (projectId: string) => {
    setDraft((current) => ({
      ...current,
      projectId,
      relatedQuestionIds: [],
      relatedClaimIds: [],
      relatedLiteratureIds: [],
    }))
  }

  const saveMemo = async (event: FormEvent) => {
    event.preventDefault()
    const title = draft.title.trim()
    const content = draft.content
    if (!title || !draft.projectId) return

    await updateData((current) => {
      if (!current.projects.some((project) => project.id === draft.projectId)) return current
      const allowedQuestionIds = new Set(current.researchQuestions
        .filter((item) => item.projectId === draft.projectId).map((item) => item.id))
      const allowedClaimIds = new Set(current.claims
        .filter((item) => item.projectId === draft.projectId).map((item) => item.id))
      const allowedLiteratureIds = new Set(current.literature
        .filter((item) => item.projectId === draft.projectId).map((item) => item.id))
      const relationships = {
        relatedQuestionIds: [...new Set(draft.relatedQuestionIds)].filter((id) => allowedQuestionIds.has(id)),
        relatedClaimIds: [...new Set(draft.relatedClaimIds)].filter((id) => allowedClaimIds.has(id)),
        relatedLiteratureIds: [...new Set(draft.relatedLiteratureIds)].filter((id) => allowedLiteratureIds.has(id)),
      }

      if (editing) {
        return {
          ...current,
          theoryMemos: current.theoryMemos.map((memo) => memo.id === editing.id
            ? {
                ...memo,
                projectId: draft.projectId,
                memoType: draft.memoType,
                title,
                content,
                ...relationships,
                updatedAt: new Date().toISOString(),
              }
            : memo),
        }
      }

      const record: TheoryMemo = {
        ...entityMeta('theory-memo'),
        projectId: draft.projectId,
        memoType: draft.memoType,
        title,
        content,
        ...relationships,
      }
      return { ...current, theoryMemos: [record, ...current.theoryMemos] }
    })

    setFormOpen(false)
    setEditing(null)
    if (!projectFilter) onProjectFilterChange(draft.projectId)
  }

  const deleteMemo = async () => {
    if (!deleting) return
    const id = deleting.id
    await updateData((current) => ({
      ...current,
      theoryMemos: current.theoryMemos.filter((memo) => memo.id !== id),
    }))
    setDeleting(null)
    setViewing(null)
  }

  const questions = data.researchQuestions.filter((item) => item.projectId === draft.projectId)
  const claims = data.claims.filter((item) => item.projectId === draft.projectId)
  const literature = data.literature.filter((item) => item.projectId === draft.projectId)
  const linkedQuestions = (memo: TheoryMemo) => data.researchQuestions
    .filter((item) => memo.relatedQuestionIds.includes(item.id))
  const linkedClaims = (memo: TheoryMemo) => data.claims
    .filter((item) => memo.relatedClaimIds.includes(item.id))
  const linkedLiterature = (memo: TheoryMemo) => data.literature
    .filter((item) => memo.relatedLiteratureIds.includes(item.id))

  return (
    <section className="panel theory-memo-workspace" aria-labelledby="theory-memo-view-title">
      <SectionHeader
        title={t(config.titleKey)}
        description={t(config.descriptionKey)}
        action={<AddButton size="sm" onClick={openCreate}>{t('theory.actions.newMemo')}</AddButton>}
      />
      <span id="theory-memo-view-title" className="sr-only">{t(config.titleKey)}</span>

      <div className="toolbar toolbar--wrap">
        <ProjectSelect
          projects={projects}
          value={projectFilter}
          onChange={onProjectFilterChange}
          includeAll
          allLabel={t('theory.filters.allProjects')}
          ariaLabel={t('theory.filters.project')}
        />
        {view === 'memos' && (
          <>
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as TheoryMemoType | '')} aria-label={t('theory.filters.type')}>
              <option value="">{t('theory.filters.allTypes')}</option>
              {THEORY_MEMO_TYPES.map((type) => <option key={type} value={type}>{labelEnum(type)}</option>)}
            </select>
            <select value={updatedFilter} onChange={(event) => setUpdatedFilter(event.target.value)} aria-label={t('theory.filters.updated')}>
              <option value="">{t('theory.filters.updatedAny')}</option>
              <option value="7">{t('theory.filters.updated7')}</option>
              <option value="30">{t('theory.filters.updated30')}</option>
              <option value="90">{t('theory.filters.updated90')}</option>
            </select>
          </>
        )}
        <span className="toolbar__count">{t('theory.filters.count', {
          visible: formatNumber(visibleMemos.length),
          total: formatNumber(data.theoryMemos.length),
        })}</span>
      </div>

      {visibleMemos.length ? (
        <div className="theory-memo-grid" role="list">
          {visibleMemos.map((memo) => {
            const memoLiterature = linkedLiterature(memo)
            return (
              <article key={memo.id} className="theory-memo-card" role="listitem">
                <header>
                  <div>
                    <Badge tone={memo.memoType === 'counterargument' ? 'warning' : memo.memoType === 'boundary' ? 'violet' : 'accent'}>
                      {labelEnum(memo.memoType)}
                    </Badge>
                    <button type="button" onClick={() => setViewing(memo)}>{memo.title}</button>
                  </div>
                  <span>{t('theory.memo.updated', { date: formatDate(memo.updatedAt) })}</span>
                </header>
                {memo.content && <p>{truncate(memo.content, 220)}</p>}
                {memo.memoType === 'dialogue' && memoLiterature.length > 0 && (
                  <div className="theory-memo-card__literature">
                    <BookOpenText size={14} aria-hidden="true" />
                    <span>{memoLiterature.map((item) => item.title).join(' · ')}</span>
                  </div>
                )}
                <footer>
                  <span>{projectLabel(memo.projectId)}</span>
                  <span>{t('theory.memo.relationships', {
                    questions: formatNumber(memo.relatedQuestionIds.length),
                    claims: formatNumber(memo.relatedClaimIds.length),
                    literature: formatNumber(memo.relatedLiteratureIds.length),
                  })}</span>
                  <div>
                    <Button size="sm" variant="ghost" aria-label={t('theory.memo.view', { title: memo.title })} onClick={() => setViewing(memo)}>{t('common.view')}</Button>
                    <Button size="sm" variant="ghost" aria-label={t('theory.memo.edit', { title: memo.title })} onClick={() => openEdit(memo)}>{t('common.edit')}</Button>
                    <Button size="sm" variant="ghost" className="text-danger" aria-label={t('theory.memo.delete', { title: memo.title })} onClick={() => setDeleting(memo)}>{t('common.delete')}</Button>
                  </div>
                </footer>
              </article>
            )
          })}
        </div>
      ) : (
        <EmptyState
          title={t('theory.memo.emptyTitle')}
          description={t('theory.memo.emptyDescription')}
          action={data.projects.length ? <AddButton onClick={openCreate}>{t('theory.actions.newMemo')}</AddButton> : undefined}
        />
      )}

      <Modal
        open={formOpen}
        title={t(editing ? 'theory.memo.editTitle' : 'theory.memo.createTitle')}
        description={t('theory.memo.formDescription')}
        onClose={() => { setFormOpen(false); setEditing(null) }}
        size="xl"
        footer={
          <>
            <Button onClick={() => { setFormOpen(false); setEditing(null) }}>{t('common.cancel')}</Button>
            <Button type="submit" form="theory-memo-form" variant="primary">
              {t(editing ? 'theory.memo.save' : 'theory.memo.create')}
            </Button>
          </>
        }
      >
        <form id="theory-memo-form" className="form-grid theory-memo-form" onSubmit={(event) => void saveMemo(event)}>
          <Field label={t('theory.memo.project')} required>
            <ProjectSelect required projects={projects} value={draft.projectId} onChange={changeProject} />
          </Field>
          <Field label={t('theory.memo.type')} required>
            <select value={draft.memoType} onChange={(event) => setDraft({ ...draft, memoType: event.target.value as TheoryMemoType })}>
              {THEORY_MEMO_TYPES.map((type) => <option key={type} value={type}>{labelEnum(type)}</option>)}
            </select>
          </Field>
          <Field label={t('theory.memo.title')} required className="form-span-2">
            <input autoFocus required maxLength={MEMO_TITLE_MAX_LENGTH} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder={t('theory.memo.titlePlaceholder')} />
          </Field>
          <aside className="theory-prompt-panel form-span-2" aria-labelledby="theory-prompt-title">
            <div>
              <Lightbulb size={18} aria-hidden="true" />
              <div>
                <strong id="theory-prompt-title">{t('theory.memo.promptTitle')}</strong>
                <p>{t('theory.memo.promptDescription')}</p>
              </div>
            </div>
            <ul>{promptKeys[draft.memoType].map((key) => <li key={key}>{t(key)}</li>)}</ul>
          </aside>
          <Field label={t('theory.memo.content')} hint={t('theory.memo.contentHint')} className="form-span-2">
            <textarea rows={10} maxLength={MEMO_CONTENT_MAX_LENGTH} value={draft.content} onChange={(event) => setDraft({ ...draft, content: event.target.value })} placeholder={t('theory.memo.contentPlaceholder')} />
          </Field>
          <RelationSelector
            legend={t('theory.memo.relatedQuestions')}
            hint={t('theory.memo.relatedQuestionsHint')}
            empty={t('theory.memo.noQuestions')}
            items={questions.map((item) => ({ id: item.id, label: item.text, meta: labelEnum(item.status) }))}
            selected={draft.relatedQuestionIds}
            onToggle={(id) => setDraft({ ...draft, relatedQuestionIds: toggleId(draft.relatedQuestionIds, id) })}
          />
          <RelationSelector
            legend={t('theory.memo.relatedClaims')}
            hint={t('theory.memo.relatedClaimsHint')}
            empty={t('theory.memo.noClaims')}
            items={claims.map((item) => ({ id: item.id, label: item.text, meta: labelEnum(item.status) }))}
            selected={draft.relatedClaimIds}
            onToggle={(id) => setDraft({ ...draft, relatedClaimIds: toggleId(draft.relatedClaimIds, id) })}
          />
          <RelationSelector
            className="form-span-2"
            legend={t('theory.memo.relatedLiterature')}
            hint={t('theory.memo.relatedLiteratureHint')}
            empty={t('theory.memo.noLiterature')}
            items={literature.map((item) => ({ id: item.id, label: item.title, meta: [item.authors.join(', '), item.year].filter(Boolean).join(' · ') }))}
            selected={draft.relatedLiteratureIds}
            onToggle={(id) => setDraft({ ...draft, relatedLiteratureIds: toggleId(draft.relatedLiteratureIds, id) })}
          />
        </form>
      </Modal>

      {viewing && (
        <Modal
          open
          title={viewing.title}
          description={`${labelEnum(viewing.memoType)} · ${projectLabel(viewing.projectId)}`}
          onClose={() => setViewing(null)}
          size="lg"
          footer={<Button variant="primary" onClick={() => openEdit(viewing)}>{t('common.edit')}</Button>}
        >
          <div className="theory-memo-detail">
            <section>
              <h3>{t('theory.memo.detailContent')}</h3>
              <p>{viewing.content || t('theory.memo.noContent')}</p>
            </section>
            <section>
              <h3><Link2 size={15} aria-hidden="true" />{t('theory.memo.detailLinks')}</h3>
              <dl>
                <div><dt>{t('theory.memo.relatedQuestions')}</dt><dd>{linkedQuestions(viewing).map((item) => item.text).join(' · ') || t('theory.memo.noQuestions')}</dd></div>
                <div><dt>{t('theory.memo.relatedClaims')}</dt><dd>{linkedClaims(viewing).map((item) => item.text).join(' · ') || t('theory.memo.noClaims')}</dd></div>
                <div><dt>{t('theory.memo.relatedLiterature')}</dt><dd>{linkedLiterature(viewing).map((item) => item.title).join(' · ') || t('theory.memo.noLiterature')}</dd></div>
              </dl>
            </section>
            <footer>{t('theory.memo.created')}: {formatDate(viewing.createdAt)} · {t('theory.memo.updated', { date: formatDate(viewing.updatedAt) })}</footer>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title={t('theory.memo.deleteTitle', { title: deleting?.title ?? '' })}
        description={t('theory.memo.deleteDescription', {
          questions: formatNumber(deleting?.relatedQuestionIds.length ?? 0),
          claims: formatNumber(deleting?.relatedClaimIds.length ?? 0),
          literature: formatNumber(deleting?.relatedLiteratureIds.length ?? 0),
        })}
        confirmLabel={t('theory.memo.deleteConfirm')}
        onCancel={() => setDeleting(null)}
        onConfirm={deleteMemo}
      />
    </section>
  )
}

function RelationSelector({
  legend,
  hint,
  empty,
  items,
  selected,
  onToggle,
  className = '',
}: {
  legend: string
  hint: string
  empty: string
  items: Array<{ id: string; label: string; meta: string }>
  selected: string[]
  onToggle: (id: string) => void
  className?: string
}) {
  return (
    <fieldset className={`research-link-selector ${className}`}>
      <legend>{legend}</legend>
      <p>{hint}</p>
      {items.length ? <div>{items.map((item) => (
        <label key={item.id}>
          <input
            type="checkbox"
            aria-label={item.label}
            checked={selected.includes(item.id)}
            onChange={() => onToggle(item.id)}
          />
          <span><strong>{item.label}</strong><small>{item.meta}</small></span>
        </label>
      ))}</div> : <span className="quiet-copy">{empty}</span>}
    </fieldset>
  )
}
