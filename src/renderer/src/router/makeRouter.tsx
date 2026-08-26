import {
  Activity,
  createContext,
  useContext,
  useEffect,
  useEffectEvent,
  type FC,
  type ReactNode
} from 'react'
import { create, type UseBoundStore, type StoreApi } from 'zustand'
import { makeUUID } from '@shared/utils'

/** Maps a screen name to the params it's navigated to with. Use `undefined` for screens that take no params. */
export type RouteParamsMap = Record<string, unknown>

type NavigateArgs<Routes extends RouteParamsMap, K extends keyof Routes> = Routes[K] extends
  undefined | void
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

/** Identifies which stack entry a screen (and anything it renders) belongs to, so the
 *  lifecycle hooks below can look up their own entry's visibility. Provided by
 *  `makeRouterOutlet` around each `<Activity>`'s children. */
type RouteContextValue = { key: string }

export type RouterHandle<Routes extends RouteParamsMap> = {
  navigate: <K extends keyof Routes>(...args: NavigateArgs<Routes, K>) => void
  back: () => void
  useRouterStore: RouterStore<Routes>
  /** True iff this screen's stack entry is currently the top (visible) one. */
  useIsRouteVisible: () => boolean
  /** Runs `callback` when this screen becomes visible: on first mount, and again every
   *  time its `<Activity>` subtree goes from hidden back to visible (Activity remounts
   *  effects on that transition, so a plain mount effect already doubles as this). */
  useOnRouteEnter: (callback: () => void) => void
  /** Runs `callback` when this screen stops being visible: hidden by a `navigate()` past
   *  it, or fully removed by `back()` (Activity tears down effects in both cases, so a
   *  plain effect cleanup already doubles as this). */
  useOnRouteLeave: (callback: () => void) => void
  RouteContext: React.Context<RouteContextValue | null>
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
export const makeRouter = <Routes extends RouteParamsMap>(
  ...initial: AnyNavigateArgs<Routes>
): RouterHandle<Routes> => {
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

  const RouteContext = createContext<RouteContextValue | null>(null)

  const useOwnRouteKey = (): string => {
    const ctx = useContext(RouteContext)
    if (ctx === null) {
      throw new Error(
        'Router lifecycle hooks (useIsRouteVisible/useOnRouteEnter/useOnRouteLeave) must be ' +
          "used within a screen rendered by this router's RouterOutlet."
      )
    }
    return ctx.key
  }

  const useIsRouteVisible = (): boolean => {
    const key = useOwnRouteKey()
    return useRouterStore((s) => s.stack[s.stack.length - 1]?.key === key)
  }

  const useOnRouteEnter = (callback: () => void): void => {
    useOwnRouteKey()
    const onEnter = useEffectEvent(callback)
    useEffect(() => {
      onEnter()
    }, [])
  }

  const useOnRouteLeave = (callback: () => void): void => {
    useOwnRouteKey()
    const onLeave = useEffectEvent(callback)
    useEffect(() => {
      return () => onLeave()
    }, [])
  }

  return {
    navigate,
    back,
    useRouterStore,
    useIsRouteVisible,
    useOnRouteEnter,
    useOnRouteLeave,
    RouteContext
  }
}

/**
 * Builds the `<RouterOutlet>` component that actually renders a router's stack, given its
 * screen components. Kept separate from `makeRouter` so the store/navigate/back can live in
 * a module with no page imports (see `makeRouter`'s doc comment) while this piece - which
 * necessarily imports every page component - stays isolated to wherever the app root
 * assembles them (e.g. `App.tsx`), rather than being reachable from the pages themselves.
 */
export const makeRouterOutlet = <Routes extends RouteParamsMap>(
  router: RouterHandle<Routes>,
  screens: RouterScreens<Routes>
) => {
  const { useRouterStore, RouteContext } = router

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
          <RouteContext.Provider value={{ key: entry.key }}>
            <Screen {...(entry.params ?? {})} />
          </RouteContext.Provider>
        </Activity>
      )
    })
  }
}
