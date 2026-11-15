import { BookOpenText, Compass, Play } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import { ButtonRouterLink } from '../../components/ui/Button'
import { cx } from '../../lib/cx'
import { MascotNote } from '../components/controls'
import { PageHeader } from '../components/PageHeader'
import { SECTIONS, type SectionId } from '../science/engineFacts'
import { SectionClimate, SectionData, SectionProcessing } from '../science/SectionsData'
import { SectionExplanation, SectionRotations, SectionSimulation } from '../science/SectionsModel'
import { SectionLimitations, SectionReferences } from '../science/SectionsTrust'
import { useWorkspace } from '../state/workspace'

// The ten steps of docs/METHODOLOGY.md, each pointing at the section that explains it.
const PIPELINE: { step: string; method: string; file: string; to: SectionId }[] = [
  { step: 'Clean the weather', method: 'Drop 29 February, fill any gaps from the record itself', file: 'climate.py', to: 'processing' },
  { step: 'Reference evapotranspiration', method: 'FAO-56 Penman-Monteith, every day', file: 'et0.py', to: 'simulation' },
  { step: 'Soil-water limits', method: 'Saxton and Rawls (2006), from texture and organic matter', file: 'soil.py', to: 'simulation' },
  { step: 'Daily water balance', method: 'One soil-water bucket: rain and irrigation in, crop use and drainage out', file: 'rotation.py', to: 'simulation' },
  { step: 'Crop curves', method: 'Four-stage crop coefficient, growing roots', file: 'season.py', to: 'simulation' },
  { step: 'Seasonal index', method: 'Water term × temperature factor × legume effect', file: 'season.py', to: 'simulation' },
  { step: 'Hindcast', method: 'Every rotation replayed through 1985–2024', file: 'rotation.py', to: 'rotations' },
  { step: 'Indicators and ranking', method: 'Scaled, weighted 0–5 by the farmer, Pareto mark', file: 'ranking.py', to: 'rotations' },
  { step: 'Climate comparison', method: 'Two 20-year periods, slope and trend test', file: 'trends.py', to: 'climate' },
  { step: 'Explanations', method: 'Fixed templates filled with the numbers', file: 'explain.py', to: 'explanation' },
]

/** Height of the workspace's sticky header, so sticky parts of this page sit just beneath it. */
function useShellHeaderHeight(): number {
  const [h, setH] = useState(112)
  useEffect(() => {
    const header = document.querySelector('header')
    if (!header) return
    const read = () => setH(Math.round(header.getBoundingClientRect().height))
    read()
    const ro = new ResizeObserver(read)
    ro.observe(header)
    return () => ro.disconnect()
  }, [])
  return h
}

