import React, { memo, useState, type ComponentType, type ReactNode } from "react"
import { flushSync } from "react-dom"
import { createRoot, type Root } from "react-dom/client"
import { afterAll, afterEach, describe, expect, it } from "vitest"
import { commands, server } from "vitest/browser"
import { createSlot, type Slot } from "../createSlot"

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

globalThis.IS_REACT_ACT_ENVIRONMENT = false

type ChurnProps = { tick: number; kind: "pass" | "drop" }

type ChurnSlot = Slot<ChurnProps>

type RunStats = { medianMs: number; spreadPct: number }

type BenchResult = {
  id: string
  label: string
  n: number
  rendersPerSweep: number
  runMediansMs: [number, number]
  medianMs: number
  spreadPct: number
  perRenderUs: number
  perChildUs: number
  convergencePct: number
}

type FpsResult = {
  id: string
  label: string
  frames: number
  medianMs: number
  p95Ms: number
  maxMs: number
  approxFps: number
  deltasMs: number[]
}

const TARGET_SWEEP_MS = 50
const WARMUP_SWEEPS = 3
const MEASURED_SWEEPS = 11
const N = 1000
const FRAMES = 120

const CHILDREN = Array.from({ length: N }, (_, i) => `item-${i}`)

const Leaf = ({ label }: { label: string }) => <li>{label}</li>
const MemoLeaf = memo(Leaf)

const startedAt = new Date().toISOString()
const results: BenchResult[] = []
const fpsResults: FpsResult[] = []

let mounted: { root: Root; container: HTMLElement }[] = []

const mountSync = (element: ReactNode) => {
  const container = document.createElement("div")

  document.body.appendChild(container)

  const root = createRoot(container)

  flushSync(() => root.render(element as React.ReactElement))
  mounted.push({ root, container })

  return container
}

const unmountAll = () => {
  for (const { root, container } of mounted) {
    root.unmount()
    container.remove()
  }

  mounted = []
}

const assertRendered = (container: HTMLElement, expected: number) => {
  const count = container.querySelectorAll("li").length

  if (count !== expected) throw new Error(`expected ${expected} mounted children, got ${count}`)
}

const round = (value: number, digits: number) => {
  const factor = 10 ** digits

  return Math.round(value * factor) / factor
}

const trimmedStats = (sweeps: number[]): RunStats => {
  const sorted = [...sweeps].sort((a, b) => a - b)
  const trimmed = sorted.slice(1, sorted.length - 1)
  const medianMs = trimmed[Math.floor(trimmed.length / 2)]!
  const spreadPct = ((trimmed[trimmed.length - 1]! - trimmed[0]!) / medianMs) * 100

  return { medianMs, spreadPct }
}

const calibrate = (drive: () => void) => {
  let renders = 0
  const start = performance.now()

  while (performance.now() - start < TARGET_SWEEP_MS) {
    drive()
    renders++
  }

  return renders
}

const measureRun = (drive: () => void, renders: number): RunStats => {
  for (let warm = 0; warm < WARMUP_SWEEPS; warm++) {
    for (let i = 0; i < renders; i++) drive()
  }

  const sweeps: number[] = []

  for (let sweep = 0; sweep < MEASURED_SWEEPS; sweep++) {
    const start = performance.now()

    for (let i = 0; i < renders; i++) drive()

    sweeps.push(performance.now() - start)
  }

  return trimmedStats(sweeps)
}

const bench = (id: string, label: string, n: number, setup: () => () => void): BenchResult => {
  const driveA = setup()

  calibrate(driveA)

  const renders = calibrate(driveA)
  const runA = measureRun(driveA, renders)

  unmountAll()

  const driveB = setup()
  const runB = measureRun(driveB, renders)

  unmountAll()

  const medianMs = (runA.medianMs + runB.medianMs) / 2
  const perRenderUs = (medianMs * 1000) / renders
  const result: BenchResult = {
    id,
    label,
    n,
    rendersPerSweep: renders,
    runMediansMs: [round(runA.medianMs, 3), round(runB.medianMs, 3)],
    medianMs: round(medianMs, 3),
    spreadPct: round(Math.max(runA.spreadPct, runB.spreadPct), 1),
    perRenderUs: round(perRenderUs, 3),
    perChildUs: round(perRenderUs / n, 4),
    convergencePct: round((Math.abs(runA.medianMs - runB.medianMs) / Math.min(runA.medianMs, runB.medianMs)) * 100, 1),
  }

  results.push(result)

  return result
}

