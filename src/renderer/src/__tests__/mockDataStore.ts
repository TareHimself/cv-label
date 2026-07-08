import { IDataStore } from '@shared/types'
import { vi } from 'vitest'

export const createMockDataStore = (): IDataStore => ({
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),

  getProjects: vi.fn().mockResolvedValue([]),
  createProject: vi.fn(),
  deleteProjects: vi.fn().mockResolvedValue([]),

  getTasksForProject: vi.fn().mockResolvedValue([]),
  createTask: vi.fn(),
  deleteTasks: vi.fn().mockResolvedValue([]),

  getSamplesForTask: vi.fn().mockResolvedValue([]),
  getSamples: vi.fn().mockResolvedValue([]),
  createSamples: vi.fn().mockResolvedValue([]),
  updateSamples: vi.fn().mockResolvedValue([]),
  deleteSamples: vi.fn().mockResolvedValue([]),

  getAnnotationsForSample: vi.fn().mockResolvedValue([]),
  createAnnotations: vi.fn().mockResolvedValue([]),
  updateAnnotations: vi.fn().mockResolvedValue([]),
  deleteAnnotations: vi.fn().mockResolvedValue([]),

  getAnnotators: vi.fn().mockResolvedValue([]),
  createAnnotator: vi.fn(),
  deleteAnnotators: vi.fn().mockResolvedValue([]),

  replacePoints: vi.fn().mockResolvedValue([])
})
