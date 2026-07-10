import { test, expect } from './fixtures'
import { createTestImage, cleanupTestImage } from './testImage'
import { createYoloDatasetZip, cleanupYoloDatasetZip } from './testYoloDataset'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

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

  test('imports a YOLO dataset zip via the YOLO Dataset importer', async ({
    tasksPage,
    samplesPage
  }) => {
    const zipPath = await createYoloDatasetZip()
    try {
      await tasksPage.createTaskFromYoloZip('Yolo Batch', zipPath)

      await expect(tasksPage.row('Yolo Batch')).toBeVisible()

      await tasksPage.open('Yolo Batch')
      await expect(samplesPage.card('sign-1')).toBeVisible()
    } finally {
      cleanupYoloDatasetZip(zipPath)
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

  test('exports selected tasks to the path chosen in the save dialog', async ({
    tasksPage,
    electronApp,
    appDataDir
  }) => {
    const image = await createTestImage('sample-1')
    const savePath = join(appDataDir, 'export.zip')
    try {
      await tasksPage.createTask('Batch 1', [image])

      // The real dialog is native and blocks Playwright, so stub it to resolve
      // immediately with a fixed path, same as a user picking one and confirming.
      await electronApp.evaluate(({ dialog }, targetPath) => {
        dialog.showSaveDialog = (async () => ({
          canceled: false,
          filePath: targetPath
        })) as typeof dialog.showSaveDialog
      }, savePath)

      await tasksPage.exportTasks(['Batch 1'])

      expect(existsSync(savePath)).toBe(true)
    } finally {
      cleanupTestImage(image)
    }
  })

  test('renames a task via the context menu', async ({ tasksPage }) => {
    const image = await createTestImage('sample-1')
    try {
      await tasksPage.createTask('Batch 1', [image])

      await tasksPage.rename('Batch 1', 'Renamed Batch')

      await expect(tasksPage.row('Renamed Batch')).toBeVisible()
      await expect(tasksPage.row('Batch 1')).not.toBeVisible()
    } finally {
      cleanupTestImage(image)
    }
  })

  test('keeps a selected task visible even when it no longer matches the search', async ({
    tasksPage
  }) => {
    const imageA = await createTestImage('sample-a')
    const imageB = await createTestImage('sample-b')
    try {
      await tasksPage.createTask('Batch 1', [imageA])
      await tasksPage.createTask('Batch 2', [imageB])

      await tasksPage.taskCheckbox('Batch 1').check()
      await tasksPage.search('2')

      await expect(tasksPage.row('Batch 2')).toBeVisible()
      await expect(tasksPage.row('Batch 1')).toBeVisible()
    } finally {
      cleanupTestImage(imageA)
      cleanupTestImage(imageB)
    }
  })

  test('deletes multiple selected tasks via the batch action bar', async ({ tasksPage }) => {
    const imageA = await createTestImage('sample-a')
    const imageB = await createTestImage('sample-b')
    const imageC = await createTestImage('sample-c')
    try {
      await tasksPage.createTask('Batch 1', [imageA])
      await tasksPage.createTask('Batch 2', [imageB])
      await tasksPage.createTask('Batch 3', [imageC])

      await tasksPage.deleteSelectedTasks(['Batch 1', 'Batch 2'])

      await expect(tasksPage.row('Batch 1')).not.toBeVisible()
      await expect(tasksPage.row('Batch 2')).not.toBeVisible()
      await expect(tasksPage.row('Batch 3')).toBeVisible()
    } finally {
      cleanupTestImage(imageA)
      cleanupTestImage(imageB)
      cleanupTestImage(imageC)
    }
  })
})