export default function SciencePage() {
  const { presets, crops } = useWorkspace()
  const limits = crops.status === 'ready' ? crops.data.limits : null
  const defaultMarket = crops.status === 'ready' ? crops.data.default_market_rating : null

  const headerH = useShellHeaderHeight()
  const bar = useRef<HTMLElement>(null)
  const chips = useRef<HTMLUListElement>(null)
  const [barH, setBarH] = useState(0)
  const [active, setActive] = useState<SectionId>(SECTIONS[0].id)
  // Everything sticky above a section: the shell header, plus this page's section bar on narrow screens.
  const offset = headerH + barH

  useEffect(() => {
    const el = bar.current
    if (!el) return
    const read = () => setBarH(el.offsetHeight)
    read()
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Which section is being read: the last one whose top has passed under the sticky parts.
  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      let current: SectionId = SECTIONS[0].id
      for (const s of SECTIONS) {
        const el = document.getElementById(s.id)
        if (el && el.getBoundingClientRect().top <= offset + 48) current = s.id
      }
      const doc = document.documentElement
      if (window.scrollY > 0 && window.innerHeight + window.scrollY >= doc.scrollHeight - 4) current = SECTIONS[SECTIONS.length - 1].id
      setActive(current)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [offset])

  // Keep the active chip in view inside the narrow-screen bar, without moving the page.
  useEffect(() => {
    const list = chips.current
    const chip = list?.querySelector<HTMLElement>(`[data-chip="${active}"]`)
    if (!list || !chip || !list.clientWidth) return
    list.scrollTo({ left: chip.offsetLeft - (list.clientWidth - chip.offsetWidth) / 2 })
  }, [active])

  const jump = useCallback(
    (id: SectionId, focus = true) => {
      const el = document.getElementById(id)
      if (!el) return
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - offset - 16 })
      if (focus) document.getElementById(`${id}-title`)?.focus({ preventScroll: true })
    },
    [offset],
  )

  const onNav = (e: MouseEvent<HTMLAnchorElement>, id: SectionId) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    e.preventDefault()
    window.history.replaceState(window.history.state, '', `#${id}`)
    jump(id)
  }

  // Arriving with a section in the address (a shared link): go there once the page has laid out.
  const arrived = useRef(false)
  useEffect(() => {
    if (arrived.current) return
    arrived.current = true
    const id = window.location.hash.slice(1)
    if (!SECTIONS.some((s) => s.id === id)) return
    const t = window.setTimeout(() => jump(id as SectionId, false), 80)
    return () => window.clearTimeout(t)
  }, [jump])

  return (
    <div className="space-y-8" style={{ '--sci-offset': `${offset}px` } as CSSProperties}>
      <PageHeader
        eyebrow="Science and methodology"
        title="The science behind better-informed rotation decisions."
        intro="How HindSight turns a public weather record and a farmer’s own knowledge into a comparison of crop rotations: what it reads, what it calculates, and where its limits are. The engine is a deterministic simulation. The same inputs always give the same answer."
        aside={
          <MascotNote mascot="blue" className="max-w-[17rem]">
            Each part names the file it describes, so every statement here can be checked against the code.
          </MascotNote>
        }
      />

      {/* The pipeline at a glance */}
      <section aria-labelledby="pipeline-title" className="on-dark animate-rise rounded-[1.5rem] bg-forest-950 p-5 sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
          <div>
            <p className="text-[0.6875rem] font-extrabold tracking-[0.08em] text-sage uppercase">The analysis pipeline</p>
            <h2 id="pipeline-title" className="mt-1 text-[1.375rem] leading-tight text-cream-50 sm:text-[1.5rem]">
              Ten steps from a weather record to a ranked comparison
            </h2>
          </div>
          <p className="max-w-md text-[0.875rem] leading-snug text-mist">Choose a step to read how it works. There is no machine-learning model and no yield prediction anywhere in the chain.</p>
        </div>
        <ol className="mt-5 grid grid-cols-2 gap-2 xl:grid-cols-5">
          {PIPELINE.map((p, i) => (
            <li key={p.step}>
              <a
                href={`#${p.to}`}
                onClick={(e) => onNav(e, p.to)}
                className="group flex h-full flex-col rounded-2xl bg-white/[0.07] p-3.5 ring-1 ring-white/10 transition-colors hover:bg-white/[0.12] focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-display text-[0.75rem] font-semibold text-lime tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                  <span className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[0.6875rem] font-semibold break-all text-mist">{p.file}</span>
                </span>
                <span className="mt-2 font-display text-[0.9375rem] leading-tight font-semibold [overflow-wrap:anywhere] text-cream-50 sm:text-[1rem] group-hover:underline group-hover:decoration-lime group-hover:underline-offset-4">{p.step}</span>
                <span className="mt-1 hidden text-[0.8125rem] leading-snug text-mist sm:block">{p.method}</span>
              </a>
            </li>
          ))}
        </ol>
      </section>

      {/* Section list: a compact sticky bar on narrow screens */}
      <nav
        ref={bar}
        aria-label="Sections of this page"
        className="sticky z-30 -mx-4 border-b border-forest-950/[0.07] bg-cream/95 px-4 py-2 backdrop-blur-md sm:-mx-6 sm:px-6 lg:hidden print:hidden"
        style={{ top: headerH }}
      >
        <ul ref={chips} className="relative flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {SECTIONS.map((s) => (
            <li key={s.id} className="shrink-0" data-chip={s.id}>
              <a
                href={`#${s.id}`}
                onClick={(e) => onNav(e, s.id)}
                aria-current={active === s.id ? 'location' : undefined}
                className={cx(
                  'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.8125rem] font-extrabold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-forest-950',
                  active === s.id ? 'bg-forest-950 text-cream-50' : 'bg-white text-forest-950 ring-1 ring-border',
                )}
              >
                <span className={cx('font-display tabular-nums', active === s.id ? 'text-lime' : 'text-muted')}>{s.letter}</span>
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="lg:grid lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:gap-10">
        {/* Section list: sticky beside the text on wide screens */}
        <aside className="hidden lg:block print:hidden">
          <nav aria-label="Sections of this page" className="sticky" style={{ top: headerH + 24 }}>
            <p className="text-[0.6875rem] font-extrabold tracking-[0.08em] text-muted uppercase">On this page</p>
            <ol className="mt-3 space-y-0.5 border-l-2 border-sand-300">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    onClick={(e) => onNav(e, s.id)}
                    aria-current={active === s.id ? 'location' : undefined}
                    className={cx(
                      '-ml-0.5 flex gap-2.5 rounded-r-lg border-l-2 py-1.5 pr-2 pl-3 text-[0.875rem] leading-snug transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-950',
                      active === s.id ? 'border-forest-950 bg-white font-extrabold text-forest-950' : 'border-transparent font-semibold text-ink hover:border-sage hover:text-forest-950',
                    )}
                  >
                    <span className={cx('w-3 shrink-0 font-display tabular-nums', active === s.id ? 'text-forest-950' : 'text-muted')}>{s.letter}</span>
                    <span>{s.label}</span>
                  </a>
                </li>
              ))}
            </ol>
            <div className="mt-6 border-t border-border pt-5">
              <ButtonRouterLink to="/app/analysis" icon={<Play />}>
                Run an analysis
              </ButtonRouterLink>
            </div>
          </nav>
        </aside>

        <div className="min-w-0 space-y-14">
          <SectionData limits={limits} />
          <SectionProcessing />
          <SectionClimate />
          <SectionSimulation limits={limits} />
          <SectionRotations limits={limits} defaultMarket={defaultMarket} />
          <SectionExplanation limits={limits} />
          <SectionLimitations crops={crops} />
          <SectionReferences presets={presets} />

          {/* Onward */}
          <section aria-labelledby="next-title" className="on-dark rounded-[1.5rem] bg-forest-950 p-6 sm:p-8">
            <h2 id="next-title" className="text-[1.5rem] leading-tight text-cream-50">
              See the method at work
            </h2>
            <p className="mt-2 max-w-2xl text-[0.9375rem] leading-relaxed text-mist">
              Run the engine on a demonstration farm or your own field, follow the guided tour, or open Field Intelligence to read an analysis chart by chart.
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <ButtonRouterLink to="/app/analysis" variant="accent" icon={<Play />}>
                Run an analysis
              </ButtonRouterLink>
              <ButtonRouterLink to="/app/demo" variant="ghostDark" icon={<Compass />}>
                Take the Guided Tour
              </ButtonRouterLink>
              <ButtonRouterLink to="/app/insights" variant="ghostDark" icon={<BookOpenText />}>
                Open Field Intelligence
              </ButtonRouterLink>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
