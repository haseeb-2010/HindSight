import { ArrowDown, ArrowUp, ArrowUpDown, CircleMinus, CirclePlus, Equal, Gauge, History, Sprout, Trophy, type LucideIcon } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { InfoTip } from '../../components/ui/InfoTip'
import { useElementWidth } from '../../hooks/useElementWidth'
import { failureThreshold, isIrrigated, rotationLabel } from '../../lib/analysis'
import { cx } from '../../lib/cx'
import { fmtCoord, isNum } from '../../lib/format'
import type { AnalysisEnvelope, Rotation } from '../../lib/types'
import { isScenarioActive } from '../lib/config'
import {
  METRIC_BY_ID,
  fmtMetric,
  fmtMetricDelta,
  joinList,
  rotationKey,
  runChanges,
  summariseRuns,
  tradeoffs,
  type MetricDef,
  type RunChange,
  type RunInput,
  type RunSummary,
  type Tradeoff,
} from '../lib/insights'
import { PRIORITIES, PRIORITY_ORDER, textureLabel, waterLabel } from '../lib/labels'
import { priorityList } from '../lib/priorityTemplates'
import { scenarioSummary } from '../lib/scenarios'
import { Chip, Panel, TIP } from '../results/shared'
import { RankBump, RankingList } from '../scenarios/RankBump'
import { Callout, Segmented } from './controls'
import { ScenarioDisclaimer } from './ScenarioDisclaimer'
import { SourceBadge } from './SourceBadge'

export interface RunComparisonProps {
  /** Two or more finished engine runs, in display order. */
  runs: RunInput[]
  /** The run the others are compared against. Defaults to the first. */
  baselineId?: string
  /**
   * What differs between the runs, for the wording:
   * 'scenario' = what-if scenarios of one field, 'priorities' = weight sets for one field,
   * 'analysis' = saved analyses that may be of different fields.
   */
  kind: 'scenario' | 'priorities' | 'analysis'
  /** Crop id → display name. */
  names: Record<string, string>
}

type Kind = RunComparisonProps['kind']

const WORDS: Record<Kind, { title: string; changed: string; caveat: string }> = {
  scenario: {
    title: 'Scenario comparison',
    changed: 'What changed between these scenarios?',
    caveat:
      'Each statement compares two runs of the same model on the same historical record, one of them adjusted. A rank or index under an adjusted record shows how the simulation responded to that adjustment. It does not show that any rotation is certain to withstand future conditions.',
  },
  priorities: {
    title: 'Priority comparison',
    changed: 'What changed with these weights?',
    caveat:
      'The weights decide how the indicators are added into a score, and which alternatives the engine lists. A rank is relative to the rotations and weights of its own run. It is not a probability of success.',
  },
  analysis: {
    title: 'Analysis comparison',
    changed: 'How these analyses differ',
    caveat: 'A rank says how a rotation scored against the other rotations in the same analysis, under that analysis’s own settings. It is not a probability of success.',
  },
}

/** The five headline indicators of a run, in the order of METRICS. */
const HEADLINE = ['median', 'p10', 'failure', 'water', 'irrigation'].map((id) => METRIC_BY_ID[id]).filter((m): m is MetricDef => !!m)

type Subject = 'current' | 'top'

/** Lets a chip break onto a second line in a narrow column instead of spilling into the next one. */
const WRAP_CHIPS = '[&>span]:rounded-2xl [&>span]:leading-tight [&>span]:whitespace-normal'

/** Keeps an info button on the same line as the last word of its label. */
const NBSP = '\u00a0'

const scenarioOf = (env: AnalysisEnvelope) => ({ temp_delta_c: env.request?.scenario?.temp_delta_c ?? 0, precip_factor: env.request?.scenario?.precip_factor ?? 1 })

const sameRotation = (a: Rotation | undefined, b: Rotation | undefined) => !!a && !!b && ((a.is_current && b.is_current) || (!a.is_current && !b.is_current && rotationKey(a) === rotationKey(b)))

const samePoint = (a: AnalysisEnvelope, b: AnalysisEnvelope) => Math.abs(a.result.site.lat - b.result.site.lat) < 1e-4 && Math.abs(a.result.site.lon - b.result.site.lon) < 1e-4

