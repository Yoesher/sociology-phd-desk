import { WORKSPACE_APPLICATION, WORKSPACE_SCHEMA_VERSION } from './domain'
import type {
  AnalysisRun,
  Claim,
  ClaimQuestionLink,
  Dataset,
  EvidenceItem,
  FieldSite,
  FieldVisit,
  Interview,
  LiteratureItem,
  Manuscript,
  ResearchLogEntry,
  ResearchProject,
  ResearchQuestion,
  ResearchTask,
  ReviewerComment,
  Submission,
  TheoryMemo,
  WorkspaceData,
} from './domain'

const DEMO_PROJECT_ID = 'demo-project-employment-mobility'
export const DEMO_WORKSPACE_ID = 'sociology-phd-desk-demo-workspace'
export const DEMO_WORKSPACE_DISPLAY_NAME = 'Sociology PhD Desk — Demo Workspace'
const DEMO_RESEARCH_QUESTION_ID = 'demo-question-employment-mobility'
const DEMO_LITERATURE_CLAIM_ID = 'demo-claim-literature-proposition'
const DEMO_QUANTITATIVE_CLAIM_ID = 'demo-claim-quantitative-expectation'
const DEMO_SITE_ID = 'demo-field-site-a'
const DEMO_DATASET_ID = 'demo-dataset-national-panel'
const DEMO_MANUSCRIPT_ID = 'demo-manuscript-employment-mobility'
const DEMO_SUBMISSION_ID = 'demo-submission-planning-record'
const DEMO_THEORY_PROJECT_ID = 'demo-project-platform-work-theory'
const DEMO_THEORY_QUESTION_ID = 'demo-question-employment-uncertainty'
const DEMO_THEORY_CLAIM_ID = 'demo-claim-institutional-buffering'

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function offsetDate(anchor: Date, days: number): string {
  const shifted = new Date(anchor)
  shifted.setUTCDate(shifted.getUTCDate() + days)
  return toIsoDate(shifted)
}

/**
 * Creates a complete synthetic workspace for product orientation.
 *
 * Nothing in this snapshot is a real citation, interview, field observation,
 * dataset, analysis result, journal submission, or reviewer exchange.
 */
