import { WorkerFunctionMessage } from './types'

onmessage = async (e: MessageEvent<WorkerFunctionMessage>) => {
  const func: (...args: unknown[]) => Promise<unknown> = new Function('return ' + e.data.function)()
  func(...e.data.args).then((a) => postMessage(a))
}
