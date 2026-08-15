// Will be loaded in a worker thread, cant use any electron API's
import { IAnnotator, IAnnotatorUpdate, INewAnnotator } from '../shared/types'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { asc, eq } from 'drizzle-orm'
import path from 'path'
import fs from 'fs/promises'
import assert from 'assert'
import * as schema from './appSchema'

console.log('App database loaded into worker', APP_PATH)

assert(APP_PATH !== undefined, 'APP_PATH global was not defined')
assert(MIGRATIONS_PATH !== undefined, 'MIGRATIONS_PATH global was not defined')

// Sibling to store/database/data.db (see database.ts) - app-level data lives independently
// of whichever IDataStore is currently active, so it gets its own top-level folder rather
// than nesting under store/.
const appPath = path.join(APP_PATH, 'app')
const databasePath = path.join(appPath, 'database', 'app.db')

await fs.mkdir(path.dirname(databasePath), { recursive: true })

const sqlite = new Database(databasePath, { fileMustExist: false })

sqlite.pragma('journal_mode = WAL')

const db = drizzle(sqlite, { schema })

migrate(db, { migrationsFolder: MIGRATIONS_PATH })

const appDatabase = {
  getAnnotators: async (): Promise<IAnnotator[]> => {
    const annotators = await db.select().from(schema.annotators).orderBy(asc(schema.annotators.id))

    return annotators.map<IAnnotator>((a) => ({
      ...a,
      headers: JSON.parse(a.headers)
    }))
  },

  createAnnotator: async (
    id: string,
    name: string,
    url: string,
    headers: Record<string, string>
  ): Promise<IAnnotator> => {
    const newAnnotator: INewAnnotator = { id, name, url, headers }
    db.insert(schema.annotators)
      .values({ ...newAnnotator, headers: JSON.stringify(newAnnotator.headers) })
      .run()
    return { ...newAnnotator }
  },

  updateAnnotators: async (updates: IAnnotatorUpdate[]): Promise<IAnnotator[]> => {
    return db.transaction((tx) => {
      return updates.map((update) => {
        const existing = tx
          .select()
          .from(schema.annotators)
          .where(eq(schema.annotators.id, update.id))
          .get()

        if (existing === undefined) {
          throw new Error(`annotator not found: ${update.id}`)
        }

        const nextName = update.name ?? existing.name
        const nextUrl = update.url ?? existing.url
        const nextHeaders =
          update.headers !== undefined ? JSON.stringify(update.headers) : existing.headers

        tx.update(schema.annotators)
          .set({ name: nextName, url: nextUrl, headers: nextHeaders })
          .where(eq(schema.annotators.id, existing.id))
          .run()

        return {
          id: existing.id,
          name: nextName,
          url: nextUrl,
          headers: JSON.parse(nextHeaders)
        } satisfies IAnnotator
      })
    })
  },

  deleteAnnotators: async (annotatorIds: string[]): Promise<boolean[]> => {
    db.transaction((tx) => {
      for (const id of annotatorIds) {
        tx.delete(schema.annotators).where(eq(schema.annotators.id, id)).run()
      }
    })
    return annotatorIds.map(() => true)
  }
}

// named exports (bindings)
export const { getAnnotators, createAnnotator, updateAnnotators, deleteAnnotators } = appDatabase
