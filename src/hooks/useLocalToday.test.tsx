import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLocalToday } from './useLocalToday'

describe('useLocalToday', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 3, 23, 59, 58))
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('updates at local midnight without interaction and schedules each following day', () => {
    const { result } = renderHook(() => useLocalToday())
    expect(result.current).toBe('2026-10-03')
    act(() => vi.advanceTimersByTime(1_999))
    expect(result.current).toBe('2026-10-03')
    act(() => vi.advanceTimersByTime(1))
    expect(result.current).toBe('2026-10-04')
    expect(vi.getTimerCount()).toBe(1)
    act(() => vi.advanceTimersByTime(86_400_000))
    expect(result.current).toBe('2026-10-05')
    expect(vi.getTimerCount()).toBe(1)
  })

  it.each([
    [new Date(2026, 0, 31, 23, 59, 59), '2026-02-01'],
    [new Date(2026, 11, 31, 23, 59, 59), '2027-01-01'],
    [new Date(2028, 1, 28, 23, 59, 59), '2028-02-29'],
  ])('follows calendar boundaries at %s', (start, expected) => {
    vi.setSystemTime(start)
    const { result } = renderHook(() => useLocalToday())
    act(() => vi.advanceTimersByTime(1_000))
    expect(result.current).toBe(expected)
  })

  it.each([
    [new Date(2026, 2, 8), new Date(2026, 2, 9), '2026-03-08', '2026-03-09'],
    [new Date(2026, 10, 1), new Date(2026, 10, 2), '2026-11-01', '2026-11-02'],
  ])('waits for local midnight across the calendar day starting %s', (start, end, firstDay, nextDay) => {
    // With TZ=America/New_York these are 23- and 25-hour days. The same
    // calendar behavior must also hold in zones without daylight saving.
    vi.setSystemTime(start)
    const { result } = renderHook(() => useLocalToday())
    act(() => vi.advanceTimersByTime(end.getTime() - start.getTime() - 1))
    expect(result.current).toBe(firstDay)
    act(() => vi.advanceTimersByTime(1))
    expect(result.current).toBe(nextDay)
  })

  it('rechecks the actual day on focus after sleep and when the clock moves backward', () => {
    const { result } = renderHook(() => useLocalToday())
    vi.setSystemTime(new Date(2026, 9, 8, 8))
    act(() => window.dispatchEvent(new Event('focus')))
    expect(result.current).toBe('2026-10-08')
    expect(vi.getTimerCount()).toBe(1)

    vi.setSystemTime(new Date(2026, 9, 2, 23, 59, 59))
    act(() => window.dispatchEvent(new Event('focus')))
    expect(result.current).toBe('2026-10-02')
    act(() => vi.advanceTimersByTime(1_000))
    expect(result.current).toBe('2026-10-03')
  })

  it('refreshes when a suspended document becomes visible without updating it on hide', () => {
    let visibility: DocumentVisibilityState = 'hidden'
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility)
    const { result } = renderHook(() => useLocalToday())
    vi.setSystemTime(new Date(2026, 9, 5, 10))
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(result.current).toBe('2026-10-03')
    visibility = 'visible'
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(result.current).toBe('2026-10-05')
    expect(vi.getTimerCount()).toBe(1)
  })

  it('does not poll or rerender when activity leaves the local day unchanged', () => {
    vi.setSystemTime(new Date(2026, 9, 3, 12))
    const render = vi.fn(() => useLocalToday())
    renderHook(render)
    const initialRenders = render.mock.calls.length
    act(() => vi.advanceTimersByTime(3_600_000))
    expect(render).toHaveBeenCalledTimes(initialRenders)
    act(() => window.dispatchEvent(new Event('focus')))
    expect(render).toHaveBeenCalledTimes(initialRenders)
    expect(vi.getTimerCount()).toBe(1)
  })

  it('cleans up its timer and recovery listeners when unmounted', () => {
    const { unmount } = renderHook(() => useLocalToday())
    unmount()
    expect(vi.getTimerCount()).toBe(0)
    vi.setSystemTime(new Date(2026, 9, 6))
    act(() => {
      window.dispatchEvent(new Event('focus'))
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(vi.getTimerCount()).toBe(0)
  })
})