/** Ranks are lined up only when every run is of the same point and the same current rotation. */
function sameField(runs: RunSummary[]): boolean {
  const first = runs[0]
  if (!first?.current) return false
  const key = rotationKey(first.current)
  return runs.every((r) => !!r.current && rotationKey(r.current) === key && samePoint(r.envelope, first.envelope))
}

function tipFor(m: MetricDef, env: AnalysisEnvelope): string {
  const base =
    m.id === 'median' ? `${TIP.median} ${TIP.index}` : m.id === 'p10' ? TIP.p10 : m.id === 'failure' ? TIP.failure(failureThreshold(env)) : m.id === 'water' ? TIP.water : m.id === 'irrigation' ? TIP.irrigation : ''
  return `${base} ${m.context}`.trim()
}

function sublabelFor(run: RunSummary, kind: Kind): string | undefined {
  if (run.sublabel) return run.sublabel
  const env = run.envelope
  if (kind === 'scenario') return env.request?.scenario ? scenarioSummary(scenarioOf(env)) : undefined
  if (kind === 'priorities') return priorityList(env.request?.priorities, PRIORITIES) || undefined
  return `${fmtCoord(env.result.site.lat, env.result.site.lon)} · ${waterLabel(env.request?.water?.mode, env.request?.water?.seasonal_cap_mm)}`
}

/** For what-if scenarios: every run except an unadjusted one is a hypothetical adjustment, and is labelled as such. */
function isHypothetical(run: RunSummary, isBase: boolean): boolean {
  const scenario = run.envelope.request?.scenario
  return isBase ? isScenarioActive(scenario) : !scenario || isScenarioActive(scenario)
}

interface SettingDiff {
  dim: 'field' | 'scenario' | 'priorities' | 'other'
  label: string
  base: string
  other: string
}

/** Settings that differ between two runs, read from the requests the engine ran with and the sites it reports. */
function settingDiffs(a: RunSummary, b: RunSummary, names: Record<string, string>): SettingDiff[] {
  const out: SettingDiff[] = []
  const add = (dim: SettingDiff['dim'], label: string, x: string, y: string) => {
    if (x !== y) out.push({ dim, label, base: x, other: y })
  }
  const ea = a.envelope
  const eb = b.envelope
  const place = (e: AnalysisEnvelope) => `${e.result.site.name} (${fmtCoord(e.result.site.lat, e.result.site.lon)})`
  if (!samePoint(ea, eb)) add('field', 'Field', place(ea), place(eb))
  if (a.current && b.current && rotationKey(a.current) !== rotationKey(b.current)) add('field', 'Current rotation', rotationLabel(a.current), rotationLabel(b.current))
  const sa = ea.result.site.soil_used?.texture_class
  const sb = eb.result.site.soil_used?.texture_class
  if (sa && sb) add('other', 'Soil texture', textureLabel(sa), textureLabel(sb))
  const ra = ea.request
  const rb = eb.request
  if (ra && rb) {
    add('other', 'Water', waterLabel(ra.water?.mode, ra.water?.seasonal_cap_mm), waterLabel(rb.water?.mode, rb.water?.seasonal_cap_mm))
    const da = ra.soil?.depth_cm
    const db = rb.soil?.depth_cm
    if (isNum(da) && isNum(db)) add('other', 'Soil depth', `${da} cm`, `${db} cm`)
    add('scenario', 'Weather adjustment', scenarioSummary(scenarioOf(ea)), scenarioSummary(scenarioOf(eb)))
    for (const k of PRIORITY_ORDER) {
      const wa = ra.priorities?.[k]
      const wb = rb.priorities?.[k]
      if (isNum(wa) && isNum(wb)) add('priorities', `${PRIORITIES[k].label} weight`, String(wa), String(wb))
    }
    const oa = ra.options ?? {}
    const ob = rb.options ?? {}
    const onOff = (v: boolean) => (v ? 'applied' : 'switched off')
    if (isNum(oa.failure_threshold) && isNum(ob.failure_threshold)) add('other', 'Failure line', oa.failure_threshold.toFixed(2), ob.failure_threshold.toFixed(2))
    if (typeof oa.apply_legume_effect === 'boolean' && typeof ob.apply_legume_effect === 'boolean') add('other', 'Legume effect', onOff(oa.apply_legume_effect), onOff(ob.apply_legume_effect))
    if (isNum(oa.top_n) && isNum(ob.top_n)) add('other', 'Alternatives requested', String(oa.top_n), String(ob.top_n))
    const ca = ra.constraints
    const cb = rb.constraints
    const ya = ca?.max_cycle_years
    const yb = cb?.max_cycle_years
    if (isNum(ya) && isNum(yb)) add('other', 'Longest rotation considered', `${ya} years`, `${yb} years`)
    const left = (list: string[] | undefined) => (list?.length ? [...list].sort().map((id) => names[id] ?? id).join(', ') : 'none')
    if (ca && cb) add('other', 'Crops left out', left(ca.excluded_crops), left(cb.excluded_crops))
  }
  const span = (e: AnalysisEnvelope) => `${e.result.meta.record.start_year}–${e.result.meta.record.end_year}`
  add('other', 'Historical period', span(ea), span(eb))
  return out
}

