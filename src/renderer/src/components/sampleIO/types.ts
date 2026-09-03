import type { FC, ReactNode } from 'react'
import type { INewSample, IProject, ISample, ITask } from '@shared/types'

/** One resulting task's worth of samples - name is a suggestion only, ignored when appending to an already-open task. */
export type ImportedTaskGroup = {
  name?: string
  samples: INewSample[]
}

export interface SampleImporterComponentProps {
  project: IProject
  /** scratchDir is where the importer wrote every sample's imagePath - the caller owns deleting it once done with the samples. Most importers report exactly one group; a format with its own task structure (e.g. a multi-task .cvlabel import) may report several. */
  onComplete: (taskGroups: ImportedTaskGroup[], scratchDir: string) => void
  onCancel: () => void
}

export interface SampleImporter {
  id: string
  name: string
  description: string
  icon: ReactNode
  /** Owns its own step/wizard state internally. Must call onComplete exactly once, when it has produced samples to import. */
  Component: FC<SampleImporterComponentProps>
}

export interface SampleExporterComponentProps {
  project: IProject
  tasks: ITask[]
  getSamplesForTask: (taskId: string) => Promise<ISample[]>
  onComplete: () => void
  onCancel: () => void
}

export interface SampleExporter {
  id: string
  name: string
  description: string
  icon: ReactNode
  Component: FC<SampleExporterComponentProps>
}
