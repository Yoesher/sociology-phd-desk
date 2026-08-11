import { useEffect, useId, type ButtonHTMLAttributes, type ReactNode } from 'react'
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

export type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'violet' | 'blue'

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
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    document.body.classList.add('modal-open')
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.classList.remove('modal-open')
    }
  }, [onClose, open])

  if (!open) return null

  return createPortal(
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className={`modal modal--${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal__header">
          <div>
            <p className="eyebrow">Workspace record</p>
            <h2 id={titleId}>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <IconButton label="Close dialog" onClick={onClose}>
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
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  tone?: 'danger' | 'primary'
  onConfirm: () => void | Promise<void>
  onCancel: () => void
}) {
  return (
    <Modal
      open={open}
      title={title}
      description={description}
      onClose={onCancel}
      size="sm"
      footer={
        <>
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant={tone} onClick={() => void onConfirm()}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className={`confirm-panel confirm-panel--${tone}`}>
        <AlertTriangle size={20} />
        <p>This action changes the local workspace stored in this browser.</p>
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

export function SearchField({
  value,
  onChange,
  placeholder = 'Search records',
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <label className="search-field">
      <Search size={15} aria-hidden="true" />
      <span className="sr-only">Search</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
      {value && (
        <button type="button" aria-label="Clear search" onClick={() => onChange('')}>
          <X size={13} />
        </button>
      )}
    </label>
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
  return (
    <aside className={`privacy-notice ${compact ? 'privacy-notice--compact' : ''}`}>
      <LockKeyhole size={18} />
      <div>
        <strong>Protect participant privacy</strong>
        <p>
          Do not store directly identifying participant information here. Use aliases and anonymous case IDs only.
        </p>
      </div>
    </aside>
  )
}

export function LocalDataNotice() {
  return (
    <div className="local-data-notice">
      <Database size={15} />
      <span>Stored locally in this browser</span>
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
  return (
    <div className="table-actions">
      {onView && (
        <button type="button" onClick={onView}>
          {viewLabel || 'View'} <ArrowRight size={13} />
        </button>
      )}
      {onEdit && (
        <button type="button" onClick={onEdit}>
          Edit
        </button>
      )}
      {onDelete && (
        <button type="button" className="text-danger" onClick={onDelete}>
          Delete
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
