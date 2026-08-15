import { sqliteTable, text } from 'drizzle-orm/sqlite-core'

/** Store-agnostic and project-agnostic - an annotator is just connection info (name/url/
 *  headers). Its label vocabulary and mapping against a project's labels are never
 *  persisted - see ExternalAnnotator.ts / useAnnotatorRuntime.ts. */
export const annotators = sqliteTable('annotators', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  url: text('url').notNull(),
  headers: text('headers').notNull()
})
