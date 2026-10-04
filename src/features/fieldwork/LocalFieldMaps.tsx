import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { MapPinned, Upload } from 'lucide-react'
import type { FieldMap, FieldMapImage, FieldSite, WorkspaceData } from '../../models/domain'
import type { WorkspaceContextValue } from '../../app/workspace-context'
import { useProjectScope } from '../../app/project-scope-context'
import { entityMeta } from '../../app/format'
import { useI18n, type MessageKey } from '../../i18n'
import { AddButton, Button, EmptyState, Field, Modal } from '../../components/ui'
import { ProjectSelect } from '../../components/ProjectSelect'
import { WorkspaceCapacityError } from '../../utils/workspace-capacity'
import { fieldMapPosition, MAX_WORKSPACE_FIELD_MAP_IMAGE_BYTES, readLocalFieldMapImage } from './local-field-map'

type Editor = { id: string | null; title: string; projectId: string; image: FieldMapImage | null; original: FieldMap | null; rights: boolean; clearMarkers: boolean; workspaceId: string; scopeProjectId: string }
type Removal = { kind: 'map' | 'marker'; mapId: string; siteId?: string; label: string }
type Props = {
  data: WorkspaceData
  updateData: WorkspaceContextValue['updateData']
  onEditSite: (site: FieldSite) => void
  onCreateVisit: (site: FieldSite) => void
  onCreateInterview: (site: FieldSite) => void
}

