import type { WorkspaceData } from '../../models/domain'
import type { SegmentLocator } from '../../models/provenance'

/** Read-only selectors retain historical revisions and retired relationships. */
export function evidenceRevisionTrace(data: WorkspaceData, revisionId: string) {
  const evidenceRevision = data.evidenceRevisions.find((row) => row.id === revisionId)
  const claimLinks = data.evidenceClaimLinks.filter((row) => row.evidenceRevisionId === revisionId)
  const claimLinkIds = new Set(claimLinks.map((row) => row.id))
  const usages = data.evidenceUsages.filter((row) => claimLinkIds.has(row.evidenceClaimLinkId))
  return {
    evidenceRevision,
    sourceLinks: data.evidenceSourceLinks.filter((row) => row.evidenceRevisionId === revisionId),
    claimLinks,
    usages,
  }
}

export function claimRevisionTrace(data: WorkspaceData, revisionId: string) {
  return {
    claimRevision: data.claimRevisions.find((row) => row.id === revisionId),
    evidenceLinks: data.evidenceClaimLinks.filter((row) => row.claimRevisionId === revisionId),
    manuscriptLinks: data.claimManuscriptLinks.filter((row) => row.claimRevisionId === revisionId),
    derivations: data.claimDerivationLinks.filter((row) => row.claimRevisionId === revisionId),
  }
}

export function anchorRevisionTrace(data: WorkspaceData, revisionId: string) {
  const manuscriptLinks = data.claimManuscriptLinks.filter((row) => row.anchorRevisionId === revisionId)
  const linkIds = new Set(manuscriptLinks.map((row) => row.id))
  return {
    anchorRevision: data.manuscriptAnchorRevisions.find((row) => row.id === revisionId),
    manuscriptLinks,
    usages: data.evidenceUsages.filter((row) => linkIds.has(row.claimManuscriptLinkId)),
  }
}

/** Locale-neutral locator metadata; labels are rendered by the bilingual view. */
export function locatorNumbers(locator: SegmentLocator): string {
  switch (locator.kind) {
    case 'lineRange': return `${locator.start}–${locator.end}`
    case 'pageParagraph': return `${locator.page} / ${locator.paragraphStart}–${locator.paragraphEnd}`
    case 'timeRange': return `${locator.startMs}–${locator.endMs} ms`
    case 'externalAnchor': return `${locator.namespace}: ${locator.token}`
  }
}
