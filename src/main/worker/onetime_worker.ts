import { parentPort } from 'worker_threads'
import { isEntryFile } from './utils'
if (isEntryFile(import.meta.url)) {
  parentPort?.on('message', (data) => {
    const func = new Function('return ' + data.f)()
    func(...data.args).then((a) => parentPort?.postMessage(a))
  })
}

export default __filename // Electron vite cries if I don't do this
