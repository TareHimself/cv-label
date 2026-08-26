import { Worker } from 'worker_threads'
import { makeUUID } from '../../shared/utils'
import { URL } from 'node:url'
import {
  WorkerResponse,
  WorkerMessage,
  WorkerProgressMessage,
  InitResult,
  ModuleWorkerMessage
} from './module_worker_utils'
import onetimeWorkerPath from './onetime_worker?modulePath'
import moduleWorkerPath from './module_worker?modulePath'

const isProgressMessage = (d: WorkerResponse | WorkerProgressMessage): d is WorkerProgressMessage =>
  'type' in d && d.type === 'progress'

export async function withNodeWorker<A extends unknown[], R>(
  func: (...args: A) => Promise<R>,
  ...args: A
): Promise<R> {
  const worker = new Worker(onetimeWorkerPath)
  return new Promise<R>((res, rej) => {
    worker.on('message', async (d) => {
      res(d)
      await worker.terminate()
    })
    worker.on('error', async (e) => {
      rej(e)
      await worker.terminate()
    })
    worker.postMessage({
      f: func.toString(),
      args: args
    })
  })
}

class WorkerModule {
  modulePath: string
  worker: Worker
  pending: Map<string, (result: WorkerResponse) => void>
  progressListeners: Map<string, (...args: unknown[]) => void>
  constructor(modulePath: string, globals: object) {
    this.modulePath = modulePath
    this.worker = new Worker(moduleWorkerPath, {
      workerData: globals
    })
    this.pending = new Map()
    this.progressListeners = new Map()
    this.worker.on('message', (d: WorkerResponse | WorkerProgressMessage) => {
      if (isProgressMessage(d)) {
        this.progressListeners.get(d.callRef)?.(...d.args)
        return
      }

      const id = d.callRef
      const pending = this.pending.get(id)
      pending?.(d)
      this.pending.delete(id)
      this.progressListeners.delete(id)
    })
  }

  async send<R = unknown>(
    message: WorkerMessage,
    onProgress?: (...args: unknown[]) => void
  ): Promise<R> {
    return new Promise((res, rej) => {
      if (onProgress) {
        this.progressListeners.set(message.callRef, onProgress)
      }
      const onResponse = (resp: WorkerResponse<R>) => {
        if (resp.success) {
          res(resp.data)
        } else {
          rej(resp.error)
        }
      }
      this.pending.set(message.callRef, onResponse as (_: WorkerResponse) => void)
      this.worker.postMessage(message)
    })
  }
}

export async function importWorkerModule<T = unknown>(
  modulePath: URL,
  globals: object = {}
): Promise<T & { terminate(): Promise<number> }> {
  const worker = new WorkerModule(moduleWorkerPath, globals)
  const initResponse = await worker.send<InitResult>({
    callRef: makeUUID(),
    type: ModuleWorkerMessage.Init,
    path: modulePath.toString()
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = {}

  // Lets callers tear the worker thread down explicitly (e.g. StoreOrchestrator freeing a
  // store that's been switched away from) instead of only ever being reaped on app exit.
  result.terminate = () => worker.worker.terminate()

  for (const property of initResponse.properties) {
    result[property.name] = property.value
  }

  for (const method of initResponse.methods) {
    result[method.name] = (...args: unknown[]) => {
      // By convention, a trailing function argument is a progress callback: it can't
      // cross postMessage, so it's registered locally against this call instead of sent.
      const lastArg = args[args.length - 1]
      const hasProgressCallback = typeof lastArg === 'function'
      const onProgress = hasProgressCallback
        ? (lastArg as (...progressArgs: unknown[]) => void)
        : undefined
      const callArgs = hasProgressCallback ? args.slice(0, -1) : args

      return worker.send<unknown>(
        {
          callRef: makeUUID(),
          type: ModuleWorkerMessage.Call,
          methodId: method.id,
          args: callArgs
        },
        onProgress
      )
    }

    Object.defineProperty(result[method.name], 'name', {
      value: method.name,
      configurable: true
    })
  }

  return result
}
