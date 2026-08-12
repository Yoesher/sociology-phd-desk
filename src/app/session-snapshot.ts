import {
  LocalWorkspaceManagerError,
  type OpenedLocalWorkspaceSession,
} from '../db/localWorkspaceManager'
import type { WorkspaceData } from '../models/domain'

/**
 * Reads a session snapshot for rendering without treating a closed runtime as
 * usable. The structural branch covers a session created by the previous Vite
 * HMR module generation; every other error remains visible to an error boundary.
 */
export function readMountableSnapshot(
  session: OpenedLocalWorkspaceSession | null,
): WorkspaceData | null {
  if (!session) return null
  try {
    return session.snapshot
  } catch (caught) {
    const closedSessionError = caught instanceof LocalWorkspaceManagerError
      ? caught.code === 'manager-closed'
      : Boolean(
          caught && typeof caught === 'object' &&
          'name' in caught && caught.name === 'LocalWorkspaceManagerError' &&
          'code' in caught && caught.code === 'manager-closed',
        )
    if (closedSessionError) return null
    throw caught
  }
}
