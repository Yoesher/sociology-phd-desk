import { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ConfirmDialog, Modal } from './ui'

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
  it('closes only the topmost dialog, preserves scroll lock, and restores focus by layer', async () => {
    const user = userEvent.setup()
    render(<NestedModalHarness />)

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

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog', { name: 'Replace current workspace?' })).not.toBeInTheDocument()
    expect(workspaceDialog).toBeInTheDocument()
    expect(document.body).toHaveClass('modal-open')
    expect(replaceTrigger).toHaveFocus()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog', { name: 'Workspace tools' })).not.toBeInTheDocument()
    expect(document.body).not.toHaveClass('modal-open')
    expect(workspaceTrigger).toHaveFocus()
  })
})
