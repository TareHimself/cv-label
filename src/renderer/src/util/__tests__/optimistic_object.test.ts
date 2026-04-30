import { describe, it, expect, beforeEach } from 'vitest'
import { OptimisticObject } from '../optimistic_object'

// Test data constants
const INITIAL_STATE = {
  name: 'Test User',
  email: 'test@example.com',
  age: 25,
  verified: false
}

const UPDATE_PARTIAL = {
  name: 'Updated User',
  verified: true
}

const UPDATE_WITH_UNDEFINED = {
  name: 'Another User',
  email: undefined
}

// Test scenario constants
const EXAMPLE_NAME_1 = 'First'
const NEW_EMAIL = 'new@example.com'
const NEW_AGE = 35
const EXAMPLE_NAME_2 = 'First Update'
const SECOND_EMAIL = 'second@example.com'
const BASE_UPDATE_EMAIL = 'base@example.com'
const BASE_UPDATE_AGE = 40
const UPDATE_NAME = 'Updated Name'
const VERIFY_UPDATE = true
const UPDATE_AGE_ROLLBACK = 30
const NEW_BASE_NAME = 'New Base'
const SERVER_RESPONSE_EMAIL = 'overridden@example.com'

describe('OptimisticObject', () => {
  let optimisticObj: OptimisticObject<typeof INITIAL_STATE>

  beforeEach(() => {
    optimisticObj = new OptimisticObject(structuredClone(INITIAL_STATE))
  })

  describe('optimistic updates workflow', () => {
    it('should apply optimistic updates immediately and preserve after commit', () => {
      const { commit } = optimisticObj.update(UPDATE_PARTIAL)
      let resolved = optimisticObj.resolve()
      expect(resolved).toEqual(expect.objectContaining(UPDATE_PARTIAL))

      commit()
      resolved = optimisticObj.resolve()
      expect(resolved).toEqual(expect.objectContaining(UPDATE_PARTIAL))
    })

    it('should revert state when update is rolled back', () => {
      const { rollback } = optimisticObj.update(UPDATE_PARTIAL)
      expect(optimisticObj.resolve()).toEqual(expect.objectContaining(UPDATE_PARTIAL))

      rollback()
      expect(optimisticObj.resolve()).toEqual(INITIAL_STATE)
    })

    it('should handle multiple pending updates and apply them in sequence', () => {
      optimisticObj.update({ name: EXAMPLE_NAME_2 })
      optimisticObj.update({ email: SECOND_EMAIL })
      const resolved = optimisticObj.resolve()
      expect(resolved.name).toBe(EXAMPLE_NAME_2)
      expect(resolved.email).toBe(SECOND_EMAIL)
      expect(resolved.age).toBe(INITIAL_STATE.age)
    })

    it('should allow selective rollback while preserving other updates', () => {
      const { rollback: rollback1 } = optimisticObj.update({ name: EXAMPLE_NAME_1 })
      optimisticObj.update({ email: NEW_EMAIL })
      optimisticObj.update({ age: NEW_AGE })
      rollback1()
      const resolved = optimisticObj.resolve()
      expect(resolved.name).toBe(INITIAL_STATE.name)
      expect(resolved.email).toBe(NEW_EMAIL)
      expect(resolved.age).toBe(NEW_AGE)
    })

    it('should support override data during commit to reconcile server response', () => {
      const { commit } = optimisticObj.update(UPDATE_PARTIAL)
      commit({ email: SERVER_RESPONSE_EMAIL })
      const resolved = optimisticObj.resolve()
      expect(resolved.name).toBe(UPDATE_PARTIAL.name)
      expect(resolved.email).toBe(SERVER_RESPONSE_EMAIL)
      expect(resolved.verified).toBe(UPDATE_PARTIAL.verified)
    })

    it('should update base state and clear pending changes', () => {
      optimisticObj.update(UPDATE_PARTIAL)
      optimisticObj.updateBase({ email: BASE_UPDATE_EMAIL, age: BASE_UPDATE_AGE })
      const resolved = optimisticObj.resolve()
      expect(resolved.email).toBe(BASE_UPDATE_EMAIL)
      expect(resolved.age).toBe(BASE_UPDATE_AGE)
      expect(resolved.name).toBe(UPDATE_PARTIAL.name)
    })
  })

  describe('state consistency', () => {
    it('returns current state reflecting all non-rolled-back updates', () => {
      const { rollback: rollback1 } = optimisticObj.update({ name: UPDATE_NAME })
      optimisticObj.update({ verified: VERIFY_UPDATE })
      rollback1()
      const resolved = optimisticObj.resolve()
      expect(resolved.name).toBe(INITIAL_STATE.name)
      expect(resolved.verified).toBe(VERIFY_UPDATE)
      expect(resolved.email).toBe(INITIAL_STATE.email)
      expect(resolved.age).toBe(INITIAL_STATE.age)
    })

    it('provides keys and values from current state', () => {
      optimisticObj.update(UPDATE_PARTIAL)
      const keys = optimisticObj.keys()
      const values = optimisticObj.values()
      expect(keys).toContain('name')
      expect(values).toContain(UPDATE_PARTIAL.name)
      expect(values).toContain(UPDATE_PARTIAL.verified)
    })
  })

  describe('subscription and notification', () => {
    it('notifies subscribers when state changes via update', () => {
      let callCount = 0
      optimisticObj.subscribe(() => {
        callCount++
      })
      optimisticObj.update(UPDATE_PARTIAL)
      expect(callCount).toBe(1)
    })

    it('notifies subscribers on all state-changing operations', () => {
      let callCount = 0
      optimisticObj.subscribe(() => {
        callCount++
      })
      const { commit } = optimisticObj.update(UPDATE_PARTIAL)
      expect(callCount).toBe(1)

      commit()
      expect(callCount).toBe(2)

      const { rollback: rollback2 } = optimisticObj.update({ age: UPDATE_AGE_ROLLBACK })
      rollback2()
      expect(callCount).toBe(4)

      optimisticObj.updateBase({ name: NEW_BASE_NAME })
      expect(callCount).toBe(5)
    })

    it('allows unsubscribing from state changes', () => {
      let callCount = 0
      const unsub = optimisticObj.subscribe(() => {
        callCount++
      })
      optimisticObj.update(UPDATE_PARTIAL)
      expect(callCount).toBe(1)

      unsub()
      optimisticObj.update({ age: UPDATE_AGE_ROLLBACK })
      expect(callCount).toBe(1)
    })

    it('supports multiple independent subscribers', () => {
      let count1 = 0
      let count2 = 0
      optimisticObj.subscribe(() => {
        count1++
      })
      optimisticObj.subscribe(() => {
        count2++
      })
      optimisticObj.update(UPDATE_PARTIAL)
      expect(count1).toBe(1)
      expect(count2).toBe(1)
    })
  })

  describe('cleanup of undefined values', () => {
    it('removes undefined fields when removeUndefined option is enabled', () => {
      const obj = new OptimisticObject(structuredClone(INITIAL_STATE), true)
      obj.update(UPDATE_WITH_UNDEFINED)
      const resolved = obj.resolve()
      expect('email' in resolved).toBe(false)
      expect(resolved.name).toBe(UPDATE_WITH_UNDEFINED.name)
    })

    it('cleans up undefined values in base state updates', () => {
      const obj = new OptimisticObject({ ...INITIAL_STATE }, true)
      obj.updateBase(UPDATE_WITH_UNDEFINED)
      const resolved = obj.resolve()
      expect('email' in resolved).toBe(false)
    })

    it('applies cleanup after commit with override', () => {
      const obj = new OptimisticObject(structuredClone(INITIAL_STATE), true)
      const { commit } = obj.update(UPDATE_WITH_UNDEFINED)
      commit()
      const resolved = obj.resolve()
      expect('email' in resolved).toBe(false)
    })
  })

  describe('async update resolution', () => {
    it('waits for specific update to be committed or rolled back', async () => {
      const { commit, id } = optimisticObj.update(UPDATE_PARTIAL)
      const waitPromise = optimisticObj.waitForUpdateResolve(id)
      commit()
      await expect(waitPromise).resolves.toBeUndefined()
    })

    it('waits for update rollback resolution', async () => {
      const { rollback, id } = optimisticObj.update(UPDATE_PARTIAL)
      const waitPromise = optimisticObj.waitForUpdateResolve(id)
      rollback()
      await expect(waitPromise).resolves.toBeUndefined()
    })

    it('waits for all pending updates to be resolved', async () => {
      const { commit: commit1 } = optimisticObj.update(UPDATE_PARTIAL)
      const { commit: commit2 } = optimisticObj.update({ age: UPDATE_AGE_ROLLBACK })
      const waitPromise = optimisticObj.waitForResolve()
      commit1()
      commit2()
      await expect(waitPromise).resolves.toBeUndefined()
    })

    it('resolves immediately if no pending updates', async () => {
      const waitPromise = optimisticObj.waitForResolve()
      await expect(waitPromise).resolves.toBeUndefined()
    })
  })

  describe('error handling', () => {
    it('returns false when committing non-existent update', () => {
      const success = optimisticObj.commit('non-existent-id')
      expect(success).toBe(false)
      expect(optimisticObj.resolve()).toEqual(INITIAL_STATE)
    })

    it('returns false when rolling back non-existent update', () => {
      const success = optimisticObj.rollback('non-existent-id')
      expect(success).toBe(false)
      expect(optimisticObj.resolve()).toEqual(INITIAL_STATE)
    })
  })
})
