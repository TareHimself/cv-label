import { ipcMain } from 'electron'
import { BoundaryResult, IPCEvents } from '../shared/types'
import { errorToString } from '../shared/utils'

export const handleIpc = <TChannel extends keyof IPCEvents>(
  channel: TChannel,
  callback: IPCEvents[TChannel]
) => {
  ipcMain.handle(channel, (_, ...args) => {
    const func = callback as (...args: unknown[]) => Promise<unknown>
    return func(...args)
      .then<BoundaryResult<unknown>>((d) => ({ ok: true, data: d }))
      .catch((e) => ({ ok: false, error: errorToString(e) }))
  })
}
