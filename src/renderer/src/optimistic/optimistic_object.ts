import { makeUUID } from '@shared/utils'

type OptimisticObjectDiff<T> = {
  id: string
  diff: Partial<T>
}

const clearUndefined = <T extends object>(obj: T) =>
  Object.keys(obj).forEach((key) => obj?.[key] === undefined && delete obj?.[key])
export class OptimisticObject<T extends object> {
  base: T
  private diffs: OptimisticObjectDiff<T>[]
  private recentMerge: T | null
  private removeUndefined: boolean
  constructor(base: T, removeUndefined: boolean = false) {
    this.base = base
    this.recentMerge = base
    this.diffs = []
    this.removeUndefined = removeUndefined
    if (this.removeUndefined) {
      clearUndefined(this.base)
    }
  }

  private rebuildMerged(): asserts this is this & { recentMerge: T } {
    this.recentMerge = { ...this.base }
    for (const diff of this.diffs) {
      this.recentMerge = { ...this.recentMerge, ...diff.diff }
    }
    if (this.recentMerge !== null && this.removeUndefined) {
      clearUndefined(this.recentMerge)
    }
  }

  update(diff: Partial<T>) {
    const id = makeUUID()

    this.diffs.push({
      id,
      diff
    })

    if (this.recentMerge === null) {
      this.rebuildMerged()
    } else {
      this.recentMerge = { ...this.recentMerge, ...diff }
      if (this.removeUndefined) {
        clearUndefined(this.recentMerge)
      }
    }
    return id
  }

  updateBase(update: Partial<T>) {
    this.base = { ...this.base, ...update }
    if (this.removeUndefined) {
      clearUndefined(this.base)
    }
    this.recentMerge = null
  }

  rollback(id: string) {
    const diffIdx = this.diffs.findIndex((c) => c.id === id)
    if (diffIdx === -1) return
    this.recentMerge = null
    this.diffs.splice(diffIdx, 1)
  }

  commit(id: string) {
    const diffIdx = this.diffs.findIndex((c) => c.id === id)
    if (diffIdx === -1) return
    this.recentMerge = null
    const diff = this.diffs[diffIdx]
    this.diffs.splice(diffIdx, 1)
    this.base = { ...this.base, ...diff.diff }
    if (this.removeUndefined) {
      clearUndefined(this.base)
    }
  }

  resolve() {
    if (this.recentMerge === null) {
      this.rebuildMerged()
    }

    return this.recentMerge!
  }

  keys() {
    return Object.keys(this.resolve())
  }

  values() {
    return Object.values(this.resolve()) as T[keyof T][]
  }

  toString() {
    return this.resolve().toString()
  }
}
