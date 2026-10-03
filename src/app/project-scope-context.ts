import { createContext, useContext } from 'react'

export const ProjectScopeContext = createContext({
  projectId: '',
  enter: (_projectId: string): Promise<void> => Promise.resolve(),
})
export const useProjectScope = () => useContext(ProjectScopeContext)
