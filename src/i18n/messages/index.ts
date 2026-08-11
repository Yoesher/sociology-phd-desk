import { commonMessages } from './common'
import { evidenceMessages } from './evidence'
import { fieldworkMessages } from './fieldwork'
import { literatureMessages } from './literature'
import { manuscriptsMessages } from './manuscripts'
import { projectsMessages } from './projects'
import { quantitativeMessages } from './quantitative'
import { researchLogMessages } from './researchLog'
import { shellMessages } from './shell'
import { submissionsMessages } from './submissions'
import { todayMessages } from './today'
import { workspaceMessages } from './workspace'

const en = {
  ...commonMessages.en,
  ...shellMessages.en,
  ...workspaceMessages.en,
  ...todayMessages.en,
  ...projectsMessages.en,
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
  ...todayMessages['zh-CN'],
  ...projectsMessages['zh-CN'],
  ...literatureMessages['zh-CN'],
  ...fieldworkMessages['zh-CN'],
  ...quantitativeMessages['zh-CN'],
  ...evidenceMessages['zh-CN'],
  ...researchLogMessages['zh-CN'],
  ...manuscriptsMessages['zh-CN'],
  ...submissionsMessages['zh-CN'],
}

export const messages = { en, 'zh-CN': zhCN }
