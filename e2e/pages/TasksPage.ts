import type { Page } from '@playwright/test'

export class TasksPage {
  constructor(private readonly page: Page) {}

  get backButton() {
    return this.page.getByRole('button', { name: 'Back' })
  }

  get createTaskButton() {
    return this.page.getByRole('button', { name: 'Create Task' })
  }

  get nameInput() {
    return this.page.getByLabel('Name')
  }

  get createDialog() {
    return this.page.getByRole('dialog', { name: 'Create Task' })
  }

  get fileInput() {
    return this.createDialog.locator('input[type=file]')
  }

  get createButton() {
    return this.page.getByRole('button', { name: 'Create', exact: true })
  }

  get searchInput() {
    return this.page.getByPlaceholder('Search')
  }

  get emptyState() {
    return this.page.getByText('No tasks yet — create one to get started.')
  }

  get noSearchMatchesState() {
    return this.page.getByText('No tasks match your search.')
  }

  row(name: string) {
    return this.page.getByText(name, { exact: true })
  }

  /** Opens the create-task modal, names it, and attaches sample image files. */
  async createTask(name: string, filePaths: string[]) {
    await this.createTaskButton.click()
    await this.nameInput.waitFor()
    await this.nameInput.fill(name)
    await this.fileInput.setInputFiles(filePaths)
    await this.createButton.click()
  }

  async search(text: string) {
    await this.searchInput.fill(text)
  }

  async open(name: string) {
    await this.row(name).click()
  }

  async back() {
    await this.backButton.click()
  }

  async delete(name: string) {
    await this.row(name).click({ button: 'right' })
    await this.page.getByText('Delete').click()
    await this.page.getByRole('button', { name: 'Delete', exact: true }).click()
  }

  async cancelDelete(name: string) {
    await this.row(name).click({ button: 'right' })
    await this.page.getByText('Delete').click()
    await this.page.getByRole('button', { name: 'Cancel' }).click()
  }
}
