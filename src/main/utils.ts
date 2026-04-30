import { app } from 'electron'
import path from 'node:path'
export const isDev = () => app.isPackaged

export const getAppPath = () =>
  app.isPackaged ? path.dirname(app.getPath('exe')) : app.getAppPath()

// ((_: IpcMainInvokeEvent, ...args: never[]): Promise<BoundaryResult<TResult>> => {
//   return func(...args)
//     .then<BoundaryResult<TResult>>((d) => ({ ok: true, data: d }))
//     .catch((e) => ({ ok: false, error: e }))
// }) as (_: IpcMainInvokeEvent, ...args: unknown[]) => Promise<BoundaryResult<unknown>>