const directSetup = (Component: ComponentType<{ label: string }>) => () => {
  let drive!: (next: number) => void
  const Host = () => {
    const [, set] = useState(0)

    drive = set

    return (
      <ul>
        {CHILDREN.map((label) => (
          <Component key={label} label={label} />
        ))}
      </ul>
    )
  }

  const container = mountSync(<Host />)

  assertRendered(container, N)

  let tick = 0

  return () => flushSync(() => drive(++tick))
}

const mountChurnSlot = (SlotRoot: ChurnSlot["Root"], kind: ChurnProps["kind"], expected: number) => {
  let drive!: (next: ChurnProps) => void
  const Host = () => {
    const [props, set] = useState<ChurnProps>({ tick: 0, kind: "pass" })

    drive = set

    return (
      <ul>
        <SlotRoot tick={props.tick} kind={props.kind} />
      </ul>
    )
  }

  const container = mountSync(<Host />)

  assertRendered(container, expected)

  let tick = 0

  return () => flushSync(() => drive({ tick: ++tick, kind }))
}

const mountStableRootHost = (SlotRoot: ChurnSlot["Root"], expected: number) => {
  let drive!: (next: number) => void
  const Host = () => {
    const [, set] = useState(0)

    drive = set

    return (
      <ul>
        <SlotRoot tick={0} kind="pass" />
      </ul>
    )
  }

  const container = mountSync(<Host />)

  assertRendered(container, expected)

  let tick = 0

  return () => flushSync(() => drive(++tick))
}

const insertStatic = (insert: ChurnSlot["api"]["insert"]) => {
  CHILDREN.forEach((label, i) => insert({ Component: () => <li>{label}</li>, order: i }))
}

const insertMappedStable = (insert: ChurnSlot["api"]["insert"], n: number) => {
  for (let i = 0; i < n; i++) {
    const label = `item-${i}`

    insert<{ label: string }>({ Component: Leaf, mapProps: () => ({ label }), order: i })
  }
}

const insertFilteredStable = (insert: ChurnSlot["api"]["insert"]) => {
  CHILDREN.forEach((label, i) =>
    insert<{ label: string }>({
      Component: Leaf,
      filter: (p) => p.kind === "pass",
      mapProps: () => ({ label }),
      order: i,
    }),
  )
}

const insertMappedFlow = (insert: ChurnSlot["api"]["insert"], withFilter: boolean, n: number) => {
  for (let i = 0; i < n; i++) {
    const label = `item-${i}`

    if (withFilter) {
      insert<{ label: string }>({
        Component: Leaf,
        filter: (p) => p.kind === "pass",
        mapProps: (p) => ({ label: `${label}:${p.tick}` }),
        order: i,
      })
    } else {
      insert<{ label: string }>({ Component: Leaf, mapProps: (p) => ({ label: `${label}:${p.tick}` }), order: i })
    }
  }
}

const rootBailSetup = (n: number) => () => {
  const slot = createSlot<ChurnProps>()

  insertMappedStable(slot.api.insert, n)

  return mountStableRootHost(slot.Root, n)
}

const mappedChurnSetup = (presence: boolean, n: number) => () => {
  const slot = presence ? createSlot<ChurnProps>({ presence: true }) : createSlot<ChurnProps>()

  insertMappedFlow(slot.api.insert, false, n)

  return mountChurnSlot(slot.Root, "pass", n)
}

