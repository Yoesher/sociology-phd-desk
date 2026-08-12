import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WorkspaceAutoLock } from '../models/workspace-registry'
import { useAutoLock } from './useAutoLock'

const MINUTE = 60_000

describe('useAutoLock', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-12T08:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it.each([5, 15, 30, 60] satisfies WorkspaceAutoLock[])(
    'requests a lock after %s elapsed minutes',
    (autoLock) => {
      const onLock = vi.fn()
      renderHook(() => useAutoLock({ autoLock, onLock }))

      act(() => vi.advanceTimersByTime(autoLock * MINUTE - 1))
      expect(onLock).not.toHaveBeenCalled()
      act(() => vi.advanceTimersByTime(1))
      expect(onLock).toHaveBeenCalledOnce()

      act(() => vi.advanceTimersByTime(autoLock * MINUTE))
      expect(onLock).toHaveBeenCalledOnce()
    },
  )

  it('does not attach an active lock timer for never', () => {
    const onLock = vi.fn()
    renderHook(() => useAutoLock({ autoLock: 'never', onLock }))
    act(() => vi.advanceTimersByTime(365 * 24 * 60 * MINUTE))
    expect(onLock).not.toHaveBeenCalled()
  })

  it('resets elapsed time on trusted activity events', () => {
    const onLock = vi.fn()
    renderHook(() => useAutoLock({ autoLock: 5, onLock }))

    act(() => vi.advanceTimersByTime(4 * MINUTE))
    act(() => window.dispatchEvent(new Event('pointerdown')))
    act(() => vi.advanceTimersByTime(4 * MINUTE + 59_999))
    expect(onLock).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(onLock).toHaveBeenCalledOnce()
  })

  it('rechecks wall-clock elapsed time when a background tab becomes visible', () => {
    const onLock = vi.fn()
    let visibility: DocumentVisibilityState = 'hidden'
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility)
    renderHook(() => useAutoLock({ autoLock: 5, onLock }))

    act(() => document.dispatchEvent(new Event('visibilitychange')))
    vi.setSystemTime(new Date('2026-08-12T08:06:00.000Z'))
    visibility = 'visible'
    act(() => document.dispatchEvent(new Event('visibilitychange')))

    expect(onLock).toHaveBeenCalledOnce()
  })

  it('supports programmatic activity resets and removes timers/listeners on cleanup', () => {
    const onLock = vi.fn()
    const { result, unmount } = renderHook(() => useAutoLock({ autoLock: 5, onLock }))

    act(() => vi.advanceTimersByTime(4 * MINUTE))
    act(() => result.current.resetAutoLock())
    act(() => vi.advanceTimersByTime(4 * MINUTE))
    expect(onLock).not.toHaveBeenCalled()

    unmount()
    act(() => window.dispatchEvent(new Event('keydown')))
    act(() => vi.advanceTimersByTime(10 * MINUTE))
    expect(onLock).not.toHaveBeenCalled()
  })

  it('does nothing while disabled', () => {
    const onLock = vi.fn()
    renderHook(() => useAutoLock({ autoLock: 5, enabled: false, onLock }))
    act(() => vi.advanceTimersByTime(10 * MINUTE))
    expect(onLock).not.toHaveBeenCalled()
  })

  it('retries after a rejected lock without a busy loop and still honors activity resets', async () => {
    const onLock = vi.fn()
      .mockRejectedValueOnce(new Error('flush failed'))
      .mockResolvedValue(undefined)
    renderHook(() => useAutoLock({ autoLock: 5, onLock }))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * MINUTE)
    })
    expect(onLock).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(29_999)
    })
    expect(onLock).toHaveBeenCalledTimes(1)

    act(() => window.dispatchEvent(new Event('pointerdown')))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_001)
    })
    expect(onLock).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4 * MINUTE + 29_998)
    })
    expect(onLock).toHaveBeenCalledTimes(1)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(onLock).toHaveBeenCalledTimes(2)
  })

  it('locks conservatively if the injected wall clock moves backward', () => {
    const onLock = vi.fn()
    let now = 10 * MINUTE
    renderHook(() => useAutoLock({ autoLock: 5, onLock, now: () => now }))

    now -= MINUTE
    act(() => vi.advanceTimersByTime(5 * MINUTE))
    expect(onLock).toHaveBeenCalledOnce()
  })
})
