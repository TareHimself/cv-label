import { relations } from 'drizzle-orm'
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex
} from 'drizzle-orm/sqlite-core'

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull()
})

export const tasks = sqliteTable(
  'tasks',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    projectId: text('projectId')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade', onUpdate: 'restrict' })
  },
  (table) => [index('idx_tasks_projectId').on(table.projectId)]
)

export const tags = sqliteTable(
  'tags',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    projectId: text('projectId')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade', onUpdate: 'restrict' })
  },
  (table) => [
    index('idx_tags_projectId').on(table.projectId),
    // DB-level guard against a literal duplicate tag name within the same project.
    uniqueIndex('idx_tags_project_name').on(table.projectId, table.name)
  ]
)

export const taskTags = sqliteTable(
  'task_tags',
  {
    taskId: text('taskId')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade', onUpdate: 'restrict' }),
    tagId: text('tagId')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade', onUpdate: 'restrict' })
  },
  (table) => [
    primaryKey({ columns: [table.taskId, table.tagId] }),
    index('idx_task_tags_tagId').on(table.tagId)
  ]
)

export const labels = sqliteTable(
  'labels',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    color: text('color').notNull(),
    projectId: text('projectId')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade', onUpdate: 'restrict' })
  },
  (table) => [index('idx_labels_projectId').on(table.projectId)]
)

export const images = sqliteTable('images', {
  id: text('id').primaryKey(),
  hash: text('hash').notNull(),
  extension: text('extension').notNull(),
  width: integer('width'),
  height: integer('height')
})

export const samples = sqliteTable(
  'samples',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    split: text('split').notNull(),
    createdAt: text('createdAt').notNull(),
    completedAt: text('completedAt'),
    imageId: text('imageId')
      .notNull()
      .references(() => images.id),
    taskId: text('taskId')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade', onUpdate: 'restrict' })
  },
  (table) => [
    index('idx_samples_taskId').on(table.taskId),
    index('idx_samples_imageId').on(table.imageId)
  ]
)

export const annotations = sqliteTable(
  'annotations',
  {
    id: text('id').primaryKey(),
    type: text('type').notNull(),
    labelId: text('labelId')
      .notNull()
      .references(() => labels.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
    sampleId: text('sampleId')
      .notNull()
      .references(() => samples.id, { onDelete: 'cascade', onUpdate: 'restrict' })
  },
  (table) => [
    index('idx_annotations_sampleId').on(table.sampleId),
    index('idx_annotations_labelId').on(table.labelId)
  ]
)

export const points = sqliteTable(
  'points',
  {
    id: text('id').primaryKey(),
    x: real('x').notNull(),
    y: real('y').notNull(),
    sequence: integer('sequence').notNull(),
    annotationId: text('annotationId')
      .notNull()
      .references(() => annotations.id, { onDelete: 'cascade', onUpdate: 'restrict' })
  },
  (table) => [index('idx_points_annotationId').on(table.annotationId)]
)

export const projectsRelations = relations(projects, ({ many }) => ({
  labels: many(labels),
  tasks: many(tasks),
  tags: many(tags)
}))

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, { fields: [tasks.projectId], references: [projects.id] }),
  samples: many(samples),
  taskTags: many(taskTags)
}))

export const tagsRelations = relations(tags, ({ one, many }) => ({
  project: one(projects, { fields: [tags.projectId], references: [projects.id] }),
  taskTags: many(taskTags)
}))

export const taskTagsRelations = relations(taskTags, ({ one }) => ({
  task: one(tasks, { fields: [taskTags.taskId], references: [tasks.id] }),
  tag: one(tags, { fields: [taskTags.tagId], references: [tags.id] })
}))

export const labelsRelations = relations(labels, ({ one }) => ({
  project: one(projects, { fields: [labels.projectId], references: [projects.id] })
}))

export const imagesRelations = relations(images, ({ many }) => ({
  samples: many(samples)
}))

export const samplesRelations = relations(samples, ({ one, many }) => ({
  task: one(tasks, { fields: [samples.taskId], references: [tasks.id] }),
  image: one(images, { fields: [samples.imageId], references: [images.id] }),
  annotations: many(annotations)
}))

export const annotationsRelations = relations(annotations, ({ one, many }) => ({
  sample: one(samples, { fields: [annotations.sampleId], references: [samples.id] }),
  label: one(labels, { fields: [annotations.labelId], references: [labels.id] }),
  points: many(points)
}))

export const pointsRelations = relations(points, ({ one }) => ({
  annotation: one(annotations, { fields: [points.annotationId], references: [annotations.id] })
}))
