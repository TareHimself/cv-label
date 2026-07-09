import { AnnotationType, IAnnotation, ILabel, IPoint, ISample, OmitV2 } from '@shared/types'
import { OptimisticObject } from './util/optimistic_object'

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
