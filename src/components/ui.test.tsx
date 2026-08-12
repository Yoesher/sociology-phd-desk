import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { useState } from 'react'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ConfirmDialog, Modal } from './ui'
import { I18nProvider } from '../i18n'
import { APP_SETTINGS_STORAGE_KEY } from '../i18n/settings'

function NestedModalHarness() {
  const [workspaceOpen, setWorkspaceOpen] = useState(false)
  const [confirmationOpen, setConfirmationOpen] = useState(false)

  return (
    <>
      <button type="button" onClick={() => setWorkspaceOpen(true)}>
        Open workspace tools
      </button>
      <Modal
        open={workspaceOpen}
        title="Workspace tools"
        description="Import, export, or reset this workspace."
        onClose={() => setWorkspaceOpen(false)}
      >
        <button type="button" onClick={() => setConfirmationOpen(true)}>
          Replace workspace
        </button>
      </Modal>
      <ConfirmDialog
        open={confirmationOpen}
        title="Replace current workspace?"
        description="All current local records will be replaced."
        confirmLabel="Replace"
        onConfirm={() => setConfirmationOpen(false)}
        onCancel={() => setConfirmationOpen(false)}
      />
    </>
  )
}

describe('Modal stack', () => {
  afterEach(cleanup)

  beforeEach(() => {
    window.localStorage.clear()
    window.localStorage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify({ language: 'en' }))
  })

  it('closes only the topmost dialog, preserves scroll lock, and restores focus by layer', async () => {
    const user = userEvent.setup()
    render(<I18nProvider><NestedModalHarness /></I18nProvider>)

    const workspaceTrigger = screen.getByRole('button', { name: 'Open workspace tools' })
    await user.click(workspaceTrigger)

    const workspaceDialog = screen.getByRole('dialog', { name: 'Workspace tools' })
    const workspaceClose = within(workspaceDialog).getByRole('button', { name: 'Close dialog' })
    const replaceTrigger = within(workspaceDialog).getByRole('button', { name: 'Replace workspace' })
    expect(document.body).toHaveClass('modal-open')
    expect(workspaceClose).toHaveFocus()

    await user.click(replaceTrigger)

    const confirmDialog = screen.getByRole('dialog', { name: 'Replace current workspace?' })
    const confirmClose = within(confirmDialog).getByRole('button', { name: 'Close dialog' })
    expect(confirmClose).toHaveFocus()
    expect(document.body).toHaveClass('modal-open')
    expect(workspaceDialog).toHaveAttribute('inert')
    expect(workspaceDialog).toHaveAttribute('aria-hidden', 'true')
    expect(workspaceDialog).toHaveAttribute('aria-modal', 'false')
    expect(confirmDialog).not.toHaveAttribute('inert')
    expect(confirmDialog).not.toHaveAttribute('aria-hidden')
    expect(confirmDialog).toHaveAttribute('aria-modal', 'true')

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog', { name: 'Replace current workspace?' })).not.toBeInTheDocument()
    expect(workspaceDialog).toBeInTheDocument()
    expect(document.body).toHaveClass('modal-open')
    expect(workspaceDialog).not.toHaveAttribute('inert')
    expect(workspaceDialog).not.toHaveAttribute('aria-hidden')
    expect(workspaceDialog).toHaveAttribute('aria-modal', 'true')
    expect(replaceTrigger).toHaveFocus()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog', { name: 'Workspace tools' })).not.toBeInTheDocument()
    expect(document.body).not.toHaveClass('modal-open')
    expect(workspaceTrigger).toHaveFocus()
  })

  it('cycles Tab and Shift+Tab inside only the topmost dialog', async () => {
    const user = userEvent.setup()
    render(<I18nProvider><NestedModalHarness /></I18nProvider>)

    await user.click(screen.getByRole('button', { name: 'Open workspace tools' }))
    const workspaceDialog = screen.getByRole('dialog', { name: 'Workspace tools' })
    const workspaceClose = within(workspaceDialog).getByRole('button', { name: 'Close dialog' })
    const replaceTrigger = within(workspaceDialog).getByRole('button', { name: 'Replace workspace' })
    expect(workspaceClose).toHaveFocus()

    await user.tab({ shift: true })
    expect(replaceTrigger).toHaveFocus()
    await user.tab()
    expect(workspaceClose).toHaveFocus()

    await user.click(replaceTrigger)
    const confirmDialog = screen.getByRole('dialog', { name: 'Replace current workspace?' })
    const confirmClose = within(confirmDialog).getByRole('button', { name: 'Close dialog' })
    const confirmAction = within(confirmDialog).getByRole('button', { name: 'Replace' })
    expect(confirmClose).toHaveFocus()

    await user.tab({ shift: true })
    expect(confirmAction).toHaveFocus()
    await user.tab()
    expect(confirmClose).toHaveFocus()
    expect(workspaceDialog).toHaveAttribute('inert')
    expect(workspaceDialog).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('index security metadata', () => {
  it('defines a strict meta-deliverable CSP without unsupported frame-ancestor claims', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')
    const parsed = new DOMParser().parseFromString(html, 'text/html')
    const csp = parsed
      .querySelector('meta[http-equiv="Content-Security-Policy"]')
      ?.getAttribute('content')

    expect(csp).toBeTruthy()
    for (const directive of [
      'default-src',
      'script-src',
      'script-src-attr',
      'style-src',
      'img-src',
      'font-src',
      'connect-src',
      'worker-src',
      'object-src',
      'base-uri',
      'form-action',
      'frame-src',
    ]) {
      expect(csp).toMatch(new RegExp(`(?:^|;)\\s*${directive}\\s`))
    }
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("base-uri 'none'")
    expect(csp).toContain("frame-src 'none'")
    expect(csp).not.toContain("'unsafe-eval'")
    expect(csp).not.toContain('frame-ancestors')
    expect(parsed.characterSet).toBe('UTF-8')
    expect(parsed.title).toBe('Sociology PhD Desk｜社会学博士研究工作站')
    expect(parsed.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(
      '面向社会学博士生与研究者的本地优先 ResearchOps 工作站。',
    )
  })
})
