import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '@renderer/__tests__/renderWithProviders'
import { AnnotationType, ILabel, IProject, ISample, ITask, TrainingSplit } from '@shared/types'
import { useAnnotatorRuntime } from '@renderer/hooks/useAnnotatorRuntime'

const { connectToAnnotator, runAnnotatorOnSample, onRouteLeave } = vi.hoisted(() => ({
  connectToAnnotator: vi.fn(),
  runAnnotatorOnSample: vi.fn(),
  onRouteLeave: { current: null as (() => void) | null }
}))

vi.mock('@renderer/api/ExternalAnnotator', () => ({ connectToAnnotator, runAnnotatorOnSample }))

vi.mock('@renderer/hooks/useAppStore', async () => {
  const { createMockDataStore } = await import('@renderer/__tests__/mockDataStore')
  const state = { store: createMockDataStore() }
  const useAppStore = Object.assign((selector: (s: typeof state) => unknown) => selector(state), {
    getState: () => state
  })
  return { useAppStore }
})

vi.mock('@renderer/router/appRouter', () => ({
  navigate: vi.fn(),
  back: vi.fn(),
  useOnRouteLeave: (callback: () => void) => {
    onRouteLeave.current = callback
  }
}))

import { useAppStore } from '@renderer/hooks/useAppStore'
import { navigate } from '@renderer/router/appRouter'
import { SamplesPage } from '../SamplesPage'

const project: IProject = { id: 'p1', name: 'Street Signs', labels: [] }
const task: ITask = { id: 't1', name: 'Batch 1' }

const samples: ISample[] = [
  {
    id: 's1',
    name: 'photo-one',
    imageUri: 'cv-label-image://s1',
    split: TrainingSplit.Train,
    width: 400,
    height: 300,
    annotations: [],
    completedAt: null,
    createdAt: new Date().toISOString()
  },
  {
    id: 's2',
    name: 'photo-two',
    imageUri: 'cv-label-image://s2',
    split: TrainingSplit.Test,
    width: 400,
    height: 300,
    annotations: [],
    completedAt: new Date().toISOString(),
    createdAt: new Date().toISOString()
  }
]

const renderSamplesPage = (projectOverride: IProject = project) =>
  renderWithProviders(<SamplesPage project={projectOverride} task={task} />)

beforeEach(() => {
  vi.mocked(navigate).mockReset()
  vi.mocked(useAppStore.getState().store.getSamplesForTask).mockReset().mockResolvedValue(samples)
  connectToAnnotator.mockReset().mockResolvedValue([])
  runAnnotatorOnSample.mockReset()
  useAnnotatorRuntime.setState({ entries: {} })
  window.appStore = {
    getAnnotators: vi.fn().mockResolvedValue([]),
    createAnnotator: vi.fn(),
    updateAnnotators: vi.fn().mockResolvedValue([]),
    deleteAnnotators: vi.fn().mockResolvedValue([])
  } as unknown as typeof window.appStore
  onRouteLeave.current = null
})

