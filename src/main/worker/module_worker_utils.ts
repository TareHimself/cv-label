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

/** Out-of-band progress for a still-in-flight Call - any worker export opts in just by declaring a trailing `onProgress?: (...args) => void` param; the dispatcher always passes one. */
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
