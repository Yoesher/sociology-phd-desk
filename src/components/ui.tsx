import { useEffect, useId, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Database,
  FileQuestion,
  LockKeyhole,
  Plus,
  Search,
  X,
} from 'lucide-react'
import { useI18n } from '../i18n'

export type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'violet' | 'blue'

const focusableSelector = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',')

interface ModalStackEntry {
  id: string
  dialog: HTMLElement
  onClose: () => void
  restoreTargets: HTMLElement[]
}

const modalStack: ModalStackEntry[] = []
let modalKeydownAttached = false

function getFocusableElements(dialog: HTMLElement) {
  return Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector)).filter(
    (element) =>
      element.getAttribute('aria-hidden') !== 'true' &&
      !element.hidden &&
      !(element instanceof HTMLInputElement && element.type === 'hidden') &&
      !element.closest('[inert]'),
  )
}

function focusFirstInteractive(dialog: HTMLElement) {
  const target = getFocusableElements(dialog)[0]
  ;(target ?? dialog).focus({ preventScroll: true })
}

function handleModalKeyDown(event: KeyboardEvent) {
  const topmostModal = modalStack.at(-1)
  if (!topmostModal) return

  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    topmostModal.onClose()
    return
  }

  if (event.key !== 'Tab' || event.altKey || event.ctrlKey || event.metaKey) return
  const focusableElements = getFocusableElements(topmostModal.dialog)
  if (focusableElements.length === 0) {
    event.preventDefault()
    topmostModal.dialog.focus({ preventScroll: true })
    return
  }

  const first = focusableElements[0]
  const last = focusableElements.at(-1)!
  const activeElement = document.activeElement
  const focusIsOutsideTopmost =
    !(activeElement instanceof Node) || !topmostModal.dialog.contains(activeElement)

  if (event.shiftKey && (activeElement === first || focusIsOutsideTopmost)) {
    event.preventDefault()
    last.focus({ preventScroll: true })
  } else if (!event.shiftKey && (activeElement === last || focusIsOutsideTopmost)) {
    event.preventDefault()
    first.focus({ preventScroll: true })
  }
}

function syncModalLayers() {
  const topmostModal = modalStack.at(-1)
  modalStack.forEach((entry) => {
    const isTopmost = entry === topmostModal
    entry.dialog.toggleAttribute('inert', !isTopmost)
    if (isTopmost) {
      entry.dialog.removeAttribute('aria-hidden')
      entry.dialog.setAttribute('aria-modal', 'true')
    } else {
      entry.dialog.setAttribute('aria-hidden', 'true')
      entry.dialog.setAttribute('aria-modal', 'false')
    }
  })
}

function syncModalEnvironment() {
  const hasOpenModal = modalStack.length > 0
  document.body.classList.toggle('modal-open', hasOpenModal)
  syncModalLayers()

  if (hasOpenModal && !modalKeydownAttached) {
    document.addEventListener('keydown', handleModalKeyDown)
    modalKeydownAttached = true
  } else if (!hasOpenModal && modalKeydownAttached) {
    document.removeEventListener('keydown', handleModalKeyDown)
    modalKeydownAttached = false
  }
}

function registerModal(
  entry: Omit<ModalStackEntry, 'restoreTargets'>,
  preferredRestoreTarget?: HTMLElement | null,
) {
  const activeElement = document.activeElement
  const currentTop = modalStack.at(-1)
  const restoreTargets = [
    ...(preferredRestoreTarget instanceof HTMLElement && preferredRestoreTarget !== document.body
      ? [preferredRestoreTarget]
      : []),
    ...(activeElement instanceof HTMLElement && activeElement !== document.body ? [activeElement] : []),
    ...(currentTop?.restoreTargets ?? []),
  ].filter((element, index, elements) => elements.indexOf(element) === index)

  modalStack.push({ ...entry, restoreTargets })
  focusFirstInteractive(entry.dialog)
  syncModalEnvironment()
}

function unregisterModal(id: string) {
  const index = modalStack.findIndex((entry) => entry.id === id)
  if (index === -1) return

  const wasTopmost = index === modalStack.length - 1
  const [entry] = modalStack.splice(index, 1)
  syncModalEnvironment()

  if (!wasTopmost) return
  const restoreTarget = entry.restoreTargets.find((element) => element.isConnected)
  if (restoreTarget) {
    restoreTarget.focus({ preventScroll: true })
    return
  }

  const nextTopmost = modalStack.at(-1)
  if (nextTopmost) focusFirstInteractive(nextTopmost.dialog)
}

