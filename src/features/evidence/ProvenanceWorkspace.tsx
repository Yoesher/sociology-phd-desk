import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { SUPPORT_LEVELS, type SupportLevel } from '../../models/domain'
import type { ClaimManuscriptLink, EvidenceOriginV9, EvidenceSourceLink, EvidenceUsage, ManuscriptAnchor } from '../../models/provenance'
import { useProjectWorkspace } from '../../hooks/useProjectWorkspace'
import { useModuleSearch } from '../../hooks/useModuleSearch'
import { useI18n, type MessageKey } from '../../i18n'
import { Button, Badge, ConfirmDialog, Field, PageHeader } from '../../components/ui'
import { applyProvenanceCommand, type ProvenanceCommand, type RetirableCollection } from '../../utils/provenance-commands'
import { anchorRevisionTrace, claimRevisionTrace, evidenceRevisionTrace, locatorNumbers } from './provenance-view'
import './ProvenanceWorkspace.css'

type OriginKind = EvidenceOriginV9['kind']
interface AnchorDraft {
  manuscriptId: string
  anchorId: string
  kind: ManuscriptAnchor['kind']
  documentVersion: string
  sectionPath: string
  paragraphLabel: string
  bookmarkToken: string
  verified: boolean
}
const newAnchorDraft = (): AnchorDraft => ({ manuscriptId: '', anchorId: '', kind: 'paragraph', documentVersion: '', sectionPath: '', paragraphLabel: '', bookmarkToken: '', verified: false })
const latestId = <T extends { id: string; revisionNo: number }>(rows: T[]) => [...rows].sort((a, b) => b.revisionNo - a.revisionNo)[0]?.id