function createDemoWorkspaceFixture(now: Date, includeTheory: boolean): WorkspaceData {
  const timestamp = now.toISOString()
  const entityMetadata = {
    createdAt: timestamp,
    updatedAt: timestamp,
    isDemo: true,
  }

  const projects: ResearchProject[] = [
    {
      ...entityMetadata,
      id: DEMO_PROJECT_ID,
      title: 'Employment Mobility among Young Adults [DEMO]',
      shortTitle: 'Youth mobility — DEMO',
      topic: 'Employment, mobility, and occupational mismatch — synthetic example',
      method: 'Mixed Methods',
      status: 'Analysis',
      startDate: offsetDate(now, -120),
      targetDate: offsetDate(now, 150),
      notes:
        'Synthetic orientation project. It contains no real participants, citations, research data, or findings.',
    },
    ...(includeTheory
      ? [
          {
            ...entityMetadata,
            id: DEMO_THEORY_PROJECT_ID,
            title: 'Platform Work and Employment Uncertainty — DEMO',
            shortTitle: 'Platform work theory — DEMO',
            topic: 'Conceptual workflow example for platform work and employment uncertainty',
            method: 'Theoretical' as const,
            status: 'Writing' as const,
            startDate: offsetDate(now, -30),
            targetDate: offsetDate(now, 120),
            notes:
              'Synthetic theory-workflow orientation project. It contains no verified proposition, citation, empirical result, or real institution.',
          },
        ]
      : []),
  ]

  const researchQuestions: ResearchQuestion[] = [
    {
      ...entityMetadata,
      id: DEMO_RESEARCH_QUESTION_ID,
      projectId: DEMO_PROJECT_ID,
      text: 'DEMO question: How might occupational mismatch shape employment mobility among young adults?',
      status: 'active',
      notes: 'Synthetic research question for product orientation; it does not describe a completed study.',
    },
    ...(includeTheory
      ? [
          {
            ...entityMetadata,
            id: DEMO_THEORY_QUESTION_ID,
            projectId: DEMO_THEORY_PROJECT_ID,
            text: 'DEMO question: How could institutional arrangements shape employment uncertainty in platform work?',
            status: 'active' as const,
            notes: 'Synthetic theoretical question for demonstrating the workflow; it is not a research conclusion.',
          },
        ]
      : []),
  ]

  const claims: Claim[] = [
    {
      ...entityMetadata,
      id: DEMO_LITERATURE_CLAIM_ID,
      projectId: DEMO_PROJECT_ID,
      text: 'DEMO proposition to investigate; not an established finding.',
      status: 'draft',
      notes: 'Synthetic analytical proposition. Its status does not imply evidentiary support.',
    },
    {
      ...entityMetadata,
      id: DEMO_QUANTITATIVE_CLAIM_ID,
      projectId: DEMO_PROJECT_ID,
      text: 'DEMO quantitative expectation to test; not a statistical conclusion.',
      status: 'draft',
      notes: 'Synthetic analytical expectation. No analysis has been run.',
    },
    ...(includeTheory
      ? [
          {
            ...entityMetadata,
            id: DEMO_THEORY_CLAIM_ID,
            projectId: DEMO_THEORY_PROJECT_ID,
            text: 'DEMO proposition: institutional buffering is a mechanism to examine, not an established explanation.',
            status: 'draft' as const,
            notes: 'Synthetic theoretical proposition. It has not been evaluated against evidence.',
          },
        ]
      : []),
  ]

  const claimQuestionLinks: ClaimQuestionLink[] = [
    {
      ...entityMetadata,
      id: 'demo-link-literature-claim-question',
      projectId: DEMO_PROJECT_ID,
      claimId: DEMO_LITERATURE_CLAIM_ID,
      researchQuestionId: DEMO_RESEARCH_QUESTION_ID,
    },
    {
      ...entityMetadata,
      id: 'demo-link-quantitative-claim-question',
      projectId: DEMO_PROJECT_ID,
      claimId: DEMO_QUANTITATIVE_CLAIM_ID,
      researchQuestionId: DEMO_RESEARCH_QUESTION_ID,
    },
    ...(includeTheory
      ? [
          {
            ...entityMetadata,
            id: 'demo-link-theory-claim-question',
            projectId: DEMO_THEORY_PROJECT_ID,
            claimId: DEMO_THEORY_CLAIM_ID,
            researchQuestionId: DEMO_THEORY_QUESTION_ID,
          },
        ]
      : []),
  ]

  const theoryMemos: TheoryMemo[] = includeTheory
    ? [
        {
          ...entityMetadata,
          id: 'demo-theory-memo-employment-uncertainty',
          projectId: DEMO_THEORY_PROJECT_ID,
          memoType: 'concept',
          title: 'Employment uncertainty — DEMO',
          content:
            'Synthetic concept-development placeholder for demonstrating the theory workflow. It is not a validated definition or a summary of a real publication.',
          relatedQuestionIds: [DEMO_THEORY_QUESTION_ID],
          relatedClaimIds: [],
          relatedLiteratureIds: [],
        },
        {
          ...entityMetadata,
          id: 'demo-theory-memo-institutional-buffering',
          projectId: DEMO_THEORY_PROJECT_ID,
          memoType: 'mechanism',
          title: 'Institutional buffering mechanism — DEMO',
          content:
            'Synthetic mechanism-planning placeholder. It records no observed process, empirical finding, or accepted theoretical result.',
          relatedQuestionIds: [DEMO_THEORY_QUESTION_ID],
          relatedClaimIds: [DEMO_THEORY_CLAIM_ID],
          relatedLiteratureIds: [],
        },
      ]
    : []

  const tasks: ResearchTask[] = [
    {
      ...entityMetadata,
      id: 'demo-task-reading',
      projectId: DEMO_PROJECT_ID,
      title: 'Review the three synthetic literature queue records',
      category: 'Reading',
      status: 'In Progress',
      dueDate: offsetDate(now, 0),
      priority: 'High',
      notes: 'DEMO task; the records are workflow examples, not real publications.',
    },
    {
      ...entityMetadata,
      id: 'demo-task-analysis',
      projectId: DEMO_PROJECT_ID,
      title: 'Specify a reproducibility checklist for the planned analysis',
      category: 'Analysis',
      status: 'To Do',
      dueDate: offsetDate(now, 1),
      priority: 'High',
      notes: 'DEMO task; no model has been run.',
    },
    {
      ...entityMetadata,
      id: 'demo-task-writing',
      projectId: DEMO_PROJECT_ID,
      title: 'Outline the synthetic manuscript argument',
      category: 'Writing',
      status: 'To Do',
      dueDate: offsetDate(now, 3),
      priority: 'Medium',
      notes: 'DEMO task; this is not a real manuscript.',
    },
    {
      ...entityMetadata,
      id: 'demo-task-fieldwork',
      projectId: DEMO_PROJECT_ID,
      title: 'Check anonymous interview registry fields',
      category: 'Fieldwork / Interview',
      status: 'To Do',
      dueDate: offsetDate(now, 5),
      priority: 'Medium',
      notes: 'DEMO only. Do not store directly identifying participant information here.',
    },
    {
      ...entityMetadata,
      id: 'demo-task-submission',
      projectId: DEMO_PROJECT_ID,
      title: 'Review the sample revision matrix',
      category: 'Submission',
      status: 'Deferred',
      dueDate: offsetDate(now, 14),
      priority: 'Low',
      notes: 'DEMO only; no journal received this manuscript.',
    },
    ...(includeTheory
      ? [
          {
            ...entityMetadata,
            id: 'demo-task-theory-concept',
            projectId: DEMO_THEORY_PROJECT_ID,
            title: 'Review the synthetic concept boundary prompts',
            category: 'Theory / Conceptual Work' as const,
            status: 'To Do' as const,
            dueDate: offsetDate(now, 4),
            priority: 'Medium' as const,
            notes: 'DEMO task for a synthetic theory workflow; it contains no generated research content.',
          },
        ]
      : []),
  ]

  const literature: LiteratureItem[] = [
    {
      ...entityMetadata,
      id: 'demo-literature-1',
      title: '[DEMO] Occupational mismatch as a research workflow example',
      authors: ['DEMO Author A'],
      year: 2026,
      journal: 'Synthetic literature exercise — not a real journal citation',
      projectId: DEMO_PROJECT_ID,
      status: 'Reading',
      priority: 'High',
      whyRead: 'To demonstrate how a reading can be connected to a research question.',
      notes: 'Fictitious teaching record. No DOI is provided because this publication does not exist.',
    },
    {
      ...entityMetadata,
      id: 'demo-literature-2',
      title: '[DEMO] Early-career mobility and institutional context',
      authors: ['DEMO Author B', 'DEMO Author C'],
      year: 2026,
      journal: 'Synthetic literature exercise — not a real journal citation',
      projectId: DEMO_PROJECT_ID,
      status: 'To Read',
      priority: 'Medium',
      whyRead: 'To test literature triage and prioritization in the demo workspace.',
      notes: 'Fictitious teaching record. It makes no empirical or theoretical claim.',
    },
    {
      ...entityMetadata,
      id: 'demo-literature-3',
      title: '[DEMO] Connecting mixed-method evidence to manuscript claims',
      authors: ['DEMO Methods Collective'],
      year: 2026,
      journal: 'Synthetic literature exercise — not a real journal citation',
      projectId: DEMO_PROJECT_ID,
      status: 'Inbox',
      priority: 'Low',
      whyRead: 'To illustrate the boundary between a reference library and ResearchOps triage.',
      notes: 'Fictitious teaching record. No publication, URL, or DOI exists.',
    },
  ]

  const fieldSites: FieldSite[] = [
    {
      ...entityMetadata,
      id: DEMO_SITE_ID,
      nameOrAlias: 'DEMO-SITE-A',
      projectId: DEMO_PROJECT_ID,
      status: 'Planned',
      notes:
        'Synthetic site alias. No actual place or organization is represented. Do not store directly identifying participant information here.',
    },
  ]

  const interviews: Interview[] = [
    {
      ...entityMetadata,
      id: 'INT-001-DEMO',
      participantAlias: 'DEMO-PARTICIPANT-A',
      projectId: DEMO_PROJECT_ID,
      fieldSiteId: DEMO_SITE_ID,
      interviewDate: offsetDate(now, 12),
      status: 'Planned',
      transcriptStatus: 'Not Applicable',
      codingStatus: 'Not Applicable',
      memoStatus: 'Not Started',
      notes:
        'Synthetic scheduling placeholder. No person, interview, transcript, quotation, or consent record exists.',
    },
    {
      ...entityMetadata,
      id: 'INT-002-DEMO',
      participantAlias: 'DEMO-PARTICIPANT-B',
      projectId: DEMO_PROJECT_ID,
      fieldSiteId: DEMO_SITE_ID,
      interviewDate: offsetDate(now, 19),
      status: 'Planned',
      transcriptStatus: 'Not Applicable',
      codingStatus: 'Not Applicable',
      memoStatus: 'Not Started',
      notes:
        'Synthetic scheduling placeholder. No person, interview, transcript, quotation, or consent record exists.',
    },
  ]

  const fieldVisits: FieldVisit[] = [
    {
      ...entityMetadata,
      id: 'demo-field-visit-1',
      date: offsetDate(now, 7),
      projectId: DEMO_PROJECT_ID,
      fieldSiteId: DEMO_SITE_ID,
      purpose: 'DEMO planning exercise for an initial site visit.',
      observations: 'No observations recorded; this field visit did not occur.',
      followUp: 'Review the research-ethics checklist before any real fieldwork.',
      memo: 'Synthetic placeholder only. It contains no fieldnote material.',
    },
  ]

  const datasets: Dataset[] = [
    {
      ...entityMetadata,
      id: DEMO_DATASET_ID,
      name: 'National Panel Dataset — DEMO',
      wave: 'Synthetic wave A',
      source: 'Synthetic registry placeholder; no dataset is bundled or referenced.',
      projectId: DEMO_PROJECT_ID,
      notes: 'DEMO metadata only. There are no records, variables, or research data behind this entry.',
    },
  ]

  const analysisRuns: AnalysisRun[] = [
    {
      ...entityMetadata,
      id: 'demo-analysis-run-1',
      projectId: DEMO_PROJECT_ID,
      date: offsetDate(now, 2),
      software: 'Stata',
      datasetId: DEMO_DATASET_ID,
      sample: 'Planned synthetic sample definition — no observations',
      model: 'Illustrative model specification — not executed',
      outcome: 'Illustrative employment-mobility outcome',
      keyPredictor: 'Illustrative occupational-mismatch predictor',
      status: 'Planned',
      resultSummary: 'No result: this synthetic registry record has never been executed.',
    },
  ]

  const evidence: EvidenceItem[] = [
    {
      ...entityMetadata,
      id: 'demo-evidence-literature',
      projectId: DEMO_PROJECT_ID,
      claim: 'DEMO proposition to investigate; not an established finding.',
      evidenceType: 'Literature',
      source: 'demo-literature-1 (fictitious record)',
      locator: 'No source locator — the record is synthetic',
      finding: 'No finding recorded; this row demonstrates provenance fields only.',
      supportLevel: 'Unclear',
      limitations: 'There is no underlying publication or evidence.',
      manuscriptLocation: 'Planned discussion outline — DEMO',
    },
    {
      ...entityMetadata,
      id: 'demo-evidence-analysis',
      projectId: DEMO_PROJECT_ID,
      claim: 'DEMO quantitative expectation to test; not a statistical conclusion.',
      evidenceType: 'Quantitative Result',
      source: 'demo-analysis-run-1 (planned, never executed)',
      locator: 'No output file',
      finding: 'No finding recorded because no analysis or dataset exists.',
      supportLevel: 'Unclear',
      limitations: 'Entirely synthetic workflow metadata.',
      manuscriptLocation: 'Planned results outline — DEMO',
    },
  ]

  const researchLogs: ResearchLogEntry[] = [
    {
      ...entityMetadata,
      id: 'demo-research-log-1',
      date: offsetDate(now, -1),
      projectId: DEMO_PROJECT_ID,
      whatChanged: 'Separated the illustrative claim from its future evidence sources.',
      decision: 'Keep unexecuted analyses marked Planned and support level Unclear.',
      problem: 'A workflow example could otherwise be mistaken for an empirical result.',
      nextStep: 'Review provenance fields before adding any user-owned evidence.',
    },
    {
      ...entityMetadata,
      id: 'demo-research-log-2',
      date: offsetDate(now, 0),
      projectId: DEMO_PROJECT_ID,
      whatChanged: 'Added explicit DEMO labels to the literature and fieldwork registries.',
      decision: 'Never include realistic DOI values or participant narratives in bundled data.',
      problem: 'Synthetic examples must remain unmistakable when exported.',
      nextStep: 'Explore the Today workspace and then create a separate user project.',
    },
  ]

  const manuscripts: Manuscript[] = [
    {
      ...entityMetadata,
      id: DEMO_MANUSCRIPT_ID,
      title: 'Employment Mobility and Occupational Mismatch [DEMO]',
      projectId: DEMO_PROJECT_ID,
      targetJournal: 'To be selected — DEMO, no real journal targeted',
      status: 'Outline',
      wordCount: 0,
      nextAction: 'Draft an argument map using synthetic placeholders only.',
      deadline: offsetDate(now, 90),
    },
  ]

  const submissions: Submission[] = [
    {
      ...entityMetadata,
      id: DEMO_SUBMISSION_ID,
      projectId: DEMO_PROJECT_ID,
      manuscriptId: DEMO_MANUSCRIPT_ID,
      journal: 'DEMO journal placeholder — no real venue',
      manuscriptVersion: 'demo-outline-v0',
      status: 'Preparing',
      editorialStatus: 'Not submitted',
      notes: 'Synthetic pipeline record. Nothing has been sent to a journal.',
    },
  ]

  const reviewerComments: ReviewerComment[] = [
    {
      ...entityMetadata,
      id: 'demo-reviewer-comment-1',
      submissionId: DEMO_SUBMISSION_ID,
      reviewer: 'DEMO REVIEWER — not a real person',
      commentId: 'DEMO-C1',
      comment: 'Synthetic prompt: clarify how each planned claim will connect to traceable evidence.',
      severity: 'Major',
      response: 'DEMO response draft; no reviewer received this text.',
      revisionAction: 'Add a claim-to-source map after real evidence exists.',
      status: 'Open',
    },
  ]

  return {
    application: WORKSPACE_APPLICATION,
    version: WORKSPACE_SCHEMA_VERSION,
    exportedAt: timestamp,
    workspace: {
      ...entityMetadata,
      id: DEMO_WORKSPACE_ID,
      name: DEMO_WORKSPACE_DISPLAY_NAME,
      description:
        'A fully synthetic orientation workspace. It contains no real citations, people, research data, findings, or submissions.',
      activeProjectId: DEMO_PROJECT_ID,
      revision: 0,
      todayGoals: [
        'Trace one DEMO claim back to its placeholder source',
        'Review the planned analysis reproducibility fields',
        'Check the anonymous fieldwork registry design',
      ],
    },
    projects,
    researchQuestions,
    claims,
    claimQuestionLinks,
    theoryMemos,
    tasks,
    literature,
    literatureExternalReferences: [],
    fieldSites,
    interviews,
    fieldVisits,
    datasets,
    analysisRuns,
    evidence,
    researchLogs,
    manuscripts,
    submissions,
    reviewerComments,
  }
}

