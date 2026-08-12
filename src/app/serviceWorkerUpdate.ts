export async function activateWaitingWorker(
  worker: Pick<ServiceWorker, 'postMessage'>,
  prepare: () => Promise<void>,
  onPrepared: () => void = () => undefined,
) {
  await prepare()
  onPrepared()
  worker.postMessage({ type: 'SKIP_WAITING' })
}
