import { isMainThread, parentPort, workerData } from 'worker_threads'
import {
  WorkerResponse,
  WorkerMessage,
  ModuleWorkerMessage,
  InitResult
} from './module_worker_utils'
import { isEntryFile } from './utils'

if (isEntryFile(import.meta.url)) {
  for (const k of Object.keys(workerData)) {
    global[k] = workerData[k]

    console.log('ADDING GLOBAL', k, workerData[k], global[k])
  }

  const respond = <T = unknown>(callRef: string, response: T) => {
    const message: WorkerResponse<T> = { callRef, data: response, success: true }
    parentPort?.postMessage(message)
  }

  const respondError = <T = unknown>(callRef: string, error: unknown) => {
    const message: WorkerResponse<T> = { callRef, error: error, success: false }
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
        try {
          const result = await func(...data.args)
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
