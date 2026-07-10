import type { Page } from '@playwright/test'

export class ProjectsPage {
  constructor(private readonly page: Page) {}

  get createProjectButton() {
    return this.page.getByRole('button', { name: 'Create Project' })
  }

  get nameInput() {
    return this.page.getByLabel('Name')
  }

  get labelNameInputs() {
    return this.page.getByPlaceholder('Label Name')
  }

  get addLabelButton() {
    return this.page.getByRole('button', { name: 'Add Label' })
  }

  get createButton() {
    return this.page.getByRole('button', { name: 'Create', exact: true })
  }

  // Every stack-router page has an identically-placeholdered search box, and hidden
  // (not unmounted) pages still match placeholder-based locators, unlike getByRole -
  // scope to the visible one.
  get searchInput() {
    return this.page.getByPlaceholder('Search').and(this.page.locator(':visible'))
  }

  get emptyState() {
    return this.page.getByText('No projects yet, create one to get started.')
  }

  get noSearchMatchesState() {
    return this.page.getByText('No projects match your search.')
  }

  get editDialog() {
    return this.page.getByRole('dialog', { name: 'Edit Project' })
  }

  row(name: string) {
    return this.page.getByText(name, { exact: true })
  }

  /** Opens the create-project modal and fills in a name plus one or more labels. */
  async createProject(name: string, labelNames: string[]) {
    await this.createProjectButton.click()
    await this.nameInput.waitFor()
    await this.nameInput.fill(name)

    for (let i = 0; i < labelNames.length; i++) {
      if (i > 0) {
        await this.addLabelButton.click()
      }
      await this.labelNameInputs.nth(i).fill(labelNames[i])
    }

    await this.createButton.click()
  }

  async search(text: string) {
    await this.searchInput.fill(text)
  }

  async open(name: string) {
    await this.row(name).click()
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

  /** Renames a project and, in order, renames its existing labels (doesn't add/remove any). */
  async edit(name: string, newName: string, newLabelNames: string[] = []) {
    await this.row(name).click({ button: 'right' })
    await this.page.getByText('Edit').click()
    await this.editDialog.getByLabel('Name').fill(newName)

    const labelInputs = this.editDialog.getByRole('textbox')
    for (let i = 0; i < newLabelNames.length; i++) {
      // Textbox 0 is the project Name field itself - label rows start at index 1.
      await labelInputs.nth(i + 1).fill(newLabelNames[i])
    }

    await this.editDialog.getByRole('button', { name: 'Save' }).click()
  }
}
