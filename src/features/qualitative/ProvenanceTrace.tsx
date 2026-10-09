import { useState } from 'react'
import type { WorkspaceData } from '../../models/domain'
import { WORKSPACE_COLLECTION_KEYS, type WorkspaceCollectionKey, type SegmentLocator, type ExternalReference } from '../../models/provenance'
import { getProvenanceReferences, previewProvenanceDeletion, traceProvenance } from '../../utils/provenance-graph'
import { useI18n } from '../../i18n'
import { Field, Badge, Button } from '../../components/ui'
import { qualitativeText, type QualitativeMessage } from './messages'
import { locatorLabel, referenceLabel } from './qualitative-editor'

type Target = { collection: WorkspaceCollectionKey; id: string }
type Props = { data: WorkspaceData; projectId: string; target: Target | null; onSelect: (target: Target) => void }
type VisibleRecord = { id: string; projectId?: string; state?: string; revisionNo?: number; [key: string]: unknown }
const asRecord = (record: unknown) => record as VisibleRecord
const scalarFields = ['label', 'alias', 'participantAlias', 'title', 'text', 'definition', 'inclusion', 'exclusion', 'content', 'finding', 'locator', 'limitations', 'rationale', 'note', 'changeReason', 'versionLabel', 'documentVersion', 'paragraphLabel', 'researcherAlias', 'verification', 'researcherVerification', 'frozenAt'] as const
const fieldLabels: Partial<Record<typeof scalarFields[number], QualitativeMessage>> = { label: 'label', alias: 'alias', participantAlias: 'interview', title: 'memoTitle', text: 'claim', definition: 'definition', inclusion: 'inclusion', exclusion: 'exclusion', content: 'memoContent', finding: 'note', locator: 'locator', limitations: 'boundary', rationale: 'rationale', note: 'note', changeReason: 'reason', versionLabel: 'version', documentVersion: 'version', paragraphLabel: 'locator', researcherAlias: 'researcher', verification: 'verification', researcherVerification: 'verification', frozenAt: 'frozenAt' }

function provenanceRecordLabel(record: unknown): string {
  const item = asRecord(record)
  const snapshot = item.snapshot && typeof item.snapshot === 'object' ? item.snapshot as Record<string, unknown> : {}
  for (const value of [item.label, item.alias, item.participantAlias, item.title, snapshot.title, snapshot.text, snapshot.finding, item.text, item.finding]) if (typeof value === 'string' && value) return value
  return item.id
}

export function ProvenanceTrace({ data, projectId, target, onSelect }: Props) {
  const { locale } = useI18n()
  const q = (key: QualitativeMessage) => qualitativeText(locale, key)
  const [expanded, setExpanded] = useState(false)
  const records = WORKSPACE_COLLECTION_KEYS.flatMap(collection => data[collection].map(record => ({ collection, record: asRecord(record) }))).filter(item => item.record.projectId === projectId)
  const selected = target ? records.find(item => item.collection === target.collection && item.record.id === target.id) : undefined
  const record = selected?.record
  const outgoing = selected ? [...new Map(getProvenanceReferences(selected.collection, selected.record).filter(ref => ref.collection !== 'projects').map(ref => [`${ref.collection}\0${ref.id}`, ref])).values()] : []
  const incoming = selected ? records.filter(item => getProvenanceReferences(item.collection, item.record).some(ref => ref.collection === selected.collection && ref.id === record?.id)).map(item => ({ collection: item.collection, id: item.record.id })) : []
  const deletion = selected ? previewProvenanceDeletion(data, selected.collection, selected.record.id) : null
  const graph = selected && expanded ? traceProvenance(data, { collection: selected.collection, id: selected.record.id }, 200) : null
  const link = (ref: Target) => {
    const item = records.find(entry => entry.collection === ref.collection && entry.record.id === ref.id)
    return <Button size="sm" variant="ghost" disabled={!item} onClick={() => onSelect(ref)}>{item ? provenanceRecordLabel(item.record) : ref.id}{item?.record.revisionNo ? ` · r${item.record.revisionNo}` : ''} · {ref.collection}</Button>
  }
  const values = record?.snapshot && typeof record.snapshot === 'object' ? { ...record, ...record.snapshot as object } : record
  return <section className="panel qualitative-trace">
    <Field label={q('stableId')}><select value={selected ? `${selected.collection}|${selected.record.id}` : ''} onChange={event => { const item = records.find(entry => `${entry.collection}|${entry.record.id}` === event.target.value); if (item) { onSelect({ collection: item.collection, id: item.record.id }); setExpanded(false) } }}><option value="">{q('select')}</option>{records.map(item => <option key={`${item.collection}|${item.record.id}`} value={`${item.collection}|${item.record.id}`}>{provenanceRecordLabel(item.record)}{item.record.revisionNo ? ` · r${item.record.revisionNo}` : ''} · {item.collection}</option>)}</select></Field>
    {record && selected && <>
      <header><h3>{provenanceRecordLabel(record)}</h3><p className="qualitative-id">{selected.collection} · {record.id}</p>{record.state && <Badge>{q(record.state as QualitativeMessage)}</Badge>}</header>
      {values && <dl className="qualitative-trace-content">{scalarFields.filter(field => typeof values[field] === 'string' && values[field]).map(field => <div key={field}><dt>{fieldLabels[field] ? q(fieldLabels[field]!) : field}</dt><dd>{values[field] as string}</dd></div>)}</dl>}
      <dl className="qualitative-trace-content">
        {Boolean(record.primaryLocator) && <div><dt>{q('locator')}</dt><dd>{locatorLabel(record.primaryLocator as SegmentLocator)}</dd></div>}
        {Array.isArray(record.alternateLocators) && record.alternateLocators.length > 0 && <div><dt>{q('alternateLocators')}</dt><dd>{(record.alternateLocators as SegmentLocator[]).map(locatorLabel).join(' · ')}</dd></div>}
        {Boolean(record.externalRef) && <div><dt>{q('externalReference')}</dt><dd className="qualitative-reference">{referenceLabel(record.externalRef as ExternalReference)}</dd></div>}
        {Array.isArray(record.sectionPath) && <div><dt>{q('sectionPath')}</dt><dd>{record.sectionPath.join(' / ')}</dd></div>}
        {typeof record.bookmarkToken === 'string' && <div><dt>{q('token')}</dt><dd>{record.bookmarkToken}</dd></div>}
      </dl>
      <div className="qualitative-trace-columns"><section><h4>{q('outgoing')}</h4>{outgoing.length ? <ul className="qualitative-trace-list">{outgoing.map(ref => <li key={`${ref.collection}|${ref.id}`}>{link(ref)}</li>)}</ul> : <p>{q('noLinks')}</p>}</section><section><h4>{q('incoming')}</h4>{incoming.length ? <ul className="qualitative-trace-list">{incoming.map(ref => <li key={`${ref.collection}|${ref.id}`}>{link(ref)}</li>)}</ul> : <p>{q('noLinks')}</p>}</section></div>
      {deletion?.protected && <details><summary>{q('deleteProtected')}</summary><h4>{q('deleteBlockers')}</h4><ul className="qualitative-trace-list">{deletion.blockers.map(ref => <li key={`${ref.collection}|${ref.id}`}>{link(ref)}</li>)}</ul></details>}
      <Button size="sm" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>{q('connected')}</Button>{graph && <><ul className="qualitative-trace-list">{graph.nodes.filter(node => node.collection !== 'projects').map(node => <li key={`${node.collection}|${node.id}`}>{link(node)}</li>)}</ul>{graph.truncated && <p>{q('truncated')}</p>}</>}
    </>}
  </section>
}
