import { test, expect } from './fixtures'
import { createTestImage, cleanupTestImage } from './testImage'

test.describe('Tasks page', () => {
  test.beforeEach(async ({ projectsPage, tasksPage }) => {
    await projectsPage.createProject('Street Signs', ['Stop Sign'])
    await projectsPage.open('Street Signs')
    await expect(tasksPage.createTaskButton).toBeVisible()
  })

  test('shows an empty state when there are no tasks', async ({ tasksPage }) => {
    await expect(tasksPage.emptyState).toBeVisible()
  })

  test('creates a task with sample files and lists it', async ({ tasksPage }) => {
    const image = await createTestImage('sample-1')
    try {
      await tasksPage.createTask('Batch 1', [image])

      await expect(tasksPage.row('Batch 1')).toBeVisible()
      await expect(tasksPage.emptyState).not.toBeVisible()
    } finally {
      cleanupTestImage(image)
    }
  })

  test('filters the list via search', async ({ tasksPage }) => {
    const imageA = await createTestImage('sample-a')
    const imageB = await createTestImage('sample-b')
    try {
      await tasksPage.createTask('Batch 1', [imageA])
      await tasksPage.createTask('Batch 2', [imageB])

      await tasksPage.search('2')

      await expect(tasksPage.row('Batch 2')).toBeVisible()
      await expect(tasksPage.row('Batch 1')).not.toBeVisible()
    } finally {
      cleanupTestImage(imageA)
      cleanupTestImage(imageB)
    }
  })

  test('navigates back to the projects page', async ({ tasksPage, projectsPage }) => {
    await tasksPage.back()

    await expect(projectsPage.row('Street Signs')).toBeVisible()
  })

  test('navigates to the samples page when a task is opened', async ({
    tasksPage,
    samplesPage
  }) => {
    const image = await createTestImage('sample-1')
    try {
      await tasksPage.createTask('Batch 1', [image])

      await tasksPage.open('Batch 1')

      await expect(samplesPage.importSamplesButton).toBeVisible()
    } finally {
      cleanupTestImage(image)
    }
  })

  test('cancelling a delete keeps the task', async ({ tasksPage }) => {
    const image = await createTestImage('sample-1')
    try {
      await tasksPage.createTask('Batch 1', [image])

      await tasksPage.cancelDelete('Batch 1')

      await expect(tasksPage.row('Batch 1')).toBeVisible()
    } finally {
      cleanupTestImage(image)
    }
  })

  test('deletes a task via the context menu and confirm modal', async ({ tasksPage }) => {
    const imageA = await createTestImage('sample-a')
    const imageB = await createTestImage('sample-b')
    try {
      await tasksPage.createTask('Batch 1', [imageA])
      await tasksPage.createTask('Batch 2', [imageB])

      await tasksPage.delete('Batch 1')

      await expect(tasksPage.row('Batch 1')).not.toBeVisible()
      await expect(tasksPage.row('Batch 2')).toBeVisible()
    } finally {
      cleanupTestImage(imageA)
      cleanupTestImage(imageB)
    }
  })
})