const fpsScenario = async (id: string, label: string, churn: boolean, presence = false): Promise<FpsResult> => {
  const slot = presence ? createSlot<ChurnProps>({ presence: true }) : createSlot<ChurnProps>()

  insertMappedFlow(slot.api.insert, false, N)

  let bump: () => void = () => {}
  const Host = () => {
    const [tick, setTick] = useState(0)

    bump = () => setTick((t) => t + 1)

    return (
      <ul>
        <slot.Root tick={tick} kind="pass" />
      </ul>
    )
  }

  const container = mountSync(<Host />)

  assertRendered(container, N)

  const deltas: number[] = []

  await new Promise<void>((resolve) => {
    let frames = 0
    let last = 0

    const loop = () => {
      const now = performance.now()

      deltas.push(now - last)
      last = now

      if (churn) bump()

      frames++

      if (frames >= FRAMES) {
        resolve()

        return
      }

      requestAnimationFrame(loop)
    }

    requestAnimationFrame(() => {
      last = performance.now()
      requestAnimationFrame(loop)
    })
  })

  unmountAll()

  const sorted = [...deltas].sort((a, b) => a - b)
  const medianMs = sorted[Math.floor(sorted.length / 2)]!
  const p95Ms = sorted[Math.floor(sorted.length * 0.95)]!
  const maxMs = sorted[sorted.length - 1]!
  const result: FpsResult = {
    id,
    label,
    frames: deltas.length,
    medianMs: round(medianMs, 3),
    p95Ms: round(p95Ms, 3),
    maxMs: round(maxMs, 3),
    approxFps: round(1000 / medianMs, 1),
    deltasMs: deltas.map((d) => round(d, 2)),
  }

  fpsResults.push(result)

  return result
}

afterEach(unmountAll)

afterAll(async () => {
  const find = (id: string) => results.find((r) => r.id === id)
  const perChildRatio = (a: BenchResult | undefined, b: BenchResult | undefined) =>
    a && b ? round(a.perChildUs / b.perChildUs, 2) : null
  const s8 = find("S8")
  const s8b = find("S8b")
  const s8c = find("S8c")

  const payload = {
    engine: server.browser,
    userAgent: navigator.userAgent,
    startedAt,
    finishedAt: new Date().toISOString(),
    methodology: {
      targetSweepMs: TARGET_SWEEP_MS,
      warmupSweeps: WARMUP_SWEEPS,
      measuredSweeps: MEASURED_SWEEPS,
      trim: "drop best and worst sweep, median + spread over the rest",
      runsPerScenario: 2,
    },
    ratios: {
      staticVsMemoBaseline: perChildRatio(find("S1"), find("S0b")),
      mappedVsMemoBaseline: perChildRatio(find("S2"), find("S0b")),
      freezeVsMapped: perChildRatio(find("S5"), find("S2")),
      filterTaxOnPass: perChildRatio(find("S6"), find("S6b")),
      presenceTax: perChildRatio(find("P1"), find("P2")),
      presenceTaxSmall: perChildRatio(find("P1b"), find("P2b")),
      presenceTaxStable: perChildRatio(find("P3"), find("S2")),
      rootBailScaling: s8 && s8b ? round(s8b.perRenderUs / s8.perRenderUs, 2) : null,
      rootBailBallast: s8 && s8c ? round(s8c.perRenderUs / s8.perRenderUs, 2) : null,
    },
    scenarios: results,
    fps: fpsResults,
  }

  await commands.writeFile(`bench-results.${server.browser}.json`, JSON.stringify(payload, null, 2))
})

