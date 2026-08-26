import { IAnnotation, ISample } from '@shared/types'
import { OptimisticObject } from './optimistic_object'
import { OptimisticSample } from '@renderer/types'

/** Wraps a raw ISample in the OptimisticObject layer the rest of the app expects - for anything fetching samples outside useSamples' own query. */
export const toOptimisticSample = (sample: ISample): OptimisticSample => {
  const annotationsObj = sample.annotations.reduce<{
    [key: string]: OptimisticObject<IAnnotation>
  }>((acc, annotation) => ({ ...acc, [annotation.id]: new OptimisticObject(annotation) }), {})

  return new OptimisticObject({
    ...sample,
    annotations: new OptimisticObject(annotationsObj, true)
  })
}
