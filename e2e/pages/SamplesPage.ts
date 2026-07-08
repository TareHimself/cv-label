import type { Page } from '@playwright/test'

export class SamplesPage {
  constructor(private readonly page: Page) {}

  get backButton() {
    return this.page.getByRole('button', { name: 'Back' })
  }

  get importSamplesButton() {
    return this.page.getByRole('button', { name: 'Import Samples' })
  }

  get searchInput() {
    return this.page.getByPlaceholder('Search')
  }

  /** Scopes queries to a specific sample's card, since split/status controls repeat per card. */
  card(sampleName: string) {
    return this.page.locator('.mantine-Card-root').filter({ hasText: sampleName })
  }

  /** The underlying (visually hidden) radio input — use for state assertions like toBeChecked(). */
  radio(sampleName: string, label: 'Train' | 'Test' | 'In Progress' | 'Completed') {
    return this.card(sampleName).getByRole('radio', { name: label })
  }

  /** The visible label text a real user actually clicks to change the radio's value. */
  private option(sampleName: string, label: string) {
    return this.card(sampleName).getByText(label, { exact: true })
  }

  async back() {
    await this.backButton.click()
  }

  async label(sampleName: string) {
    await this.card(sampleName).getByRole('button', { name: 'Label' }).click()
  }

  async setSplit(sampleName: string, split: 'Train' | 'Test') {
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
}
