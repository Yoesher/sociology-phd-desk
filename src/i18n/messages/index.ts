import { commonMessages } from './common'
import { evidenceMessages } from './evidence'
import { fieldworkMessages } from './fieldwork'
import { literatureMessages } from './literature'
import { localWorkspacesMessages } from './localWorkspaces'
import { manuscriptsMessages } from './manuscripts'
import { projectsMessages } from './projects'
import { publishingMessages } from './publishing'
import { quantitativeMessages } from './quantitative'
import { researchLogMessages } from './researchLog'
import { shellMessages } from './shell'
import { submissionsMessages } from './submissions'
import { todayMessages } from './today'
import { theoryMessages } from './theory'
import { workspaceMessages } from './workspace'

const en = {
  ...commonMessages.en,
  ...shellMessages.en,
  ...workspaceMessages.en,
  ...localWorkspacesMessages.en,
  ...todayMessages.en,
  ...theoryMessages.en,
  ...projectsMessages.en,
  ...publishingMessages.en,
  ...literatureMessages.en,
  ...fieldworkMessages.en,
  ...quantitativeMessages.en,
  ...evidenceMessages.en,
  ...researchLogMessages.en,
  ...manuscriptsMessages.en,
  ...submissionsMessages.en,
}

export type MessageKey = keyof typeof en

const zhCN: Record<MessageKey, string> = {
  ...commonMessages['zh-CN'],
  ...shellMessages['zh-CN'],
  ...workspaceMessages['zh-CN'],
  ...localWorkspacesMessages['zh-CN'],
  ...todayMessages['zh-CN'],
  ...theoryMessages['zh-CN'],
  ...projectsMessages['zh-CN'],
  ...publishingMessages['zh-CN'],
  ...literatureMessages['zh-CN'],
  ...fieldworkMessages['zh-CN'],
  ...quantitativeMessages['zh-CN'],
  ...evidenceMessages['zh-CN'],
  ...researchLogMessages['zh-CN'],
  ...manuscriptsMessages['zh-CN'],
  ...submissionsMessages['zh-CN'],
}

export const messages = { en, 'zh-CN': zhCN }
