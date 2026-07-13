import { describe, expect, it } from 'vitest'
import { imageExtensionFromUri } from '../imageExtensionFromUri'

describe('imageExtensionFromUri', () => {
  it('returns the extension after the last dot', () => {
    expect(imageExtensionFromUri('cv-label-image://s1.png')).toBe('png')
    expect(imageExtensionFromUri('cv-label-image://s1.jpeg')).toBe('jpeg')
  })

  it('uses the last dot when the uri has more than one', () => {
    expect(imageExtensionFromUri('cv-label-image://my.photo.jpg')).toBe('jpg')
  })

  it('falls back to "bin" when there is no extension', () => {
    expect(imageExtensionFromUri('cv-label-image://s1')).toBe('bin')
  })
})
