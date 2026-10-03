import { useEffect, useState } from 'react'
import type { LiteraturePdf } from '../../models/domain'
import { useI18n } from '../../i18n'
import { pdfBlob } from './local-pdf'

export function PdfDownload({ pdf }: { pdf: LiteraturePdf }) {
  const [url, setUrl] = useState('')
  const { t } = useI18n()
  useEffect(() => {
    const next = URL.createObjectURL(pdfBlob(pdf))
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [pdf])
  return <a className="button button--ghost button--sm" href={url || undefined} download={pdf.fileName} aria-label={t('feedback.pdf.downloadName', { name: pdf.fileName })}>{t('feedback.pdf.download')}</a>
}
