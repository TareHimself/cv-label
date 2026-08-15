import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@renderer/__tests__/renderWithProviders'
import { AnnotationType, IAnnotation, IProject, ISample, ITask, TrainingSplit } from '@shared/types'
import { OptimisticObject } from '@renderer/util/optimistic_object'
import { OptimisticSample } from '@renderer/types'
import { useAnnotatorRuntime } from '@renderer/hooks/useAnnotatorRuntime'

const {
  getAnnotators,
  createAnnotator,
  updateAnnotators,
  deleteAnnotators,
  connectToAnnotator,
  runAnnotatorOnSample,
  createAnnotations
} = vi.hoisted(() => ({
  getAnnotators: vi.fn(),
  createAnnotator: vi.fn(),
  updateAnnotators: vi.fn(),
  deleteAnnotators: vi.fn(),
  connectToAnnotator: vi.fn(),
  runAnnotatorOnSample: vi.fn(),
  createAnnotations: vi.fn()
}))

vi.mock('@renderer/api/ExternalAnnotator', () => ({ connectToAnnotator, runAnnotatorOnSample }))

vi.mock('@renderer/hooks/useAppStore', async () => {
  const { createMockDataStore } = await import('@renderer/__tests__/mockDataStore')
  const store = { ...createMockDataStore(), createAnnotations }
  const state = { store }
  const useAppStore = Object.assign((selector: (s: typeof state) => unknown) => selector(state), {
    getState: () => state
  })
  return { useAppStore }
})

import { AnnotatorsModal } from '../AnnotatorsModal'

const project: IProject = {
  id: 'p1',
  name: 'Street Signs',
  labels: [
    { id: 'l1', name: 'Person', color: '#ff0000' },
    { id: 'l2', name: 'Car', color: '#00ff00' }
  ]
}
const task: ITask = { id: 't1', name: 'Batch 1' }

const annotatorA = { id: 'a1', name: 'Model A', url: 'https://example.com/a', headers: {} }
const annotatorB = { id: 'a2', name: 'Model B', url: 'https://example.com/b', headers: {} }

const makeSample = (id: string): OptimisticSample => {
  const base: ISample = {
    id,
    name: id,
    imageUri: `image://local/${id}.png`,
    split: TrainingSplit.Train,
    width: 100,
    height: 100,
    annotations: [],
    completedAt: null,
    createdAt: new Date().toISOString()
  }
  return new OptimisticObject({
    ...base,
    annotations: new OptimisticObject({}, true)
  })
}

beforeEach(() => {
  getAnnotators.mockReset().mockResolvedValue([])
  createAnnotator.mockReset().mockResolvedValue(undefined)
  updateAnnotators.mockReset().mockResolvedValue([])
  deleteAnnotators.mockReset().mockResolvedValue([true])
  connectToAnnotator.mockReset()
  runAnnotatorOnSample.mockReset()
  createAnnotations.mockReset().mockResolvedValue([])
  window.appStore = {
    getAnnotators,
    createAnnotator,
    updateAnnotators,
    deleteAnnotators
  } as unknown as typeof window.appStore
  useAnnotatorRuntime.setState({ entries: {} })
})

