import { sqliteTable, text } from 'drizzle-orm/sqlite-core'

/** Store-agnostic and project-agnostic - just connection info. Label vocabulary/mapping is never persisted, see ExternalAnnotator.ts / useAnnotatorRuntime.ts. */
export const annotators = sqliteTable('annotators', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  url: text('url').notNull(),
  headers: text('headers').notNull()
})
