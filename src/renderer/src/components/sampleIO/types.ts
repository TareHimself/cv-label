import type { FC, ReactNode } from 'react'
import type { INewSample, IProject, ISample, ITask } from '@shared/types'

export interface SampleImporterComponentProps {
  project: IProject
  /** scratchDir is where the importer wrote every sample's imagePath - the caller owns deleting it once done with the samples. */
  onComplete: (samples: INewSample[], scratchDir: string) => void
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
