import { describe, it, expect } from 'vitest'
import { ColorGenerator } from '../color_generator'

describe('ColorGenerator', () => {
  it('should always generate new colors', () => {
    const generator = new ColorGenerator()
    const generated = new Set<string>()
    for (let i = 0; i < 2000; i++) {
      generated.add(generator.make())
    }
    expect(generated.size).toBe(2000)
  })
  it('should re-use colors after they are freed', () => {
    const generator = new ColorGenerator()
    const generated = new Set<string>()
    for (let i = 0; i < 2000; i++) {
      generated.add(generator.make())
    }
    for (const color of generated) {
      generator.free(color)
    }

    for (let i = 0; i < 2000; i++) {
      expect(generated.has(generator.make())).toBe(true)
    }
  })
})
