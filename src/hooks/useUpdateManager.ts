import { useContext } from 'react'
import { UpdateManagerContext } from '../app/update-manager-context'

export function useUpdateManager() {
  const value = useContext(UpdateManagerContext)
  if (!value) throw new Error('useUpdateManager must be used inside UpdateManagerProvider')
  return value
}
