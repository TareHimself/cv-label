import type { Page } from '@playwright/test'

export class SamplesPage {
  constructor(private readonly page: Page) {}

  get backButton() {
    return this.page.getByRole('button', { name: 'Back' })
  }

  get importSamplesButton() {
    return this.page.getByRole('button', { name: 'Import Samples' })
  }

  get importDialog() {
    return this.page.getByRole('dialog', { name: /Import Samples/ })
  }

  /** The Plain Images importer's own Dropzone file input - excludes its separate folder-picker input. */
  get fileInput() {
    return this.importDialog.locator('input[type=file]:not([data-testid="plain-images-folder-input"])')
  }

  get renameDialog() {
    return this.page.getByRole('dialog', { name: 'Rename sample' })
  }

  // Every stack-router page has an identically-placeholdered search box, and hidden
  // (not unmounted) pages still match placeholder-based locators, unlike getByRole -
  // scope to the visible one.
  get searchInput() {
    return this.page.getByPlaceholder('Search').and(this.page.locator(':visible'))
  }

  /** Scopes queries to a specific sample's card, since split/status controls repeat per card. */
  card(sampleName: string) {
    return this.page.locator('.mantine-Card-root').filter({ hasText: sampleName })
  }

  /** The underlying (visually hidden) radio input - use for state assertions like toBeChecked(). */
  radio(sampleName: string, label: 'Train' | 'Test' | 'Valid' | 'In Progress' | 'Completed') {
    return this.card(sampleName).getByRole('radio', { name: label })
  }

  /** The visible label text a real user actually clicks to change the radio's value. */
  private option(sampleName: string, label: string) {
    return this.card(sampleName).getByText(label, { exact: true })
  }

  async back() {
    await this.backButton.click()
  }

  async search(text: string) {
    await this.searchInput.fill(text)
  }

  /** Opens the Import Samples modal, picks the Plain Images importer, and attaches the
   *  given files, which are added to the current task on completion. */
  async importSamples(filePaths: string[]) {
    await this.importSamplesButton.click()
    await this.importDialog.getByText('Plain Images').click()
    await this.fileInput.waitFor()
    await this.fileInput.setInputFiles(filePaths)
    await this.importDialog.waitFor({ state: 'hidden' })
  }

  async label(sampleName: string) {
    await this.card(sampleName).getByRole('button', { name: 'Label' }).click()
  }

  async setSplit(sampleName: string, split: 'Train' | 'Test' | 'Valid') {
    await this.option(sampleName, split).click()
  }

  async setCompleted(sampleName: string, completed: boolean) {
    await this.option(sampleName, completed ? 'Completed' : 'In Progress').click()
  }

  async delete(sampleName: string) {
    await this.card(sampleName).click({ button: 'right' })
    await this.page.getByText('Delete').click()
    await this.page.getByRole('button', { name: 'Delete', exact: true }).click()
  }

  async cancelDelete(sampleName: string) {
    await this.card(sampleName).click({ button: 'right' })
    await this.page.getByText('Delete').click()
    await this.page.getByRole('button', { name: 'Cancel' }).click()
  }

  async rename(sampleName: string, newName: string) {
    await this.card(sampleName).click({ button: 'right' })
    await this.page.getByText('Edit').click()
    await this.renameDialog.getByLabel('Name').fill(newName)
    await this.renameDialog.getByRole('button', { name: 'Save' }).click()
  }
}
