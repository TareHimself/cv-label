import { Activity, type FC, type ReactNode } from 'react'
import { create, type UseBoundStore, type StoreApi } from 'zustand'
import { makeUUID } from '@shared/utils'

/** Maps a screen name to the params it's navigated to with. Use `undefined` for screens that take no params. */
export type RouteParamsMap = Record<string, unknown>

type NavigateArgs<Routes extends RouteParamsMap, K extends keyof Routes> = Routes[K] extends
  | undefined
  | void
  ? [screen: K]
  : [screen: K, params: Routes[K]]

type AnyNavigateArgs<Routes extends RouteParamsMap> = {
  [K in keyof Routes]: NavigateArgs<Routes, K>
}[keyof Routes]

type StackEntry<Routes extends RouteParamsMap> = {
  key: string
  screen: keyof Routes
  params: Routes[keyof Routes]
}

type RouterStoreState<Routes extends RouteParamsMap> = { stack: StackEntry<Routes>[] }

export type RouterStore<Routes extends RouteParamsMap> = UseBoundStore<
  StoreApi<RouterStoreState<Routes>>
>

export type RouterScreens<Routes extends RouteParamsMap> = {
  [K in keyof Routes]: FC<Routes[K] extends undefined ? Record<string, never> : Routes[K]>
}

/**
 * Builds a stack-based navigator's data/actions: screens are pushed on top of each other
 * and stay mounted (see `makeRouterOutlet`) so state like scroll position survives going
 * back, instead of the unmount/remount that a route-swapping router does.
 *
 * Deliberately takes no screen components - only the route/param shape - so modules that
 * just need to call `navigate`/`back` (e.g. a page's data hook) don't have to import every
 * other page's component to get them, which would create a circular dependency between
 * this module and the pages themselves. Pair with `makeRouterOutlet` to render the stack.
 */
export const makeRouter = <Routes extends RouteParamsMap>(...initial: AnyNavigateArgs<Routes>) => {
  const toEntry = (args: AnyNavigateArgs<Routes>): StackEntry<Routes> => {
    const [screen, params] = args
    return { key: makeUUID(), screen, params: params as Routes[keyof Routes] }
  }

  const useRouterStore = create<RouterStoreState<Routes>>(() => ({
    stack: [toEntry(initial)]
  }))

  const navigate = <K extends keyof Routes>(...args: NavigateArgs<Routes, K>): void => {
    useRouterStore.setState((s) => ({
      stack: [...s.stack, toEntry(args as AnyNavigateArgs<Routes>)]
    }))
  }

  const back = (): void => {
    useRouterStore.setState((s) => (s.stack.length <= 1 ? s : { stack: s.stack.slice(0, -1) }))
  }

  return { navigate, back, useRouterStore }
}

/**
 * Builds the `<RouterOutlet>` component that actually renders a router's stack, given its
 * screen components. Kept separate from `makeRouter` so the store/navigate/back can live in
 * a module with no page imports (see `makeRouter`'s doc comment) while this piece - which
 * necessarily imports every page component - stays isolated to wherever the app root
 * assembles them (e.g. `App.tsx`), rather than being reachable from the pages themselves.
 */
export const makeRouterOutlet = <Routes extends RouteParamsMap>(
  useRouterStore: RouterStore<Routes>,
  screens: RouterScreens<Routes>
) => {
  return function RouterOutlet(): ReactNode {
    const stack = useRouterStore((s) => s.stack)
    const topKey = stack[stack.length - 1]?.key

    return stack.map((entry) => {
      const Screen = screens[entry.screen] as FC<Record<string, unknown>>
      return (
        <Activity
          key={entry.key}
          name={String(entry.screen)}
          mode={entry.key === topKey ? 'visible' : 'hidden'}
        >
          <Screen {...(entry.params ?? {})} />
        </Activity>
      )
    })
  }
}
