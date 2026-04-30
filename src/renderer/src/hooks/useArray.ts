import { useRef, useState } from 'react'

const arrayMutators = new Set<string | symbol>([
  'copyWithin',
  'fill',
  'pop',
  'push',
  'reverse',
  'shift',
  'sort',
  'splice',
  'unshift'
])

export interface IProxiedArray<T> extends Array<T> {
  update: () => IProxiedArray<T>
  clear: () => IProxiedArray<T>
  mutate: (mutation: (self: IProxiedArray<T>) => unknown) => IProxiedArray<T>
  replace: (other: Array<T>) => IProxiedArray<T>
  resolve: () => T[]
}
export const useArray = <T = unknown>(iniital?: T[]): IProxiedArray<T> => {
  const dataRef = useRef(iniital ?? [])
  const proxyRef = useRef<IProxiedArray<T>>(undefined)

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_, setCounter] = useState(0)

  const bumpCounter = () => {
    setCounter((value) => value + 1)
  }

  // eslint-disable-next-line react-hooks/refs
  if (!proxyRef.current) {
    // eslint-disable-next-line react-hooks/refs
    proxyRef.current = new Proxy(dataRef.current, {
      get(target, property, r) {
        if (arrayMutators.has(property)) {
          return (...args: unknown[]) => {
            const result = dataRef.current[property](...args)
            bumpCounter()
            return result
          }
        }

        if (property === 'update') {
          return () => {
            bumpCounter()
            return proxyRef.current
          }
        }

        if (property === 'clear') {
          return () => {
            dataRef.current.splice(0, dataRef.current.length)
            return proxyRef.current
          }
        }

        if (property === 'mutate') {
          return (mutation: (self: IProxiedArray<T>) => unknown) => {
            mutation(proxyRef.current!)
            bumpCounter()
            return proxyRef.current
          }
        }

        if (property === 'replace') {
          return (other: Array<T>) => {
            dataRef.current?.splice(0, dataRef.current.length)
            dataRef.current?.push(...other)
            bumpCounter()
            return proxyRef.current
          }
        }

        if (property === 'resolve') {
          return () => dataRef.current
        }

        return Reflect.get(target, property, r)
      },
      set(target, property, value, r) {
        const result = Reflect.set(target, property, value, r)
        bumpCounter()
        return result
      }
    }) as IProxiedArray<T>
  }

  // eslint-disable-next-line react-hooks/refs
  return proxyRef.current
}
