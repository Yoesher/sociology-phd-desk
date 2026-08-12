import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  BookMarked,
  ChevronDown,
  ChevronRight,
  FolderCog,
  LockKeyhole,
  Menu,
  Moon,
  MoreHorizontal,
  PanelLeftClose,
  Plus,
  Settings2,
  Sun,
  X,
} from 'lucide-react'
import {
  getActiveView,
  getNavigationItem,
  navigationItems,
  toNavigationView,
  type NavigationBadgeId,
  type NavigationItem,
  type PrimaryModuleId,
} from './navigation'
import { dispatchQuickAdd } from './navigationEvents'
import { useTheme } from '../hooks/useTheme'
import { IconButton } from '../components/ui'
import { WorkspaceTools } from './WorkspaceTools'
import { useWorkspace } from '../hooks/useWorkspace'
import { useI18n, type MessageKey } from '../i18n'
import { LanguageControl } from '../components/LanguageControl'
import { useWorkspaceSession } from '../hooks/useWorkspaceSession'
import { hasRetainedPlaintextSource } from '../models/workspace-registry'

const EXPANDED_GROUPS_STORAGE_KEY = 'sociology-phd-desk:navigation-expanded:v1'
const USER_EXPANDED_LIMIT = 2

function readExpandedGroups(): PrimaryModuleId[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(EXPANDED_GROUPS_STORAGE_KEY) ?? '[]')
    if (!Array.isArray(value)) return []
    const valid = new Set(navigationItems.map((item) => item.id))
    return value.filter((id): id is PrimaryModuleId => typeof id === 'string' && valid.has(id as PrimaryModuleId)).slice(-USER_EXPANDED_LIMIT)
  } catch {
    return []
  }
}

