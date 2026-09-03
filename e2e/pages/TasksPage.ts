import type { Locator, Page } from '@playwright/test'

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

  /** The picker's "None" option - starts an empty create-task modal with no import. */
  get noneImportOption() {
    return this.importDialog.getByText('None', { exact: true })
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

  /** Every visible "Export" text on the page - the batch action bar's own button plus,
   *  outside select mode only, a row's open context-menu entry. Callers assert a count
   *  rather than presence, since the batch button alone already matches. */
  get allExportTexts() {
    return this.page.getByText('Export', { exact: true })
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

  get manageTagsButton() {
    return this.page.getByRole('button', { name: 'Manage Tags' })
  }

  get manageTagsDialog() {
    return this.page.getByRole('dialog', { name: 'Manage Tags' })
  }

  get editTagsDialog() {
    return this.page.getByRole('dialog', { name: 'Edit Tags' })
  }

  get batchTagsButton() {
    return this.page.getByRole('button', { name: 'Tags', exact: true })
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

  /** "Create Task" opens the sample importer picker directly - picks Plain Images, attaches
   *  files, then names the resulting (auto-opened, prefilled) create-task modal and confirms. */
  async createTask(name: string, filePaths: string[]) {
    await this.createTaskButton.click()
    await this.importDialog.waitFor()
    await this.importDialog.getByText('Plain Images').click()
    await this.fileInput.waitFor()
    await this.fileInput.setInputFiles(filePaths)
    // The importer completes as soon as files are selected, closing the picker and
    // opening the create-task modal prefilled with the imported samples.
    await this.importDialog.waitFor({ state: 'hidden' })
    await this.createDialog.waitFor()
    await this.nameInput.fill(name)
    await this.createButton.click()
  }

  /** "Create Task" opens the picker; "None" skips straight to a blank create-task modal
   *  (no import), which is then named and confirmed with no samples. */
  async createEmptyTask(name: string) {
    await this.createTaskButton.click()
    await this.importDialog.waitFor()
    await this.noneImportOption.click()
    await this.createDialog.waitFor()
    await this.nameInput.fill(name)
    await this.createButton.click()
  }

  // Mantine's SegmentedControl keeps the native radio visually hidden and pairs it with
  // a <label> that's the actual visible/clickable surface (same trick as LabelPage's
  // clickOption, for the importer's "Label Format" control).
  private async clickOption(radioLocator: Locator) {
    await radioLocator.evaluate((input: HTMLInputElement) => {
      const label = input.labels?.[0]
      ;(label ?? input).click()
    })
  }

  /** "Create Task" opens the sample importer picker directly - picks YOLO Dataset, imports
   *  the zip accepting the default class-to-label mapping (each class defaults to the
   *  project's first label), then names the resulting (auto-opened, prefilled) create-task
   *  modal and confirms. `format` picks the importer's "Label Format" toggle - defaults to
   *  Detection, matching the importer's own default. */
  async createTaskFromYoloZip(
    name: string,
    zipPath: string,
    format: 'Detection' | 'Segmentation' = 'Detection'
  ) {
    await this.createTaskButton.click()
    await this.importDialog.waitFor()
    await this.importDialog.getByText('YOLO Dataset').click()
    await this.yoloZipInput.setInputFiles(zipPath)
    if (format === 'Segmentation') {
      await this.clickOption(this.importDialog.getByRole('radio', { name: 'Segmentation' }))
    }
    await this.importDialog.getByRole('button', { name: 'Import' }).click()
    await this.importDialog.waitFor({ state: 'hidden' })
    await this.createDialog.waitFor()
    await this.nameInput.fill(name)
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

  /** Exports a single task via its own context-menu "Export" entry - only offered
   *  outside select mode. Otherwise the same save-dialog-stubbing caveat as exportTasks
   *  applies. */
  async exportTask(name: string) {
    await this.row(name).click({ button: 'right' })
    await this.page.getByText('Export', { exact: true }).click()
    await this.exportDialog.waitFor()
    await this.exportDialog.getByText('cv-label File').click()
    await this.confirmExportButton.click()
    await this.exportDialog.waitFor({ state: 'hidden' })
  }

  /** Copy Annotations is a routed page (not a modal, for width - see
   *  CopyAnnotationsPage.tsx), so its own body content lives in the stack-router's usual
   *  scroll container, distinguishing its in-page "Back" (destination picker, once in the
   *  run step) from the page's top-bar "Back" (returns to this TasksPage). */
  get copyAnnotationsContent() {
    return this.page.getByTestId('basic-list-scroll-container').and(this.page.locator(':visible'))
  }

  /** Copies annotations from `sourceName`'s task into `destinationName`'s task via the
   *  source task's own context-menu entry - picks the destination task, accepts the
   *  default position-based sample mapping as-is, runs, then returns here (Done alone
   *  doesn't leave the page - it returns to the destination picker for another run, same
   *  as the auto-label modal's Done - so the top-bar Back is what navigates back). */
  async copyAnnotations(sourceName: string, destinationName: string) {
    await this.row(sourceName).click({ button: 'right' })
    await this.page.getByText('Copy Annotations', { exact: true }).click()
    await this.copyAnnotationsContent.getByPlaceholder('Select a task').click()
    await this.page.getByRole('option', { name: destinationName }).click()
    await this.copyAnnotationsContent.getByRole('button', { name: 'Continue' }).click()
    await this.copyAnnotationsContent.getByRole('button', { name: 'Run' }).click()
    await this.copyAnnotationsContent.getByRole('button', { name: 'Done' }).click()
    await this.backButton.click()
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
    // Exact match - the row's context menu also has an "Edit Tags" item, which
    // getByText('Edit') would otherwise match too (substring).
    await this.page.getByText('Edit', { exact: true }).click()
    await this.renameDialog.getByLabel('Name').fill(newName)
    await this.renameDialog.getByRole('button', { name: 'Save' }).click()
  }

  /** Creates a project tag via the "Manage Tags" modal - the only place typing creates a
   *  tag outright; everywhere else it's picked (or created inline) via the TagPicker
   *  combobox. Leaves the modal open. */
  async createTag(name: string) {
    await this.manageTagsButton.click()
    await this.manageTagsDialog.getByLabel('New tag').fill(name)
    await this.manageTagsDialog.getByRole('button', { name: 'Add', exact: true }).click()
    await this.manageTagsDialog.getByText(name).waitFor()
  }

  async closeManageTags() {
    await this.manageTagsDialog.getByRole('button', { name: 'Close' }).click()
  }

  async openEditTags(taskName: string) {
    await this.row(taskName).click({ button: 'right' })
    await this.page.getByText('Edit Tags').click()
    await this.editTagsDialog.waitFor()
  }

  /** Picks an existing tag by exact name from a TagPicker combobox inside the currently
   *  open "Edit Tags" dialog. */
  async pickExistingTag(comboboxLabel: string, tagName: string) {
    await this.editTagsDialog.getByLabel(comboboxLabel).click()
    await this.page.getByRole('option', { name: tagName, exact: true }).click()
  }

  /** Types a brand new tag name into a TagPicker combobox and clicks its "+ Create"
   *  option, creating the tag and selecting it in one motion. */
  async createTagInline(comboboxLabel: string, tagName: string) {
    await this.editTagsDialog.getByLabel(comboboxLabel).fill(tagName)
    await this.page.getByRole('option', { name: `+ Create "${tagName}"` }).click()
  }

  async saveTags() {
    await this.editTagsDialog.getByRole('button', { name: 'Save' }).click()
    await this.editTagsDialog.waitFor({ state: 'hidden' })
  }

  /** The tag badge shown on a task's own row (not the filter/picker dropdowns elsewhere
   *  on the page) - scoped to the row's container via the shared Paper-styled Row. */
  tagBadge(taskName: string, tagName: string) {
    return this.page
      .locator('.mantine-Paper-root')
      .filter({ has: this.page.getByText(taskName, { exact: true }) })
      .getByText(tagName, { exact: true })
  }
}
