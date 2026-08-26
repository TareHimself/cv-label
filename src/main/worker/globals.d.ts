// Ambient globals injected via `workerData` by importWorkerModule - shared here so every worker-thread module that reads them doesn't redeclare its own (a duplicate block-scoped binding).
export {}

declare global {
  const APP_PATH: string
  const MIGRATIONS_PATH: string
}
