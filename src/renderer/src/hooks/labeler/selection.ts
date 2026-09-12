import type { IAnnotation } from '@shared/types'
import type { OptimisticObject } from '@renderer/util/optimistic_object'
import type { OptimisticSample } from '@renderer/types'

/** selectedAnnotation stays derived from this set - non-null only when exactly one id is selected. */
export const resolveSelectedAnnotation = (
  ids: ReadonlySet<string>,
  sample: OptimisticSample | null
): OptimisticObject<IAnnotation> | null => {
  if (ids.size !== 1) return null
  const [id] = ids
  return sample?.resolve().annotations.resolve()[id] ?? null
}

export const idsEqual = (a: ReadonlySet<string>, b: ReadonlySet<string>): boolean =>
  a.size === b.size && [...a].every((x) => b.has(x))
