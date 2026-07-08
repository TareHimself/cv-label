import type { Locator, Page } from '@playwright/test'

export type LabelerModeName = 'Select' | 'Create Boxes' | 'Create Segments'
export type CompletedStateName = 'In Progress' | 'Completed'

export class LabelPage {
  constructor(private readonly page: Page) {}

  get canvasContainer() {
    return this.page.getByTestId('labeler-canvas')
  }

  get backButton() {
    return this.page.getByRole('button', { name: 'Back' })
  }

  async back() {
    await this.backButton.click()
  }

  get sampleIndexInput() {
    return this.page.getByLabel('Sample index')
  }

  /** The underlying (visually hidden) radio input — use for state assertions like toBeChecked(). */
  modeRadio(mode: LabelerModeName) {
    return this.page.getByRole('radio', { name: mode })
  }

  labelRadio(labelName: string) {
    return this.page.getByRole('radio', { name: labelName })
  }

  completedRadio(state: CompletedStateName) {
    return this.page.getByRole('radio', { name: state })
  }

  // Mantine's SegmentedControl keeps the native radio visually hidden and pairs it with
  // a <label> that's the actual visible/clickable surface. Resolve and click that label
  // via the DOM's own `labels` association in a single atomic evaluate() — reading the
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

  async setCompleted(state: CompletedStateName) {
    await this.clickOption(this.completedRadio(state))
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

  /** Clicks the canvas center — selects whatever annotation is there in Select mode. */
  async clickCenter() {
    const { x, y } = await this.canvasCenter()
    await this.page.mouse.move(x, y)
    await this.page.mouse.down()
    await this.page.mouse.up()
  }

  async rightClickCenter() {
    const { x, y } = await this.canvasCenter()
    await this.page.mouse.move(x, y)
    await this.page.mouse.click(x, y, { button: 'right' })
  }

  get deleteAnnotationMenuItem() {
    return this.page.getByText('Delete')
  }

  /** Selects the annotation under the cursor and deletes it via the right-click menu. */
  async deleteAnnotationAtCenter() {
    await this.clickCenter()
    await this.rightClickCenter()
    await this.deleteAnnotationMenuItem.click()
  }
}
