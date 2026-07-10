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
})
