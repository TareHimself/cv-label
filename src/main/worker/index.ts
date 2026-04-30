import { Worker } from 'worker_threads'
import { makeUUID } from '../../shared/utils'
import { URL } from 'node:url'
import {
  WorkerResponse,
  WorkerMessage,
  InitResult,
  ModuleWorkerMessage
} from './module_worker_utils'
import onetimeWorkerPath from './onetime_worker?modulePath'
import moduleWorkerPath from './module_worker?modulePath'

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
  constructor(modulePath: string, globals: object) {
    this.modulePath = modulePath
    this.worker = new Worker(moduleWorkerPath, {
      workerData: globals
    })
    this.pending = new Map()
    this.worker.on('message', (d: WorkerResponse) => {
      const id = d.callRef
      const pending = this.pending.get(id)
      pending?.(d)
      this.pending.delete(id)
    })
  }

  async send<R = unknown>(message: WorkerMessage): Promise<R> {
    return new Promise((res, rej) => {
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

/**
 *
 * @param modulePath the fileurl to the module to load
 * @returns
 */
export async function importWorkerModule<T = unknown>(
  modulePath: URL,
  globals: object = {}
): Promise<T> {
  const worker = new WorkerModule(moduleWorkerPath, globals)
  const initResponse = await worker.send<InitResult>({
    callRef: makeUUID(),
    type: ModuleWorkerMessage.Init,
    path: modulePath.toString()
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = {}

  for (const property of initResponse.properties) {
    result[property.name] = property.value
  }

  for (const method of initResponse.methods) {
    result[method.name] = (...args: unknown[]) =>
      worker.send<unknown>({
        callRef: makeUUID(),
        type: ModuleWorkerMessage.Call,
        methodId: method.id,
        args: args
      })

    Object.defineProperty(result[method.name], 'name', {
      value: method.name,
      configurable: true
    })
  }

  return result
}
