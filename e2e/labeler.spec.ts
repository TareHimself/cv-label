import { test, expect } from './fixtures'
import { createTestImage, cleanupTestImage } from './testImage'

test.describe('Labeler', () => {
  test.beforeEach(async ({ projectsPage, tasksPage, samplesPage }) => {
    await projectsPage.createProject('Street Signs', ['Stop Sign', 'Yield Sign'])
    await projectsPage.open('Street Signs')
    const image = await createTestImage('sample-1')
    try {
      await tasksPage.createTask('Batch 1', [image])
      await tasksPage.open('Batch 1')
      await samplesPage.label('sample-1')
    } finally {
      cleanupTestImage(image)
    }
  })

  test('opens in Select mode with the labeler canvas visible', async ({ labelPage }) => {
    await expect(labelPage.canvasContainer).toBeVisible()
    await expect(labelPage.modeRadio('Select')).toBeChecked()
  })

  test('switches modes via the mode control', async ({ labelPage }) => {
    await labelPage.setMode('Create Boxes')
    await expect(labelPage.modeRadio('Create Boxes')).toBeChecked()

    await labelPage.setMode('Create Segments')
    await expect(labelPage.modeRadio('Create Segments')).toBeChecked()

    await labelPage.setMode('Select')
    await expect(labelPage.modeRadio('Select')).toBeChecked()
  })

  test('shows the label picker for multi-label projects and can switch labels', async ({
    labelPage
  }) => {
    await expect(labelPage.labelRadio('Stop Sign')).toBeChecked()

    await labelPage.selectLabel('Yield Sign')

    await expect(labelPage.labelRadio('Yield Sign')).toBeChecked()
  })

  test('toggles the sample completed state', async ({ labelPage }) => {
    await expect(labelPage.completedRadio('In Progress')).toBeChecked()

    await labelPage.setCompleted('Completed')

    await expect(labelPage.completedRadio('Completed')).toBeChecked()
  })

  test('navigates back to the samples page', async ({ labelPage, samplesPage }) => {
    await labelPage.back()

    await expect(samplesPage.card('sample-1')).toBeVisible()
  })

  test('draws a box annotation, selects it, and deletes it', async ({ labelPage }) => {
    await labelPage.setMode('Create Boxes')
    await labelPage.drawBoxAroundCenter()
    await labelPage.setMode('Select')

    await labelPage.deleteAnnotationAtCenter()

    // A second right-click over the same spot should no longer offer a Delete option,
    // since there's nothing left there to hit-test against.
    await labelPage.rightClickCenter()
    await expect(labelPage.deleteAnnotationMenuItem).not.toBeVisible()
  })
})
