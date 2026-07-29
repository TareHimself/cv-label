import { app, net, protocol } from 'electron'
import url from 'node:url'
import { IPCKeys, SCRATCH_PROTOCOL_URL } from '../shared/types'
import { makeUUID } from '../shared/utils'
import { handleIpc } from './ipc'

// Chromium parses a custom "standard" scheme's URL as scheme://host/path, same as
// images://<id> - there's no way to put an arbitrary local path in that host position
// (drive letters, colons and backslashes are invalid/mangled host content), so this maps
// an opaque id to the real path server-side instead of encoding the path into the URL.
const scratchPathById = new Map<string, string>()

handleIpc(IPCKeys.System_GetScratchPreviewUri, async (filePath) => {
  const id = makeUUID()
  scratchPathById.set(id, filePath)
  return `${SCRATCH_PROTOCOL_URL}://${id}`
})

// protocol.registerSchemesAsPrivileged is a single, global, call-once-per-app-lifetime
// registration - a second call from a separate module (as this file used to make) is
// silently dropped, so this scheme would never actually become privileged even though the
// call itself doesn't throw. It's registered once, centrally, alongside images:// in
// store.ts; this file only installs the handler, which has no such one-call restriction.
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
