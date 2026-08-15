import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// vitest doesn't run in "globals" mode here, so RTL's auto-cleanup detection
// (which looks for a global afterEach) doesn't kick in on its own.
afterEach(() => {
  cleanup()
})

// jsdom doesn't implement matchMedia; Mantine's color-scheme handling needs it.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }))
})

// jsdom doesn't implement ResizeObserver; Mantine's ScrollArea and the Labeler both use it.
class ResizeObserverStub {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub)

// jsdom doesn't implement scrollIntoView; Mantine's Combobox (Select, Autocomplete, etc.)
// calls it when navigating options, which otherwise throws from an internal timeout well
// after the triggering test has already finished.
Element.prototype.scrollIntoView = vi.fn()

// jsdom doesn't implement OffscreenCanvas; useLabeler's store creates one unconditionally
// on init (for hit-testing) even in tests that never render a canvas.
class OffscreenCanvasStub {
  width: number
  height: number
  constructor(width: number, height: number) {
    this.width = width
    this.height = height
  }
  getContext() {
    return null
  }
}
vi.stubGlobal('OffscreenCanvas', OffscreenCanvasStub)
