import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { BookMarked, Menu, Moon, MoreHorizontal, PanelLeftClose, Sun, X } from 'lucide-react'
import { navigationItems } from './navigation'
import { useTheme } from '../hooks/useTheme'
import { IconButton } from '../components/ui'
import { WorkspaceTools } from './WorkspaceTools'
import { useWorkspace } from '../hooks/useWorkspace'

export function AppShell() {
  const { theme, toggleTheme } = useTheme()
  const { data, saving, error, clearError } = useWorkspace()
  const [sidebarCompact, setSidebarCompact] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setMobileMenuOpen(false)
    window.scrollTo(0, 0)
  }, [location.pathname])

  const current = navigationItems.find((item) => item.path === location.pathname) ?? navigationItems[0]
  const primaryMobile = navigationItems.slice(0, 4)
  const hasDemoRecords = Boolean(data && [
    data.projects,
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
    <nav className="primary-nav" aria-label="Research workspace">
      {navigationItems.map((item) => {
        const Icon = item.icon
        return (
          <NavLink key={item.path} to={item.path} end={item.path === '/'} className="primary-nav__item">
            <span className="primary-nav__icon"><Icon size={17} strokeWidth={1.8} /></span>
            <span className="primary-nav__label">{item.label}</span>
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
              <strong>{saving ? 'Saving locally' : 'Local workspace'}</strong>
              <span>{data?.workspace.name || 'Loading…'}</span>
            </div>
          </div>
          <IconButton
            label={sidebarCompact ? 'Expand sidebar' : 'Compact sidebar'}
            onClick={() => setSidebarCompact((value) => !value)}
          >
            <PanelLeftClose size={17} />
          </IconButton>
        </div>
      </aside>

      <header className="mobile-header">
        <div className="brand brand--mobile">
          <span className="brand__mark"><BookMarked size={18} /></span>
          <div className="brand__copy"><strong>PhD Desk</strong><span>{current.label}</span></div>
        </div>
        <div className="mobile-header__actions">
          <IconButton label="Toggle color theme" onClick={toggleTheme}>
            {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
          </IconButton>
          <IconButton label="Open navigation" onClick={() => setMobileMenuOpen(true)}>
            <Menu size={19} />
          </IconButton>
        </div>
      </header>

      <div className="topbar">
        <div className="topbar__context">
          <span>{current.index}</span>
          <strong>{current.label}</strong>
        </div>
        <div className="topbar__actions">
          {hasDemoRecords && <span className="badge badge--warning">Synthetic demo records</span>}
          <span className="privacy-chip">Private by default</span>
          <WorkspaceTools />
          <IconButton label={`Use ${theme === 'light' ? 'dark' : 'light'} theme`} onClick={toggleTheme}>
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </IconButton>
        </div>
      </div>

      <main className="app-main">
        {error && (
          <div className="app-error" role="alert">
            <span>{error}</span>
            <button type="button" onClick={clearError}>Dismiss</button>
          </div>
        )}
        <Outlet />
      </main>

      <nav className="mobile-bottom-nav" aria-label="Primary mobile navigation">
        {primaryMobile.map((item) => {
          const Icon = item.icon
          return (
            <NavLink key={item.path} to={item.path} end={item.path === '/'}>
              <Icon size={18} />
              <span>{item.shortLabel}</span>
            </NavLink>
          )
        })}
        <button
          type="button"
          className={primaryMobile.some((item) => item.path === location.pathname) ? '' : 'active'}
          onClick={() => setMobileMenuOpen(true)}
        >
          <MoreHorizontal size={18} />
          <span>More</span>
        </button>
      </nav>

      {mobileMenuOpen && (
        <div className="mobile-menu-backdrop" role="presentation" onMouseDown={() => setMobileMenuOpen(false)}>
          <aside className="mobile-menu" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div>
                <p className="eyebrow">Research workspace</p>
                <h2>Navigate</h2>
              </div>
              <IconButton label="Close navigation" onClick={() => setMobileMenuOpen(false)}>
                <X size={19} />
              </IconButton>
            </header>
            {nav}
            <footer>
              <WorkspaceTools compact />
              <IconButton label="Toggle color theme" onClick={toggleTheme}>
                {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
              </IconButton>
            </footer>
          </aside>
        </div>
      )}
    </div>
  )
}
