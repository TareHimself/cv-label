// Ambient globals injected via `workerData` by importWorkerModule (see worker/index.ts) -
// shared by every worker-thread module (database.ts, appDatabase.ts, ...) that reads them,
// so each doesn't redeclare its own (which TS rejects as a duplicate block-scoped binding
// once more than one such module is part of the same program).
export {}

declare global {
  const APP_PATH: string
  const MIGRATIONS_PATH: string
}
