import { test, expect } from './fixtures'
import { createTestImage, cleanupTestImage } from './testImage'

test.describe('Samples page', () => {
  test.beforeEach(async ({ projectsPage }) => {
    await projectsPage.createProject('Street Signs', ['Stop Sign'])
    await projectsPage.open('Street Signs')
  })

  test('lists samples created with the task', async ({ tasksPage, samplesPage }) => {
    const image = await createTestImage('sample-1')
    try {
      await tasksPage.createTask('Batch 1', [image])
      await tasksPage.open('Batch 1')

      await expect(samplesPage.card('sample-1')).toBeVisible()
    } finally {
      cleanupTestImage(image)
    }
  })

  test('toggles the train/test split for a sample', async ({ tasksPage, samplesPage }) => {
    const image = await createTestImage('sample-1')
    try {
      await tasksPage.createTask('Batch 1', [image])
      await tasksPage.open('Batch 1')

      await expect(samplesPage.radio('sample-1', 'Train')).toBeChecked()

      await samplesPage.setSplit('sample-1', 'Test')

      await expect(samplesPage.radio('sample-1', 'Test')).toBeChecked()
      await expect(samplesPage.radio('sample-1', 'Train')).not.toBeChecked()
    } finally {
      cleanupTestImage(image)
    }
  })

  test('toggles the completed status for a sample', async ({ tasksPage, samplesPage }) => {
    const image = await createTestImage('sample-1')
    try {
      await tasksPage.createTask('Batch 1', [image])
      await tasksPage.open('Batch 1')

      await expect(samplesPage.radio('sample-1', 'In Progress')).toBeChecked()

      await samplesPage.setCompleted('sample-1', true)

      await expect(samplesPage.radio('sample-1', 'Completed')).toBeChecked()
    } finally {
      cleanupTestImage(image)
    }
  })

  test('navigates to the labeler when Label is clicked', async ({
    tasksPage,
    samplesPage,
    labelPage
  }) => {
    const image = await createTestImage('sample-1')
    try {
      await tasksPage.createTask('Batch 1', [image])
      await tasksPage.open('Batch 1')

      await samplesPage.label('sample-1')

      await expect(labelPage.canvasContainer).toBeVisible()
      await expect(labelPage.modeRadio('Select')).toBeChecked()
    } finally {
      cleanupTestImage(image)
    }
  })

  test('navigates back to the tasks page', async ({ tasksPage, samplesPage }) => {
    const image = await createTestImage('sample-1')
    try {
      await tasksPage.createTask('Batch 1', [image])
      await tasksPage.open('Batch 1')

      await samplesPage.back()

      await expect(tasksPage.row('Batch 1')).toBeVisible()
    } finally {
      cleanupTestImage(image)
    }
  })

  test('cancelling a delete keeps the sample', async ({ tasksPage, samplesPage }) => {
    const image = await createTestImage('sample-1')
    try {
      await tasksPage.createTask('Batch 1', [image])
      await tasksPage.open('Batch 1')

      await samplesPage.cancelDelete('sample-1')

      await expect(samplesPage.card('sample-1')).toBeVisible()
    } finally {
      cleanupTestImage(image)
    }
  })

  test('deletes a sample via the context menu and confirm modal', async ({
    tasksPage,
    samplesPage
  }) => {
    const imageA = await createTestImage('sample-a')
    const imageB = await createTestImage('sample-b')
    try {
      await tasksPage.createTask('Batch 1', [imageA, imageB])
      await tasksPage.open('Batch 1')

      await samplesPage.delete('sample-a')

      await expect(samplesPage.card('sample-a')).not.toBeVisible()
      await expect(samplesPage.card('sample-b')).toBeVisible()
    } finally {
      cleanupTestImage(imageA)
      cleanupTestImage(imageB)
    }
  })
})
