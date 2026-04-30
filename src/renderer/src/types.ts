// export const enum AnnotationType {
//   Rectangle,
//   Mask
// }

import { AnnotationType, IAnnotation, ILabel, IPoint, ISample, OmitV2 } from '@shared/types'
import type { NavigateFunction } from 'react-router'
import { OptimisticObject } from './util/optimistic_object'

// export interface IProject {
//   id: string
//   name: string
//   labels: ILabel[]
// }

// export interface ITask {
//   id: string
//   name: string
//   createdAt: string
// }

// export interface ISample {
//   id: string
//   name: string
//   imageId: string
//   imageUri: string
//   annotations: IAnnotation[]
//   createdAt: string
// }

// export interface INewAnnotation {
//   id: string
//   type: string
//   labelId: string
//   points: IPoint[]
// }

// export interface IAnnotation extends INewAnnotation {
//   createdAt: string
//   updatedAt: string
//   completedAt?: string
// }

// export interface IAnnotationUpdate {
//   id: IAnnotation['id']
//   labelId?: IAnnotation['labelId']
//   points?: IAnnotation['points']
// }

// export interface IDataStore {
//   connect: () => Promise<void>
//   disconnect: () => Promise<void>

//   getProjects: () => Promise<IProject[]>
//   createProject: (id: string, name: string, labels: INewLabel[]) => Promise<IProject>
//   deleteProjects: (projectIds: string[]) => Promise<boolean[]>

//   getTasks: () => Promise<ITask[]>
//   createTask: (id: string, name: string) => Promise<ITask>
//   deleteTasks: (taskIds: string[]) => Promise<boolean[]>

//   /**
//    * Create images
//    * @param b64Image the image in base64
//    * @returns the new image id's
//    */
//   createImages: (b64Image: string[]) => Promise<string[]>

//   createSamples: (taskId: string, samples: INewSample[]) => Promise<ISample[]>
//   deleteSamples: (sampleIds: string[]) => Promise<boolean[]>

//   createAnnotations: (sampleId: string, annotations: INewAnnotation[]) => Promise<IAnnotation[]>
//   updateAnnotations: (updates: IAnnotationUpdate[]) => Promise<IAnnotation[]>
//   deleteAnnotations: (annotationsIds: string[]) => Promise<boolean[]>
// }

declare global {
  interface Window {
    navigate: NavigateFunction
  }
}

export enum LabelerMode {
  Select = 'select',
  CreateBox = 'create-box',
  CreateMask = 'create-mask'
}

type AnnotatorLabel = OmitV2<ILabel, 'color'>
type AnnotatorPoint = OmitV2<IPoint, 'id'>

export type AnnotatorInfoResponse = {
  labels: AnnotatorLabel[]
}

export type AnnotatorAnnotation = {
  labelId: string
  type: AnnotationType
  points: AnnotatorPoint[]
}

export type AnnotatorAnnotateResponse = {
  annotations: AnnotatorAnnotation[]
}

export type OptimisticSample = OptimisticObject<
  OmitV2<ISample, 'annotations'> & {
    annotations: OptimisticObject<{ [key: string]: OptimisticObject<IAnnotation> }>
  }
>