function isTopmostModal(id: string) {
  return modalStack.at(-1)?.id === id
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
  icon?: ReactNode
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button className={`button button--${variant} button--${size} ${className}`} {...props}>
      {icon}
      <span>{children}</span>
    </button>
  )
}

export function AddButton({ children, ...props }: Omit<ButtonProps, 'icon'>) {
  return (
    <Button variant="primary" icon={<Plus size={15} />} {...props}>
      {children}
    </Button>
  )
}

export function IconButton({
  label,
  children,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode }) {
  return (
    <button className={`icon-button ${className}`} aria-label={label} title={label} {...props}>
      {children}
    </button>
  )
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: Tone }) {
  return <span className={`badge badge--${tone}`}>{children}</span>
}

export function PageHeader({
  index,
  eyebrow,
  title,
  description,
  actions,
}: {
  index: string
  eyebrow: string
  title: string
  description: string
  actions?: ReactNode
}) {
  return (
    <header className="page-header">
      <div className="page-header__identity">
        <span className="page-header__index" aria-hidden="true">
          {index}
        </span>
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="page-header__description">{description}</p>
        </div>
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </header>
  )
}

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="section-header">
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function StatCard({
  label,
  value,
  detail,
  tone = 'neutral',
}: {
  label: string
  value: string | number
  detail?: string
  tone?: Tone
}) {
  return (
    <article className={`stat-card stat-card--${tone}`}>
      <p>{label}</p>
      <strong>{value}</strong>
      {detail && <span>{detail}</span>}
    </article>
  )
}

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  size = 'md',
}: {
  open: boolean
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}) {
  const { t } = useI18n()
  const titleId = useId()
  const descriptionId = useId()
  const stackId = useId()
  const dialogRef = useRef<HTMLElement>(null)
  const restoreTargetRef = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)
  const [present, setPresent] = useState(open)
  const [closing, setClosing] = useState(false)
  const rendered = present && !(import.meta.env.MODE === 'test' && !open)
  onCloseRef.current = onClose

  useLayoutEffect(() => {
    if (!open) {
      restoreTargetRef.current = null
      return
    }
    const activeElement = document.activeElement
    const dialog = dialogRef.current
    restoreTargetRef.current =
      activeElement instanceof HTMLElement &&
      activeElement !== document.body &&
      !dialog?.contains(activeElement)
        ? activeElement
        : null
  }, [open])

  useEffect(() => {
    if (open) {
      setPresent(true)
      setClosing(false)
      return
    }
    if (!present) return
    if (import.meta.env.MODE === 'test') {
      setPresent(false)
      setClosing(false)
      return
    }
    setClosing(true)
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const timer = window.setTimeout(() => {
      setPresent(false)
      setClosing(false)
    }, reduced ? 0 : 160)
    return () => window.clearTimeout(timer)
  }, [open, present])

  useLayoutEffect(() => {
    const dialog = dialogRef.current
    if (!rendered || !dialog) return

    registerModal(
      { id: stackId, dialog, onClose: () => onCloseRef.current() },
      restoreTargetRef.current,
    )
    return () => unregisterModal(stackId)
  }, [rendered, stackId])

  if (!rendered) return null

  const requestClose = () => {
    if (!closing && isTopmostModal(stackId)) onCloseRef.current()
  }

  return createPortal(
    <div className="modal-backdrop" data-closing={closing || undefined} role="presentation" onMouseDown={requestClose}>
      <section
        ref={dialogRef}
        className={`modal modal--${size}`}
        data-closing={closing || undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        aria-hidden={closing || undefined}
        inert={closing || undefined}
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal__header">
          <div>
            <p className="eyebrow">{t('modal.eyebrow')}</p>
            <h2 id={titleId}>{title}</h2>
            {description && <p id={descriptionId}>{description}</p>}
          </div>
          <IconButton label={t('common.closeDialog')} onClick={requestClose}>
            <X size={18} />
          </IconButton>
        </header>
        <div className="modal__body">{children}</div>
        {footer && <footer className="modal__footer">{footer}</footer>}
      </section>
    </div>,
    document.body,
  )
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  tone = 'danger',
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  tone?: 'danger' | 'primary'
  busy?: boolean
  onConfirm: () => void | Promise<void>
  onCancel: () => void
}) {
  const { t } = useI18n()
  return (
    <Modal
      open={open}
      title={title}
      description={description}
      onClose={busy ? () => undefined : onCancel}
      size="sm"
      footer={
        <>
          <Button disabled={busy} onClick={onCancel}>{t('common.cancel')}</Button>
          <Button variant={tone} disabled={busy} aria-busy={busy} onClick={() => void onConfirm()}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className={`confirm-panel confirm-panel--${tone}`}>
        <AlertTriangle size={20} />
        <p>{t('modal.localChange')}</p>
      </div>
    </Modal>
  )
}

export function Field({
  label,
  hint,
  required,
  children,
  className = '',
}: {
  label: string
  hint?: string
  required?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <label className={`field ${className}`}>
      <span className="field__label">
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </span>
      {children}
      {hint && <span className="field__hint">{hint}</span>}
    </label>
  )
}

export function DisclosureSection({
  summary,
  children,
  defaultOpen = false,
  className = '',
}: {
  summary: string
  children: ReactNode
  defaultOpen?: boolean
  className?: string
}) {
  return (
    <details className={`form-disclosure motion-collapse ${className}`} open={defaultOpen || undefined}>
      <summary>{summary}</summary>
      <div className="form-disclosure__content">{children}</div>
    </details>
  )
}

export function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  const { t } = useI18n()
  return (
    <label className="search-field">
      <Search size={15} aria-hidden="true" />
      <span className="sr-only">{t('common.search')}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder || t('common.searchRecords')} />
      {value && (
        <button type="button" aria-label={t('common.clearSearch')} onClick={() => onChange('')}>
          <X size={13} />
        </button>
      )}
    </label>
  )
}

