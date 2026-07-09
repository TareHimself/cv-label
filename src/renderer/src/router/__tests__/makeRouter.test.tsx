import { describe, expect, it } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { useState, type FC } from 'react'
import { makeRouter, makeRouterOutlet } from '../makeRouter'

type Routes = {
  home: undefined
  detail: { id: string }
}

const Home: FC = () => {
  const [count, setCount] = useState(0)
  return (
    <div>
      <p>Home screen</p>
      <p data-testid="home-count">{count}</p>
      <button onClick={() => setCount((c) => c + 1)}>Increment</button>
    </div>
  )
}

const Detail: FC<{ id: string }> = ({ id }) => <p>Detail screen: {id}</p>

const setup = () => {
  const router = makeRouter<Routes>('home')
  const RouterOutlet = makeRouterOutlet(router.useRouterStore, { home: Home, detail: Detail })
  return { ...router, RouterOutlet }
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
})
