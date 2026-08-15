import { isMainThread, parentPort, workerData } from 'worker_threads'
import {
  WorkerResponse,
  WorkerMessage,
  WorkerProgressMessage,
  ModuleWorkerMessage,
  InitResult
} from './module_worker_utils'
import { isEntryFile } from './utils'
import { errorToString } from '../../shared/utils'

if (isEntryFile(import.meta.url)) {
  for (const k of Object.keys(workerData)) {
    global[k] = workerData[k]
  }

  const respond = <T = unknown>(callRef: string, response: T) => {
    const message: WorkerResponse<T> = { callRef, data: response, success: true }
    parentPort?.postMessage(message)
  }

  const respondError = <T = unknown>(callRef: string, error: unknown) => {
    const message: WorkerResponse<T> = { callRef, error: errorToString(error), success: false }
    parentPort?.postMessage(message)
  }

  if (!isMainThread) {
    type MethodMap = {
      [key: string]: (...args: unknown[]) => Promise<unknown>
    }

    const methods: MethodMap = {}

    parentPort?.on('message', async (data: WorkerMessage) => {
      if (data.type === ModuleWorkerMessage.Init) {
        try {
          const result: InitResult = { properties: [], methods: [] }
          const mod = await import(data.path)
          for (const key of Object.keys(mod)) {
            if (typeof mod[key] === 'function') {
              result.methods.push({
                id: key,
                name: key
              })
              methods[key] = mod[key]
            } else {
              result.properties.push({
                name: key,
                value: mod[key]
              })
            }
          }

          respond(data.callRef, result)
        } catch (error) {
          console.error(error)
          respondError(data.callRef, error)
        }
        return
      }

      if (data.type === ModuleWorkerMessage.Call) {
        const func = methods[data.methodId]
        // Every call gets a progress reporter as its final argument - unused by methods
        // that don't declare a trailing progress parameter, but requires no per-method
        // plumbing for the ones that do (see WorkerProgressMessage).
        const reportProgress = (...args: unknown[]) => {
          const message: WorkerProgressMessage = { type: 'progress', callRef: data.callRef, args }
          parentPort?.postMessage(message)
        }
        try {
          const result = await func(...data.args, reportProgress)
          respond(data.callRef, result)
        } catch (error) {
          console.error(error)
          respondError(data.callRef, error)
        }
        return
      }
    })
  }
}

export default __filename // Electron vite cries if I don't do this