export function FilterChips({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: string
  options: readonly { value: string; label: string }[]
  onChange: (value: string) => void
  ariaLabel: string
}) {
  return (
    <div className="filter-chips" role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value || 'all'}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="empty-state">
      <span className="empty-state__mark">
        <FileQuestion size={23} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  )
}

export function PrivacyNotice({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n()
  return (
    <aside className={`privacy-notice ${compact ? 'privacy-notice--compact' : ''}`}>
      <LockKeyhole size={18} />
      <div>
        <strong>{t('privacy.title')}</strong>
        <p>{t('privacy.body')}</p>
      </div>
    </aside>
  )
}

export function LocalDataNotice() {
  const { t } = useI18n()
  return (
    <div className="local-data-notice">
      <Database size={15} />
      <span>{t('storage.local')}</span>
    </div>
  )
}

export function TableActions({
  onEdit,
  onDelete,
  viewLabel,
  onView,
}: {
  onEdit?: () => void
  onDelete?: () => void
  viewLabel?: string
  onView?: () => void
}) {
  const { t } = useI18n()
  return (
    <div className="table-actions">
      {onView && (
        <button type="button" onClick={onView}>
          {viewLabel || t('common.view')} <ArrowRight size={13} />
        </button>
      )}
      {onEdit && (
        <button type="button" onClick={onEdit}>
          {t('common.edit')}
        </button>
      )}
      {onDelete && (
        <button type="button" className="text-danger" onClick={onDelete}>
          {t('common.delete')}
        </button>
      )}
    </div>
  )
}

export function ProgressBar({ value, label }: { value: number; label: string }) {
  const safeValue = Math.min(100, Math.max(0, value))
  return (
    <div className="progress" aria-label={`${label}: ${Math.round(safeValue)}%`}>
      <div className="progress__meta">
        <span>{label}</span>
        <strong>{Math.round(safeValue)}%</strong>
      </div>
      <div className="progress__track">
        <span style={{ width: `${safeValue}%` }} />
      </div>
    </div>
  )
}

export function CheckRow({
  checked,
  label,
  meta,
  onChange,
}: {
  checked: boolean
  label: string
  meta?: ReactNode
  onChange: () => void
}) {
  return (
    <button type="button" className={`check-row ${checked ? 'check-row--done' : ''}`} onClick={onChange}>
      <span className="check-row__box">{checked && <Check size={13} />}</span>
      <span className="check-row__label">{label}</span>
      {meta && <span className="check-row__meta">{meta}</span>}
    </button>
  )
}
