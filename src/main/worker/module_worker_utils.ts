export const enum ModuleWorkerMessage {
  Init,
  Call
}

export type WorkerMessage = { callRef: string } & (
  | {
      type: ModuleWorkerMessage.Init
      path: string
    }
  | {
      type: ModuleWorkerMessage.Call
      methodId: string
      args: unknown[]
    }
)

export type WorkerResponse<T = unknown> =
  | {
      callRef: string
      success: true
      data: T
    }
  | {
      callRef: string
      success: false
      error: string
    }

/** Out-of-band progress update for a still-in-flight Call. Any worker-module export can
 *  opt into this by declaring a real trailing `onProgress?: (...args) => void` parameter
 *  and calling it - the dispatcher always passes one, so it works for any method without
 *  further changes to this transport. */
export type WorkerProgressMessage = {
  type: 'progress'
  callRef: string
  args: unknown[]
}

export type MethodInfo = {
  id: string
  name: string
}

export type PropertyInfo = {
  name: string
  value: unknown
}

export type InitResult = {
  methods: MethodInfo[]
  properties: PropertyInfo[]
}
