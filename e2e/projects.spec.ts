import { test, expect } from './fixtures'

test.describe('Projects page', () => {
  test('shows an empty state when there are no projects', async ({ projectsPage }) => {
    await expect(projectsPage.emptyState).toBeVisible()
  })

  test('creates a project with labels and lists it with colored tags', async ({ projectsPage }) => {
    await projectsPage.createProject('Street Signs', ['Stop Sign', 'Yield Sign'])

    await expect(projectsPage.row('Street Signs')).toBeVisible()
    await expect(projectsPage.emptyState).not.toBeVisible()
  })

  test('filters the list via search', async ({ projectsPage }) => {
    await projectsPage.createProject('Street Signs', ['Stop Sign'])
    await projectsPage.createProject('Wildlife Cams', ['Deer'])

    await projectsPage.search('wild')

    await expect(projectsPage.row('Wildlife Cams')).toBeVisible()
    await expect(projectsPage.row('Street Signs')).not.toBeVisible()
    await expect(projectsPage.noSearchMatchesState).not.toBeVisible()
  })

  test('shows a no-matches message when search finds nothing', async ({ projectsPage }) => {
    await projectsPage.createProject('Street Signs', ['Stop Sign'])

    await projectsPage.search('nonexistent-project-name')

    await expect(projectsPage.noSearchMatchesState).toBeVisible()
  })

  test('navigates to the tasks page when a project is opened', async ({
    projectsPage,
    tasksPage
  }) => {
    await projectsPage.createProject('Street Signs', ['Stop Sign'])

    await projectsPage.open('Street Signs')

    await expect(tasksPage.createTaskButton).toBeVisible()
    await expect(tasksPage.emptyState).toBeVisible()
  })

  test('cancelling a delete keeps the project', async ({ projectsPage }) => {
    await projectsPage.createProject('Street Signs', ['Stop Sign'])

    await projectsPage.cancelDelete('Street Signs')

    await expect(projectsPage.row('Street Signs')).toBeVisible()
  })

  test('deletes a project via the context menu and confirm modal', async ({ projectsPage }) => {
    await projectsPage.createProject('Street Signs', ['Stop Sign'])
    await projectsPage.createProject('Wildlife Cams', ['Deer'])

    await projectsPage.delete('Street Signs')

    await expect(projectsPage.row('Street Signs')).not.toBeVisible()
    await expect(projectsPage.row('Wildlife Cams')).toBeVisible()
  })

  test('edits a project name and its label names via the context menu', async ({
    projectsPage,
    window
  }) => {
    await projectsPage.createProject('Street Signs', ['Stop Sign', 'Yield Sign'])

    await projectsPage.edit('Street Signs', 'Renamed Signs', ['Stop Sign Renamed'])

    await expect(projectsPage.row('Renamed Signs')).toBeVisible()
    await expect(projectsPage.row('Street Signs')).not.toBeVisible()
    await expect(window.getByText('Stop Sign Renamed')).toBeVisible()
    // Only the first label was renamed - the second keeps its original name.
    await expect(window.getByText('Yield Sign', { exact: true })).toBeVisible()
  })

  test('adds a new label to an existing project via the edit dialog', async ({
    projectsPage,
    window
  }) => {
    await projectsPage.createProject('Street Signs', ['Stop Sign'])

    await projectsPage.addLabels('Street Signs', ['Speed Limit'])

    // The row's own label badges (LabelTags) reflect the newly-added label directly -
    // the original label is still there too, untouched.
    await expect(window.getByText('Speed Limit')).toBeVisible()
    await expect(window.getByText('Stop Sign')).toBeVisible()
  })

  test('checkboxes only appear after entering select mode, and clicking a row selects it instead of navigating', async ({
    projectsPage
  }) => {
    await projectsPage.createProject('Street Signs', ['Stop Sign'])

    await expect(projectsPage.projectCheckbox('Street Signs')).not.toBeVisible()

    await projectsPage.selectModeButton.click()
    await projectsPage.row('Street Signs').click()

    await expect(projectsPage.projectCheckbox('Street Signs')).toBeChecked()
  })

  test('deletes multiple selected projects via the batch action bar', async ({ projectsPage }) => {
    await projectsPage.createProject('Street Signs', ['Stop Sign'])
    await projectsPage.createProject('Wildlife Cams', ['Deer'])
    await projectsPage.createProject('Other Project', ['Label'])

    await projectsPage.deleteSelectedProjects(['Street Signs', 'Wildlife Cams'])

    await expect(projectsPage.row('Street Signs')).not.toBeVisible()
    await expect(projectsPage.row('Wildlife Cams')).not.toBeVisible()
    await expect(projectsPage.row('Other Project')).toBeVisible()
  })
})
