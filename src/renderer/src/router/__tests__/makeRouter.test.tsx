import { describe, expect, it, vi } from 'vitest'
import { act, render, fireEvent, screen } from '@testing-library/react'
import { useState, type FC } from 'react'
import { makeRouter, makeRouterOutlet } from '../makeRouter'

type Routes = {
  home: undefined
  detail: { id: string }
}

const setup = () => {
  const router = makeRouter<Routes>('home')
  const onHomeEnter = vi.fn()
  const onHomeLeave = vi.fn()

  const Home: FC = () => {
    const [count, setCount] = useState(0)
    const visible = router.useIsRouteVisible()
    router.useOnRouteEnter(onHomeEnter)
    router.useOnRouteLeave(onHomeLeave)
    return (
      <div>
        <p>Home screen</p>
        <p data-testid="home-count">{count}</p>
        <p data-testid="home-visible">{String(visible)}</p>
        <button onClick={() => setCount((c) => c + 1)}>Increment</button>
      </div>
    )
  }

  const Detail: FC<{ id: string }> = ({ id }) => <p>Detail screen: {id}</p>

  const RouterOutlet = makeRouterOutlet(router, { home: Home, detail: Detail })
  return { ...router, RouterOutlet, onHomeEnter, onHomeLeave }
}

describe('makeRouter', () => {
  it('renders the seeded initial screen', () => {
    const { RouterOutlet } = setup()
    render(<RouterOutlet />)

    expect(screen.getByText('Home screen')).toBeInTheDocument()
  })

  it('navigate() pushes a new screen without unmounting the previous one', () => {
    const { navigate, RouterOutlet } = setup()
    render(<RouterOutlet />)

    fireEvent.click(screen.getByText('Increment'))
    expect(screen.getByTestId('home-count')).toHaveTextContent('1')

    act(() => navigate('detail', { id: 'abc' }))

    expect(screen.getByText('Detail screen: abc')).toBeInTheDocument()
    // Home is still mounted (state preserved) - just no longer visible.
    expect(screen.getByTestId('home-count')).toHaveTextContent('1')
  })

  it('navigate() to a param-less screen can be called with no params', () => {
    const { navigate, useRouterStore } = setup()
    act(() => navigate('home'))

    expect(useRouterStore.getState().stack).toHaveLength(2)
    expect(useRouterStore.getState().stack[1].screen).toBe('home')
  })

  it('back() reveals the previous screen with its state intact and unmounts the popped one', () => {
    const { navigate, back, RouterOutlet } = setup()
    render(<RouterOutlet />)

    fireEvent.click(screen.getByText('Increment'))
    act(() => navigate('detail', { id: 'abc' }))
    act(() => back())

    expect(screen.getByText('Home screen')).toBeInTheDocument()
    expect(screen.getByTestId('home-count')).toHaveTextContent('1')
    expect(screen.queryByText('Detail screen: abc')).not.toBeInTheDocument()
  })

  it('back() is a no-op once only the initial screen is left', () => {
    const { back, useRouterStore, RouterOutlet } = setup()
    render(<RouterOutlet />)

    act(() => back())

    expect(useRouterStore.getState().stack).toHaveLength(1)
    expect(screen.getByText('Home screen')).toBeInTheDocument()
  })

  it('navigating to the same screen twice pushes two independent stack entries', () => {
    const { navigate, useRouterStore } = setup()

    act(() => navigate('detail', { id: 'a' }))
    act(() => navigate('detail', { id: 'b' }))

    const { stack } = useRouterStore.getState()
    expect(stack).toHaveLength(3)
    expect(stack[1].key).not.toBe(stack[2].key)
  })

  it('re-navigating to a screen after going back creates a fresh instance (no stale state)', () => {
    const { navigate, back, RouterOutlet } = setup()
    render(<RouterOutlet />)

    act(() => navigate('detail', { id: 'first' }))
    act(() => back())
    act(() => navigate('detail', { id: 'second' }))

    expect(screen.getByText('Detail screen: second')).toBeInTheDocument()
    expect(screen.queryByText('Detail screen: first')).not.toBeInTheDocument()
  })

  it('useIsRouteVisible reflects whether this screen is the top of the stack', () => {
    const { navigate, back, RouterOutlet } = setup()
    render(<RouterOutlet />)

    expect(screen.getByTestId('home-visible')).toHaveTextContent('true')

    act(() => navigate('detail', { id: 'abc' }))
    expect(screen.getByTestId('home-visible')).toHaveTextContent('false')

    act(() => back())
    expect(screen.getByTestId('home-visible')).toHaveTextContent('true')
  })

  it('useOnRouteEnter fires on mount and again when the screen becomes visible again', () => {
    const { navigate, back, RouterOutlet, onHomeEnter } = setup()
    render(<RouterOutlet />)
    expect(onHomeEnter).toHaveBeenCalledTimes(1)

    act(() => navigate('detail', { id: 'abc' }))
    expect(onHomeEnter).toHaveBeenCalledTimes(1)

    act(() => back())
    expect(onHomeEnter).toHaveBeenCalledTimes(2)
  })

  it('useOnRouteLeave fires whenever the screen stops being visible, whether hidden or fully removed', () => {
    const { navigate, back, RouterOutlet, onHomeLeave } = setup()
    render(<RouterOutlet />)
    expect(onHomeLeave).not.toHaveBeenCalled()

    // Hidden by a screen pushed on top - still mounted, just not visible.
    act(() => navigate('detail', { id: 'a' }))
    expect(onHomeLeave).toHaveBeenCalledTimes(1)

    // Becoming visible again shouldn't fire another leave.
    act(() => back())
    expect(onHomeLeave).toHaveBeenCalledTimes(1)

    // Hidden again by a fresh "home" instance pushed on top.
    act(() => navigate('home'))
    expect(onHomeLeave).toHaveBeenCalledTimes(2)

    // That fresh instance is fully removed by back() - also fires leave.
    act(() => back())
    expect(onHomeLeave).toHaveBeenCalledTimes(3)
  })

  it('throws when a lifecycle hook is used outside a routed screen', () => {
    const router = makeRouter<Routes>('home')
    const Rogue: FC = () => {
      router.useIsRouteVisible()
      return null
    }
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<Rogue />)).toThrow(/must be used within a screen/)

    consoleError.mockRestore()
  })
})
