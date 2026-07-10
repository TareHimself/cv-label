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

  get addSamplesButton() {
    return this.page.getByRole('button', { name: 'Add Samples' })
  }

  get importDialog() {
    return this.page.getByRole('dialog', { name: /Import Samples/ })
  }

  get fileInput() {
    return this.importDialog.locator('input[type=file]')
  }

  get yoloZipInput() {
    return this.importDialog.getByTestId('yolo-zip-input')
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

  /** The batch action bar's "Export" button, visible once at least one task is selected. */
  get exportSelectedButton() {
    return this.page.getByRole('button', { name: 'Export', exact: true })
  }

  /** The batch action bar's "Delete" button, visible once at least one task is selected. */
  get deleteSelectedButton() {
    return this.page.getByRole('button', { name: 'Delete', exact: true })
  }

  get clearSelectionButton() {
    return this.page.getByRole('button', { name: 'Clear' })
  }

  /** Enters select mode, showing checkboxes on every row. Hidden once already in select
   *  mode (replaced by the batch action bar), so callers can invoke this idempotently. */
  get selectModeButton() {
    return this.page.getByRole('button', { name: 'Select', exact: true })
  }

  get exportDialog() {
    return this.page.getByRole('dialog', { name: /Export Samples/ })
  }

  get confirmDeleteDialog() {
    return this.page.getByRole('dialog', { name: 'Delete task' })
  }

  get renameDialog() {
    return this.page.getByRole('dialog', { name: 'Rename task' })
  }

  taskCheckbox(name: string) {
    return this.page.getByRole('checkbox', { name: `Select ${name}` })
  }

  get confirmExportButton() {
    return this.exportDialog.getByRole('button', { name: 'Export', exact: true })
  }

  get emptyState() {
    return this.page.getByText('No tasks yet, create one to get started.')
  }

  get noSearchMatchesState() {
    return this.page.getByText('No tasks match your search.')
  }

  row(name: string) {
    return this.page.getByText(name, { exact: true })
  }

  /** Opens the create-task modal, names it, and attaches sample image files via the
   *  Plain Images importer (opened in a nested modal by "Add Samples"). */
  async createTask(name: string, filePaths: string[]) {
    await this.createTaskButton.click()
    await this.nameInput.waitFor()
    await this.nameInput.fill(name)
    await this.addSamplesButton.click()
    await this.importDialog.getByText('Plain Images').click()
    await this.fileInput.waitFor()
    await this.fileInput.setInputFiles(filePaths)
    // The importer completes as soon as files are selected, closing the nested modal.
    await this.importDialog.waitFor({ state: 'hidden' })
    await this.createButton.click()
  }

  /** Opens the create-task modal, names it, and imports samples from a YOLO dataset zip via
   *  the YOLO Dataset importer, accepting the default class-to-label mapping (each class
   *  defaults to the project's first label). */
  async createTaskFromYoloZip(name: string, zipPath: string) {
    await this.createTaskButton.click()
    await this.nameInput.waitFor()
    await this.nameInput.fill(name)
    await this.addSamplesButton.click()
    await this.importDialog.getByText('YOLO Dataset').click()
    await this.yoloZipInput.setInputFiles(zipPath)
    await this.importDialog.getByRole('button', { name: 'Import' }).click()
    await this.importDialog.waitFor({ state: 'hidden' })
    await this.createButton.click()
  }

  /** Enters select mode (if not already in it) and selects the given tasks via their
   *  row checkboxes. */
  async selectTasks(names: string[]) {
    if (await this.selectModeButton.isVisible()) {
      await this.selectModeButton.click()
    }
    for (const name of names) {
      await this.taskCheckbox(name).check()
    }
  }

  /** Selects the given tasks and runs the (single, default) exporter via the batch action
   *  bar. The exporter shows a native save dialog (`dialog.showSaveDialog` in
   *  main/system.ts) to pick where the zip goes, so callers driving this in a test must
   *  stub `dialog.showSaveDialog` via `electronApp.evaluate` first. Resolves once the
   *  modal closes, signalling export completion. */
  async exportTasks(names: string[]) {
    await this.selectTasks(names)
    await this.exportSelectedButton.click()
    await this.exportDialog.waitFor()
    await this.exportDialog.getByText('cv-label File').click()
    await this.confirmExportButton.click()
    await this.exportDialog.waitFor({ state: 'hidden' })
  }

  /** Selects the given tasks and deletes them all via the batch action bar. */
  async deleteSelectedTasks(names: string[]) {
    await this.selectTasks(names)
    await this.deleteSelectedButton.click()
    await this.confirmDeleteDialog.getByRole('button', { name: 'Delete', exact: true }).click()
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

  async rename(name: string, newName: string) {
    await this.row(name).click({ button: 'right' })
    await this.page.getByText('Edit').click()
    await this.renameDialog.getByLabel('Name').fill(newName)
    await this.renameDialog.getByRole('button', { name: 'Save' }).click()
  }
}
