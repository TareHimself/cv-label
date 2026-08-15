import type { Locator, Page } from '@playwright/test'

export type LabelerModeName = 'Select' | 'Create Boxes' | 'Create Polygon'
export type CompletedStateName = 'In Progress' | 'Completed'

export class LabelPage {
  constructor(private readonly page: Page) {}

  get canvasContainer() {
    return this.page.getByTestId('labeler-canvas')
  }

  get backButton() {
    return this.page.getByRole('button', { name: 'Back' })
  }

  get annotationsButton() {
    return this.page.getByRole('button', { name: 'Annotations' })
  }

  get annotationsDrawerContent() {
    return this.page.getByTestId('annotations-drawer-content')
  }

  async openAnnotationsDrawer() {
    await this.annotationsButton.click()
    await this.annotationsDrawerContent.waitFor()
  }

  /** A row's visible label, e.g. "Box 1" or "Polygon 2" - matches AnnotationsDrawer's own
   *  `${type} ${index + 1}` text per annotation within its label group. */
  annotationRow(text: string) {
    return this.annotationsDrawerContent.getByText(text, { exact: true })
  }

  async back() {
    await this.backButton.click()
  }

  get sampleIndexInput() {
    return this.page.getByLabel('Sample index')
  }

  /** The underlying (visually hidden) radio input - use for state assertions like toBeChecked(). */
  modeRadio(mode: LabelerModeName) {
    return this.page.getByRole('radio', { name: mode })
  }

  labelRadio(labelName: string) {
    return this.page.getByRole('radio', { name: labelName })
  }

  // Mantine's SegmentedControl keeps the native radio visually hidden and pairs it with
  // a <label> that's the actual visible/clickable surface. Resolve and click that label
  // via the DOM's own `labels` association in a single atomic evaluate() - reading the
  // id and clicking it as two separate round-trips is racy if the control re-renders
  // (and gets a fresh Mantine-generated id) in between.
  private async clickOption(radioLocator: Locator) {
    await radioLocator.evaluate((input: HTMLInputElement) => {
      const label = input.labels?.[0]
      ;(label ?? input).click()
    })
  }

  async setMode(mode: LabelerModeName) {
    await this.clickOption(this.modeRadio(mode))
  }

  async selectLabel(labelName: string) {
    await this.clickOption(this.labelRadio(labelName))
  }

  /** The single completed/in-progress toggle button - its label always names the *action*
   *  the click would perform, not the current state (e.g. reads "Mark Complete" while the
   *  sample is in progress). */
  get completedButton() {
    return this.page.getByRole('button', { name: /Mark (Complete|In Progress)/ })
  }

  private buttonLabelForCurrentState(state: CompletedStateName) {
    return state === 'In Progress' ? 'Mark Complete' : 'Mark In Progress'
  }

  // Toggling completed goes through an optimistic update plus an async IPC round trip to
  // the main process before the UI reflects it - on a loaded CI runner that can
  // occasionally outlast even a generous assertion timeout. Retry the click itself
  // rather than trust one attempt to land within a fixed window.
  async setCompleted(state: CompletedStateName, maxAttempts = 3) {
    const targetLabel = this.buttonLabelForCurrentState(state)
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if ((await this.completedButton.textContent())?.trim() === targetLabel) return
      await this.completedButton.click()
      for (let i = 0; i < 20; i++) {
        if ((await this.completedButton.textContent())?.trim() === targetLabel) return
        await this.page.waitForTimeout(250)
      }
    }
  }

  async setSampleIndex(index: number) {
    await this.sampleIndexInput.fill(String(index))
    await this.sampleIndexInput.press('Tab')
  }

  private async canvasCenter() {
    const box = await this.canvasContainer.boundingBox()
    if (box === null) throw new Error('labeler canvas not found')
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  }

  /** Draws a box annotation by dragging around the canvas's center point. */
  async drawBoxAroundCenter(halfSize = 60) {
    const { x, y } = await this.canvasCenter()
    await this.page.mouse.move(x - halfSize, y - halfSize)
    await this.page.mouse.down()
    await this.page.mouse.move(x + halfSize, y + halfSize, { steps: 5 })
    await this.page.mouse.up()
  }

  /** Clicks the canvas center - selects whatever annotation is there in Select mode. */
  async clickCenter() {
    const { x, y } = await this.canvasCenter()
    await this.page.mouse.move(x, y)
    await this.page.mouse.down()
    await this.page.mouse.up()
  }

  async rightClickCenter() {
    await this.rightClickAt(0, 0)
  }

  /** Right-clicks a point offset from the canvas center by (dx, dy) canvas pixels -
   *  e.g. to hit-test a spot on a resized annotation's edge. */
  async rightClickAt(dx: number, dy: number) {
    const { x, y } = await this.canvasCenter()
    await this.page.mouse.move(x + dx, y + dy)
    await this.page.mouse.click(x + dx, y + dy, { button: 'right' })
  }

  /** Drags the mouse between two points offset from the canvas center by (dx, dy)
   *  canvas pixels - e.g. to drag a selected box annotation's edge/corner handle. */
  async dragCanvas(from: { dx: number; dy: number }, to: { dx: number; dy: number }, steps = 5) {
    const { x, y } = await this.canvasCenter()
    await this.page.mouse.move(x + from.dx, y + from.dy)
    await this.page.mouse.down()
    await this.page.mouse.move(x + to.dx, y + to.dy, { steps })
    await this.page.mouse.up()
  }

  get deleteAnnotationMenuItem() {
    return this.page.getByText('Delete')
  }

  get duplicateAnnotationMenuItem() {
    return this.page.getByText('Duplicate')
  }

  /** Matches either direction - its label always names the type the click would convert
   *  *to*, not the annotation's current type. */
  get convertAnnotationTypeMenuItem() {
    return this.page.getByText(/Convert to (Polygon|Box)/)
  }

  /** Selects the annotation under the cursor and deletes it via the right-click menu. */
  async deleteAnnotationAtCenter() {
    await this.clickCenter()
    await this.rightClickCenter()
    await this.deleteAnnotationMenuItem.click()
  }

  /** Selects the annotation under the cursor and duplicates it via the right-click menu. */
  async duplicateAnnotationAtCenter() {
    await this.clickCenter()
    await this.rightClickCenter()
    await this.duplicateAnnotationMenuItem.click()
  }

  /** Selects the annotation under the cursor and flips its Box/Polygon type via the
   *  right-click menu. */
  async convertAnnotationTypeAtCenter() {
    await this.clickCenter()
    await this.rightClickCenter()
    await this.convertAnnotationTypeMenuItem.click()
  }
}