describe('SamplesPage', () => {
  it('lists samples for the task', async () => {
    renderSamplesPage()

    expect(await screen.findByText('photo-one')).toBeInTheDocument()
    expect(screen.getByText('photo-two')).toBeInTheDocument()
  })

  it('shows "No annotations yet" on a sample with no annotations', async () => {
    const labels: ILabel[] = [{ id: 'l1', name: 'Stop Sign', color: '#ff0000' }]
    renderSamplesPage({ ...project, labels })

    expect(await screen.findByText('photo-one')).toBeInTheDocument()
    expect(screen.getAllByText('No annotations yet')).toHaveLength(2)
  })

  it('shows a per-label annotation count badge on a labeled sample', async () => {
    const labels: ILabel[] = [
      { id: 'l1', name: 'Stop Sign', color: '#ff0000' },
      { id: 'l2', name: 'Yield Sign', color: '#00ff00' }
    ]
    const labeledSample: ISample = {
      ...samples[0],
      annotations: [
        { id: 'a1', type: AnnotationType.Box, labelId: 'l1', points: [] },
        { id: 'a2', type: AnnotationType.Box, labelId: 'l1', points: [] },
        { id: 'a3', type: AnnotationType.Box, labelId: 'l2', points: [] }
      ]
    }
    vi.mocked(useAppStore.getState().store.getSamplesForTask).mockResolvedValue([
      labeledSample,
      samples[1]
    ])

    renderSamplesPage({ ...project, labels })

    expect(await screen.findByText('Stop Sign: 2')).toBeInTheDocument()
    expect(screen.getByText('Yield Sign: 1')).toBeInTheDocument()
    // The other (unlabeled) sample still gets its own empty-state text.
    expect(screen.getByText('No annotations yet')).toBeInTheDocument()
  })

  it('filters samples via the search box', async () => {
    renderSamplesPage()
    await screen.findByText('photo-one')

    fireEvent.change(screen.getByPlaceholderText('Search'), { target: { value: 'two' } })

    expect(screen.queryByText('photo-one')).not.toBeInTheDocument()
    expect(screen.getByText('photo-two')).toBeInTheDocument()
  })

  it('shows a no-matches message when the search finds nothing', async () => {
    renderSamplesPage()
    await screen.findByText('photo-one')

    fireEvent.change(screen.getByPlaceholderText('Search'), { target: { value: 'nomatch' } })

    expect(screen.getByText('No samples match your search.')).toBeInTheDocument()
  })

  it('renames a sample via the context menu', async () => {
    vi.mocked(useAppStore.getState().store.updateSamples).mockResolvedValue([
      { ...samples[0], name: 'photo-one-renamed' }
    ])
    renderSamplesPage()
    await screen.findByText('photo-one')

    fireEvent.contextMenu(screen.getByText('photo-one'))
    fireEvent.click(screen.getByText('Edit'))

    const dialog = await screen.findByRole('dialog', { name: 'Rename sample' })
    fireEvent.change(within(dialog).getByLabelText('Name'), {
      target: { value: 'photo-one-renamed' }
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(useAppStore.getState().store.updateSamples).toHaveBeenCalledWith([
        { id: 's1', name: 'photo-one-renamed' }
      ])
    })
    expect(await screen.findByText('photo-one-renamed')).toBeInTheDocument()
  })

  it('hides the per-sample Auto-label menu entry when there are no annotators', async () => {
    renderSamplesPage()
    await screen.findByText('photo-one')

    fireEvent.contextMenu(screen.getByText('photo-one'))
    // The top-bar button's own label always renders "Auto-label" - only the per-sample
    // context-menu entry should be absent here.
    expect(screen.getAllByText('Auto-label')).toHaveLength(1)
  })

  it('shows the per-sample Auto-label entry once annotators exist', async () => {
    vi.mocked(window.appStore.getAnnotators).mockResolvedValue([
      { id: 'ann1', name: 'My Model', url: 'https://example.com', headers: {} }
    ])
    renderSamplesPage()
    await screen.findByText('photo-one')

    // Open the modal once so the annotators query is known to have resolved (the top-bar
    // button itself no longer reflects loading state), then close it before checking the
    // per-sample context menu.
    fireEvent.click(screen.getByRole('button', { name: 'Auto-label' }))
    await screen.findByText('My Model')
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    fireEvent.contextMenu(screen.getByText('photo-one'))
    // More than just the top-bar button's own label - the per-sample menu entry is there too.
    expect(screen.getAllByText('Auto-label').length).toBeGreaterThan(1)
  })

  it('opens the merged Auto-label modal from the top bar', async () => {
    renderSamplesPage()
    await screen.findByText('photo-one')

    fireEvent.click(screen.getByRole('button', { name: 'Auto-label' }))

    expect(await screen.findByRole('dialog', { name: 'Auto-label' })).toBeInTheDocument()
    expect(screen.getByText('No annotators configured yet.')).toBeInTheDocument()
  })

  it('does not re-label a sample the modal already auto-labeled once Run is clicked again', async () => {
    const labeledSampleOne: ISample = {
      ...samples[0],
      annotations: [{ id: 'ann1', type: AnnotationType.Box, labelId: 'l1', points: [] }]
    }
    vi.mocked(useAppStore.getState().store.getSamplesForTask)
      .mockResolvedValueOnce(samples)
      .mockResolvedValue([labeledSampleOne, samples[1]])
    vi.mocked(window.appStore.getAnnotators).mockResolvedValue([
      { id: 'ann1', name: 'My Model', url: 'https://example.com', headers: {} }
    ])
    runAnnotatorOnSample.mockResolvedValue({
      annotations: [{ id: 'ann1', type: AnnotationType.Box, labelId: 'l1', points: [] }],
      skipped: 0
    })

    renderSamplesPage()
    await screen.findByText('photo-one')

    fireEvent.contextMenu(screen.getByText('photo-one'))
    // Scoped to the open context menu - "Auto-label" also matches the top-bar button, and
    // (depending on portal mount order) isn't reliably the last/first match by index.
    const menu = screen.getByText('Edit').closest('.mantine-contextmenu')
    fireEvent.click(within(menu as HTMLElement).getByText('Auto-label'))

    // First run: no mapping known yet, so it shows the (empty, since neither side has
    // labels) review screen before actually running - wait for that screen to actually
    // mount before clicking its own Run button, or the second click can land on the
    // list's (still-pending) Run button instead.
    fireEvent.click(await screen.findByRole('button', { name: 'Run' }))
    await screen.findByRole('button', { name: 'Back' })
    fireEvent.click(screen.getByRole('button', { name: 'Run' }))
    await waitFor(() => expect(runAnnotatorOnSample).toHaveBeenCalledTimes(1))

    fireEvent.click(await screen.findByRole('button', { name: 'Done' }))

    // Run again in the same still-open modal - a mapping is now known so it runs
    // immediately, and the sample list it sees must be the freshly-refetched one (where
    // photo-one now has an annotation), not the stale pre-run snapshot.
    fireEvent.click(await screen.findByRole('button', { name: 'Run' }))

    await waitFor(() => expect(screen.getByText(/1 already labeled/)).toBeInTheDocument())
    expect(runAnnotatorOnSample).toHaveBeenCalledTimes(1)
  })

  it('closes the auto-label modal when the router reports leaving the page', async () => {
    renderSamplesPage()
    await screen.findByText('photo-one')

    fireEvent.click(screen.getByRole('button', { name: 'Auto-label' }))
    expect(await screen.findByRole('dialog', { name: 'Auto-label' })).toBeInTheDocument()

    act(() => onRouteLeave.current?.())

    expect(screen.queryByRole('dialog', { name: 'Auto-label' })).not.toBeInTheDocument()
  })

  it('navigates to the labeler when Label is clicked', async () => {
    renderSamplesPage()
    await screen.findByText('photo-one')

    fireEvent.click(screen.getAllByRole('button', { name: 'Label' })[0])

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith(
        'label',
        expect.objectContaining({ project, task, initial: 0 })
      )
    })
  })
})
