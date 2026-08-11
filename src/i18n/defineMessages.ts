export type MessageTable = Record<string, string>

export function defineMessages<const English extends MessageTable>(
  en: English,
  zhCN: { [Key in keyof English]: string },
) {
  return { en, 'zh-CN': zhCN }
}
