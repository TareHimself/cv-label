import { IAnnotation, ISample } from '@shared/types'
import { OptimisticObject } from './optimistic_object'
import { OptimisticSample } from '@renderer/types'

/** Wraps a raw ISample (and its annotations) in the OptimisticObject layer the rest of the
 *  app expects a sample to already be in - shared by anything that fetches samples outside
 *  useSamples' own query (e.g. a batch action that pulls samples for several tasks at once). */
export const toOptimisticSample = (sample: ISample): OptimisticSample => {
  const annotationsObj = sample.annotations.reduce<{
    [key: string]: OptimisticObject<IAnnotation>
  }>((acc, annotation) => ({ ...acc, [annotation.id]: new OptimisticObject(annotation) }), {})

  return new OptimisticObject({
    ...sample,
    annotations: new OptimisticObject(annotationsObj, true)
  })
}
