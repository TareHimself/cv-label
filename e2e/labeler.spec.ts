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

    await labelPage.setMode('Create Polygon')
    await expect(labelPage.modeRadio('Create Polygon')).toBeChecked()

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
    await expect(labelPage.completedButton).toHaveText('Mark Complete')

    await labelPage.setCompleted('Completed')

    await expect(labelPage.completedButton).toHaveText('Mark In Progress')
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

  test('drags a box edge to resize it', async ({ labelPage }) => {
    await labelPage.setMode('Create Boxes')
    await labelPage.drawBoxAroundCenter(60)
    await labelPage.setMode('Select')
    await labelPage.clickCenter()

    // A point just outside the original box shouldn't hit-test to it yet.
    await labelPage.rightClickAt(100, 0)
    await expect(labelPage.deleteAnnotationMenuItem).not.toBeVisible()

    // Drag the midpoint of the box's right edge outward to resize it.
    await labelPage.dragCanvas({ dx: 60, dy: 0 }, { dx: 150, dy: 0 })

    // The same point is now inside the resized box.
    await labelPage.rightClickAt(100, 0)
    await expect(labelPage.deleteAnnotationMenuItem).toBeVisible()
  })

  test('drags a resized box edge again, still hit-testable after a move', async ({ labelPage }) => {
    // Regression coverage for the box's derived corner/edge sentinel hit ids surviving a
    // points replace (e.g. a move), not just a fresh selection.
    await labelPage.setMode('Create Boxes')
    await labelPage.drawBoxAroundCenter(60)
    await labelPage.setMode('Select')
    await labelPage.clickCenter()

    // Move the whole box down and to the right.
    await labelPage.dragCanvas({ dx: 0, dy: 0 }, { dx: 40, dy: 40 })

    // Its right edge, now at its new position, should still be hit-testable.
    await labelPage.rightClickAt(100, 40)
    await expect(labelPage.deleteAnnotationMenuItem).toBeVisible()
  })

  test('duplicates a box annotation', async ({ labelPage }) => {
    await labelPage.setMode('Create Boxes')
    await labelPage.drawBoxAroundCenter()
    await labelPage.setMode('Select')

    await labelPage.duplicateAnnotationAtCenter()

    await labelPage.openAnnotationsDrawer()
    await expect(labelPage.annotationRow('Box 1')).toBeVisible()
    await expect(labelPage.annotationRow('Box 2')).toBeVisible()
  })

  test('converts a box annotation to a polygon and back', async ({ labelPage }) => {
    await labelPage.setMode('Create Boxes')
    await labelPage.drawBoxAroundCenter()
    await labelPage.setMode('Select')
    await labelPage.openAnnotationsDrawer()

    await labelPage.convertAnnotationTypeAtCenter()
    await expect(labelPage.annotationRow('Polygon 1')).toBeVisible()

    await labelPage.convertAnnotationTypeAtCenter()
    await expect(labelPage.annotationRow('Box 1')).toBeVisible()
  })
})
