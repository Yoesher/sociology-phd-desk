import { useContext } from 'react'
import { WorkspaceSessionContext } from '../app/workspace-session-context'

export function useWorkspaceSession() {
  const context = useContext(WorkspaceSessionContext)
  if (!context) {
    throw new Error('useWorkspaceSession must be used within WorkspaceSessionProvider')
  }
  return context
}
