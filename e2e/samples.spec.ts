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

  test('toggles the train/test/valid split for a sample', async ({ tasksPage, samplesPage }) => {
    const image = await createTestImage('sample-1')
    try {
      await tasksPage.createTask('Batch 1', [image])
      await tasksPage.open('Batch 1')

      await expect(samplesPage.radio('sample-1', 'Train')).toBeChecked()

      await samplesPage.setSplit('sample-1', 'Test')

      await expect(samplesPage.radio('sample-1', 'Test')).toBeChecked()
      await expect(samplesPage.radio('sample-1', 'Train')).not.toBeChecked()

      await samplesPage.setSplit('sample-1', 'Valid')

      await expect(samplesPage.radio('sample-1', 'Valid')).toBeChecked()
      await expect(samplesPage.radio('sample-1', 'Test')).not.toBeChecked()
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

  test('imports additional samples via the Import Samples button', async ({
    tasksPage,
    samplesPage
  }) => {
    const imageA = await createTestImage('sample-a')
    const imageB = await createTestImage('sample-b')
    try {
      await tasksPage.createTask('Batch 1', [imageA])
      await tasksPage.open('Batch 1')
      await expect(samplesPage.card('sample-a')).toBeVisible()

      await samplesPage.importSamples([imageB])

      await expect(samplesPage.card('sample-b')).toBeVisible()
      await expect(samplesPage.card('sample-a')).toBeVisible()
    } finally {
      cleanupTestImage(imageA)
      cleanupTestImage(imageB)
    }
  })

  // Regression test: the search box on this page used to be wired up to nothing at all.
  test('filters samples via the search box', async ({ tasksPage, samplesPage }) => {
    const imageA = await createTestImage('sample-a')
    const imageB = await createTestImage('sample-b')
    try {
      await tasksPage.createTask('Batch 1', [imageA, imageB])
      await tasksPage.open('Batch 1')
      await expect(samplesPage.card('sample-a')).toBeVisible()

      await samplesPage.search('sample-b')

      await expect(samplesPage.card('sample-b')).toBeVisible()
      await expect(samplesPage.card('sample-a')).not.toBeVisible()
    } finally {
      cleanupTestImage(imageA)
      cleanupTestImage(imageB)
    }
  })

  test('renames a sample via the context menu', async ({ tasksPage, samplesPage }) => {
    const image = await createTestImage('sample-1')
    try {
      await tasksPage.createTask('Batch 1', [image])
      await tasksPage.open('Batch 1')
      await expect(samplesPage.card('sample-1')).toBeVisible()

      await samplesPage.rename('sample-1', 'renamed-sample')

      await expect(samplesPage.card('renamed-sample')).toBeVisible()
      await expect(samplesPage.card('sample-1')).not.toBeVisible()
    } finally {
      cleanupTestImage(image)
    }
  })

  // Regression test: the samples list used to reset to the top whenever you came back
  // from the labeler, because navigating there used to unmount the samples page entirely.
  test('preserves scroll position when navigating to the labeler and back', async ({
    tasksPage,
    samplesPage
  }) => {
    const images = await Promise.all(
      Array.from({ length: 30 }, (_, i) => createTestImage(`sample-${i}`))
    )
    try {
      await tasksPage.createTask('Batch 1', images)
      await tasksPage.open('Batch 1')
      await expect(samplesPage.card('sample-0')).toBeVisible()

      await samplesPage.scrollContainer.evaluate((el) => {
        el.scrollTop = 800
      })
      const scrollTopBefore = await samplesPage.scrollContainer.evaluate((el) => el.scrollTop)
      expect(scrollTopBefore).toBeGreaterThan(100)

      // force: true so Playwright's own "scroll target into view before clicking" doesn't
      // perturb the scroll position we just set up above - the point of this test is
      // whether *the app* preserves scroll across navigation, not Playwright's click.
      await samplesPage.card('sample-0').getByRole('button', { name: 'Label' }).click({
        force: true
      })
      await samplesPage.back()
      await expect(samplesPage.card('sample-0')).toBeVisible()

      const scrollTopAfter = await samplesPage.scrollContainer.evaluate((el) => el.scrollTop)
      expect(scrollTopAfter).toBe(scrollTopBefore)
    } finally {
      images.forEach(cleanupTestImage)
    }
  })
})