/** Explicit, version-pinned relationships; old free text never creates edges. */
export function ProvenanceWorkspace() {
  const { data, updateData } = useProjectWorkspace()
  const { t, labelEnum } = useI18n()
  const { searchParams, updateSearch } = useModuleSearch('evidence')
  const [projectId, setProjectId] = useState('')
  const [evidenceId, setEvidenceId] = useState(searchParams.get('evidenceRevision') || '')
  const [claimId, setClaimId] = useState(searchParams.get('claimRevision') || '')
  const [anchorId, setAnchorId] = useState(searchParams.get('anchorRevision') || '')
  const [researcherAlias, setResearcherAlias] = useState('')
  const [reason, setReason] = useState('')
  const [supportLevel, setSupportLevel] = useState<SupportLevel>('Unclear')
  const [rationale, setRationale] = useState('')
  const [limitations, setLimitations] = useState('')
  const [originKind, setOriginKind] = useState<OriginKind>('sourceSegmentRevision')
  const [originId, setOriginId] = useState('')
  const [locator, setLocator] = useState('')
  const [sourceRole, setSourceRole] = useState<EvidenceSourceLink['role']>('primary')
  const [anchorDraft, setAnchorDraft] = useState<AnchorDraft>(newAnchorDraft)
  const [purpose, setPurpose] = useState<ClaimManuscriptLink['purpose']>('assertion')
  const [useKind, setUseKind] = useState<EvidenceUsage['useKind']>('summary')
  const [usageLinkId, setUsageLinkId] = useState('')
  const [usageNote, setUsageNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<'saved' | 'failed' | 'context-required' | null>(null)
  const [retiring, setRetiring] = useState<{ collection: RetirableCollection; linkId: string; projectId: string } | null>(null)

  useEffect(() => {
    if (!data) return
    const queryEvidence = data.evidenceRevisions.find((row) => row.id === searchParams.get('evidenceRevision'))
    const queryClaim = data.claimRevisions.find((row) => row.id === searchParams.get('claimRevision'))
    const queryAnchor = data.manuscriptAnchorRevisions.find((row) => row.id === searchParams.get('anchorRevision'))
    if (!projectId || !data.projects.some((row) => row.id === projectId)) {
      setProjectId(queryEvidence?.projectId || queryClaim?.projectId || queryAnchor?.projectId || data.workspace.activeProjectId || data.projects[0]?.id || '')
    }
  }, [data, projectId, searchParams])

  useEffect(() => {
    if (!data || !projectId) return
    if (!evidenceId && !searchParams.get('evidenceRevision')) setEvidenceId(data.evidenceRevisions.find((row) => row.projectId === projectId)?.id || '')
    if (!claimId && !searchParams.get('claimRevision')) setClaimId(data.claimRevisions.find((row) => row.projectId === projectId)?.id || '')
    if (!anchorId && !searchParams.get('anchorRevision')) setAnchorId(data.manuscriptAnchorRevisions.find((row) => row.projectId === projectId)?.id || '')
  }, [data, projectId, evidenceId, claimId, anchorId, searchParams])

  useEffect(() => {
    const evidenceRevision = searchParams.get('evidenceRevision')
    const claimRevision = searchParams.get('claimRevision')
    const anchorRevision = searchParams.get('anchorRevision')
    if (evidenceRevision) setEvidenceId(evidenceRevision)
    if (claimRevision) setClaimId(claimRevision)
    if (anchorRevision) setAnchorId(anchorRevision)
  }, [searchParams])

  if (!data) return null
  const scoped = <T extends { projectId: string }>(rows: T[]) => rows.filter((row) => row.projectId === projectId)
  const evidenceRevisions = scoped(data.evidenceRevisions)
  const claimRevisions = scoped(data.claimRevisions)
  const anchorRevisions = scoped(data.manuscriptAnchorRevisions)
  const evidenceTrace = evidenceRevisionTrace(data, evidenceId)
  const claimTrace = claimRevisionTrace(data, claimId)
  const anchorTrace = anchorRevisionTrace(data, anchorId)
  const evidence = evidenceTrace.evidenceRevision
  const claim = claimTrace.claimRevision
  const anchor = anchorTrace.anchorRevision
  const enumLabel = (value: string) => t(`evidence.provenance.enum.${value}` as MessageKey)
  const versionLabel = (revision: { revisionNo: number }, title: string, current: boolean) => `${title} · r${revision.revisionNo} · ${t(current ? 'evidence.provenance.current' : 'evidence.provenance.historical')}`
  const evidenceLabel = (id: string) => {
    const row = data.evidenceRevisions.find((record) => record.id === id)
    return row ? versionLabel(row, row.snapshot.finding || row.snapshot.claim, latestId(data.evidenceRevisions.filter((record) => record.evidenceId === row.evidenceId)) === row.id) : id
  }
  const claimLabel = (id: string) => {
    const row = data.claimRevisions.find((record) => record.id === id)
    return row ? versionLabel(row, row.snapshot.text, latestId(data.claimRevisions.filter((record) => record.claimId === row.claimId)) === row.id) : id
  }
  const anchorLabel = (id: string) => {
    const row = data.manuscriptAnchorRevisions.find((record) => record.id === id)
    const root = data.manuscriptAnchors.find((record) => record.id === row?.anchorId)
    const manuscript = data.manuscripts.find((record) => record.id === root?.manuscriptId)
    return row ? versionLabel(row, `${manuscript?.title || root?.id || ''} / ${row.documentVersion} / ${row.sectionPath.join(' › ')} ${row.paragraphLabel || ''}`, root?.currentRevisionId === row.id) : id
  }
  const chooseEvidence = (id: string) => { setEvidenceId(id); setUsageLinkId(''); updateSearch({ evidenceRevision: id }) }
  const chooseClaim = (id: string) => { setClaimId(id); setUsageLinkId(''); updateSearch({ claimRevision: id }) }
  const chooseAnchor = (id: string) => { setAnchorId(id); updateSearch({ anchorRevision: id }) }
  const changeProject = (id: string) => {
    setProjectId(id); setEvidenceId(''); setClaimId(''); setAnchorId(''); setOriginId(''); setUsageLinkId(''); setAnchorDraft(newAnchorDraft())
    updateSearch({ evidenceRevision: '', claimRevision: '', anchorRevision: '' })
  }
  const execute = async (command: ProvenanceCommand) => {
    if (!researcherAlias.trim() || !reason.trim()) { setStatus('context-required'); return false }
    setBusy(true); setStatus(null)
    try {
      await updateData((current) => applyProvenanceCommand(current, command, { researcherAlias, reason, expectedRevision: data.workspace.revision }))
      setStatus('saved'); return true
    } catch { setStatus('failed'); return false }
    finally { setBusy(false) }
  }
  const submit = (command: ProvenanceCommand) => (event: FormEvent) => { event.preventDefault(); void execute(command) }
  const originOptions: Array<{ id: string; label: string }> = originKind === 'sourceSegmentRevision'
    ? scoped(data.sourceSegmentRevisions).filter((row) => data.sourceSegments.some((segment) => segment.id === row.segmentId && segment.state !== 'withdrawn')).map((row) => ({ id: row.id, label: `${data.sourceSegments.find((segment) => segment.id === row.segmentId)?.label || row.segmentId} · r${row.revisionNo} / ${enumLabel(row.primaryLocator.kind)} ${locatorNumbers(row.primaryLocator)}` }))
    : originKind === 'literature' ? scoped(data.literature).map((row) => ({ id: row.id, label: row.title }))
    : originKind === 'analysisRun' ? scoped(data.analysisRuns).map((row) => ({ id: row.id, label: `${row.date} / ${row.model}` }))
    : originKind === 'interview' ? scoped(data.interviews).map((row) => ({ id: row.id, label: row.participantAlias }))
    : scoped(data.fieldVisits).map((row) => ({ id: row.id, label: `${row.date} / ${row.purpose}` }))
  const selectedOrigin = (): EvidenceOriginV9 => {
    switch (originKind) {
      case 'sourceSegmentRevision': return { kind: originKind, segmentRevisionId: originId }
      case 'literature': return { kind: originKind, literatureId: originId, locator }
      case 'analysisRun': return { kind: originKind, analysisRunId: originId, locator }
      case 'interview': return { kind: originKind, interviewId: originId, locator }
      case 'fieldVisit': return { kind: originKind, fieldVisitId: originId, locator }
    }
  }
  const originDescription = (origin: EvidenceOriginV9) => {
    switch (origin.kind) {
      case 'sourceSegmentRevision': {
        const revision = data.sourceSegmentRevisions.find((row) => row.id === origin.segmentRevisionId)
        const segment = data.sourceSegments.find((row) => row.id === revision?.segmentId)
        const sourceRevision = data.sourceRevisions.find((row) => row.id === revision?.sourceRevisionId)
        const source = data.sourceReferences.find((row) => row.id === sourceRevision?.sourceReferenceId)
        return `${source?.alias || ''} / ${sourceRevision?.versionLabel || ''} / ${segment?.label || ''} · r${revision?.revisionNo || ''} / ${revision ? `${enumLabel(revision.primaryLocator.kind)} ${locatorNumbers(revision.primaryLocator)} / ${enumLabel(revision.verification)}` : origin.segmentRevisionId} / ${source ? enumLabel(source.state) : ''}`
      }
      case 'literature': return `${data.literature.find((row) => row.id === origin.literatureId)?.title || origin.literatureId} / ${origin.locator}`
      case 'analysisRun': return `${data.analysisRuns.find((row) => row.id === origin.analysisRunId)?.model || origin.analysisRunId} / ${origin.locator}`
      case 'interview': return `${data.interviews.find((row) => row.id === origin.interviewId)?.participantAlias || origin.interviewId} / ${origin.locator}`
      case 'fieldVisit': return `${data.fieldVisits.find((row) => row.id === origin.fieldVisitId)?.purpose || origin.fieldVisitId} / ${origin.locator}`
    }
  }
  const retireButton = (collection: RetirableCollection, row: { id: string; projectId: string; state: string }) => row.state === 'active'
    ? <Button size="sm" disabled={busy} onClick={() => setRetiring({ collection, linkId: row.id, projectId: row.projectId })}>{t('evidence.provenance.retire')}</Button> : null
  const edgeBadge = (state: string) => <Badge tone={state === 'active' ? 'success' : 'neutral'}>{enumLabel(state)}</Badge>
  const activeClaimLinks = evidenceTrace.claimLinks.filter((row) => row.state === 'active' && row.claimRevisionId === claimId)
  const anchorFields = {
    documentVersion: anchorDraft.documentVersion,
    sectionPath: anchorDraft.sectionPath.split('>').map((part) => part.trim()).filter(Boolean),
    ...(anchorDraft.paragraphLabel ? { paragraphLabel: anchorDraft.paragraphLabel } : {}),
    ...(anchorDraft.bookmarkToken ? { bookmarkToken: anchorDraft.bookmarkToken } : {}),
    ...(anchorDraft.verified ? { locatorVerifiedAt: new Date().toISOString() } : {}),
  }
  const selectedMismatch = (evidence && evidence.projectId !== projectId) || (claim && claim.projectId !== projectId) || (anchor && anchor.projectId !== projectId)

  return (
    <div className="page provenance-workspace">
      <PageHeader index="07" eyebrow={t('evidence.provenance.eyebrow')} title={t('evidence.provenance.title')} description={t('evidence.provenance.description')} />
      <aside className="provenance-notice"><strong>{t('evidence.provenance.boundaryTitle')}</strong><p>{t('evidence.provenance.boundary')}</p><p>{t('evidence.provenance.historyNotice')}</p></aside>
      <section className="panel provenance-selectors" aria-label={t('evidence.provenance.selection')}>
        <Field label={t('evidence.provenance.project')}><select value={projectId} onChange={(event) => changeProject(event.target.value)}><option value="">{t('evidence.provenance.choose')}</option>{data.projects.map((row) => <option key={row.id} value={row.id}>{row.title}</option>)}</select></Field>
        <Field label={t('evidence.provenance.evidenceRevision')}><select value={evidenceId} onChange={(event) => chooseEvidence(event.target.value)}><option value="">{t('evidence.provenance.choose')}</option>{evidenceRevisions.map((row) => <option key={row.id} value={row.id}>{evidenceLabel(row.id)}</option>)}</select></Field>
        <Field label={t('evidence.provenance.claimRevision')}><select value={claimId} onChange={(event) => chooseClaim(event.target.value)}><option value="">{t('evidence.provenance.choose')}</option>{claimRevisions.map((row) => <option key={row.id} value={row.id}>{claimLabel(row.id)}</option>)}</select></Field>
        <Field label={t('evidence.provenance.anchorRevision')}><select value={anchorId} onChange={(event) => chooseAnchor(event.target.value)}><option value="">{t('evidence.provenance.choose')}</option>{anchorRevisions.map((row) => <option key={row.id} value={row.id}>{anchorLabel(row.id)}</option>)}</select></Field>
      </section>
      {((evidenceId && !evidence) || (claimId && !claim) || (anchorId && !anchor) || selectedMismatch) && <p role="alert" className="provenance-status provenance-status--error">{t('evidence.provenance.unavailable')}</p>}
      <section className="panel provenance-selectors" aria-label={t('evidence.provenance.researcherContext')}>
        <Field required label={t('evidence.provenance.researcherAlias')} hint={t('evidence.provenance.aliasHint')}><input required maxLength={200} value={researcherAlias} onChange={(event) => setResearcherAlias(event.target.value)} /></Field>
        <Field required label={t('evidence.provenance.changeReason')}><input required maxLength={2000} value={reason} onChange={(event) => setReason(event.target.value)} /></Field>
      </section>
      {status && <p role={status === 'saved' ? 'status' : 'alert'} className={`provenance-status ${status === 'saved' ? '' : 'provenance-status--error'}`}>{t(`evidence.provenance.status.${status}`)}</p>}

      <div className="provenance-form-columns">
        <section className="panel"><h2>{t('evidence.provenance.linkClaimTitle')}</h2><form className="form-grid" onSubmit={submit({ type: 'linkEvidenceToClaim', projectId, evidenceRevisionId: evidenceId, claimRevisionId: claimId, supportLevel, rationale, limitations })}>
          <Field label={t('evidence.provenance.support')}><select value={supportLevel} onChange={(event) => setSupportLevel(event.target.value as SupportLevel)}>{SUPPORT_LEVELS.map((value) => <option key={value} value={value}>{labelEnum(value)}</option>)}</select></Field>
          <Field required label={t('evidence.provenance.rationale')}><textarea required rows={3} value={rationale} onChange={(event) => setRationale(event.target.value)} /></Field>
          <Field label={t('evidence.provenance.limitations')} className="form-span-2"><textarea rows={2} value={limitations} onChange={(event) => setLimitations(event.target.value)} /></Field>
          <Button type="submit" variant="primary" disabled={busy || !evidence || !claim || Boolean(selectedMismatch)}>{t('evidence.provenance.linkClaim')}</Button>
        </form></section>
        <section className="panel"><h2>{t('evidence.provenance.sourceTitle')}</h2><form className="form-grid" onSubmit={submit({ type: 'linkEvidenceSource', projectId, evidenceRevisionId: evidenceId, origin: selectedOrigin(), role: sourceRole })}>
          <Field label={t('evidence.provenance.originKind')}><select value={originKind} onChange={(event) => { setOriginKind(event.target.value as OriginKind); setOriginId('') }}>{(['sourceSegmentRevision', 'literature', 'analysisRun', 'interview', 'fieldVisit'] as const).map((value) => <option key={value} value={value}>{enumLabel(value)}</option>)}</select></Field>
          <Field required label={t('evidence.provenance.originRecord')}><select required value={originId} onChange={(event) => setOriginId(event.target.value)}><option value="">{t('evidence.provenance.choose')}</option>{originOptions.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}</select></Field>
          {originKind !== 'sourceSegmentRevision' && <Field required label={t('evidence.provenance.locator')}><input required value={locator} onChange={(event) => setLocator(event.target.value)} /></Field>}
          <Field label={t('evidence.provenance.sourceRole')}><select value={sourceRole} onChange={(event) => setSourceRole(event.target.value as EvidenceSourceLink['role'])}>{(['primary', 'corroborating', 'context'] as const).map((value) => <option key={value} value={value}>{enumLabel(value)}</option>)}</select></Field>
          <Button type="submit" variant="primary" disabled={busy || !evidence || !originId || Boolean(selectedMismatch)}>{t('evidence.provenance.linkSource')}</Button>
        </form></section>
        <section className="panel"><h2>{t('evidence.provenance.anchorTitle')}</h2><p>{t('evidence.provenance.reanchorNotice')}</p><form className="form-grid" onSubmit={submit(anchorDraft.anchorId ? { type: 'reviseManuscriptAnchor', projectId, anchorId: anchorDraft.anchorId, ...anchorFields } : { type: 'createManuscriptAnchor', projectId, manuscriptId: anchorDraft.manuscriptId, kind: anchorDraft.kind, ...anchorFields })}>
          <Field label={t('evidence.provenance.existingAnchor')}><select value={anchorDraft.anchorId} onChange={(event) => { const id = event.target.value; const root = data.manuscriptAnchors.find((row) => row.id === id); const rev = data.manuscriptAnchorRevisions.find((row) => row.id === root?.currentRevisionId); setAnchorDraft(rev && root ? { anchorId: id, manuscriptId: root.manuscriptId, kind: root.kind, documentVersion: rev.documentVersion, sectionPath: rev.sectionPath.join(' > '), paragraphLabel: rev.paragraphLabel || '', bookmarkToken: rev.bookmarkToken || '', verified: false } : newAnchorDraft()) }}><option value="">{t('evidence.provenance.newAnchor')}</option>{scoped(data.manuscriptAnchors).filter((row) => row.state === 'active').map((row) => <option key={row.id} value={row.id}>{anchorLabel(row.currentRevisionId)}</option>)}</select></Field>
          <Field required label={t('evidence.provenance.manuscript')}><select required disabled={Boolean(anchorDraft.anchorId)} value={anchorDraft.manuscriptId} onChange={(event) => setAnchorDraft({ ...anchorDraft, manuscriptId: event.target.value })}><option value="">{t('evidence.provenance.choose')}</option>{scoped(data.manuscripts).map((row) => <option key={row.id} value={row.id}>{row.title}</option>)}</select></Field>
          <Field label={t('evidence.provenance.anchorKind')}><select disabled={Boolean(anchorDraft.anchorId)} value={anchorDraft.kind} onChange={(event) => setAnchorDraft({ ...anchorDraft, kind: event.target.value as ManuscriptAnchor['kind'] })}>{(['section', 'paragraph', 'table', 'figure'] as const).map((value) => <option key={value} value={value}>{enumLabel(value)}</option>)}</select></Field>
          <Field required label={t('evidence.provenance.documentVersion')}><input required value={anchorDraft.documentVersion} onChange={(event) => setAnchorDraft({ ...anchorDraft, documentVersion: event.target.value })} /></Field>
          <Field required label={t('evidence.provenance.sectionPath')} hint={t('evidence.provenance.sectionHint')}><input required value={anchorDraft.sectionPath} onChange={(event) => setAnchorDraft({ ...anchorDraft, sectionPath: event.target.value })} /></Field>
          <Field label={t('evidence.provenance.paragraphLabel')}><input value={anchorDraft.paragraphLabel} onChange={(event) => setAnchorDraft({ ...anchorDraft, paragraphLabel: event.target.value })} /></Field>
          <Field label={t('evidence.provenance.bookmarkToken')}><input value={anchorDraft.bookmarkToken} onChange={(event) => setAnchorDraft({ ...anchorDraft, bookmarkToken: event.target.value })} /></Field>
          <label><input type="checkbox" checked={anchorDraft.verified} onChange={(event) => setAnchorDraft({ ...anchorDraft, verified: event.target.checked })} /> {t('evidence.provenance.locatorVerified')}</label>
          <Button type="submit" variant="primary" disabled={busy || !projectId || !anchorDraft.manuscriptId}>{t(anchorDraft.anchorId ? 'evidence.provenance.reanchor' : 'evidence.provenance.createAnchor')}</Button>
        </form></section>
        <section className="panel"><h2>{t('evidence.provenance.usageTitle')}</h2><p>{t('evidence.provenance.usageNotice')}</p><form className="form-grid" onSubmit={submit({ type: 'useEvidenceAtAnchor', projectId, evidenceClaimLinkId: usageLinkId, anchorRevisionId: anchorId, purpose, useKind, note: usageNote })}>
          <Field label={t('evidence.provenance.purpose')}><select value={purpose} onChange={(event) => setPurpose(event.target.value as ClaimManuscriptLink['purpose'])}>{(['assertion', 'discussion', 'boundary', 'counterargument'] as const).map((value) => <option key={value} value={value}>{enumLabel(value)}</option>)}</select></Field>
          <Field required label={t('evidence.provenance.evidenceClaimLink')}><select required value={usageLinkId} onChange={(event) => setUsageLinkId(event.target.value)}><option value="">{t('evidence.provenance.choose')}</option>{activeClaimLinks.map((row) => <option key={row.id} value={row.id}>{labelEnum(row.supportLevel)} / {row.rationale}</option>)}</select></Field>
          <Field label={t('evidence.provenance.useKind')}><select value={useKind} onChange={(event) => setUseKind(event.target.value as EvidenceUsage['useKind'])}>{(['summary', 'quotation-reference', 'table-reference', 'context'] as const).map((value) => <option key={value} value={value}>{enumLabel(value)}</option>)}</select></Field>
          <Field label={t('evidence.provenance.useNote')}><textarea rows={2} value={usageNote} onChange={(event) => setUsageNote(event.target.value)} /></Field>
          <Button type="button" disabled={busy || !claim || !anchor || Boolean(selectedMismatch)} onClick={() => void execute({ type: 'linkClaimToManuscript', projectId, claimRevisionId: claimId, anchorRevisionId: anchorId, purpose })}>{t('evidence.provenance.placeClaim')}</Button>
          <Button type="submit" variant="primary" disabled={busy || !usageLinkId || !anchor || Boolean(selectedMismatch)}>{t('evidence.provenance.recordUsage')}</Button>
        </form></section>
      </div>

      <div className="provenance-columns">
        <section className="panel" aria-label={t('evidence.provenance.evidenceTrace')}><h2>{t('evidence.provenance.evidenceTrace')}</h2>
          {evidence ? <article className="provenance-record"><h3>{evidenceLabel(evidence.id)}</h3><span className="provenance-id">{evidence.id} / {evidence.evidenceId}</span><p>{evidence.snapshot.finding}</p><details><summary>{t('evidence.provenance.legacyText')}</summary><dl><dt>{t('evidence.provenance.claimRevision')}</dt><dd>{evidence.snapshot.claim}</dd><dt>{t('evidence.provenance.locator')}</dt><dd>{evidence.snapshot.source} / {evidence.snapshot.locator}</dd><dt>{t('evidence.provenance.anchorRevision')}</dt><dd>{evidence.snapshot.manuscriptLocation}</dd></dl></details></article> : <p className="provenance-empty">{t('evidence.provenance.noEvidence')}</p>}
          <h3>{t('evidence.provenance.savedSources')}</h3>{!evidenceTrace.sourceLinks.length && <p className="provenance-empty">{t('evidence.provenance.noRelationship')}</p>}
          {evidenceTrace.sourceLinks.map((row) => <article className="provenance-record" key={row.id}>{edgeBadge(row.state)} <Badge>{enumLabel(row.role)}</Badge><p>{originDescription(row.origin)}</p><span className="provenance-id">{row.id}</span><div className="provenance-row-actions">{row.origin.kind === 'sourceSegmentRevision' && <Link to={`/fieldwork?view=qualitative&segmentRevision=${encodeURIComponent(row.origin.segmentRevisionId)}`}>{t('evidence.provenance.openQualitative')}</Link>}{retireButton('evidenceSourceLinks', row)}</div></article>)}
          <h3>{t('evidence.provenance.savedClaims')}</h3>{!evidenceTrace.claimLinks.length && <p className="provenance-empty">{t('evidence.provenance.noRelationship')}</p>}
          {evidenceTrace.claimLinks.map((row) => <article className="provenance-record" key={row.id}>{edgeBadge(row.state)} <Badge tone={row.supportLevel === 'Contradictory' ? 'danger' : 'neutral'}>{labelEnum(row.supportLevel)}</Badge><p>{claimLabel(row.claimRevisionId)}</p><p>{row.rationale}</p>{row.limitations && <p>{t('evidence.provenance.limitations')}: {row.limitations}</p>}<span className="provenance-id">{row.id}</span><div className="provenance-row-actions"><Button size="sm" onClick={() => chooseClaim(row.claimRevisionId)}>{t('evidence.provenance.showClaim')}</Button>{retireButton('evidenceClaimLinks', row)}</div></article>)}
        </section>
        <section className="panel" aria-label={t('evidence.provenance.claimTrace')}><h2>{t('evidence.provenance.claimTrace')}</h2>
          {claim ? <article className="provenance-record"><h3>{claimLabel(claim.id)}</h3><p>{claim.snapshot.notes}</p><span className="provenance-id">{claim.id} / {claim.claimId}</span></article> : <p className="provenance-empty">{t('evidence.provenance.noClaim')}</p>}
          <h3>{t('evidence.provenance.reverseEvidence')}</h3>{!claimTrace.evidenceLinks.length && <p className="provenance-empty">{t('evidence.provenance.noRelationship')}</p>}
          {claimTrace.evidenceLinks.map((row) => <article className="provenance-record" key={row.id}>{edgeBadge(row.state)} <Badge>{labelEnum(row.supportLevel)}</Badge><p>{evidenceLabel(row.evidenceRevisionId)}</p><p>{row.rationale}</p><Button size="sm" onClick={() => chooseEvidence(row.evidenceRevisionId)}>{t('evidence.provenance.showEvidence')}</Button></article>)}
          <h3>{t('evidence.provenance.derivations')}</h3>{!claimTrace.derivations.length && <p className="provenance-empty">{t('evidence.provenance.noRelationship')}</p>}
          {claimTrace.derivations.map((row) => { const memo = data.theoryMemoRevisions.find((record) => record.id === row.memoRevisionId); return <article className="provenance-record" key={row.id}>{edgeBadge(row.state)}<h3>{memo?.snapshot.title} · r{memo?.revisionNo}</h3><p>{row.rationale}</p><details><summary>{t('evidence.provenance.memoText')}</summary><p>{memo?.snapshot.content}</p></details><span className="provenance-id">{row.memoRevisionId}</span><Link to={`/fieldwork?view=qualitative&memoRevision=${encodeURIComponent(row.memoRevisionId)}`}>{t('evidence.provenance.openMemo')}</Link></article> })}
          <h3>{t('evidence.provenance.savedManuscripts')}</h3>{!claimTrace.manuscriptLinks.length && <p className="provenance-empty">{t('evidence.provenance.noRelationship')}</p>}
          {claimTrace.manuscriptLinks.map((row) => <article className="provenance-record" key={row.id}>{edgeBadge(row.state)} <Badge>{enumLabel(row.purpose)}</Badge><p>{anchorLabel(row.anchorRevisionId)}</p><span className="provenance-id">{row.id}</span><div className="provenance-row-actions"><Button size="sm" onClick={() => chooseAnchor(row.anchorRevisionId)}>{t('evidence.provenance.showAnchor')}</Button>{retireButton('claimManuscriptLinks', row)}</div></article>)}
        </section>
        <section className="panel" aria-label={t('evidence.provenance.anchorTrace')}><h2>{t('evidence.provenance.anchorTrace')}</h2>
          {anchor ? <article className="provenance-record"><h3>{anchorLabel(anchor.id)}</h3><p>{anchor.bookmarkToken}</p><p>{t(anchor.locatorVerifiedAt ? 'evidence.provenance.verified' : 'evidence.provenance.unverified')}</p><span className="provenance-id">{anchor.id} / {anchor.anchorId}</span></article> : <p className="provenance-empty">{t('evidence.provenance.noAnchor')}</p>}
          <h3>{t('evidence.provenance.reverseClaims')}</h3>{!anchorTrace.manuscriptLinks.length && <p className="provenance-empty">{t('evidence.provenance.noRelationship')}</p>}
          {anchorTrace.manuscriptLinks.map((row) => <article className="provenance-record" key={row.id}>{edgeBadge(row.state)} <Badge>{enumLabel(row.purpose)}</Badge><p>{claimLabel(row.claimRevisionId)}</p><Button size="sm" onClick={() => chooseClaim(row.claimRevisionId)}>{t('evidence.provenance.showClaim')}</Button>{!anchorTrace.usages.some((usage) => usage.claimManuscriptLinkId === row.id) && <p>{t('evidence.provenance.noActualUsage')}</p>}</article>)}
          <h3>{t('evidence.provenance.actualUsages')}</h3>{!anchorTrace.usages.length && <p className="provenance-empty">{t('evidence.provenance.noRelationship')}</p>}
          {anchorTrace.usages.map((row) => { const evidenceLink = data.evidenceClaimLinks.find((record) => record.id === row.evidenceClaimLinkId); return <article className="provenance-record" key={row.id}>{edgeBadge(row.state)} <Badge>{enumLabel(row.useKind)}</Badge><p>{evidenceLink ? evidenceLabel(evidenceLink.evidenceRevisionId) : row.evidenceClaimLinkId}</p><p>{row.note}</p><span className="provenance-id">{row.id}</span><div className="provenance-row-actions">{evidenceLink && <Button size="sm" onClick={() => chooseEvidence(evidenceLink.evidenceRevisionId)}>{t('evidence.provenance.showEvidence')}</Button>}{retireButton('evidenceUsages', row)}</div></article> })}
        </section>
      </div>
      <ConfirmDialog open={Boolean(retiring)} busy={busy} title={t('evidence.provenance.retireTitle')} description={t('evidence.provenance.retireNotice')} confirmLabel={t('evidence.provenance.retireConfirm')} onCancel={() => setRetiring(null)} onConfirm={async () => { if (retiring && await execute({ type: 'retireLink', ...retiring })) setRetiring(null) }} />
    </div>
  )
}
