import type { FC, ReactNode } from 'react'
import type { INewSample, IProject, ISample, ITask } from '@shared/types'

export interface SampleImporterComponentProps {
  project: IProject
  /** scratchDir is the directory the importer wrote every sample's imagePath into -
   *  the caller owns deleting it once it's done with the samples (immediately if they're
   *  persisted right away, or later if they're only staged for review first). */
  onComplete: (samples: INewSample[], scratchDir: string) => void
  onCancel: () => void
}

export interface SampleImporter {
  id: string
  name: string
  description: string
  icon: ReactNode
  /**
   * Owns its own step/wizard state internally (e.g. a COCO importer might go
   * pick file -> map categories to labels -> preview -> confirm). Must call
   * onComplete exactly once, when it has produced samples to import.
   */
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
