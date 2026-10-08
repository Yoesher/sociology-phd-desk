import { useMemo } from 'react'
import { useWorkspace } from './useWorkspace'
import { useProjectScope } from '../app/project-scope-context'
import type { WorkspaceData } from '../models/domain'
import { PROVENANCE_COLLECTION_KEYS } from '../models/provenance'

/** Display projection only. Every mutation still receives the full workspace snapshot. */
export function projectDisplayData(data: WorkspaceData | null, projectId: string): WorkspaceData | null {
  if (!data || !projectId) return data
  const literatureIds = new Set(data.literature.filter((item) => item.projectId === projectId).map((item) => item.id))
  const submissionIds = new Set(data.submissions.filter((item) => item.projectId === projectId).map((item) => item.id))
  return {
    ...data,
    ...Object.fromEntries(PROVENANCE_COLLECTION_KEYS.map((key) => [key, data[key].filter((item) => item.projectId === projectId)])),
    workspace: { ...data.workspace, activeProjectId: projectId },
    projects: data.projects.filter((item) => item.id === projectId),
    researchQuestions: data.researchQuestions.filter((item) => item.projectId === projectId),
    claims: data.claims.filter((item) => item.projectId === projectId),
    claimQuestionLinks: data.claimQuestionLinks.filter((item) => item.projectId === projectId),
    theoryMemos: data.theoryMemos.filter((item) => item.projectId === projectId),
    tasks: data.tasks.filter((item) => item.projectId === projectId),
    literature: data.literature.filter((item) => item.projectId === projectId),
    literatureExternalReferences: data.literatureExternalReferences.filter((item) => literatureIds.has(item.literatureItemId)),
    fieldSites: data.fieldSites.filter((item) => item.projectId === projectId),
    fieldMaps: data.fieldMaps.filter((item) => item.projectId === projectId),
    interviews: data.interviews.filter((item) => item.projectId === projectId),
    fieldVisits: data.fieldVisits.filter((item) => item.projectId === projectId),
    datasets: data.datasets.filter((item) => item.projectId === projectId),
    analysisRuns: data.analysisRuns.filter((item) => item.projectId === projectId),
    evidence: data.evidence.filter((item) => item.projectId === projectId),
    researchLogs: data.researchLogs.filter((item) => item.projectId === projectId),
    manuscripts: data.manuscripts.filter((item) => item.projectId === projectId),
    submissions: data.submissions.filter((item) => item.projectId === projectId),
    reviewerComments: data.reviewerComments.filter((item) => submissionIds.has(item.submissionId)),
  }
}

export function useProjectWorkspace() {
  const workspace = useWorkspace()
  const { projectId } = useProjectScope()
  const data = useMemo(() => projectDisplayData(workspace.data, projectId), [workspace.data, projectId])
  return { ...workspace, data, fullData: workspace.data }
}