export function createDemoWorkspace(now: Date = new Date()): WorkspaceData {
  return createDemoWorkspaceFixture(now, true)
}

function canonicalDemoValue(value: unknown, topLevel = false): unknown {
  if (Array.isArray(value)) {
    const normalized = value.map((item) => canonicalDemoValue(item))
    if (
      normalized.every(
        (item) =>
          typeof item === 'object' &&
          item !== null &&
          !Array.isArray(item) &&
          typeof (item as Record<string, unknown>)['id'] === 'string',
      )
    ) {
      return [...normalized].sort((left, right) =>
        String((left as Record<string, unknown>)['id']).localeCompare(
          String((right as Record<string, unknown>)['id']),
        ),
      )
    }
    return normalized
  }
  if (typeof value !== 'object' || value === null) return value

  const record = value as Record<string, unknown>
  return Object.fromEntries(
    Object.keys(record)
      .filter((key) => !(topLevel && key === 'exportedAt'))
      .sort()
      .map((key) => [key, canonicalDemoValue(record[key])]),
  )
}

/**
 * Only an exact, untouched bundled fixture is classified as a pristine demo.
 * A mixed or edited legacy workspace must be retained as personal research.
 */
export function isPristineDemoWorkspace(workspace: WorkspaceData): boolean {
  if (
    workspace.workspace.id !== DEMO_WORKSPACE_ID ||
    workspace.workspace.revision !== 0 ||
    !workspace.workspace.isDemo
  ) {
    return false
  }

  const createdAt = new Date(workspace.workspace.createdAt)
  if (Number.isNaN(createdAt.getTime())) return false
  const expected = createDemoWorkspace(createdAt)
  const historicalV3FixtureMigratedToV4 = createDemoWorkspaceFixture(createdAt, false)
  return (
    JSON.stringify(canonicalDemoValue(workspace, true)) ===
      JSON.stringify(canonicalDemoValue(expected, true)) ||
    JSON.stringify(canonicalDemoValue(workspace, true)) ===
      JSON.stringify(canonicalDemoValue(historicalV3FixtureMigratedToV4, true))
  )
}
