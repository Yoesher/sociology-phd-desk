export class OtherApplicationTabsOpenError extends Error {
  readonly otherClientCount: number

  constructor(otherClientCount: number) {
    super('Other Sociology PhD Desk tabs are still open.')
    this.name = 'OtherApplicationTabsOpenError'
    this.otherClientCount = otherClientCount
  }
}

export async function requestUpdateExclusivity(
  worker: Pick<ServiceWorker, 'postMessage'>,
  timeoutMs = 2_000,
): Promise<number> {
  if (typeof MessageChannel === 'undefined') {
    throw new Error('The multi-tab update guard is unavailable.')
  }
  return new Promise<number>((resolve, reject) => {
    const channel = new MessageChannel()
    const timeout = window.setTimeout(() => {
      channel.port1.close()
      reject(new Error('The multi-tab update guard did not respond.'))
    }, timeoutMs)
    channel.port1.onmessage = (event: MessageEvent<unknown>) => {
      window.clearTimeout(timeout)
      channel.port1.close()
      const data = event.data
      if (
        typeof data !== 'object' || data === null ||
        !('otherClientCount' in data) ||
        typeof data.otherClientCount !== 'number' ||
        !Number.isSafeInteger(data.otherClientCount) ||
        data.otherClientCount < 0
      ) {
        reject(new Error('The multi-tab update guard returned an invalid response.'))
        return
      }
      resolve(data.otherClientCount)
    }
    worker.postMessage({ type: 'PREPARE_UPDATE' }, [channel.port2])
  })
}

export async function activateWaitingWorker(
  worker: Pick<ServiceWorker, 'postMessage'>,
  prepare: () => Promise<void>,
  onPrepared: () => void = () => undefined,
  inspectOtherClients: () => Promise<number> = () => requestUpdateExclusivity(worker),
) {
  const initialOtherClientCount = await inspectOtherClients()
  if (initialOtherClientCount > 0) {
    throw new OtherApplicationTabsOpenError(initialOtherClientCount)
  }
  await prepare()
  const finalOtherClientCount = await inspectOtherClients()
  if (finalOtherClientCount > 0) {
    throw new OtherApplicationTabsOpenError(finalOtherClientCount)
  }
  onPrepared()
  worker.postMessage({ type: 'SKIP_WAITING' })
}
