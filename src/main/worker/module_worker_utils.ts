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
      error: unknown
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
