import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  BookMarked,
  FolderCog,
  LockKeyhole,
  Menu,
  Moon,
  MoreHorizontal,
  PanelLeftClose,
  Sun,
  X,
} from 'lucide-react'
import { navigationItems } from './navigation'
import { useTheme } from '../hooks/useTheme'
import { IconButton } from '../components/ui'
import { WorkspaceTools } from './WorkspaceTools'
import { useWorkspace } from '../hooks/useWorkspace'
import { useI18n } from '../i18n'
import { LanguageControl } from '../components/LanguageControl'
import { useWorkspaceSession } from '../hooks/useWorkspaceSession'
import { hasRetainedPlaintextSource } from '../models/workspace-registry'
import type { MessageKey } from '../i18n'

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
  const location = useLocation()

  useEffect(() => {
    setMobileMenuOpen(false)
    window.scrollTo(0, 0)
  }, [location.pathname])

  const current = navigationItems.find((item) => item.path === location.pathname) ?? navigationItems[0]
  const primaryMobile = navigationItems.slice(0, 4)
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

  const nav = (
    <nav className="primary-nav" aria-label={t('navigation.aria')}>
      {navigationItems.map((item) => {
        const Icon = item.icon
        return (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className="primary-nav__item"
            aria-label={t(item.labelKey)}
            title={sidebarCompact ? t(item.labelKey) : undefined}
          >
            <span className="primary-nav__icon"><Icon size={17} strokeWidth={1.8} /></span>
            <span className="primary-nav__label">{t(item.labelKey)}</span>
            <span className="primary-nav__index">{item.index}</span>
          </NavLink>
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
        {nav}
        <div className="sidebar__footer">
          <div className="local-status">
            <span className={`local-status__dot ${saving ? 'local-status__dot--saving' : ''}`} />
            <div>
              <strong title={activeWorkspace?.displayName}>
                {activeWorkspace?.displayName || t('common.loading')}
              </strong>
              <span>{saving ? t('shell.savingLocally') : t(modeLabelKey)}</span>
            </div>
          </div>
          <IconButton
            label={sidebarCompact ? t('navigation.expandSidebar') : t('navigation.compactSidebar')}
            onClick={() => setSidebarCompact((value) => !value)}
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
          <IconButton label={t('navigation.open')} onClick={() => setMobileMenuOpen(true)}>
            <Menu size={19} />
          </IconButton>
        </div>
      </header>

      <div className="topbar">
        <div className="topbar__context">
          <span>{current.index}</span>
          <strong>{t(current.labelKey)}</strong>
        </div>
        <div className="topbar__actions">
          {hasDemoRecords && <span className="badge badge--warning">{t('shell.syntheticDemo')}</span>}
          <button
            type="button"
            className="workspace-switcher"
            aria-label={t('shell.openWorkspaceCenterFor', {
              name: activeWorkspace?.displayName ?? t('shell.localWorkspace'),
            })}
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
            <NavLink key={item.path} to={item.path} end={item.path === '/'}>
              <Icon size={18} />
              <span>{t(item.shortLabelKey)}</span>
            </NavLink>
          )
        })}
        <button
          type="button"
          className={primaryMobile.some((item) => item.path === location.pathname) ? '' : 'active'}
          onClick={() => setMobileMenuOpen(true)}
        >
          <MoreHorizontal size={18} />
          <span>{t('common.more')}</span>
        </button>
      </nav>

      {mobileMenuOpen && (
        <div className="mobile-menu-backdrop" role="presentation" onMouseDown={() => setMobileMenuOpen(false)}>
          <aside className="mobile-menu" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div>
                <p className="eyebrow">{t('navigation.workspaceEyebrow')}</p>
                <h2 className="mobile-menu__workspace-name">{activeWorkspace?.displayName || t('navigation.title')}</h2>
                <p className="mobile-menu__workspace-mode">{t(modeLabelKey)}</p>
              </div>
              <IconButton label={t('navigation.close')} onClick={() => setMobileMenuOpen(false)}>
                <X size={19} />
              </IconButton>
            </header>
            {nav}
            <footer>
              <WorkspaceTools compact />
              <IconButton label={t('shell.openWorkspaceCenter')} onClick={() => openWorkspaceCenter('workspaces')}>
                <FolderCog size={17} />
              </IconButton>
              <IconButton disabled={busy} label={t('shell.lockWorkspace')} onClick={() => void lockActiveWorkspace()}>
                <LockKeyhole size={17} />
              </IconButton>
              <LanguageControl compact />
              <IconButton label={t('theme.toggle')} onClick={toggleTheme}>
                {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
              </IconButton>
            </footer>
          </aside>
        </div>
      )}
    </div>
  )
}