export function LocalFieldMaps({ data, updateData, onEditSite, onCreateVisit, onCreateInterview }: Props) {
  const { t, formatDate, formatNumber } = useI18n()
  const { projectId: scopeProjectId } = useProjectScope()
  const [mapId, setMapId] = useState('')
  const [siteId, setSiteId] = useState('')
  const [x, setX] = useState('50')
  const [y, setY] = useState('50')
  const [editor, setEditor] = useState<Editor | null>(null)
  const [removal, setRemoval] = useState<Removal | null>(null)
  const [error, setError] = useState<MessageKey | null>(null)
  const [formError, setFormError] = useState<MessageKey | null>(null)
  const [busy, setBusy] = useState(false)
  const [reading, setReading] = useState(false)
  const operation = useRef(false)
  const readGeneration = useRef(0)
  const selectedMap = data.fieldMaps.find((item) => item.id === mapId) || data.fieldMaps[0]
  const sites = data.fieldSites.filter((item) => item.projectId === selectedMap?.projectId)
  const selectedSite = sites.find((item) => item.id === siteId)
  const selectedMarker = selectedMap?.markers.find((item) => item.fieldSiteId === selectedSite?.id)
  const replacingImage = Boolean(editor?.original && editor.image && editor.image !== editor.original.image)
  const mustClear = Boolean(replacingImage && editor?.original?.markers.length)

  useEffect(() => {
    setX(String(Math.round((selectedMarker?.x ?? 0.5) * 100)))
    setY(String(Math.round((selectedMarker?.y ?? 0.5) * 100)))
  }, [selectedMap?.id, selectedSite?.id, selectedMarker?.x, selectedMarker?.y])
  useEffect(() => () => { readGeneration.current++ }, [])

  const closeEditor = () => {
    if (operation.current) return
    readGeneration.current++
    setReading(false)
    setEditor(null)
    setFormError(null)
  }
  const openEditor = (map?: FieldMap) => {
    readGeneration.current++
    setReading(false)
    setFormError(null)
    setEditor({ id: map?.id || null, title: map?.title || '', projectId: map?.projectId || data.workspace.activeProjectId || '', image: map?.image || null, original: map || null, rights: false, clearMarkers: false, workspaceId: data.workspace.id, scopeProjectId })
  }
  const readImage = async (file?: File) => {
    if (!file) return
    const generation = ++readGeneration.current
    setReading(true)
    setFormError(null)
    try {
      const image = await readLocalFieldMapImage(file)
      if (generation === readGeneration.current) setEditor((current) => current ? { ...current, image, clearMarkers: false } : null)
    } catch (failure) {
      if (generation === readGeneration.current) setFormError(failure instanceof Error && failure.message === 'map-image-size' ? 'fieldMaps.error.imageSize' : 'fieldMaps.error.imageInvalid')
    } finally { if (generation === readGeneration.current) setReading(false) }
  }

  const saveMap = async (event: FormEvent) => {
    event.preventDefault()
    if (!editor || operation.current || reading) return
    if (editor.workspaceId !== data.workspace.id || editor.scopeProjectId !== scopeProjectId) { setFormError('fieldMaps.error.saveFailed'); return }
    if (!editor.image || !editor.title.trim() || !editor.projectId || !editor.rights || (mustClear && !editor.clearMarkers)) { setFormError('fieldMaps.error.required'); return }
    const draft = editor, image = editor.image
    operation.current = true
    setBusy(true)
    setFormError(null)
    const newId = draft.id || entityMeta('field-map').id
    try {
      await updateData((current) => {
        if (!current.projects.some((project) => project.id === draft.projectId)) throw new Error('map-project-changed')
        const original = draft.id ? current.fieldMaps.find((item) => item.id === draft.id) : null
        if (draft.id && (!original || original.projectId !== draft.original?.projectId || original.updatedAt !== draft.original?.updatedAt || original.image.base64 !== draft.original?.image.base64)) throw new Error('map-changed')
        const markers = replacingImage ? [] : original?.markers || []
        if (replacingImage && original?.markers.length && !draft.clearMarkers) throw new Error('map-markers-changed')
        if (markers.some((marker) => !current.fieldSites.some((site) => site.id === marker.fieldSiteId && site.projectId === draft.projectId))) throw new Error('map-site-changed')
        const others = current.fieldMaps.filter((item) => item.id !== draft.id)
        if (others.reduce((total, map) => total + map.image.size, image.size) > MAX_WORKSPACE_FIELD_MAP_IMAGE_BYTES) throw new Error('map-workspace-size')
        const record: FieldMap = { ...(original || entityMeta('field-map')), id: newId, title: draft.title.trim(), projectId: draft.projectId, image, markers, updatedAt: new Date().toISOString() }
        return { ...current, fieldMaps: original ? current.fieldMaps.map((item) => item.id === newId ? record : item) : [record, ...current.fieldMaps] }
      })
      setMapId(newId)
      setSiteId('')
      setEditor(null)
      setError(null)
    } catch (failure) { setFormError(failure instanceof WorkspaceCapacityError ? 'feedback.backup.tooLarge' : failure instanceof Error && failure.message === 'map-workspace-size' ? 'fieldMaps.error.workspaceSize' : 'fieldMaps.error.saveFailed') }
    finally { operation.current = false; setBusy(false) }
  }

  const savePosition = async () => {
    if (operation.current || !selectedMap || !selectedSite) return
    const position = { x: Number(x) / 100, y: Number(y) / 100 }
    if (!x.trim() || !y.trim() || !Number.isFinite(position.x) || !Number.isFinite(position.y) || position.x < 0 || position.x > 1 || position.y < 0 || position.y > 1) { setError('fieldMaps.error.position'); return }
    operation.current = true
    setBusy(true)
    setError(null)
    try {
      await updateData((current) => {
        const map = current.fieldMaps.find((item) => item.id === selectedMap.id)
        const site = current.fieldSites.find((item) => item.id === selectedSite.id)
        if (!map || !site || map.projectId !== site.projectId || map.image.base64 !== selectedMap.image.base64) throw new Error('map-site-changed')
        const marker = { fieldSiteId: site.id, ...position }
        return { ...current, fieldMaps: current.fieldMaps.map((item) => item.id === map.id ? { ...item, markers: [...item.markers.filter((point) => point.fieldSiteId !== site.id), marker], updatedAt: new Date().toISOString() } : item) }
      })
    } catch (failure) { setError(failure instanceof WorkspaceCapacityError ? 'feedback.backup.tooLarge' : 'fieldMaps.error.saveFailed') }
    finally { operation.current = false; setBusy(false) }
  }

  const remove = async () => {
    if (!removal || operation.current) return
    operation.current = true
    setBusy(true)
    setError(null)
    try {
      await updateData((current) => ({ ...current, fieldMaps: removal.kind === 'map' ? current.fieldMaps.filter((map) => map.id !== removal.mapId) : current.fieldMaps.map((map) => map.id === removal.mapId ? { ...map, markers: map.markers.filter((point) => point.fieldSiteId !== removal.siteId), updatedAt: new Date().toISOString() } : map) }))
      setRemoval(null)
      if (removal.kind === 'map') { setMapId(''); setSiteId('') }
    } catch (failure) { setError(failure instanceof WorkspaceCapacityError ? 'feedback.backup.tooLarge' : 'fieldMaps.error.saveFailed') }
    finally { operation.current = false; setBusy(false) }
  }
  const keyboardPosition = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || !selectedSite || busy) return
    const direction: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
    const delta = direction[event.key]
    if (!delta) return
    event.preventDefault()
    setX(String(Math.max(0, Math.min(100, (Number(x) || 0) + delta[0]))))
    setY(String(Math.max(0, Math.min(100, (Number(y) || 0) + delta[1]))))
  }

  return <section className="local-field-maps">
    <div className="field-map-intro panel">
      <div><p className="eyebrow">{t('fieldMaps.eyebrow')}</p><h2>{t('fieldMaps.title')}</h2><p>{t('fieldMaps.description')}</p></div>
      <AddButton disabled={busy} onClick={() => openEditor()}>{t('fieldMaps.import')}</AddButton>
      <p className="field-map-notice">{t('fieldMaps.privacy')}</p>
    </div>
    {error && !removal && <p className="text-danger" role="alert">{t(error)}</p>}
    {!selectedMap ? <EmptyState title={t('fieldMaps.emptyTitle')} description={t('fieldMaps.emptyDescription')} /> : <>
      <div className="field-map-toolbar panel">
        <Field label={t('fieldMaps.selectMap')}><select disabled={busy} value={selectedMap.id} onChange={(event) => { setMapId(event.target.value); setSiteId(''); setError(null) }}>{data.fieldMaps.map((map) => <option key={map.id} value={map.id}>{map.title}</option>)}</select></Field>
        <Button disabled={busy} onClick={() => openEditor(selectedMap)}>{t('fieldMaps.edit')}</Button>
        <Button disabled={busy} onClick={() => { setError(null); setRemoval({ kind: 'map', mapId: selectedMap.id, label: selectedMap.title }) }}>{t('fieldMaps.deleteMap')}</Button>
      </div>
      <div className="field-map-layout">
        <section className="panel field-map-canvas-panel">
          <p className="field-map-caption">{t('fieldMaps.instructions')}</p>
          <div className="field-map-board" data-testid="field-map-board" role="group" tabIndex={0} aria-label={t('fieldMaps.canvas', { title: selectedMap.title })} onKeyDown={keyboardPosition} onClick={(event) => {
            if (!selectedSite || busy || event.target !== event.currentTarget && !(event.target instanceof HTMLImageElement)) return
            const position = fieldMapPosition(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect())
            if (position) { setX(String(Math.round(position.x * 100))); setY(String(Math.round(position.y * 100))); setError(null) }
          }}>
            <img draggable={false} src={`data:${selectedMap.image.mimeType};base64,${selectedMap.image.base64}`} alt={selectedMap.title} />
            {selectedMap.markers.map((marker, index) => {
              const site = sites.find((item) => item.id === marker.fieldSiteId)
              if (!site) return null
              return <button type="button" className={`field-map-marker ${site.id === selectedSite?.id ? 'is-selected' : ''}`} style={{ left: `${marker.x * 100}%`, top: `${marker.y * 100}%` }} key={marker.fieldSiteId} disabled={busy} aria-label={t('fieldMaps.selectMarker', { name: site.nameOrAlias })} aria-pressed={site.id === selectedSite?.id} onClick={(event) => { event.stopPropagation(); setSiteId(site.id); setX(String(Math.round(marker.x * 100))); setY(String(Math.round(marker.y * 100))) }}>{index + 1}</button>
            })}
            {selectedSite && x.trim() && y.trim() && Number(x) >= 0 && Number(x) <= 100 && Number(y) >= 0 && Number(y) <= 100 && <span aria-hidden="true" className="field-map-draft" style={{ left: `${Number(x)}%`, top: `${Number(y)}%` }}>+</span>}
          </div>
          <p className="field-map-caption">{t('fieldMaps.imageNote', { name: selectedMap.image.fileName, width: formatNumber(selectedMap.image.width), height: formatNumber(selectedMap.image.height) })}</p>
        </section>
        <section className="panel field-map-details">
          <Field label={t('fieldMaps.selectSite')}><select value={selectedSite?.id || ''} disabled={busy} onChange={(event) => { setSiteId(event.target.value); setError(null) }}><option value="">{t('fieldMaps.selectSitePlaceholder')}</option>{sites.map((site) => <option key={site.id} value={site.id}>{site.nameOrAlias}</option>)}</select></Field>
          {!sites.length && <p>{t('fieldMaps.noSites')}</p>}
          <p className="field-map-caption">{t('fieldMaps.positionHint')}</p>
          <div className="field-map-position"><Field label={t('fieldMaps.x')}><input type="number" min="0" max="100" step="1" disabled={!selectedSite || busy} value={x} onChange={(event) => setX(event.target.value)} /></Field><Field label={t('fieldMaps.y')}><input type="number" min="0" max="100" step="1" disabled={!selectedSite || busy} value={y} onChange={(event) => setY(event.target.value)} /></Field></div>
          <div className="field-map-actions"><Button variant="primary" disabled={!selectedSite || busy} onClick={() => void savePosition()}>{t('fieldMaps.savePosition')}</Button>{selectedMarker && <Button disabled={busy} onClick={() => { setError(null); setRemoval({ kind: 'marker', mapId: selectedMap.id, siteId: selectedSite!.id, label: selectedSite!.nameOrAlias }) }}>{t('fieldMaps.deleteMarker')}</Button>}</div>
          {selectedSite && <div className="field-map-linked">
            <h3>{selectedSite.nameOrAlias}</h3>
            <div className="field-map-actions"><Button disabled={busy} onClick={() => onEditSite(selectedSite)}>{t('fieldMaps.editSite')}</Button><Button disabled={busy} onClick={() => onCreateVisit(selectedSite)}>{t('fieldMaps.addVisit')}</Button><Button disabled={busy} onClick={() => onCreateInterview(selectedSite)}>{t('fieldMaps.addInterview')}</Button></div>
            <h4>{t('fieldMaps.visits')}</h4><ul>{data.fieldVisits.filter((visit) => visit.projectId === selectedMap.projectId && visit.fieldSiteId === selectedSite.id).map((visit) => <li key={visit.id}>{formatDate(visit.date)} · {visit.purpose}</li>)}</ul>
            {!data.fieldVisits.some((visit) => visit.projectId === selectedMap.projectId && visit.fieldSiteId === selectedSite.id) && <p>{t('fieldMaps.noVisits')}</p>}
            <h4>{t('fieldMaps.interviews')}</h4><ul>{data.interviews.filter((interview) => interview.projectId === selectedMap.projectId && interview.fieldSiteId === selectedSite.id).map((interview) => <li key={interview.id}>{formatDate(interview.interviewDate)} · {interview.participantAlias}</li>)}</ul>
            {!data.interviews.some((interview) => interview.projectId === selectedMap.projectId && interview.fieldSiteId === selectedSite.id) && <p>{t('fieldMaps.noInterviews')}</p>}
          </div>}
        </section>
      </div>
    </>}
    <Modal open={Boolean(editor)} title={t(editor?.id ? 'fieldMaps.edit' : 'fieldMaps.import')} description={t('fieldMaps.formDescription')} onClose={closeEditor} footer={<><Button disabled={busy} onClick={closeEditor}>{t('common.cancel')}</Button><Button type="submit" form="field-map-form" variant="primary" disabled={busy || reading}>{t('fieldMaps.save')}</Button></>}>
      {editor && <form id="field-map-form" className="form-grid form-grid--spaced" onSubmit={(event) => void saveMap(event)}>
        {formError && <p className="text-danger form-span-2" role="alert">{t(formError)}</p>}
        <Field required label={t('fieldMaps.formTitle')} className="form-span-2"><input autoFocus required disabled={busy} maxLength={300} value={editor.title} onChange={(event) => setEditor({ ...editor, title: event.target.value })} /></Field>
        <Field required label={t('fieldMaps.project')} hint={editor.original?.markers.length && !replacingImage ? t('fieldMaps.projectProtected') : undefined}><ProjectSelect required disabled={busy || Boolean(editor.original?.markers.length && !(replacingImage && editor.clearMarkers))} projects={data.projects} value={editor.projectId} onChange={(projectId) => setEditor((current) => current ? { ...current, projectId } : null)} /></Field>
        <Field label={t('fieldMaps.image')} required={!editor.image} hint={t('fieldMaps.limits')}><input aria-label={t('fieldMaps.image')} type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; void readImage(file) }} /></Field>
        {reading && <p className="form-span-2" role="status">{t('fieldMaps.reading')}</p>}
        {editor.image && <p className="form-span-2 field-map-file"><Upload size={16} />{editor.image.fileName} · {formatNumber(editor.image.width)} × {formatNumber(editor.image.height)}</p>}
        {mustClear && <label className="field-map-consent form-span-2"><input type="checkbox" required disabled={busy} checked={editor.clearMarkers} onChange={(event) => setEditor({ ...editor, clearMarkers: event.target.checked })} />{t('fieldMaps.replaceConfirmation')}</label>}
        <label className="field-map-consent form-span-2"><input type="checkbox" required disabled={busy} checked={editor.rights} onChange={(event) => setEditor({ ...editor, rights: event.target.checked })} />{t('fieldMaps.rightsConfirmation')}</label>
      </form>}
    </Modal>
    <Modal open={Boolean(removal)} title={t(removal?.kind === 'map' ? 'fieldMaps.deleteMap' : 'fieldMaps.deleteMarker')} description={t('fieldMaps.deleteDescription', { name: removal?.label || '' })} onClose={() => { if (!busy) setRemoval(null) }} size="sm" footer={<><Button disabled={busy} onClick={() => setRemoval(null)}>{t('common.cancel')}</Button><Button disabled={busy} variant="danger" onClick={() => void remove()}>{t('fieldMaps.confirmDelete')}</Button></>}>
      {error && <p role="alert" className="text-danger">{t(error)}</p>}
      <div className="confirm-panel confirm-panel--danger"><MapPinned size={20} /><p>{t('fieldMaps.keepSite')}</p></div>
    </Modal>
  </section>
}
