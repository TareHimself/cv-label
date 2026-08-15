import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '@renderer/__tests__/renderWithProviders'
import { IProject, ITask, TrainingSplit } from '@shared/types'

vi.mock('@renderer/hooks/useAppStore', async () => {
  const { createMockDataStore } = await import('@renderer/__tests__/mockDataStore')
  const state = { store: createMockDataStore() }
  const useAppStore = Object.assign((selector: (s: typeof state) => unknown) => selector(state), {
    getState: () => state
  })
  return { useAppStore }
})

const { onRouteLeave } = vi.hoisted(() => ({
  onRouteLeave: { current: null as (() => void) | null }
}))

vi.mock('@renderer/router/appRouter', () => ({
  navigate: vi.fn(),
  back: vi.fn(),
  useOnRouteLeave: (callback: () => void) => {
    onRouteLeave.current = callback
  }
}))

import { useAppStore } from '@renderer/hooks/useAppStore'
import { navigate } from '@renderer/router/appRouter'
import { TasksPage } from '../TasksPage'

const project: IProject = { id: 'p1', name: 'Street Signs', labels: [] }
const tasks: ITask[] = [
  { id: 't1', name: 'Batch 1' },
  { id: 't2', name: 'Batch 2' }
]

const renderTasksPage = () => renderWithProviders(<TasksPage project={project} />)

beforeEach(() => {
  vi.mocked(navigate).mockReset()
  vi.mocked(useAppStore.getState().store.getTasksForProject).mockReset().mockResolvedValue(tasks)
  vi.mocked(useAppStore.getState().store.getTagsForProject).mockReset().mockResolvedValue([])
  vi.mocked(useAppStore.getState().store.createTag).mockReset()
  vi.mocked(useAppStore.getState().store.updateTags).mockReset().mockResolvedValue([])
  vi.mocked(useAppStore.getState().store.deleteTags).mockReset().mockResolvedValue([true])
  vi.mocked(useAppStore.getState().store.addTagsToTasks).mockReset().mockResolvedValue(undefined)
  vi.mocked(useAppStore.getState().store.removeTagsFromTasks)
    .mockReset()
    .mockResolvedValue(undefined)
  vi.mocked(useAppStore.getState().store.getSamplesForTask).mockReset().mockResolvedValue([])
  window.appStore = {
    getAnnotators: vi.fn().mockResolvedValue([]),
    createAnnotator: vi.fn(),
    updateAnnotators: vi.fn().mockResolvedValue([]),
    deleteAnnotators: vi.fn().mockResolvedValue([])
  } as unknown as typeof window.appStore
  onRouteLeave.current = null
})

