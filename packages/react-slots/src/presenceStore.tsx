import React, { useEffect, useLayoutEffect, useRef, type FunctionComponent } from "react"

const SPAN_STYLE = { display: "contents" } as const

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" && typeof window.document !== "undefined" ? useLayoutEffect : useEffect

type Identified = { id: string }

const createPresenceStore = (getItems: () => readonly Identified[], subscribeItems: (l: () => void) => () => void) => {
  const reports = new Map<string, Map<Element, boolean>>()
  const listeners = new Set<() => void>()

  let scheduled = false

  const renders = (id: string): boolean => {
    const byElement = reports.get(id)

    if (byElement === undefined) return false
    for (const rendered of byElement.values()) if (rendered) return true

    return false
  }

  const flush = () => {
    scheduled = false
    listeners.forEach((listener) => listener())
  }

  const bump = () => {
    if (scheduled) return
    scheduled = true
    queueMicrotask(flush)
  }

  const report = (id: string, element: Element, rendered: boolean) => {
    let byElement = reports.get(id)

    if (byElement === undefined) reports.set(id, (byElement = new Map()))
    if (byElement.get(element) === rendered) return

    byElement.set(element, rendered)
    bump()
  }

  const remove = (id: string, element: Element) => {
    const byElement = reports.get(id)

    if (byElement === undefined || !byElement.delete(element)) return
    if (byElement.size === 0) reports.delete(id)

    bump()
  }

  const subscribe = (listener: () => void) => {
    listeners.add(listener)

    return () => {
      listeners.delete(listener)
    }
  }

  const unsubscribeItems = subscribeItems(bump)

  const dispose = () => unsubscribeItems()

  return { renders, getItems, report, remove, subscribe, dispose }
}

type PresenceStore = ReturnType<typeof createPresenceStore>

const probe = (presence: PresenceStore, id: string, Component: FunctionComponent<object>): FunctionComponent<object> =>
  function Probed(props) {
    const ref = useRef<HTMLSpanElement>(null)

    useIsomorphicLayoutEffect(() => {
      const element = ref.current!
      const reportNow = () => presence.report(id, element, element.childNodes.length > 0)

      reportNow()

      const observer = new MutationObserver(reportNow)
      observer.observe(element, { childList: true, subtree: true })

      return () => {
        observer.disconnect()
        presence.remove(id, element)
      }
    }, [])

    return (
      <span style={SPAN_STYLE} ref={ref}>
        <Component {...props} />
      </span>
    )
  }

export { createPresenceStore, probe }
export type { PresenceStore }
