import { WorkerFunctionMessage } from './types'

export async function withWorker<A extends unknown[], R>(
  func: (...args: A) => Promise<R>,
  ...args: A
): Promise<R> {
  const worker = new Worker(new URL('./onetime_worker.ts', import.meta.url), { type: 'module' })
  return new Promise<R>((res, rej) => {
    worker.addEventListener('message', (d) => {
      res(d.data)
      worker.terminate()
    })
    worker.addEventListener('error', async (e) => {
      rej(e)
      worker.terminate()
    })
    const message: WorkerFunctionMessage = {
      function: func.toString(),
      args: args
    }
    worker.postMessage(message)
  })
}
