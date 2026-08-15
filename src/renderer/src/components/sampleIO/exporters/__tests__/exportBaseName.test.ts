import { describe, expect, it } from 'vitest'
import { IProject, ITask } from '@shared/types'
import { exportBaseName } from '../exportBaseName'

const project: IProject = { id: 'p1', name: 'Street Signs', labels: [] }

describe('exportBaseName', () => {
  it("uses the task's own name when exporting a single task", () => {
    const tasks: ITask[] = [{ id: 't1', name: 'Batch 1' }]

    expect(exportBaseName(project, tasks)).toBe('Batch 1')
  })

  it('falls back to the project name when exporting more than one task', () => {
    const tasks: ITask[] = [
      { id: 't1', name: 'Batch 1' },
      { id: 't2', name: 'Batch 2' }
    ]

    expect(exportBaseName(project, tasks)).toBe('Street Signs')
  })

  it('falls back to the project name when exporting zero tasks', () => {
    expect(exportBaseName(project, [])).toBe('Street Signs')
  })
})