/** One sentence for the top of the dashboard, only when the ranks of the runs can be lined up. */
function headline(runs: RunSummary[], baseIndex: number): string | null {
  const base = runs[baseIndex]
  if (runs.length < 2 || !base?.top) return null
  const others = runs.filter((_, i) => i !== baseIndex)
  const changed = others.filter((r) => !sameRotation(r.top, base.top))
  if (changed.length === 0) return `${rotationLabel(base.top)} is the highest-ranked rotation in all ${runs.length} runs.`
  if (changed.length === others.length && others.length === 1 && changed[0].top) {
    return `The highest-ranked rotation changes from ${rotationLabel(base.top)} to ${rotationLabel(changed[0].top)} under “${changed[0].label}”.`
  }
  return `The highest-ranked rotation is different from the baseline in ${changed.length} of the ${others.length} other runs: ${joinList(changed.map((r) => `“${r.label}”`))}.`
}

function RunHead({ run, kind, isBase, single, detail, tight }: { run: RunSummary; kind: Kind; isBase: boolean; single: boolean; detail: boolean; tight?: boolean }) {
  const sub = sublabelFor(run, kind)
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-1.5">
        {isBase && !single && <Chip tone="forest">Baseline</Chip>}
        {kind === 'scenario' &&
          (isHypothetical(run, isBase) ? (
            tight ? (
              // narrow columns: the same words, free to wrap
              <span className="inline-flex items-start gap-1 text-[0.6875rem] leading-tight font-extrabold tracking-[0.04em] text-signal-ink uppercase">
                <History className="mt-px h-3 w-3 shrink-0" aria-hidden="true" /> Hypothetical adjustment
              </span>
            ) : (
              <Chip tone="signal">
                <History className="h-3 w-3" aria-hidden="true" /> Hypothetical adjustment
              </Chip>
            )
          ) : (
            <Chip tone="white">Historical record</Chip>
          ))}
      </div>
      <p className="mt-2 font-display text-[1.0625rem] leading-snug font-semibold text-forest-950">{run.label}</p>
      {sub && <p className="mt-0.5 text-[0.8125rem] leading-snug font-semibold text-ink">{sub}</p>}
      <div className={cx('mt-2', WRAP_CHIPS)}>
        <SourceBadge env={run.envelope} detail={detail} />
      </div>
    </div>
  )
}

function TopCell({ run, base, compare, names }: { run: RunSummary; base: RunSummary; compare: boolean; names: Record<string, string> }) {
  const top = run.top
  if (!top) return <span className="text-muted">Not available</span>
  const same = sameRotation(top, base.top)
  return (
    <div className="min-w-0">
      <p className="leading-snug font-extrabold text-forest-950">{rotationLabel(top)}</p>
      <p className="mt-1 text-[0.75rem] leading-snug font-semibold text-ink">
        {top.cycle_years}-year cycle: {top.slots.map((s) => names[s.crop_id] ?? s.crop_id).join(', ')}
      </p>
      <div className={cx('mt-1.5 flex flex-wrap gap-1.5', WRAP_CHIPS)}>
        {top.is_current && <Chip tone="peri">Your current rotation</Chip>}
        {compare && run !== base && (same ? <Chip>Same as baseline</Chip> : <Chip tone="lime">Different from baseline</Chip>)}
      </div>
    </div>
  )
}

