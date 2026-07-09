import { describe, expect, it } from 'vitest'
import { useRouterStore } from '../appRouter'

describe('appRouter', () => {
  it('seeds the stack with the projects screen and nothing else', () => {
    expect(useRouterStore.getState().stack).toEqual([
      expect.objectContaining({ screen: 'projects', params: undefined })
    ])
  })
})
