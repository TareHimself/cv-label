import { makeUUID } from '@shared/utils'

type OptimisticObjectDiff<T> = {
  id: string
  status: 'pending' | 'rollback' | 'commited'
  diff: Partial<T>
}

export type PendingUpdate<T> = {
  id: string
  commit: (override?: Partial<T>) => void
  rollback: () => void
}
const clearUndefined = <T extends object>(obj: T) =>
  Object.keys(obj).forEach((key) => obj?.[key] === undefined && delete obj?.[key])
export class OptimisticObject<T extends object> {
  base: T
  private diffs: OptimisticObjectDiff<T>[]
  private recentMerge: T | null
  private removeUndefined: boolean
  private pendingFinalies: Map<string, Set<() => void>> = new Map()
  private subscriptions: Map<string, (data: OptimisticObject<T>) => void> = new Map()
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
      if (diff.status !== 'rollback') this.recentMerge = { ...this.recentMerge, ...diff.diff }
    }
    if (this.recentMerge !== null && this.removeUndefined) {
      clearUndefined(this.recentMerge)
    }
  }

  subscribe(callback: (data: OptimisticObject<T>) => void) {
    const id = makeUUID()
    this.subscriptions.set(id, callback)
    return () => {
      this.subscriptions.delete(id)
    }
  }

  private updateSubscribers() {
    for (const callback of this.subscriptions.values()) {
      callback(this)
    }
  }

  update(diff: Partial<T>): PendingUpdate<T> {
    const id = makeUUID()

    this.diffs.push({
      id,
      status: 'pending',
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

    this.updateSubscribers()
    return {
      id: id,
      commit: (override) => this.commit(id, override),
      rollback: () => this.rollback(id)
    }
  }

  updateBase(update: Partial<T>) {
    this.base = { ...this.base, ...update }
    if (this.removeUndefined) {
      clearUndefined(this.base)
    }
    this.recentMerge = null
    this.updateSubscribers()
  }

  private callFinalies(id: string) {
    const callbacks = this.pendingFinalies.get(id)
    if (callbacks !== undefined) {
      for (const callback of callbacks) {
        callback()
      }
      callbacks.clear()
    }
  }

  private compactDiffs() {
    let removed = false
    while (this.diffs.length > 0 && this.diffs[0].status !== 'pending') {
      const targetDiff = this.diffs.shift()

      if (targetDiff === undefined) continue

      if (targetDiff.status === 'rollback') continue

      removed = true

      this.recentMerge = null
      this.base = { ...this.base, ...targetDiff.diff }
    }

    if (removed && this.removeUndefined) {
      clearUndefined(this.base)
    }
  }

  commit(id: string, override?: Partial<T>) {
    const diff = this.diffs.find((c) => c.id === id)

    if (diff === undefined) return false

    diff.status = 'commited'

    if (override !== undefined) {
      diff.diff = { ...diff.diff, ...override }
    }

    this.compactDiffs()

    this.callFinalies(id)
    this.updateSubscribers()
    return true
  }

  rollback(id: string) {
    const diff = this.diffs.find((c) => c.id === id)

    if (diff === undefined) return false

    diff.status = 'rollback'
    this.recentMerge = null

    this.compactDiffs()

    this.callFinalies(id)
    this.updateSubscribers()
    return true
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

  async waitForUpdateResolve(updateId: string) {
    const set = this.pendingFinalies.get(updateId) ?? new Set()
    return new Promise<void>((res) => {
      set.add(res)
      this.pendingFinalies.set(updateId, set)
    })
  }

  async waitForResolve() {
    const nestedItems = Object.values(this.resolve())
      .filter((c) => c instanceof OptimisticObject)
      .map((c) => c.waitForResolve())
    return Promise.all([
      ...nestedItems,
      ...this.diffs.map((c) => this.waitForUpdateResolve(c.id))
    ]).then(() => undefined)
  }
}
