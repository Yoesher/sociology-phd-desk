import { useEffect, useRef, useState, type MouseEvent } from 'react'
import type { LiteraturePdf } from '../../models/domain'
import { useI18n } from '../../i18n'
import { pdfBlob } from './local-pdf'

/** Decode only the PDF the researcher downloads, rather than every visible row. */
export function PdfDownload({ pdf }: { pdf: LiteraturePdf }) {
  const allocated = useRef<string | null>(null)
  const [failed, setFailed] = useState(false)
  const { t } = useI18n()
  useEffect(() => () => {
    if (allocated.current) URL.revokeObjectURL(allocated.current)
    allocated.current = null
  }, [pdf])

  const download = (event: MouseEvent<HTMLAnchorElement>) => {
    try {
      allocated.current ??= URL.createObjectURL(pdfBlob(pdf))
      // Set the target during the trusted click, before its default download action.
      event.currentTarget.href = allocated.current
      setFailed(false)
    } catch {
      event.preventDefault()
      setFailed(true)
    }
  }

  return <span>
    <a className="button button--ghost button--sm" href="#" download={pdf.fileName} onClick={download} aria-label={t('feedback.pdf.downloadName', { name: pdf.fileName })}>{t('feedback.pdf.download')}</a>
    {failed && <span role="alert" className="text-danger">{t('feedback.pdf.downloadFailed')}</span>}
  </span>
}
