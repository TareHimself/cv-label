import { describe, expect, it, afterEach } from 'vitest'
import { arrayBufferToBase64 } from '../utils'

describe('arrayBufferToBase64', () => {
  afterEach(() => {
    delete Uint8Array.prototype.toBase64
  })

  it('uses the native Uint8Array.prototype.toBase64 when the runtime has it', () => {
    Uint8Array.prototype.toBase64 = function () {
      return 'native-result'
    }
    const bytes = new Uint8Array([0x4d, 0x61, 0x6e]) // "Man"

    expect(arrayBufferToBase64(bytes.buffer)).toBe('native-result')
  })

  it('encodes an empty buffer', () => {
    expect(arrayBufferToBase64(new ArrayBuffer(0))).toBe('')
  })

  it('encodes a buffer whose length is a multiple of 3', () => {
    const bytes = new Uint8Array([0x4d, 0x61, 0x6e]) // "Man"
    expect(arrayBufferToBase64(bytes.buffer)).toBe('TWFu')
  })

  it('pads a buffer with a remainder of 1 byte', () => {
    const bytes = new Uint8Array([0x4d]) // "M"
    expect(arrayBufferToBase64(bytes.buffer)).toBe('TQ==')
  })

  it('pads a buffer with a remainder of 2 bytes', () => {
    const bytes = new Uint8Array([0x4d, 0x61]) // "Ma"
    expect(arrayBufferToBase64(bytes.buffer)).toBe('TWE=')
  })

  it('matches btoa on a larger buffer', () => {
    const bytes = new Uint8Array(4096).map((_, i) => i % 256)
    const expected = btoa(String.fromCharCode(...bytes))
    expect(arrayBufferToBase64(bytes.buffer)).toBe(expected)
  })
})