describe("microsecond sweeps", () => {
  it("S0 direct children, no memo, same-value host churn", () => {
    const r = bench("S0", "direct, no memo, same-value churn", N, directSetup(Leaf))

    expect(r.medianMs).toBeGreaterThan(0)
  })

  it("S0b direct children, React.memo, same-value host churn", () => {
    const r = bench("S0b", "direct, React.memo, same-value churn", N, directSetup(MemoLeaf))

    expect(r.medianMs).toBeGreaterThan(0)
  })

  it("S1 static slot children under Root props churn", () => {
    const r = bench("S1", "slot static, no mapProps", N, () => {
      const slot = createSlot<ChurnProps>()

      insertStatic(slot.api.insert)

      return mountChurnSlot(slot.Root, "pass", N)
    })

    expect(r.medianMs).toBeGreaterThan(0)
  })

  it("S2 mapped slot children with stable mapped values", () => {
    const r = bench("S2", "slot mapped, stable mapped values", N, () => {
      const slot = createSlot<ChurnProps>()

      insertMappedStable(slot.api.insert, N)

      return mountChurnSlot(slot.Root, "pass", N)
    })

    expect(r.medianMs).toBeGreaterThan(0)
  })

  it("S5 filtered slot children frozen by rejecting filter", () => {
    const r = bench("S5", "slot filtered, freeze on reject", N, () => {
      const slot = createSlot<ChurnProps>()

      insertFilteredStable(slot.api.insert)

      return mountChurnSlot(slot.Root, "drop", N)
    })

    expect(r.medianMs).toBeGreaterThan(0)
  })

  it("S6 full flow through passing filter and mapProps", () => {
    const r = bench("S6", "slot full flow, filter passes", N, () => {
      const slot = createSlot<ChurnProps>()

      insertMappedFlow(slot.api.insert, true, N)

      return mountChurnSlot(slot.Root, "pass", N)
    })

    expect(r.medianMs).toBeGreaterThan(0)
  })

  it("S6b full flow through mapProps without filter", () => {
    const r = bench("S6b", "slot full flow, no filter", N, () => {
      const slot = createSlot<ChurnProps>()

      insertMappedFlow(slot.api.insert, false, N)

      return mountChurnSlot(slot.Root, "pass", N)
    })

    expect(r.medianMs).toBeGreaterThan(0)
  })

  it("S8 host churn with stable Root props over 200 children", () => {
    const r = bench("S8", "Root bail, 200 children", 200, rootBailSetup(200))

    expect(r.medianMs).toBeGreaterThan(0)
  })

  it("S8b host churn with stable Root props over 1000 children", () => {
    const r = bench("S8b", "Root bail, 1000 children", 1000, rootBailSetup(1000))

    expect(r.medianMs).toBeGreaterThan(0)
  })

  it("S8c host churn with stable Root props over 200 children plus 1000 inert ballast children", () => {
    const r = bench("S8c", "Root bail, 200 children + 1000 inert ballast", 200, () => {
      const ballast = createSlot<ChurnProps>()

      insertMappedStable(ballast.api.insert, 1000)
      mountStableRootHost(ballast.Root, 1000)

      return rootBailSetup(200)()
    })

    expect(r.medianMs).toBeGreaterThan(0)
  })

  it("P2 mapped full-flow churn without presence", () => {
    const r = bench("P2", "mapped full flow, presence off", N, mappedChurnSetup(false, N))

    expect(r.medianMs).toBeGreaterThan(0)
  })

  it("P1 mapped full-flow churn with presence", () => {
    const r = bench("P1", "mapped full flow, presence on", N, mappedChurnSetup(true, N))

    expect(r.medianMs).toBeGreaterThan(0)
  })

  it("P2b mapped full-flow churn without presence over 200 children", () => {
    const r = bench("P2b", "mapped full flow, presence off, 200 children", 200, mappedChurnSetup(false, 200))

    expect(r.medianMs).toBeGreaterThan(0)
  })

  it("P1b mapped full-flow churn with presence over 200 children", () => {
    const r = bench("P1b", "mapped full flow, presence on, 200 children", 200, mappedChurnSetup(true, 200))

    expect(r.medianMs).toBeGreaterThan(0)
  })

  it("P3 mapped stable values churn with presence", () => {
    const r = bench("P3", "slot mapped stable values, presence on", N, () => {
      const slot = createSlot<ChurnProps>({ presence: true })

      insertMappedStable(slot.api.insert, N)

      return mountChurnSlot(slot.Root, "pass", N)
    })

    expect(r.medianMs).toBeGreaterThan(0)
  })
})

describe("fps report", () => {
  it("rAF loop with per-frame full-flow churn over 1000 mapped children", async () => {
    const r = await fpsScenario("FPS-churn", "rAF churn, 1000 mapped children", true)

    expect(r.frames).toBe(FRAMES)
    expect(r.p95Ms).toBeLessThan(Math.max(2 * r.medianMs, 20))
  })

  it("rAF loop without churn over the same mounted tree", async () => {
    const r = await fpsScenario("FPS-idle", "rAF idle, 1000 mapped children", false)

    expect(r.frames).toBe(FRAMES)
    expect(r.p95Ms).toBeLessThan(Math.max(2 * r.medianMs, 20))
  })

  it("rAF loop with per-frame full-flow churn over 1000 mapped children with presence", async () => {
    const r = await fpsScenario("FPS-churn-presence", "rAF churn, 1000 mapped children, presence", true, true)

    expect(r.frames).toBe(FRAMES)
    expect(r.p95Ms).toBeLessThan(Math.max(2 * r.medianMs, 20))
  })
})
