import type { LiteraturePdf } from '../../models/domain'

export const MAX_PDF_BYTES = 10 * 1024 * 1024
export const MAX_WORKSPACE_PDF_BYTES = 20 * 1024 * 1024

export function isValidLiteraturePdf(pdf: LiteraturePdf): boolean {
  if (pdf.size < 5 || pdf.size > MAX_PDF_BYTES || !pdf.fileName.toLowerCase().endsWith('.pdf')) return false
  const padding = pdf.base64.endsWith('==') ? 2 : pdf.base64.endsWith('=') ? 1 : 0
  if (pdf.base64.length % 4 !== 0 || pdf.base64.length * 3 / 4 - padding !== pdf.size) return false
  try {
    const bytes = atob(pdf.base64)
    return bytes.startsWith('%PDF-') && btoa(bytes) === pdf.base64
  } catch {
    return false
  }
}

export async function readLocalPdf(file: File): Promise<LiteraturePdf> {
  if (file.size < 5 || file.size > MAX_PDF_BYTES) throw new Error('pdf-size')
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192))
  }
  const pdf = { fileName: file.name, size: file.size, base64: btoa(binary) }
  if (!isValidLiteraturePdf(pdf)) throw new Error('pdf-invalid')
  return pdf
}

export function pdfBlob(pdf: LiteraturePdf): Blob {
  const bytes = Uint8Array.from(atob(pdf.base64), (character) => character.charCodeAt(0))
  return new Blob([bytes], { type: 'application/pdf' })
}