describe('TasksPage', () => {
  it('shows an empty state while no tasks exist', async () => {
    vi.mocked(useAppStore.getState().store.getTasksForProject).mockResolvedValue([])
    renderTasksPage()

    expect(await screen.findByText('No tasks yet, create one to get started.')).toBeInTheDocument()
  })

  it('lists the tasks for the current project', async () => {
    renderTasksPage()

    expect(await screen.findByText('Batch 1')).toBeInTheDocument()
    expect(screen.getByText('Batch 2')).toBeInTheDocument()
  })

  it('shows "No samples yet" for a task with no samples', async () => {
    vi.mocked(useAppStore.getState().store.getTasksForProject).mockResolvedValue([
      { id: 't1', name: 'Batch 1', sampleCount: 0, completedSampleCount: 0 }
    ])
    renderTasksPage()

    expect(await screen.findByText('No samples yet')).toBeInTheDocument()
  })

  it('shows a labeled-progress fraction for a task with samples', async () => {
    vi.mocked(useAppStore.getState().store.getTasksForProject).mockResolvedValue([
      { id: 't1', name: 'Batch 1', sampleCount: 10, completedSampleCount: 3 }
    ])
    renderTasksPage()

    expect(await screen.findByText('3/10 labeled')).toBeInTheDocument()
  })

  it('filters the list via the search box', async () => {
    renderTasksPage()
    await screen.findByText('Batch 1')

    fireEvent.change(screen.getByPlaceholderText('Search'), { target: { value: '2' } })

    expect(screen.queryByText('Batch 1')).not.toBeInTheDocument()
    expect(screen.getByText('Batch 2')).toBeInTheDocument()
  })

  it('navigates to samples when a task is clicked', async () => {
    renderTasksPage()
    await screen.findByText('Batch 1')

    fireEvent.click(screen.getByText('Batch 1'))

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('samples', { project, task: tasks[0] })
    })
  })

  it('renames a task via the context menu', async () => {
    vi.mocked(useAppStore.getState().store.updateTasks).mockResolvedValue([
      { id: 't1', name: 'Batch 1 Renamed' }
    ])
    renderTasksPage()
    await screen.findByText('Batch 1')

    fireEvent.contextMenu(screen.getByText('Batch 1'))
    fireEvent.click(screen.getByText('Edit'))

    const dialog = await screen.findByRole('dialog', { name: 'Rename task' })
    fireEvent.change(within(dialog).getByLabelText('Name'), {
      target: { value: 'Batch 1 Renamed' }
    })
    // The mutation settling triggers a refetch - point it at the post-rename state too, so
    // it doesn't revert the optimistic update back to the stale name once it lands.
    vi.mocked(useAppStore.getState().store.getTasksForProject).mockResolvedValue([
      { id: 't1', name: 'Batch 1 Renamed' },
      tasks[1]
    ])
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(useAppStore.getState().store.updateTasks).toHaveBeenCalledWith([
        { id: 't1', name: 'Batch 1 Renamed' }
      ])
    })
    expect(await screen.findByText('Batch 1 Renamed')).toBeInTheDocument()
  })

  it('keeps a selected task visible even when it no longer matches the search', async () => {
    renderTasksPage()
    await screen.findByText('Batch 1')

    fireEvent.click(screen.getByRole('button', { name: 'Select' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Batch 1' }))
    fireEvent.change(screen.getByPlaceholderText('Search'), { target: { value: '2' } })

    expect(screen.getByText('Batch 1')).toBeInTheDocument()
    expect(screen.getByText('Batch 2')).toBeInTheDocument()
  })

  it('only shows checkboxes and toggles select-by-click after entering select mode via the Select button', async () => {
    renderTasksPage()
    await screen.findByText('Batch 1')

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Select' }))

    expect(screen.getByRole('checkbox', { name: 'Select Batch 1' })).toBeInTheDocument()
    fireEvent.click(screen.getByText('Batch 1'))

    expect(screen.getByRole('checkbox', { name: 'Select Batch 1' })).toBeChecked()
    expect(navigate).not.toHaveBeenCalled()
    expect(screen.getByText('1 selected')).toBeInTheDocument()
  })

  it('Clear exits select mode entirely, hiding checkboxes again', async () => {
    renderTasksPage()
    await screen.findByText('Batch 1')

    fireEvent.click(screen.getByRole('button', { name: 'Select' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Batch 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Select' })).toBeInTheDocument()
  })

  it('exits select mode and clears the selection when the router reports leaving the page', async () => {
    renderTasksPage()
    await screen.findByText('Batch 1')

    fireEvent.click(screen.getByRole('button', { name: 'Select' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Batch 1' }))
    expect(screen.getByText('1 selected')).toBeInTheDocument()

    act(() => onRouteLeave.current?.())

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Select' })).toBeInTheDocument()
  })

  it('right-click Select enters select mode with just that task selected', async () => {
    renderTasksPage()
    await screen.findByText('Batch 1')

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()

    fireEvent.contextMenu(screen.getByText('Batch 1'))
    expect(screen.queryByText('Select All')).not.toBeInTheDocument()
    // The toolbar's own "Select" button is still visible outside select mode too, so
    // disambiguate by only clicking the context menu's copy of the text.
    const [selectMenuItem] = screen
      .getAllByText('Select')
      .filter((el) => el.closest('.mantine-contextmenu-item-button') !== null)
    fireEvent.click(selectMenuItem)

    expect(screen.getByText('1 selected')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Select Batch 1' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Select Batch 2' })).not.toBeChecked()
  })

  it('right-click Select All selects every currently visible (filtered) task', async () => {
    vi.mocked(useAppStore.getState().store.getTasksForProject).mockResolvedValue([
      ...tasks,
      { id: 't3', name: 'Other' }
    ])
    renderTasksPage()
    await screen.findByText('Batch 1')

    // Filter down to only the "Batch" tasks before selecting all.
    fireEvent.change(screen.getByPlaceholderText('Search'), { target: { value: 'Batch' } })
    fireEvent.click(screen.getByRole('button', { name: 'Select' }))
    fireEvent.contextMenu(screen.getByText('Batch 1'))
    fireEvent.click(screen.getByText('Select All'))

    expect(screen.getByText('2 selected')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Select Batch 1' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Select Batch 2' })).toBeChecked()
  })

  it('right-click Select Above/Below selects a range within the currently visible list', async () => {
    vi.mocked(useAppStore.getState().store.getTasksForProject).mockResolvedValue([
      { id: 't1', name: 'Alpha' },
      { id: 't2', name: 'Beta' },
      { id: 't3', name: 'Gamma' }
    ])
    renderTasksPage()
    await screen.findByText('Alpha')

    fireEvent.click(screen.getByRole('button', { name: 'Select' }))
    fireEvent.contextMenu(screen.getByText('Beta'))
    fireEvent.click(screen.getByText('Select Above'))

    expect(screen.getByRole('checkbox', { name: 'Select Alpha' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Select Beta' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Select Gamma' })).not.toBeChecked()

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    fireEvent.click(screen.getByRole('button', { name: 'Select' }))
    fireEvent.contextMenu(screen.getByText('Beta'))
    fireEvent.click(screen.getByText('Select Below'))

    expect(screen.getByRole('checkbox', { name: 'Select Alpha' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Select Beta' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Select Gamma' })).toBeChecked()
  })

  it('disables batch Export/Delete while nothing is selected, and enables them once something is', async () => {
    renderTasksPage()
    await screen.findByText('Batch 1')

    fireEvent.click(screen.getByRole('button', { name: 'Select' }))

    expect(screen.getByRole('button', { name: 'Export' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled()

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Batch 1' }))

    expect(screen.getByRole('button', { name: 'Export' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled()
  })

  it('exports a single task via its context menu outside select mode', async () => {
    renderTasksPage()
    await screen.findByText('Batch 1')

    expect(screen.queryByRole('dialog', { name: /Export Samples/ })).not.toBeInTheDocument()

    fireEvent.contextMenu(screen.getByText('Batch 1'))
    fireEvent.click(screen.getByText('Export'))

    expect(
      await screen.findByRole('dialog', { name: 'Export Samples: Select Format' })
    ).toBeInTheDocument()
  })

  it('navigates to Copy Annotations from the context menu outside select mode', async () => {
    renderTasksPage()
    await screen.findByText('Batch 1')

    fireEvent.contextMenu(screen.getByText('Batch 1'))
    fireEvent.click(screen.getByText('Copy Annotations'))

    expect(navigate).toHaveBeenCalledWith('copy-annotations', { project, sourceTask: tasks[0] })
  })

  it('hides the Copy Annotations context-menu entry in select mode', async () => {
    renderTasksPage()
    await screen.findByText('Batch 1')

    fireEvent.click(screen.getByRole('button', { name: 'Select' }))
    fireEvent.contextMenu(screen.getByText('Batch 1'))

    expect(screen.queryByText('Copy Annotations')).not.toBeInTheDocument()
  })

  it('hides the per-task Export context-menu entry in select mode', async () => {
    renderTasksPage()
    await screen.findByText('Batch 1')

    fireEvent.click(screen.getByRole('button', { name: 'Select' }))
    // The toolbar's own batch Export button is now visible too, so disambiguate by count
    // rather than presence.
    expect(screen.getAllByText('Export')).toHaveLength(1)

    fireEvent.contextMenu(screen.getByText('Batch 1'))

    expect(screen.getAllByText('Export')).toHaveLength(1)
  })

  it('hides the batch Auto-label button and the per-task context-menu entry when there are no annotators', async () => {
    renderTasksPage()
    await screen.findByText('Batch 1')

    fireEvent.click(screen.getByRole('button', { name: 'Select' }))
    expect(screen.queryByRole('button', { name: 'Auto-label' })).not.toBeInTheDocument()

    fireEvent.contextMenu(screen.getByText('Batch 1'))
    expect(screen.queryByText('Auto-label')).not.toBeInTheDocument()
  })

  it('shows the batch Auto-label button once annotators exist, enabled only once something is selected', async () => {
    vi.mocked(window.appStore.getAnnotators).mockResolvedValue([
      { id: 'ann1', name: 'My Model', url: 'https://example.com', headers: {} }
    ])
    renderTasksPage()
    await screen.findByText('Batch 1')

    fireEvent.click(screen.getByRole('button', { name: 'Select' }))
    expect(await screen.findByRole('button', { name: 'Auto-label' })).toBeDisabled()

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Batch 1' }))
    expect(screen.getByRole('button', { name: 'Auto-label' })).toBeEnabled()
  })

  it('fetches samples for every selected task and opens the Auto-label modal against all of them', async () => {
    vi.mocked(window.appStore.getAnnotators).mockResolvedValue([
      { id: 'ann1', name: 'My Model', url: 'https://example.com', headers: {} }
    ])
    vi.mocked(useAppStore.getState().store.getSamplesForTask).mockImplementation((taskId) =>
      Promise.resolve([
        {
          id: `${taskId}-s1`,
          name: `${taskId}-sample`,
          imageUri: `cv-label-image://${taskId}-s1`,
          split: TrainingSplit.Train,
          width: 100,
          height: 100,
          annotations: [],
          completedAt: null,
          createdAt: new Date().toISOString()
        }
      ])
    )
    renderTasksPage()
    await screen.findByText('Batch 1')

    fireEvent.click(screen.getByRole('button', { name: 'Select' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Batch 1' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Batch 2' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Auto-label' }))

    await waitFor(() => {
      expect(useAppStore.getState().store.getSamplesForTask).toHaveBeenCalledWith('t1')
      expect(useAppStore.getState().store.getSamplesForTask).toHaveBeenCalledWith('t2')
    })
    expect(await screen.findByRole('dialog', { name: 'Auto-label' })).toBeInTheDocument()
    expect(await screen.findByText('My Model')).toBeInTheDocument()
  })

  it('runs Auto-label for a single task via its context menu', async () => {
    vi.mocked(window.appStore.getAnnotators).mockResolvedValue([
      { id: 'ann1', name: 'My Model', url: 'https://example.com', headers: {} }
    ])
    renderTasksPage()
    await screen.findByText('Batch 1')

    fireEvent.contextMenu(screen.getByText('Batch 1'))
    fireEvent.click(screen.getByText('Auto-label'))

    await waitFor(() => {
      expect(useAppStore.getState().store.getSamplesForTask).toHaveBeenCalledWith('t1')
    })
    expect(useAppStore.getState().store.getSamplesForTask).not.toHaveBeenCalledWith('t2')
    expect(await screen.findByRole('dialog', { name: 'Auto-label' })).toBeInTheDocument()
  })

  it('deletes a task after confirming', async () => {
    vi.mocked(useAppStore.getState().store.deleteTasks).mockResolvedValue([true])
    renderTasksPage()
    await screen.findByText('Batch 1')

    fireEvent.contextMenu(screen.getByText('Batch 1'))
    fireEvent.click(screen.getByText('Delete'))

    const dialogDeleteButton = await screen.findByRole('button', { name: 'Delete' })
    fireEvent.click(dialogDeleteButton)

    await waitFor(() => {
      expect(useAppStore.getState().store.deleteTasks).toHaveBeenCalledWith(['t1'])
    })
  })

  it('hides the tag filter when the project has no tags', async () => {
    renderTasksPage()
    await screen.findByText('Batch 1')

    expect(screen.queryByPlaceholderText('Filter by tag')).not.toBeInTheDocument()
  })

  it('shows tag badges on a task and the tag filter once the project has tags', async () => {
    vi.mocked(useAppStore.getState().store.getTasksForProject).mockResolvedValue([
      { id: 't1', name: 'Batch 1', tags: [{ id: 'tag1', name: 'Needs Review' }] },
      tasks[1]
    ])
    vi.mocked(useAppStore.getState().store.getTagsForProject).mockResolvedValue([
      { id: 'tag1', name: 'Needs Review' }
    ])
    renderTasksPage()
    await screen.findByText('Batch 1')

    // "Needs Review" also matches the (closed, but still DOM-present) tag filter's own
    // option text - scope to the task row itself to find just the badge.
    const row = screen.getByText('Batch 1').closest('.mantine-Paper-root')
    expect(within(row as HTMLElement).getByText('Needs Review')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Filter by tag')).toBeInTheDocument()
  })

  it('filters the list by a selected tag', async () => {
    vi.mocked(useAppStore.getState().store.getTasksForProject).mockResolvedValue([
      { id: 't1', name: 'Batch 1', tags: [{ id: 'tag1', name: 'Urgent' }] },
      { id: 't2', name: 'Batch 2', tags: [] }
    ])
    vi.mocked(useAppStore.getState().store.getTagsForProject).mockResolvedValue([
      { id: 'tag1', name: 'Urgent' }
    ])
    renderTasksPage()
    await screen.findByText('Batch 1')

    const filterInput = screen.getByPlaceholderText('Filter by tag')
    fireEvent.focus(filterInput)
    fireEvent.click(filterInput)

    // The dropdown's options render into the DOM regardless of whether the popover's own
    // open/close CSS has actually flipped in jsdom (it doesn't reliably, since Mantine's
    // Popover positioning relies on a real layout pass) - clicking the option still
    // works, but finding it needs `hidden: true` (it's inside that possibly-still-hidden
    // popover) and scoping to the listbox (plain text is ambiguous against this same
    // tag's own row badge).
    const listbox = await screen.findByRole('listbox', { hidden: true })
    fireEvent.click(within(listbox).getByText('Urgent'))

    expect(screen.getByText('Batch 1')).toBeInTheDocument()
    expect(screen.queryByText('Batch 2')).not.toBeInTheDocument()
  })

  it("edits one task's tags via the TagPicker combobox, diffing against its current tags", async () => {
    vi.mocked(useAppStore.getState().store.getTasksForProject).mockResolvedValue([
      { id: 't1', name: 'Batch 1', tags: [{ id: 'tag1', name: 'Old' }] },
      tasks[1]
    ])
    vi.mocked(useAppStore.getState().store.getTagsForProject).mockResolvedValue([
      { id: 'tag1', name: 'Old' }
    ])
    vi.mocked(useAppStore.getState().store.createTag).mockResolvedValue({
      id: 'tag2',
      name: 'New'
    })
    renderTasksPage()
    await screen.findByText('Batch 1')

    fireEvent.contextMenu(screen.getByText('Batch 1'))
    fireEvent.click(screen.getByText('Edit Tags'))

    const dialog = await screen.findByRole('dialog', { name: 'Edit Tags' })
    const combobox = within(dialog).getByLabelText('Tags')

    // "Old" starts as a pill (it's already on this task) - its remove button is
    // aria-hidden (Mantine treats the pill's own text as the accessible content), so
    // scope down to it directly rather than querying by accessible name.
    const oldPill = within(dialog).getByText('Old').closest('.mantine-Pill-root')
    fireEvent.click(within(oldPill as HTMLElement).getByRole('button', { hidden: true }))

    // Typing only reveals a "+ Create" option - clicking it (not Enter) is what
    // actually creates the tag. Creation invalidates and refetches the vocabulary, so
    // the mock must start returning the new tag too, same as the "renames a task" test
    // above does for a post-mutation refetch.
    vi.mocked(useAppStore.getState().store.getTagsForProject).mockResolvedValue([
      { id: 'tag1', name: 'Old' },
      { id: 'tag2', name: 'New' }
    ])
    fireEvent.click(combobox)
    fireEvent.change(combobox, { target: { value: 'New' } })
    // The dropdown is portaled to document.body, not nested under the dialog, so DOM-tree
    // scoping (within(dialog)) can't find it - and the toolbar's own tag filter is also a
    // MultiSelect with its own (closed, but still DOM-present) listbox, so plain
    // findByRole would be ambiguous. aria-controls on the combobox names its own listbox
    // by id, unambiguously.
    const listboxId = combobox.getAttribute('aria-controls')
    const listbox = document.getElementById(listboxId ?? '') as HTMLElement
    fireEvent.click(within(listbox).getByText('+ Create "New"'))

    await screen.findByText('New')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(useAppStore.getState().store.createTag).toHaveBeenCalledWith(
        project.id,
        expect.any(String),
        'New'
      )
    })
    expect(useAppStore.getState().store.addTagsToTasks).toHaveBeenCalledWith(['t1'], ['tag2'])
    expect(useAppStore.getState().store.removeTagsFromTasks).toHaveBeenCalledWith(['t1'], ['tag1'])
  })

  it('adds a newly-created tag across a batch of selected tasks via the Add combobox', async () => {
    vi.mocked(useAppStore.getState().store.getTasksForProject).mockResolvedValue([
      { id: 't1', name: 'Batch 1', tags: [{ id: 'tag1', name: 'Old' }] },
      { id: 't2', name: 'Batch 2', tags: [] }
    ])
    vi.mocked(useAppStore.getState().store.getTagsForProject).mockResolvedValue([
      { id: 'tag1', name: 'Old' }
    ])
    vi.mocked(useAppStore.getState().store.createTag).mockResolvedValue({
      id: 'tag2',
      name: 'Reviewed'
    })
    renderTasksPage()
    await screen.findByText('Batch 1')

    fireEvent.click(screen.getByRole('button', { name: 'Select' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Batch 1' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Batch 2' }))
    fireEvent.click(screen.getByRole('button', { name: 'Tags' }))

    const dialog = await screen.findByRole('dialog', { name: 'Edit Tags' })
    const combobox = within(dialog).getByLabelText('Add')
    // Creation invalidates and refetches the vocabulary, so the mock must start
    // returning the new tag too.
    vi.mocked(useAppStore.getState().store.getTagsForProject).mockResolvedValue([
      { id: 'tag1', name: 'Old' },
      { id: 'tag2', name: 'Reviewed' }
    ])
    fireEvent.click(combobox)
    fireEvent.change(combobox, { target: { value: 'Reviewed' } })
    // The dropdown is portaled to document.body, not nested under the dialog, and the
    // toolbar's own tag filter is also a MultiSelect with its own listbox - aria-controls
    // on the combobox names its own listbox by id, unambiguously.
    const listboxId = combobox.getAttribute('aria-controls')
    const listbox = document.getElementById(listboxId ?? '') as HTMLElement
    fireEvent.click(within(listbox).getByText('+ Create "Reviewed"'))

    await screen.findByText('Reviewed')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(useAppStore.getState().store.addTagsToTasks).toHaveBeenCalledWith(
        ['t1', 't2'],
        ['tag2']
      )
    })
    expect(useAppStore.getState().store.removeTagsFromTasks).not.toHaveBeenCalled()
  })

  it('removes an existing tag from a batch of selected tasks by clicking it in the Remove group', async () => {
    vi.mocked(useAppStore.getState().store.getTasksForProject).mockResolvedValue([
      { id: 't1', name: 'Batch 1', tags: [{ id: 'tag1', name: 'Old' }] },
      { id: 't2', name: 'Batch 2', tags: [] }
    ])
    vi.mocked(useAppStore.getState().store.getTagsForProject).mockResolvedValue([
      { id: 'tag1', name: 'Old' }
    ])
    renderTasksPage()
    await screen.findByText('Batch 1')

    fireEvent.click(screen.getByRole('button', { name: 'Select' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Batch 1' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Batch 2' }))
    fireEvent.click(screen.getByRole('button', { name: 'Tags' }))

    const dialog = await screen.findByRole('dialog', { name: 'Edit Tags' })
    // "Old" is only in the "Remove" group's chips now - the "Add" combobox has no chips.
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Old' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(useAppStore.getState().store.removeTagsFromTasks).toHaveBeenCalledWith(
        ['t1', 't2'],
        ['tag1']
      )
    })
    expect(useAppStore.getState().store.addTagsToTasks).not.toHaveBeenCalled()
  })

  it('creates, renames, and deletes tags from the Manage Tags modal', async () => {
    vi.mocked(useAppStore.getState().store.getTagsForProject).mockResolvedValue([
      { id: 'tag1', name: 'Old Name' }
    ])
    vi.mocked(useAppStore.getState().store.createTag).mockResolvedValue({
      id: 'tag2',
      name: 'Brand New'
    })
    renderTasksPage()
    await screen.findByText('Batch 1')

    fireEvent.click(screen.getByRole('button', { name: 'Manage Tags' }))
    const dialog = await screen.findByRole('dialog', { name: 'Manage Tags' })
    await within(dialog).findByText('Old Name')

    fireEvent.change(within(dialog).getByLabelText('New tag'), {
      target: { value: 'Brand New' }
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }))
    await waitFor(() => {
      expect(useAppStore.getState().store.createTag).toHaveBeenCalledWith(
        project.id,
        expect.any(String),
        'Brand New'
      )
    })

    fireEvent.click(within(dialog).getByRole('button', { name: 'Rename Old Name' }))
    const renameDialog = await screen.findByRole('dialog', { name: 'Rename tag' })
    fireEvent.change(within(renameDialog).getByLabelText('Name'), {
      target: { value: 'New Name' }
    })
    fireEvent.click(within(renameDialog).getByRole('button', { name: 'Save' }))
    await waitFor(() => {
      expect(useAppStore.getState().store.updateTags).toHaveBeenCalledWith([
        { id: 'tag1', name: 'New Name' }
      ])
    })

    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete Old Name' }))
    const confirmDialog = await screen.findByRole('dialog', { name: 'Delete tag' })
    fireEvent.click(within(confirmDialog).getByRole('button', { name: 'Delete' }))
    await waitFor(() => {
      expect(useAppStore.getState().store.deleteTags).toHaveBeenCalledWith(['tag1'])
    })
  })
})
