import { app, IpcMainInvokeEvent } from 'electron'
import path from 'node:path'
import { BoundaryResult } from '../shared/types'
import { inspect } from 'node:util'
import { errorToString } from '../shared/utils'
export const isDev = () => app.isPackaged

export const getAppPath = () =>
  app.isPackaged ? path.dirname(app.getPath('exe')) : app.getAppPath()

type IpcMainFunc<TResult = unknown, TArgs extends unknown[] = unknown[]> = (
  _: IpcMainInvokeEvent,
  ...args: TArgs
) => Promise<BoundaryResult<TResult>>

/**
 * Freaky stuff meehn, will wrap a function to work with ipcMain.handle
 * @param func
 * @returns
 */
// export const wrap = <TResult = unknown, TArgs extends unknown[] = unknown[]>(
//   func: (...args: TArgs) => Promise<TResult>
// ): IpcMainFunc<TResult, TArgs> => {
//   return (_: IpcMainInvokeEvent, ...args: TArgs): Promise<BoundaryResult<TResult>> => {
//     return func(...args)
//       .then<BoundaryResult<TResult>>((d) => ({ ok: true, data: d }))
//       .catch((e) => ({ ok: false, error: e }))
//   }
// }
export const wrap = <TResult = unknown, TArgs extends unknown[] = unknown[]>(
  func: (...args: TArgs) => Promise<TResult>
): IpcMainFunc<TResult, TArgs> => {
  return (_: IpcMainInvokeEvent, ...args: TArgs): Promise<BoundaryResult<TResult>> => {
    return func(...args)
      .then<BoundaryResult<TResult>>((d) => ({ ok: true, data: d }))
      .catch((e) => ({ ok: false, error: errorToString(e) }))
      .then((c) => {
        console.log(
          `${func.name}(${inspect(args, {
            depth: null,
            compact: false,
            maxArrayLength: null,
            maxStringLength: null
          })}) => ${inspect(c, {
            depth: null,
            compact: false,
            maxArrayLength: null,
            maxStringLength: null
          })}`
        )
        return c as BoundaryResult<TResult>
      })
  }
}

// ((_: IpcMainInvokeEvent, ...args: never[]): Promise<BoundaryResult<TResult>> => {
//   return func(...args)
//     .then<BoundaryResult<TResult>>((d) => ({ ok: true, data: d }))
//     .catch((e) => ({ ok: false, error: e }))
// }) as (_: IpcMainInvokeEvent, ...args: unknown[]) => Promise<BoundaryResult<unknown>>
