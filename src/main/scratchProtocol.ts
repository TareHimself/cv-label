import { app, net, protocol } from 'electron'
import url from 'node:url'
import { IPCKeys, SCRATCH_PROTOCOL_URL } from '../shared/types'
import { makeUUID } from '../shared/utils'
import { handleIpc } from './ipc'

// A raw path can't go in a custom scheme's host position (colons/backslashes are invalid there), so this maps an opaque id to the real path server-side instead.
const scratchPathById = new Map<string, string>()

handleIpc(IPCKeys.System_GetScratchPreviewUri, async (filePath) => {
  const id = makeUUID()
  scratchPathById.set(id, filePath)
  return `${SCRATCH_PROTOCOL_URL}://${id}`
})

// protocol.registerSchemesAsPrivileged is call-once-per-app-lifetime; a second call is silently dropped, so this scheme is registered once, centrally, in store.ts - this file only installs the handler.
app.whenReady().then(() => {
  protocol.handle(SCRATCH_PROTOCOL_URL, async (req) => {
    try {
      const id = new URL(req.url).host
      const filePath = scratchPathById.get(id)
      if (filePath === undefined) {
        return new Response(undefined, { status: 404 })
      }

      return await net.fetch(url.pathToFileURL(filePath).toString())
    } catch (error) {
      console.error(error)
      return new Response('Not found', { status: 404 })
    }
  })
})
