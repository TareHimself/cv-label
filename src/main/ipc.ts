import { ipcMain } from 'electron'
import { BoundaryResult, IPCEvents, IPCKeys } from '../shared/types'
import { errorToString } from '../shared/utils'

// type IpcMainFunc<TResult = unknown, TArgs extends unknown[] = unknown[]> = (
//   _: IpcMainInvokeEvent,
//   ...args: TArgs
// ) => Promise<BoundaryResult<TResult>>

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
// export const wrap = <TResult = unknown, TArgs extends unknown[] = unknown[]>(
//   func: (...args: TArgs) => Promise<TResult>
// ): IpcMainFunc<TResult, TArgs> => {
//   return async (_: IpcMainInvokeEvent, ...args: TArgs): Promise<BoundaryResult<TResult>> => {
//     //await new Promise((rej) => setTimeout(rej, Math.random() * 5000))
//     return (
//       func(...args)
//         // .then(async (c) => {
//         //   await new Promise((rej) => setTimeout(rej, Math.random() * 5000))
//         //   return c
//         // })
//         .then<BoundaryResult<TResult>>((d) => ({ ok: true, data: d }))
//         .catch((e) => ({ ok: false, error: errorToString(e) }))
//         .then((c) => {
//           // console.log(
//           //   `${func.name}(${inspect(args, {
//           //     depth: null,
//           //     compact: false,
//           //     maxArrayLength: null,
//           //     maxStringLength: null
//           //   })}) => ${inspect(c, {
//           //     depth: null,
//           //     compact: false,
//           //     maxArrayLength: null,
//           //     maxStringLength: null
//           //   })}`
//           // )
//           return c as BoundaryResult<TResult>
//         })
//     )
//   }
// }

export const handleIpc = <TChannel extends IPCKeys>(
  channel: TChannel,
  callback: IPCEvents[TChannel]
) => {
  ipcMain.handle(channel, (_, ...args) => {
    const func = callback as (...args: unknown[]) => Promise<unknown>
    return (
      func(...args)
        // .then(async (c) => {
        //   await new Promise((rej) => setTimeout(rej, Math.random() * 5000))
        //   return c
        // })
        .then<BoundaryResult<unknown>>((d) => ({ ok: true, data: d }))
        .catch((e) => ({ ok: false, error: errorToString(e) }))
        .then((c) => {
          // console.log(
          //   `${func.name}(${inspect(args, {
          //     depth: null,
          //     compact: false,
          //     maxArrayLength: null,
          //     maxStringLength: null
          //   })}) => ${inspect(c, {
          //     depth: null,
          //     compact: false,
          //     maxArrayLength: null,
          //     maxStringLength: null
          //   })}`
          // )
          return c as BoundaryResult<unknown>
        })
    )
  })
}