function todayIso() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export function AppShell() {
  const { theme, toggleTheme } = useTheme()
  const { t } = useI18n()
  const { data, saving, error, clearError } = useWorkspace()
  const {
    activeWorkspace,
    busy,
    lockActiveWorkspace,
    openWorkspaceCenter,
  } = useWorkspaceSession()
  const [sidebarCompact, setSidebarCompact] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userExpanded, setUserExpanded] = useState<PrimaryModuleId[]>(readExpandedGroups)
  const [mobileExpanded, setMobileExpanded] = useState<PrimaryModuleId | null>(null)
  const [compactFlyout, setCompactFlyout] = useState<PrimaryModuleId | 'settings' | null>(null)
  const [settingsExpanded, setSettingsExpanded] = useState(false)
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const quickAddRef = useRef<HTMLDivElement>(null)
  const quickAddTriggerRef = useRef<HTMLButtonElement>(null)
  const compactFlyoutRef = useRef<HTMLDivElement>(null)
  const compactTriggerRefs = useRef<Partial<Record<PrimaryModuleId | 'settings', HTMLButtonElement | null>>>({})
  const mobileMenuRef = useRef<HTMLElement>(null)
  const mobileMenuTriggerRef = useRef<HTMLButtonElement | null>(null)
  const location = useLocation()
  const current = getNavigationItem(location.pathname)
  const activeView = getActiveView(current, location.search)
  const primaryMobile = navigationItems.slice(0, 4)

  useEffect(() => {
    setMobileMenuOpen(false)
    setCompactFlyout(null)
    setQuickAddOpen(false)
    setMobileExpanded(current.id)
    window.scrollTo(0, 0)
  }, [current.id, location.pathname, location.search])

  useEffect(() => {
    try {
      window.localStorage.setItem(EXPANDED_GROUPS_STORAGE_KEY, JSON.stringify(userExpanded))
    } catch {
      // Navigation remains functional when storage is unavailable.
    }
  }, [userExpanded])

  useEffect(() => {
    const closeFloatingPanels = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (quickAddOpen && !quickAddRef.current?.contains(target)) setQuickAddOpen(false)
      if (compactFlyout && !compactFlyoutRef.current?.contains(target)) setCompactFlyout(null)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setQuickAddOpen(false)
      setCompactFlyout(null)
    }
    document.addEventListener('mousedown', closeFloatingPanels)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeFloatingPanels)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [compactFlyout, quickAddOpen])

  useEffect(() => {
    if (compactFlyout) {
      compactFlyoutRef.current?.querySelector<HTMLElement>('.compact-flyout a, .compact-flyout button')?.focus()
    }
  }, [compactFlyout])

  useEffect(() => {
    if (quickAddOpen) quickAddRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
  }, [quickAddOpen])

  useEffect(() => {
    if (mobileMenuOpen) mobileMenuRef.current?.querySelector<HTMLElement>('[data-mobile-menu-close]')?.focus()
  }, [mobileMenuOpen])

  const badgeCounts = useMemo<Record<NavigationBadgeId, number>>(() => {
    if (!data) return { overdue: 0, 'to-read': 0, transcription: 0, coding: 0, failed: 0, revision: 0 }
    const today = todayIso()
    return {
      overdue: data.tasks.filter((task) => task.dueDate && task.dueDate < today && task.status !== 'Done').length,
      'to-read': data.literature.filter((item) => item.status === 'To Read').length,
      transcription: data.interviews.filter((item) => item.status !== 'Cancelled' && !['Complete', 'Not Applicable'].includes(item.transcriptStatus)).length,
      coding: data.interviews.filter((item) => item.status !== 'Cancelled' && !['Complete', 'Not Applicable'].includes(item.codingStatus)).length,
      failed: data.analysisRuns.filter((run) => run.status === 'Failed').length,
      revision:
        data.manuscripts.filter((manuscript) => manuscript.status === 'Revision').length +
        data.submissions.filter((submission) => submission.status === 'Revision').length,
    }
  }, [data])

  const modeLabelKey: MessageKey = activeWorkspace?.encryptionMode === 'encrypted'
    ? hasRetainedPlaintextSource(activeWorkspace)
      ? 'shell.workspaceMode.encryptedCleanupPending'
      : 'shell.workspaceMode.encrypted'
    : 'shell.workspaceMode.standard'
  const hasDemoRecords = Boolean(data && [
    data.projects,
    data.researchQuestions,
    data.claims,
    data.claimQuestionLinks,
    data.theoryMemos,
    data.tasks,
    data.literature,
    data.fieldSites,
    data.interviews,
    data.fieldVisits,
    data.datasets,
    data.analysisRuns,
    data.evidence,
    data.researchLogs,
    data.manuscripts,
    data.submissions,
    data.reviewerComments,
  ].some((records) => records.some((record) => record.isDemo)))

  const toggleExpanded = (id: PrimaryModuleId) => {
    if (id === current.id) return
    setUserExpanded((expanded) => expanded.includes(id)
      ? expanded.filter((candidate) => candidate !== id)
      : [...expanded.filter((candidate) => candidate !== id), id].slice(-USER_EXPANDED_LIMIT))
  }

  const emitQuickAdd = (module: PrimaryModuleId, action: string) => {
    dispatchQuickAdd({ module, action })
    setQuickAddOpen(false)
    setMobileMenuOpen(false)
  }

  const closeCompactFlyout = (restoreFocus = false) => {
    const open = compactFlyout
    setCompactFlyout(null)
    if (restoreFocus && open) compactTriggerRefs.current[open]?.focus()
  }

  const closeQuickAdd = (restoreFocus = false) => {
    setQuickAddOpen(false)
    if (restoreFocus) quickAddTriggerRef.current?.focus()
  }

  const openMobileMenu = (trigger: HTMLButtonElement) => {
    mobileMenuTriggerRef.current = trigger
    setMobileMenuOpen(true)
  }

  const closeMobileMenu = (restoreFocus = false) => {
    setMobileMenuOpen(false)
    if (restoreFocus) mobileMenuTriggerRef.current?.focus()
  }

  const handleFloatingPanelKeys = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    closeQuickAdd(true)
    closeCompactFlyout(true)
  }

  const handleMobileMenuKeys = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeMobileMenu(true)
      return
    }
    if (event.key !== 'Tab') return
    const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )).filter((element) => !element.hidden)
    if (!focusable.length) return
    const first = focusable[0]
    const last = focusable.at(-1)!
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const renderSecondaryLinks = (item: NavigationItem, compact = false) => (
    <nav
      className={compact ? 'secondary-nav secondary-nav--flyout' : 'secondary-nav'}
      aria-label={t('navigation.secondaryAria', { module: t(item.labelKey) })}
    >
      {item.views.map((view) => {
        const count = view.badgeId ? badgeCounts[view.badgeId] : 0
        const active = location.pathname === item.path && activeView.id === view.id
        const badgeDescriptionId = count > 0 ? `nav-${item.id}-${view.id}-badge` : undefined
        return (
          <Link
            key={view.id}
            to={toNavigationView(item, view.id)}
            className={active ? 'active' : ''}
            aria-current={active ? 'page' : undefined}
            aria-label={t(view.labelKey)}
            aria-describedby={badgeDescriptionId}
          >
            <span>{t(view.labelKey)}</span>
            {count > 0 && (
              <span
                id={badgeDescriptionId}
                className="secondary-nav__badge"
                aria-label={t('navigation.badge', { count })}
              >
                {count > 99 ? '99+' : count}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )

  const renderSettings = (compact = false) => (
    <div className={compact ? 'settings-nav settings-nav--flyout' : 'settings-nav'}>
      <button type="button" onClick={() => openWorkspaceCenter('workspaces')}>
        {t('navigation.myWorkspace')}
      </button>
      <button type="button" onClick={() => openWorkspaceCenter('privacy')}>
        {t('navigation.privacyLock')}
      </button>
      <button type="button" onClick={() => openWorkspaceCenter('backup')}>
        {t('navigation.backupRestore')}
      </button>
      <button type="button" onClick={() => openWorkspaceCenter('distribution')}>
        {t('distribution.center.tab')}
      </button>
      <div className="settings-nav__controls">
        <span>{t('navigation.languageAppearance')}</span>
        <div>
          <LanguageControl compact />
          <IconButton label={t('theme.toggle')} onClick={toggleTheme}>
            {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
          </IconButton>
        </div>
      </div>
      <div className="settings-nav__tools">
        <span>{t('navigation.dataDiagnostics')}</span>
        <WorkspaceTools compact />
      </div>
    </div>
  )

  const desktopNav = (
    <nav className="primary-nav" aria-label={t('navigation.aria')}>
      {navigationItems.map((item) => {
        const Icon = item.icon
        const expanded = item.id === current.id || userExpanded.includes(item.id)
        const pathActive = location.pathname === item.path
        return (
          <div className={`primary-nav__group ${pathActive ? 'primary-nav__group--active' : ''}`} key={item.id}>
            <div className="primary-nav__row">
              <NavLink
                to={toNavigationView(item)}
                end={item.path === '/'}
                className="primary-nav__item"
                aria-label={t(item.labelKey)}
              >
                <span className="primary-nav__icon"><Icon size={17} strokeWidth={1.8} /></span>
                <span className="primary-nav__label">{t(item.labelKey)}</span>
                <span className="primary-nav__index">{item.index}</span>
              </NavLink>
              <button
                type="button"
                className="primary-nav__toggle"
                aria-expanded={expanded}
                aria-label={t(expanded ? 'navigation.collapseGroup' : 'navigation.expandGroup', { module: t(item.labelKey) })}
                onClick={() => toggleExpanded(item.id)}
              >
                {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            </div>
            {expanded && renderSecondaryLinks(item)}
          </div>
        )
      })}
    </nav>
  )

  const compactNav = (
    <nav className="primary-nav primary-nav--compact" aria-label={t('navigation.aria')}>
      {navigationItems.map((item) => {
        const Icon = item.icon
        const pathActive = location.pathname === item.path
        return (
          <div className="compact-nav__group" key={item.id} ref={compactFlyout === item.id ? compactFlyoutRef : undefined}>
            <button
              ref={(element) => { compactTriggerRefs.current[item.id] = element }}
              type="button"
              className={`compact-nav__button ${pathActive ? 'active' : ''}`}
              aria-expanded={compactFlyout === item.id}
              aria-label={t('navigation.openViews', { module: t(item.labelKey) })}
              title={t(item.labelKey)}
              onClick={() => compactFlyout === item.id ? closeCompactFlyout() : setCompactFlyout(item.id)}
            >
              <Icon size={18} strokeWidth={1.8} />
              <span className="sr-only">{t(item.labelKey)}</span>
            </button>
            {compactFlyout === item.id && (
              <div className="compact-flyout" role="dialog" aria-label={t(item.labelKey)} onKeyDown={handleFloatingPanelKeys}>
                <strong>{item.index} · {t(item.labelKey)}</strong>
                {renderSecondaryLinks(item, true)}
              </div>
            )}
          </div>
        )
      })}
    </nav>
  )

  const mobileNav = (
    <nav className="mobile-accordion" aria-label={t('navigation.aria')}>
      {navigationItems.map((item) => {
        const Icon = item.icon
        const expanded = mobileExpanded === item.id
        return (
          <div className="mobile-accordion__group" key={item.id}>
            <div>
              <NavLink to={toNavigationView(item)} end={item.path === '/'}>
                <Icon size={17} />
                <span>{item.index} · {t(item.labelKey)}</span>
              </NavLink>
              <button
                type="button"
                aria-expanded={expanded}
                aria-label={t(expanded ? 'navigation.collapseGroup' : 'navigation.expandGroup', { module: t(item.labelKey) })}
                onClick={() => setMobileExpanded(expanded ? null : item.id)}
              >
                {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
            </div>
            {expanded && renderSecondaryLinks(item)}
          </div>
        )
      })}
    </nav>
  )

  return (
    <div className={`app-shell ${sidebarCompact ? 'app-shell--compact' : ''}`}>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand__mark"><BookMarked size={20} strokeWidth={1.7} /></span>
          <div className="brand__copy">
            <strong>Sociology</strong>
            <span>PhD Desk</span>
          </div>
        </div>
        <div className="sidebar__rule"><span>ResearchOps</span></div>
        <div className="sidebar__scroll">{sidebarCompact ? compactNav : desktopNav}</div>
        <div className="sidebar__utilities">
          {sidebarCompact ? (
            <div className="compact-nav__group" ref={compactFlyout === 'settings' ? compactFlyoutRef : undefined}>
              <button
                ref={(element) => { compactTriggerRefs.current.settings = element }}
                type="button"
                className="compact-nav__button"
                aria-expanded={compactFlyout === 'settings'}
                aria-label={t('navigation.workspaceSettings')}
                title={t('navigation.workspaceSettings')}
                onClick={() => compactFlyout === 'settings' ? closeCompactFlyout() : setCompactFlyout('settings')}
              >
                <Settings2 size={18} />
              </button>
              {compactFlyout === 'settings' && (
                <div className="compact-flyout compact-flyout--settings" role="dialog" aria-label={t('navigation.workspaceSettings')} onKeyDown={handleFloatingPanelKeys}>
                  <strong>{t('navigation.workspaceSettings')}</strong>
                  {renderSettings(true)}
                </div>
              )}
            </div>
          ) : (
            <div className="workspace-settings-nav">
              <button
                type="button"
                className="workspace-settings-nav__trigger"
                aria-expanded={settingsExpanded}
                onClick={() => setSettingsExpanded((expanded) => !expanded)}
              >
                <Settings2 size={17} />
                <span>{t('navigation.workspaceSettings')}</span>
                {settingsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
              {settingsExpanded && renderSettings()}
            </div>
          )}
        </div>
        <div className="sidebar__footer">
          <div className="local-status">
            <span className={`local-status__dot ${saving ? 'local-status__dot--saving' : ''}`} />
            <div>
              <strong title={activeWorkspace?.displayName}>{activeWorkspace?.displayName || t('common.loading')}</strong>
              <span>{saving ? t('shell.savingLocally') : t(modeLabelKey)}</span>
            </div>
          </div>
          <IconButton
            label={sidebarCompact ? t('navigation.expandSidebar') : t('navigation.compactSidebar')}
            onClick={() => {
              setSidebarCompact((value) => !value)
              setCompactFlyout(null)
            }}
          >
            <PanelLeftClose size={17} />
          </IconButton>
        </div>
      </aside>

      <header className="mobile-header">
        <div className="brand brand--mobile">
          <span className="brand__mark"><BookMarked size={18} /></span>
          <div className="brand__copy brand__copy--workspace">
            <strong title={activeWorkspace?.displayName}>{activeWorkspace?.displayName || 'PhD Desk'}</strong>
            <span>{t(modeLabelKey)}</span>
          </div>
        </div>
        <div className="mobile-header__actions">
          <IconButton label={t('shell.openWorkspaceCenter')} onClick={() => openWorkspaceCenter('workspaces')}>
            <FolderCog size={17} />
          </IconButton>
          <IconButton disabled={busy} label={t('shell.lockWorkspace')} onClick={() => void lockActiveWorkspace()}>
            <LockKeyhole size={17} />
          </IconButton>
          <IconButton label={t('theme.toggle')} onClick={toggleTheme}>
            {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
          </IconButton>
          <IconButton label={t('navigation.open')} onClick={(event) => openMobileMenu(event.currentTarget)}>
            <Menu size={19} />
          </IconButton>
        </div>
      </header>

      <div className="topbar">
        <div className="topbar__context" aria-label={`${t(current.labelKey)} / ${t(activeView.labelKey)}`}>
          <span>{current.index}</span>
          <strong>{t(current.labelKey)}</strong>
          <ChevronRight size={13} aria-hidden="true" />
          <b>{t(activeView.labelKey)}</b>
        </div>
        <div className="topbar__actions">
          <div className="quick-add" ref={quickAddRef}>
            <button
              ref={quickAddTriggerRef}
              type="button"
              className="quick-add__trigger"
              aria-expanded={quickAddOpen}
              aria-haspopup="menu"
              onClick={() => quickAddOpen ? closeQuickAdd() : setQuickAddOpen(true)}
            >
              <Plus size={14} />
              <span>{t('quickAdd.open').replace(/^\+\s*/, '')}</span>
              <ChevronDown size={13} />
            </button>
            {quickAddOpen && (
              <div className="quick-add__menu" role="menu" aria-label={t('quickAdd.menuAria', { module: t(current.labelKey) })} onKeyDown={handleFloatingPanelKeys}>
                {current.quickAdd.map((action) => (
                  <button key={action.action} type="button" role="menuitem" onClick={() => emitQuickAdd(current.id, action.action)}>
                    {t(action.labelKey)}
                  </button>
                ))}
              </div>
            )}
          </div>
          {hasDemoRecords && <span className="badge badge--warning">{t('shell.syntheticDemo')}</span>}
          <button
            type="button"
            className="workspace-switcher"
            aria-label={t('shell.openWorkspaceCenterFor', { name: activeWorkspace?.displayName ?? t('shell.localWorkspace') })}
            onClick={() => openWorkspaceCenter('workspaces')}
          >
            <FolderCog size={15} aria-hidden="true" />
            <span>
              <strong>{activeWorkspace?.displayName || t('shell.localWorkspace')}</strong>
              <small>{t(modeLabelKey)}</small>
            </span>
          </button>
          <IconButton disabled={busy} label={t('shell.lockWorkspace')} onClick={() => void lockActiveWorkspace()}>
            <LockKeyhole size={16} />
          </IconButton>
          <LanguageControl />
          <WorkspaceTools />
          <IconButton label={theme === 'light' ? t('theme.useDark') : t('theme.useLight')} onClick={toggleTheme}>
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </IconButton>
        </div>
      </div>

      <main className="app-main">
        {error && (
          <div className="app-error" role="alert">
            <span>{t(`localWorkspaces.error.${error}` as MessageKey)}</span>
            <button type="button" onClick={clearError}>{t('common.dismiss')}</button>
          </div>
        )}
        <Outlet />
      </main>

      <nav className="mobile-bottom-nav" aria-label={t('navigation.mobileAria')}>
        {primaryMobile.map((item) => {
          const Icon = item.icon
          return (
            <NavLink key={item.id} to={toNavigationView(item)} end={item.path === '/'}>
              <Icon size={18} />
              <span>{t(item.shortLabelKey)}</span>
            </NavLink>
          )
        })}
        <button
          type="button"
          className={primaryMobile.some((item) => item.path === location.pathname) ? '' : 'active'}
          aria-label={t('navigation.more')}
          onClick={(event) => openMobileMenu(event.currentTarget)}
        >
          <MoreHorizontal size={18} />
          <span>{t('common.more')}</span>
        </button>
      </nav>

      {mobileMenuOpen && (
        <div className="mobile-menu-backdrop" role="presentation" onMouseDown={() => closeMobileMenu()}>
          <aside ref={mobileMenuRef} className="mobile-menu" role="dialog" aria-modal="true" aria-label={t('navigation.title')} onMouseDown={(event) => event.stopPropagation()} onKeyDown={handleMobileMenuKeys}>
            <header>
              <div>
                <p className="eyebrow">{t('navigation.workspaceEyebrow')}</p>
                <h2 className="mobile-menu__workspace-name">{activeWorkspace?.displayName || t('navigation.title')}</h2>
                <p className="mobile-menu__workspace-mode">{t(modeLabelKey)}</p>
              </div>
              <IconButton data-mobile-menu-close label={t('navigation.close')} onClick={() => closeMobileMenu(true)}>
                <X size={19} />
              </IconButton>
            </header>
            <div className="mobile-menu__scroll">
              {mobileNav}
              <section className="mobile-settings" aria-label={t('navigation.workspaceSettingsAria')}>
                <button type="button" className="mobile-settings__trigger" aria-expanded={settingsExpanded} onClick={() => setSettingsExpanded((expanded) => !expanded)}>
                  <Settings2 size={17} />
                  <span>{t('navigation.workspaceSettings')}</span>
                  {settingsExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                </button>
                {settingsExpanded && renderSettings()}
              </section>
            </div>
            <footer>
              {current.quickAdd.map((action) => (
                <button key={action.action} type="button" className="mobile-quick-add" onClick={() => emitQuickAdd(current.id, action.action)}>
                  <Plus size={15} /> {t(action.labelKey)}
                </button>
              ))}
            </footer>
          </aside>
        </div>
      )}
    </div>
  )
}