function RankCell({ run, base, compare }: { run: RunSummary; base: RunSummary; compare: boolean }) {
  const rank = run.current?.scores?.rank
  if (!isNum(rank)) return <span className="text-muted">Not available</span>
  const b = base.current?.scores?.rank
  const moved = compare && run !== base && isNum(b) ? b - rank : null
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
      <span className="font-display text-[1.25rem] leading-none font-semibold text-forest-950 tabular-nums">
        #{rank} <span className="font-sans text-[0.75rem] font-bold text-ink">of {run.count}</span>
      </span>
      {moved !== null && (
        <span className="inline-flex items-center gap-1 rounded-full bg-sand px-2 py-0.5 text-[0.75rem] leading-tight font-extrabold whitespace-nowrap text-ink">
          {moved === 0 ? (
            <>
              <Equal className="h-3 w-3" aria-hidden="true" /> Same rank
            </>
          ) : (
            <>
              {moved > 0 ? <ArrowUp className="h-3 w-3" aria-hidden="true" /> : <ArrowDown className="h-3 w-3" aria-hidden="true" />}
              {moved > 0 ? 'Up' : 'Down'} {Math.abs(moved)} {Math.abs(moved) === 1 ? 'place' : 'places'}
            </>
          )}
        </span>
      )}
    </div>
  )
}

function DeltaPill({ t, flagged }: { t: Tradeoff; flagged: boolean }) {
  if (t.verdict === 'unknown' || !isNum(t.delta)) return null
  const Icon = t.verdict === 'similar' ? Equal : t.delta > 0 ? ArrowUp : ArrowDown
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.75rem] leading-tight font-extrabold whitespace-nowrap tabular-nums',
        t.verdict === 'favourable' && 'bg-lime-100 text-forest-950 ring-1 ring-forest-950/10',
        t.verdict === 'unfavourable' && 'bg-signal-50 text-signal-ink ring-1 ring-signal/30',
        t.verdict === 'similar' && 'bg-sand text-ink',
      )}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {t.verdict === 'similar' ? 'About the same' : fmtMetricDelta(t.metric, t.delta)}
      {flagged && <span aria-hidden="true">†</span>}
      <span className="sr-only">
        {' '}
        compared with the baseline{t.verdict === 'favourable' ? ', the favourable direction' : t.verdict === 'unfavourable' ? ', the unfavourable direction' : ''}
        {flagged ? ', comparing two different rotations' : ''}
      </span>
    </span>
  )
}

/** One indicator of one run: the engine value and, when the runs can be lined up, its difference from the baseline run. */
function MetricCell({ m, run, rot, t, flagged, align = 'left' }: { m: MetricDef; run: RunSummary; rot: Rotation | undefined; t: Tradeoff | undefined; flagged: boolean; align?: 'left' | 'right' }) {
  if (!rot) return <span className="text-muted">Not available</span>
  const rainfed = m.id === 'irrigation' && !isIrrigated(run.envelope)
  const v = m.get(rot)
  return (
    <div className={cx('flex flex-col gap-1', align === 'right' ? 'items-end text-right' : 'items-start')}>
      <span className="font-display text-[1.0625rem] leading-none font-semibold text-forest-950 tabular-nums">
        {rainfed ? <span className="font-sans text-[0.875rem] font-bold text-ink">None (rainfed)</span> : isNum(v) ? fmtMetric(m, v) : <span className="font-sans text-[0.875rem] font-bold text-muted">Not available</span>}
        {!rainfed && isNum(v) && m.unit === 'mm' && <span className="font-sans text-[0.75rem] font-bold text-ink"> / yr</span>}
      </span>
      {t && !rainfed && <DeltaPill t={t} flagged={flagged} />}
    </div>
  )
}

