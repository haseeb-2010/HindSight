import { Compass, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '../components/ui/Button'
import { Reveal } from '../components/ui/Reveal'
import { SectionHeading } from '../components/ui/SectionHeading'
import { usePrefersReducedMotion } from '../hooks/useMotion'
import type { Resource } from '../hooks/useResource'
import { api, errorMessage } from '../lib/api'
import type { PresetsResponse } from '../lib/types'
import { AnalysisPreview } from './demo/AnalysisPreview'
import { FarmCard } from './demo/FarmCard'
import type { AnalysisState } from './demo/types'

interface DemoFarmsProps {
  presets: Resource<PresetsResponse>
  onRetryPresets: () => void
}

export function DemoFarms({ presets, onRetryPresets }: DemoFarmsProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const [analyses, setAnalyses] = useState<Record<string, AnalysisState>>({})
  const inflight = useRef<Record<string, AbortController>>({})
  const panelRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    const running = inflight.current
    return () => Object.values(running).forEach((c) => c.abort())
  }, [])

  const run = useCallback((id: string) => {
    inflight.current[id]?.abort()
    const ctrl = new AbortController()
    inflight.current[id] = ctrl
    setAnalyses((a) => ({ ...a, [id]: { status: 'loading', startedAt: Date.now() } }))
    api
      .analyzePreset(id, ctrl.signal)
      .then((env) => {
        if (!ctrl.signal.aborted) setAnalyses((a) => ({ ...a, [id]: { status: 'ready', env } }))
      })
      .catch((err: unknown) => {
        if (!ctrl.signal.aborted) setAnalyses((a) => ({ ...a, [id]: { status: 'error', error: errorMessage(err) } }))
      })
      .finally(() => {
        if (inflight.current[id] === ctrl) delete inflight.current[id]
      })
  }, [])

  const reveal = useCallback(() => {
    window.setTimeout(() => {
      panelRef.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
      headingRef.current?.focus({ preventScroll: true })
    }, 60)
  }, [reduced])

  const explore = (id: string) => {
    setSelected(id)
    const st = analyses[id]
    if (!st || st.status === 'error') run(id)
    reveal()
  }

  const close = () => {
    const id = selected
    setSelected(null)
    if (id) document.getElementById(`explore-btn-${id}`)?.focus({ preventScroll: true })
  }

  const list = presets.data?.presets ?? []
  const active = list.find((p) => p.id === selected)
  const activeState = selected ? analyses[selected] : undefined

  return (
    <section id="explore" aria-labelledby="explore-title" className="relative py-20 sm:py-28">
      <div className="container-page">
        <SectionHeading
          id="explore-title"
          eyebrow="Demonstration farms"
          title="Explore what HindSight can reveal."
          description="Start with one of our demonstration locations and explore how different crop rotations compare under historical local conditions."
        />
        <Reveal delay={220} className="mt-6 flex justify-center">
          <p className="inline-flex items-center gap-2.5 rounded-2xl bg-sand px-4 py-2.5 text-[0.8125rem] leading-snug font-bold text-ink sm:rounded-full sm:py-2">
            <Compass className="h-4 w-4 shrink-0 text-forest-800" aria-hidden="true" />
            Analysis for your own field location arrives with the full workspace. Each farm below runs the real engine.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {presets.status === 'loading' &&
            [0, 1, 2].map((i) => (
              <div key={i} aria-hidden="true" className="rounded-[1.75rem] bg-white p-2.5 ring-1 ring-border">
                <div className="skeleton h-44 rounded-[1.25rem]" />
                <div className="space-y-3 p-3 pt-5">
                  <div className="skeleton h-7 w-1/2" />
                  <div className="skeleton h-4 w-2/3" />
                  <div className="skeleton h-16 w-full" />
                  <div className="skeleton h-11 w-full rounded-full" />
                </div>
              </div>
            ))}
          {presets.status === 'error' && (
            <div role="alert" className="col-span-full flex flex-col items-center gap-4 rounded-[1.75rem] bg-white p-10 text-center ring-1 ring-border">
              <p className="max-w-md text-[0.9375rem] font-semibold text-ink">The demonstration farms could not be loaded. {presets.error}</p>
              <Button icon={<RefreshCw />} onClick={onRetryPresets}>
                Try again
              </Button>
            </div>
          )}
          {list.map((p, i) => (
            <FarmCard key={p.id} preset={p} index={i} selected={selected === p.id} state={analyses[p.id]} onExplore={() => explore(p.id)} />
          ))}
        </div>

        <div ref={panelRef} id="analysis-preview" data-anchor>
          {active && activeState && (
            <div key={active.id} className="animate-rise mt-6">
              <AnalysisPreview preset={active} state={activeState} onRetry={() => run(active.id)} onClose={close} headingRef={headingRef} />
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