describe('AnnotatorsModal', () => {
  it('connects and saves a new global annotator (no projectId or mapping persisted)', async () => {
    connectToAnnotator.mockResolvedValue([{ id: '0', name: 'person' }])

    renderWithProviders(<AnnotatorsModal opened project={project} onClose={vi.fn()} />)

    await screen.findByText('No annotators configured yet.')
    fireEvent.click(screen.getByRole('button', { name: 'Add Annotator' }))

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'My Model' } })
    fireEvent.change(screen.getByLabelText('URL'), {
      target: { value: 'https://example.com/model' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }))

    await waitFor(() => expect(createAnnotator).toHaveBeenCalledTimes(1))
    expect(createAnnotator).toHaveBeenCalledWith(
      expect.any(String),
      'My Model',
      'https://example.com/model',
      {}
    )
  })

  it('shows an error and stays on the form when connecting fails', async () => {
    connectToAnnotator.mockRejectedValue(new Error('network down'))

    renderWithProviders(<AnnotatorsModal opened project={project} onClose={vi.fn()} />)

    await screen.findByText('No annotators configured yet.')
    fireEvent.click(screen.getByRole('button', { name: 'Add Annotator' }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'My Model' } })
    fireEvent.change(screen.getByLabelText('URL'), { target: { value: 'https://example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }))

    await waitFor(() => expect(connectToAnnotator).toHaveBeenCalled())
    expect(screen.getByLabelText('URL')).toBeInTheDocument()
    expect(createAnnotator).not.toHaveBeenCalled()
  })

  it('deletes an annotator after confirming', async () => {
    getAnnotators.mockResolvedValue([annotatorA])

    renderWithProviders(<AnnotatorsModal opened project={project} onClose={vi.fn()} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Delete Model A' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(deleteAnnotators).toHaveBeenCalledWith(['a1']))
  })

  it('opens the settings screen prefilled, connects for the mapping, and saves edits', async () => {
    getAnnotators.mockResolvedValue([annotatorA])
    connectToAnnotator.mockResolvedValue([{ id: '0', name: 'person' }])

    renderWithProviders(<AnnotatorsModal opened project={project} onClose={vi.fn()} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Edit Model A' }))

    expect(screen.getByLabelText('Name')).toHaveValue('Model A')
    expect(screen.getByLabelText('URL')).toHaveValue('https://example.com/a')
    // The mapping editor connects using the still-unchanged url/headers, same as Run does.
    await waitFor(() =>
      expect(connectToAnnotator).toHaveBeenCalledWith('https://example.com/a', {})
    )
    await screen.findByText('person')

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Renamed Model' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(updateAnnotators).toHaveBeenCalledWith([
        { id: 'a1', name: 'Renamed Model', url: 'https://example.com/a', headers: {} }
      ])
    )
  })

  it('forgets the cached activation when the URL is changed on save', async () => {
    getAnnotators.mockResolvedValue([annotatorA])
    connectToAnnotator.mockResolvedValue([])

    renderWithProviders(
      <AnnotatorsModal
        opened
        project={project}
        tasks={[task]}
        samples={[makeSample('s1')]}
        onClose={vi.fn()}
      />
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Edit Model A' }))
    await waitFor(() => expect(connectToAnnotator).toHaveBeenCalledTimes(1))

    fireEvent.change(screen.getByLabelText('URL'), {
      target: { value: 'https://example.com/a-new' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(updateAnnotators).toHaveBeenCalledTimes(1))

    // Back on the list - Running now reconnects, since the cached activation was for the
    // old URL.
    fireEvent.click(await screen.findByRole('button', { name: 'Run' }))
    await waitFor(() => expect(connectToAnnotator).toHaveBeenCalledTimes(2))
    expect(connectToAnnotator).toHaveBeenLastCalledWith('https://example.com/a', {})
  })

  it('hides the Run action when no task/samples are given (management-only usage)', async () => {
    getAnnotators.mockResolvedValue([annotatorA])

    renderWithProviders(<AnnotatorsModal opened project={project} onClose={vi.fn()} />)

    await screen.findByText('Model A')
    expect(screen.queryByRole('button', { name: 'Run' })).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Manage Annotators' })).toBeInTheDocument()
  })

  it('connects and guesses a mapping by name before running', async () => {
    getAnnotators.mockResolvedValue([annotatorA])
    connectToAnnotator.mockResolvedValue([
      { id: '0', name: 'person' },
      { id: '1', name: 'bicycle' }
    ])
    runAnnotatorOnSample.mockResolvedValue({
      annotations: [{ id: 'ann1', type: AnnotationType.Box, labelId: 'l1', points: [] }],
      skipped: 0
    })

    renderWithProviders(
      <AnnotatorsModal
        opened
        project={project}
        tasks={[task]}
        samples={[makeSample('s1')]}
        onClose={vi.fn()}
      />
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Run' }))

    await screen.findByText('person')
    expect(connectToAnnotator).toHaveBeenCalledWith('https://example.com/a', {})
    // "person" auto-guesses to the same-named project label; "bicycle" has no match so it
    // defaults to Ignore.
    expect(screen.getByDisplayValue('Person')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Ignore')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Run' }))

    await waitFor(() =>
      expect(runAnnotatorOnSample).toHaveBeenCalledWith(
        annotatorA,
        { '0': 'l1', '1': null },
        expect.objectContaining({ id: 's1' })
      )
    )
    expect(await screen.findByText(/1 annotation added/)).toBeInTheDocument()
  })

  it('skips samples that already have annotations and reports them separately', async () => {
    getAnnotators.mockResolvedValue([annotatorA])
    connectToAnnotator.mockResolvedValue([])

    const labeled = makeSample('labeled')
    labeled.resolve().annotations.update({
      ann1: new OptimisticObject<IAnnotation>({
        id: 'ann1',
        type: AnnotationType.Box,
        labelId: 'l1',
        points: []
      })
    })

    renderWithProviders(
      <AnnotatorsModal
        opened
        project={project}
        tasks={[task]}
        samples={[labeled]}
        onClose={vi.fn()}
      />
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Run' }))
    await screen.findByRole('button', { name: 'Back' })
    fireEvent.click(screen.getByRole('button', { name: 'Run' }))

    expect(await screen.findByText(/1 already labeled/)).toBeInTheDocument()
    expect(runAnnotatorOnSample).not.toHaveBeenCalled()
  })

  it('runs a specific annotator among several without touching the others', async () => {
    getAnnotators.mockResolvedValue([annotatorA, annotatorB])
    connectToAnnotator.mockResolvedValue([])
    runAnnotatorOnSample.mockResolvedValue({ annotations: [], skipped: 0 })

    renderWithProviders(
      <AnnotatorsModal
        opened
        project={project}
        tasks={[task]}
        samples={[makeSample('s1')]}
        onClose={vi.fn()}
      />
    )

    await screen.findByText('Model B')
    const runButtons = screen.getAllByRole('button', { name: 'Run' })
    fireEvent.click(runButtons[1])

    await screen.findByRole('button', { name: 'Back' })
    fireEvent.click(screen.getByRole('button', { name: 'Run' }))

    await waitFor(() =>
      expect(runAnnotatorOnSample).toHaveBeenCalledWith(annotatorB, {}, expect.anything())
    )
    expect(connectToAnnotator).toHaveBeenCalledWith('https://example.com/b', {})
    expect(connectToAnnotator).not.toHaveBeenCalledWith('https://example.com/a', {})
  })

  it('reuses a previously activated annotator without reconnecting, keeping the remap', async () => {
    getAnnotators.mockResolvedValue([annotatorA])
    connectToAnnotator.mockResolvedValue([{ id: '0', name: 'truck' }])
    runAnnotatorOnSample.mockResolvedValue({ annotations: [], skipped: 0 })

    renderWithProviders(
      <AnnotatorsModal
        opened
        project={project}
        tasks={[task]}
        samples={[makeSample('s1')]}
        onClose={vi.fn()}
      />
    )

    // First run: connects, remaps "truck" (no name match) from Ignore to Car.
    fireEvent.click(await screen.findByRole('button', { name: 'Run' }))
    await screen.findByText('truck')
    expect(connectToAnnotator).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByDisplayValue('Ignore'))
    fireEvent.click(await screen.findByText('Car'))
    fireEvent.click(screen.getByRole('button', { name: 'Run' }))
    await waitFor(() => expect(runAnnotatorOnSample).toHaveBeenCalledTimes(1))

    // Back to the list, run the same annotator again - since a mapping is already known
    // for this project, it skips the review screen entirely and runs immediately, reusing
    // the remap from the first run (no second connect either).
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Run' }))

    expect(screen.queryByDisplayValue('Car')).not.toBeInTheDocument()
    await waitFor(() => expect(runAnnotatorOnSample).toHaveBeenCalledTimes(2))
    expect(runAnnotatorOnSample).toHaveBeenLastCalledWith(
      annotatorA,
      { '0': 'l2' },
      expect.anything()
    )
    expect(connectToAnnotator).toHaveBeenCalledTimes(1)
  })
})
