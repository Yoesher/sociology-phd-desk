import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import { PdfDownload } from './PdfDownload'

const NativeURL = URL
const pdf = { fileName: 'SYNTHETIC.pdf', size: 10, base64: btoa('%PDF-demo!') }
const create = vi.fn((_blob: Blob) => 'blob:synthetic-download')
const revoke = vi.fn()
beforeEach(() => {
  create.mockReset().mockReturnValue('blob:synthetic-download')
  revoke.mockReset()
  localStorage.clear()
  vi.stubGlobal('URL', class extends NativeURL {
    static createObjectURL = create
    static revokeObjectURL = revoke
  })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

function clickDownload() {
  const link = screen.getByRole('link')
  // jsdom cannot perform a browser download; real download bytes are checked in E2E.
  link.addEventListener('click', (event) => event.preventDefault(), { once: true })
  fireEvent.click(link)
  return link
}

describe('on-demand PDF downloads', () => {
  it('allocates no attachment blob when a literature row renders and reuses a clicked download', () => {
    const { unmount } = render(<I18nProvider><PdfDownload pdf={pdf} /></I18nProvider>)
    expect(create).not.toHaveBeenCalled()
    expect(clickDownload()).toHaveAttribute('href', 'blob:synthetic-download')
    expect(create).toHaveBeenCalledTimes(1)
    expect(create.mock.calls[0]![0]).toMatchObject({ type: 'application/pdf', size: pdf.size })
    clickDownload()
    expect(create).toHaveBeenCalledTimes(1)
    unmount()
    expect(revoke).toHaveBeenCalledWith('blob:synthetic-download')
  })

  it('releases a replaced attachment and lazily allocates its replacement', () => {
    const { rerender } = render(<I18nProvider><PdfDownload pdf={pdf} /></I18nProvider>)
    clickDownload()
    rerender(<I18nProvider><PdfDownload pdf={{ ...pdf, fileName: 'SYNTHETIC-replacement.pdf' }} /></I18nProvider>)
    expect(revoke).toHaveBeenCalledTimes(1)
    expect(create).toHaveBeenCalledTimes(1)
    expect(clickDownload()).toHaveAttribute('download', 'SYNTHETIC-replacement.pdf')
    expect(create).toHaveBeenCalledTimes(2)
  })

  it('reports allocation failure and permits a retry without altering the attachment', () => {
    create.mockImplementationOnce(() => { throw new Error('SYNTHETIC resource failure') })
    render(<I18nProvider><PdfDownload pdf={pdf} /></I18nProvider>)
    clickDownload()
    expect(screen.getByRole('alert')).toBeVisible()
    expect(pdf.base64).toBe(btoa('%PDF-demo!'))
    clickDownload()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
