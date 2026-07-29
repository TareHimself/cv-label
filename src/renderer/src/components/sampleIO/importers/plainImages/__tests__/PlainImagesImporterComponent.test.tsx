import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@renderer/__tests__/renderWithProviders'
import { IProject, INewSample, TrainingSplit } from '@shared/types'

const filesToSamples = vi.fn()
vi.mock('../../filesToSamples', () => ({
  filesToSamples: (...args: unknown[]) => filesToSamples(...args)
}))

const toastError = vi.fn()
vi.mock('react-hot-toast', () => ({
  default: { error: (...args: unknown[]) => toastError(...args) }
}))

import { PlainImagesImporterComponent } from '../PlainImagesImporterComponent'

const project: IProject = { id: 'p1', name: 'Street Signs', labels: [] }

const makeFile = (name: string) => new File(['x'], name, { type: 'image/jpeg' })

const getFileInput = () => document.querySelector('input[type=file]') as HTMLInputElement

const createTemporaryDirectory = vi.fn()

beforeEach(() => {
  filesToSamples.mockReset()
  toastError.mockReset()
  createTemporaryDirectory.mockReset().mockResolvedValue('/scratch')
  window.system = { createTemporaryDirectory } as unknown as typeof window.system
})

describe('PlainImagesImporterComponent', () => {
  it('shows progress while importing and calls onComplete with the produced samples', async () => {
    const sample: INewSample = {
      id: 's1',
      name: 'photo',
      imagePath: '/scratch/s1.jpg',
      split: TrainingSplit.Train,
      annotations: [],
      createdAt: new Date().toISOString()
    }
    let resolveImport: (samples: INewSample[]) => void = () => {}
    filesToSamples.mockImplementation(
      (_files: File[], _scratchDir: string, onProgress?: (c: number, t: number) => void) => {
        onProgress?.(1, 2)
        return new Promise<INewSample[]>((resolve) => {
          resolveImport = resolve
        })
      }
    )
    const onComplete = vi.fn()

    renderWithProviders(
      <PlainImagesImporterComponent project={project} onComplete={onComplete} onCancel={vi.fn()} />
    )
    fireEvent.change(getFileInput(), { target: { files: [makeFile('a.jpg')] } })

    expect(await screen.findByText('Processing images… 50%')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()

    resolveImport([sample])

    await waitFor(() => expect(onComplete).toHaveBeenCalledWith([sample], '/scratch'))
    expect(screen.queryByText(/Processing images/)).not.toBeInTheDocument()
  })

  it('shows an error toast and re-enables Cancel when reading files fails', async () => {
    filesToSamples.mockRejectedValue(new Error('boom'))

    renderWithProviders(
      <PlainImagesImporterComponent project={project} onComplete={vi.fn()} onCancel={vi.fn()} />
    )
    fireEvent.change(getFileInput(), { target: { files: [makeFile('a.jpg')] } })

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Failed to read image files'))
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled()
  })

  it('calls onCancel when Cancel is clicked', () => {
    const onCancel = vi.fn()
    renderWithProviders(
      <PlainImagesImporterComponent project={project} onComplete={vi.fn()} onCancel={onCancel} />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onCancel).toHaveBeenCalled()
  })
})
