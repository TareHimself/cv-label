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

// jsdom has no real layout engine - every element reports an all-zero rect, which is fine
// for most components but breaks anything that sizes itself off real DOM geometry (e.g.
// react-virtuoso's scroll-container measurement, which otherwise computes an empty
// viewport and renders nothing). Give every element a plausible non-zero size.
Element.prototype.getBoundingClientRect = vi.fn(function (this: Element) {
  return {
    width: 1000,
    height: 800,
    top: 0,
    left: 0,
    bottom: 800,
    right: 1000,
    x: 0,
    y: 0,
    toJSON: () => {}
  }
})

// scrollHeight/clientHeight/offsetHeight/clientWidth/offsetWidth are separate,
// hardcoded-to-0 getters in jsdom - they aren't derived from getBoundingClientRect, so
// the stub above doesn't help them. react-virtuoso reads these directly (in addition to
// ResizeObserver) for its own scroll/viewport bookkeeping, so without this it measures a
// zero-height viewport and renders no rows at all.
for (const prop of ['scrollHeight', 'clientHeight', 'offsetHeight'] as const) {
  Object.defineProperty(Element.prototype, prop, { configurable: true, value: 800 })
}
for (const prop of ['clientWidth', 'offsetWidth'] as const) {
  Object.defineProperty(Element.prototype, prop, { configurable: true, value: 1000 })
}
// jsdom also hardcodes offsetParent to null (real layout would return the nearest
// positioned/laid-out ancestor) - react-virtuoso's own measurement callback bails out
// entirely whenever offsetParent is null, on the assumption that means "not laid out
// yet", so without this it never measures anything and renders zero rows.
Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
  configurable: true,
  get(this: HTMLElement) {
    return this.parentElement
  }
})

// jsdom doesn't implement ResizeObserver; Mantine's ScrollArea and the Labeler both use
// it, as does react-virtuoso for the scroll container above. A real ResizeObserver fires
// an initial observation right after observe() is called - this stub does the same (using
// the geometry stubbed above) so consumers that only size themselves off that first
// callback (rather than polling) still get a real, non-zero measurement in tests.
class ResizeObserverStub {
  #callback: ResizeObserverCallback

  constructor(callback: ResizeObserverCallback) {
    this.#callback = callback
  }

  observe = (target: Element) => {
    const rect = target.getBoundingClientRect()
    const entry = {
      target,
      contentRect: rect,
      borderBoxSize: [{ inlineSize: rect.width, blockSize: rect.height }],
      contentBoxSize: [{ inlineSize: rect.width, blockSize: rect.height }],
      devicePixelContentBoxSize: [{ inlineSize: rect.width, blockSize: rect.height }]
    } as unknown as ResizeObserverEntry
    this.#callback([entry], this as unknown as ResizeObserver)
  }

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
