import { IDataStore } from '@shared/types'
import { vi } from 'vitest'

export const createMockDataStore = (): IDataStore => ({
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),

  getProjects: vi.fn().mockResolvedValue([]),
  createProject: vi.fn(),
  updateProjects: vi.fn().mockResolvedValue([]),
  deleteProjects: vi.fn().mockResolvedValue([]),

  getTasksForProject: vi.fn().mockResolvedValue([]),
  createTask: vi.fn(),
  updateTasks: vi.fn().mockResolvedValue([]),
  deleteTasks: vi.fn().mockResolvedValue([]),

  getTagsForProject: vi.fn().mockResolvedValue([]),
  createTag: vi.fn(),
  updateTags: vi.fn().mockResolvedValue([]),
  deleteTags: vi.fn().mockResolvedValue([]),
  addTagsToTasks: vi.fn().mockResolvedValue(undefined),
  removeTagsFromTasks: vi.fn().mockResolvedValue(undefined),

  getSamplesForTask: vi.fn().mockResolvedValue([]),
  getSamples: vi.fn().mockResolvedValue([]),
  createSamples: vi.fn().mockResolvedValue([]),
  updateSamples: vi.fn().mockResolvedValue([]),
  deleteSamples: vi.fn().mockResolvedValue([]),

  getAnnotationsForSample: vi.fn().mockResolvedValue([]),
  createAnnotations: vi.fn().mockResolvedValue([]),
  updateAnnotations: vi.fn().mockResolvedValue([]),
  deleteAnnotations: vi.fn().mockResolvedValue([]),

  replacePoints: vi.fn().mockResolvedValue([])
})