const CHANGE_ICON: Record<RunChange['kind'], LucideIcon> = {
  top: Trophy,
  current_rank: Sprout,
  moved: ArrowUpDown,
  entered: CirclePlus,
  left: CircleMinus,
  metric: Gauge,
  none: Equal,
}

function Facts({ title, items }: { title: string; items: RunChange[] }) {
  if (items.length === 0) return null
  return (
    <div>
      <h4 className="font-sans text-[0.75rem] font-extrabold tracking-[0.06em] text-muted uppercase">{title}</h4>
      <ul className="mt-2 space-y-2">
        {items.map((c, i) => {
          const Icon = CHANGE_ICON[c.kind]
          return (
            <li key={i} className="flex gap-2.5 text-[0.9375rem] leading-snug text-ink">
              <span className="mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sand text-forest-800">
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <span className="min-w-0">{c.text}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Settings({ title, items }: { title: string; items: SettingDiff[] }) {
  if (items.length === 0) return null
  return (
    <div>
      <h4 className="font-sans text-[0.75rem] font-extrabold tracking-[0.06em] text-muted uppercase">{title}</h4>
      <dl className="mt-2 space-y-1.5 text-[0.875rem] leading-snug">
        {items.map((d) => (
          <div key={d.label} className="flex flex-wrap gap-x-2">
            <dt className="font-bold text-forest-950">{d.label}:</dt>
            <dd className="min-w-0 text-ink">
              <span className="font-extrabold text-forest-950">{d.other}</span> <span className="text-muted">(baseline: {d.base})</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/**
 * Side-by-side reading of several finished engine runs: what each run ranks highest, where the current
 * rotation stands, its headline indicators against a baseline run, how ranks move, and what changed.
 * Everything shown is read from the envelopes in `runs`; nothing is recomputed.
 */
export default function RunComparison({ runs, baselineId, kind, names }: RunComparisonProps) {
  const { runs: all, rows } = useMemo(() => summariseRuns(runs), [runs])
  const [subject, setSubject] = useState<Subject>('current')
  const [wrap, width] = useElementWidth<HTMLDivElement>(960)

  if (all.length === 0) {
    return <p className="rounded-[1.5rem] bg-white p-5 text-[0.9375rem] font-semibold text-ink shadow-hairline ring-1 ring-border sm:p-6">There are no finished runs to compare yet.</p>
  }

  const words = WORDS[kind]
  const baseIndex = Math.max(0, all.findIndex((r) => r.id === baselineId))
  const base = all[baseIndex]
  const single = all.length === 1
  const comparable = kind !== 'analysis' || sameField(all)
  const compare = comparable && !single
  const others = all.map((run, index) => ({ run, index })).filter((x) => x.index !== baseIndex)
  const site = base.envelope.result.site
  const record = base.envelope.result.meta.record
  const lead = comparable ? headline(all, baseIndex) : null
  const wide = width >= 760
  const rotOf = (run: RunSummary) => (subject === 'current' ? run.current : run.top)
  const baseRot = rotOf(base)
  const deltas = (run: RunSummary): Record<string, Tradeoff> => {
    const rot = rotOf(run)
    return compare && run !== base && rot && baseRot ? Object.fromEntries(tradeoffs(rot, baseRot).map((t) => [t.metric.id, t])) : {}
  }
  // a difference between two different rotations is marked, so it is not read as one rotation changing
  const flagged = (run: RunSummary) => subject === 'top' && run !== base && !sameRotation(run.top, base.top)
  const anyFlagged = compare && all.some(flagged)
  // the "about the same" margins, read from the indicator definitions (one per unit)
  const margins = [...new Map(HEADLINE.map((m) => [m.unit, m.unit === 'percent' ? `${(m.similar * 100).toFixed(0)} percentage points` : m.unit === 'mm' ? `${m.similar} mm` : `${m.similar.toFixed(2)} index points`])).values()]
  const similarText = margins.length > 1 ? `${margins.slice(0, -1).join(', ')} or ${margins[margins.length - 1]}` : margins.join('')
  const subjectTitle =
    subject === 'current'
      ? comparable && base.current
        ? `Your current rotation: ${rotationLabel(base.current)}`
        : 'The current rotation of each analysis'
      : 'The highest-ranked rotation of each run'
  const showField = kind === 'analysis' && !comparable

  return (
    <section className="space-y-5" aria-label={words.title} data-run-comparison={kind}>
      <header>
        <h2 className="text-[1.625rem] leading-tight tracking-[-0.02em]">{words.title}</h2>
        <p className="mt-1 max-w-3xl text-[0.9375rem] leading-relaxed text-muted">
          {single
            ? `One run of ${site.name}. Add another run to see what changes.`
            : comparable
              ? `${all.length} runs of ${site.name} (${fmtCoord(site.lat, site.lon)}), each a full replay of ${record.start_year}–${record.end_year}. Differences are measured from “${base.label}”.`
              : `${all.length} analyses side by side. They are not of the same field and current rotation, so each keeps its own ranking.`}
        </p>
      </header>

      {kind === 'scenario' && <ScenarioDisclaimer />}

      {!comparable && (
        <Callout tone="info" title="Ranks are only comparable within one analysis">
          These analyses do not share the same field and current rotation. A rank says how a rotation scored against the other rotations in the same analysis, so ranks and indicator values are shown
          side by side without measuring one analysis against another.
        </Callout>
      )}

      {lead && (
        <p className="animate-fade flex items-start gap-3 rounded-[1.5rem] bg-forest-950 px-5 py-4 font-display text-[1.125rem] leading-snug font-semibold text-cream-50 sm:px-6">
          <Trophy className="mt-0.5 h-5 w-5 shrink-0 text-lime" aria-hidden="true" />
          <span>{lead}</span>
        </p>
      )}

      <Panel
        title="Each run at a glance"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[0.8125rem] font-bold text-muted">Indicators for</span>
            <Segmented
              label="Which rotation the indicators describe"
              size="sm"
              value={subject}
              onChange={setSubject}
              options={[
                { value: 'current', label: 'Current rotation' },
                { value: 'top', label: 'Highest-ranked rotation' },
              ]}
            />
          </div>
        }
      >
        <div ref={wrap}>
          {wide ? (
            <div className="-mx-1 overflow-x-auto px-1">
              {/* fixed layout: the label column keeps its width and the runs share the rest equally */}
              <table className="w-full table-fixed border-separate border-spacing-0 text-[0.875rem]" style={{ minWidth: `${14 + all.length * 11.5}rem` }}>
                <colgroup>
                  <col className="w-56" />
                  {all.map((run) => (
                    <col key={run.id} />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col" className="sticky left-0 z-10 w-56 bg-white pr-3 pb-3 text-left align-bottom text-[0.75rem] font-extrabold tracking-[0.04em] text-ink uppercase">
                      Run
                    </th>
                    {all.map((run, i) => (
                      <th key={run.id} scope="col" className={cx('px-3 pt-3 pb-3 text-left align-top font-normal', i === baseIndex && !single && 'rounded-t-2xl bg-sand/60')}>
                        <RunHead run={run} kind={kind} isBase={i === baseIndex} single={single} detail={all.length <= 3} tight={all.length >= 5} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {showField && (
                    <>
                      <tr>
                        <RowHead label="Field" />
                        {all.map((run, i) => (
                          <Cell key={run.id} base={i === baseIndex && !single}>
                            <span className="font-bold text-forest-950">{run.envelope.result.site.name}</span>
                            <span className="block text-[0.75rem] font-semibold text-ink tabular-nums">{fmtCoord(run.envelope.result.site.lat, run.envelope.result.site.lon)}</span>
                          </Cell>
                        ))}
                      </tr>
                      <tr>
                        <RowHead label="Current rotation" />
                        {all.map((run, i) => (
                          <Cell key={run.id} base={i === baseIndex && !single}>
                            <span className="font-bold text-forest-950">{run.current ? rotationLabel(run.current) : 'Not available'}</span>
                          </Cell>
                        ))}
                      </tr>
                    </>
                  )}
                  <tr>
                    <RowHead label="Highest-ranked rotation" tip={TIP.rank} />
                    {all.map((run, i) => (
                      <Cell key={run.id} base={i === baseIndex && !single}>
                        <TopCell run={run} base={base} compare={compare} names={names} />
                      </Cell>
                    ))}
                  </tr>
                  <tr>
                    <RowHead label="Current rotation’s rank" tip={TIP.rank} />
                    {all.map((run, i) => (
                      <Cell key={run.id} base={i === baseIndex && !single}>
                        <RankCell run={run} base={base} compare={compare} />
                      </Cell>
                    ))}
                  </tr>
                </tbody>
                <tbody>
                  <tr>
                    <th scope="rowgroup" colSpan={all.length + 1} className="border-t border-border pt-4 pb-1.5 text-left">
                      <span className="sticky left-0 inline-block text-[0.75rem] font-extrabold tracking-[0.06em] text-muted uppercase">{subjectTitle}</span>
                    </th>
                  </tr>
                  {HEADLINE.map((m) => (
                    <tr key={m.id}>
                      <RowHead label={m.label} tip={tipFor(m, base.envelope)} note={m.favoured === 'higher' ? 'Higher is favourable' : 'Lower is favourable'} />
                      {all.map((run, i) => (
                        <Cell key={run.id} base={i === baseIndex && !single}>
                          <MetricCell m={m} run={run} rot={rotOf(run)} t={deltas(run)[m.id]} flagged={flagged(run)} />
                        </Cell>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <ul className={cx('grid gap-3', width >= 560 && 'grid-cols-2')}>
              {all.map((run, i) => {
                const d = deltas(run)
                const rot = rotOf(run)
                return (
                  <li key={run.id} className={cx('rounded-2xl p-4 ring-1', i === baseIndex && !single ? 'bg-sand/50 ring-border-strong' : 'bg-white ring-border')}>
                    <RunHead run={run} kind={kind} isBase={i === baseIndex} single={single} detail />
                    <dl className="mt-3.5 space-y-3 border-t border-border pt-3.5 text-[0.875rem]">
                      {showField && (
                        <div>
                          <dt className="text-[0.75rem] font-bold text-ink">Current rotation</dt>
                          <dd className="mt-1 font-bold text-forest-950">{run.current ? rotationLabel(run.current) : 'Not available'}</dd>
                        </div>
                      )}
                      <div>
                        <dt className="text-[0.75rem] font-bold text-ink">Highest-ranked rotation</dt>
                        <dd className="mt-1">
                          <TopCell run={run} base={base} compare={compare} names={names} />
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[0.75rem] font-bold text-ink">Current rotation’s rank</dt>
                        <dd className="mt-1">
                          <RankCell run={run} base={base} compare={compare} />
                        </dd>
                      </div>
                    </dl>
                    <p className="mt-4 text-[0.6875rem] leading-snug font-extrabold tracking-[0.06em] text-muted uppercase">
                      {subject === 'current' ? 'Current rotation' : 'Highest-ranked rotation'}
                      {rot ? `: ${rotationLabel(rot)}` : ''}
                    </p>
                    <dl className="mt-1 divide-y divide-border text-[0.875rem]">
                      {HEADLINE.map((m) => (
                        <div key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                          <dt className="flex min-w-0 items-center gap-1 leading-snug font-bold text-ink">
                            {m.short}
                            <InfoTip label={m.label}>{tipFor(m, run.envelope)}</InfoTip>
                          </dt>
                          <dd className="shrink-0">
                            <MetricCell m={m} run={run} rot={rot} t={d[m.id]} flagged={flagged(run)} align="right" />
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        <div className="mt-4 space-y-1 border-t border-border pt-3.5 text-[0.8125rem] leading-snug text-muted">
          {compare && (
            <p>
              Each difference is measured from “{base.label}”. An arrow shows its direction. A green tint marks the direction the ranking favours for that indicator and an orange tint the opposite; it
              is not a verdict on the rotation. “About the same” means a difference smaller than {similarText}.
            </p>
          )}
          {anyFlagged && <p>† A different rotation is highest-ranked in this run than in the baseline, so this difference compares two different rotations.</p>}
          <p>Index values are historical simulated seasonal indices, not crop yield. Water demand and irrigation are modelled amounts per year, not measured farm water use.</p>
        </div>
      </Panel>

      {compare ? (
        <Panel title="How the ranking changes between runs">
          <RankBump runs={all} rows={rows} baseIndex={baseIndex} />
        </Panel>
      ) : (
        <Panel title={single ? 'Ranking in this run' : 'Ranking within each analysis'}>
          <div className={cx('grid gap-x-6 gap-y-5', !single && 'md:grid-cols-2', all.length > 2 && 'xl:grid-cols-3')}>
            {all.map((run) => (
              <RankingList key={run.id} run={run} heading={single ? undefined : run.label} />
            ))}
          </div>
          <p className="mt-4 border-t border-border pt-3.5 text-[0.8125rem] leading-snug text-muted">
            {single
              ? 'With one run there is nothing to connect: this is its ranking. A rank is relative to the rotations in this run, not a probability of success.'
              : 'No lines are drawn between these lists, because a rank only has meaning among the rotations of the same analysis.'}
          </p>
        </Panel>
      )}

      {!single && (
        <Panel title={words.changed}>
          <div className={cx('grid gap-4', others.length > 1 && 'lg:grid-cols-2', others.length > 2 && 'xl:grid-cols-3')}>
            {others.map(({ run, index }) => {
              const diffs = settingDiffs(base, run, names)
              const shown = kind === 'scenario' ? diffs.filter((d) => d.dim !== 'scenario') : diffs
              const facts = comparable ? runChanges(base, run, rows, baseIndex, index) : []
              const ranking = facts.filter((c) => c.kind !== 'metric')
              const metrics = facts.filter((c) => c.kind === 'metric')
              const sub = sublabelFor(run, kind)
              return (
                <article key={run.id} className="rounded-2xl bg-cream-50 p-4 ring-1 ring-border sm:p-5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {kind === 'scenario' && isHypothetical(run, false) && (
                      <Chip tone="signal">
                        <History className="h-3 w-3" aria-hidden="true" /> Hypothetical adjustment
                      </Chip>
                    )}
                    <Chip>Compared with “{base.label}”</Chip>
                  </div>
                  <h4 className="mt-2 text-[1.125rem] leading-snug">{run.label}</h4>
                  {sub && <p className="mt-0.5 text-[0.8125rem] font-semibold text-ink">{sub}</p>}
                  <div className="mt-4 space-y-4">
                    <Settings title={kind === 'scenario' ? 'Settings that also differ from the baseline' : 'Settings that differ from the baseline'} items={shown} />
                    {comparable ? (
                      <>
                        <Facts title="Ranking" items={ranking} />
                        <Facts title="Your current rotation’s indicators" items={metrics} />
                      </>
                    ) : (
                      <ul className="space-y-2 text-[0.9375rem] leading-snug text-ink">
                        {run.top && (
                          <li>
                            In this analysis the highest-ranked rotation is <span className="font-extrabold text-forest-950">{rotationLabel(run.top)}</span>, of {run.count} compared.
                          </li>
                        )}
                        {run.current && isNum(run.current.scores?.rank) && (
                          <li>
                            Its current rotation, {rotationLabel(run.current)}, is ranked #{run.current.scores?.rank} of {run.count} within this analysis.
                          </li>
                        )}
                      </ul>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
          <p className="mt-4 border-t border-border pt-3.5 text-[0.8125rem] leading-snug text-muted">{words.caveat}</p>
        </Panel>
      )}
    </section>
  )
}

function RowHead({ label, tip, note }: { label: string; tip?: string; note?: string }) {
  return (
    <th scope="row" className="sticky left-0 z-10 border-t border-border bg-white py-3 pr-3 text-left align-top font-bold text-ink">
      <span className="leading-snug">
        {label}
        {tip && (
          <>
            {NBSP}
            <InfoTip label={label}>{tip}</InfoTip>
          </>
        )}
      </span>
      {note && <span className="mt-0.5 block text-[0.75rem] font-semibold text-muted">{note}</span>}
    </th>
  )
}

function Cell({ base, children }: { base: boolean; children: ReactNode }) {
  return <td className={cx('border-t border-border px-3 py-3 align-top', base && 'bg-sand/60')}>{children}</td>
}
