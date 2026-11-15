// The Rotation Decision Brief: one analysis written up as a report a farmer and a reviewer can read in
// a few minutes, on screen or on paper. It is driven only by its props, so any page can show it for
// any finished run (the open analysis, a saved one, the guided tour's).
import { Logo } from '../../components/brand/Logo'
import { rotationLabel, seasonsFailed } from '../../lib/analysis'
import { cx } from '../../lib/cx'
import { fmtCoord, fmtIndex, fmtNum, fmtPct, isNum } from '../../lib/format'
import type { AnalysisEnvelope } from '../../lib/types'
import { Callout, MascotNote } from '../components/controls'
import { ScenarioDisclaimer } from '../components/ScenarioDisclaimer'
import { ScenarioChip, SourceBadge } from '../components/SourceBadge'
import { scenarioText } from '../lib/config'
import { analysisDateOf, analysisIdOf } from '../lib/export'
import { readShift, stabilitySentence } from '../lib/insights'
import { waterLabel } from '../lib/labels'
import { CITATIONS } from '../results/ProvenanceTab'
import { LeadingAlternatives } from './AlternativesSection'
import { DisclaimerSection, EvidenceSection, VerificationChecklist } from './EvidenceSections'
import { ClimateContextSection, CurrentAssessment, FarmSnapshot } from './FieldSections'
import { briefData, type BriefData } from './parts'

export interface BriefAnalysis {
  /** The name the analysis is saved under. */
  name: string
  /** ISO time the analysis was saved on this device; used as its date when the engine did not stamp one. */
  at: string
  envelope: AnalysisEnvelope
  /** Identifier in "My Analyses"; used when the envelope carries no `analysis_id`. */
  id?: string
}

export interface DecisionBriefProps {
  analysis: BriefAnalysis
  /** Crop id → display name. */
  names: Record<string, string>
  /** True when the brief sits inside another page: no report cover band and no closing mascot. */
  embedded?: boolean
  /** The application's default weights (from the API). Needed only to name the "Balanced" priority template. */
  defaultPriorities?: Record<string, number>
}

const longDate = (iso: string) => new Date(iso).toLocaleString(undefined, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })

function Masthead({ analysis, d, embedded }: { analysis: BriefAnalysis; d: BriefData; embedded?: boolean }) {
  const { env, res, cur } = d
  const rec = res.meta.record
  const id = analysisIdOf(env, analysis)
  const date = analysisDateOf(env, analysis)
  const meta = [
    { label: date?.kind === 'saved' ? 'Saved on this device' : 'Date of analysis', value: date ? longDate(date.iso) : 'Not recorded' },
    { label: 'Analysis identifier', value: id ?? 'Not recorded', mono: !!id },
    { label: 'Engine version', value: res.meta.engine_version ? `v${res.meta.engine_version}` : 'Not recorded' },
    { label: 'Historical period', value: `${rec.start_year}–${rec.end_year}` },
  ]
  return (
    <header className="overflow-hidden rounded-[1.5rem] bg-white shadow-hairline ring-1 ring-border print:overflow-visible print:rounded-none print:shadow-none print:ring-0">
      <div
        className={cx(
          'flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-4 sm:px-7 print:border-b-2 print:border-forest-950 print:bg-white print:px-0 print:pt-0 print:pb-3',
          embedded ? 'border-b border-border bg-sand/50' : 'on-dark bg-forest-950',
        )}
      >
        {/* Lime on the dark band on screen; the original mark on white paper. */}
        {!embedded && (
          <span className="inline-flex print:hidden">
            <Logo tone="dark" />
          </span>
        )}
        <span className={cx(embedded ? 'inline-flex' : 'hidden print:inline-flex')}>
          <Logo />
        </span>
        <p className={cx('font-display text-[1.125rem] leading-tight font-semibold tracking-[-0.01em] print:text-[1.25rem] print:text-forest-950', embedded ? 'text-forest-950' : 'text-cream-50')}>
          Rotation Decision Brief
        </p>
      </div>
      <div className="p-5 sm:p-7 print:px-0 print:pt-4 print:pb-2">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <p className="text-[0.75rem] font-extrabold tracking-[0.1em] text-muted uppercase">Prepared for</p>
            <h2 className="mt-1 text-[1.625rem] leading-[1.12] tracking-[-0.025em] sm:text-[2rem]">{analysis.name}</h2>
            <p className="mt-1.5 text-[0.9375rem] font-semibold text-ink tabular-nums">
              {isNum(res.site.lat) && isNum(res.site.lon) ? fmtCoord(res.site.lat, res.site.lon) : 'Coordinates not recorded'}
              {env.request?.water?.mode ? ` · ${waterLabel(env.request.water.mode, env.request.water.seasonal_cap_mm)}` : ''}
              {cur ? ` · current rotation: ${rotationLabel(cur)}` : ''}
            </p>
          </div>
          <ul className="flex flex-wrap gap-1.5" aria-label="Result type">
            <li>
              <SourceBadge env={env} detail={false} />
            </li>
            <li className="empty:hidden">
              <ScenarioChip env={env} />
            </li>
          </ul>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-border pt-4 md:grid-cols-4 print:grid-cols-4">
          {meta.map((m) => (
            <div key={m.label} className="min-w-0">
              <dt className="text-[0.75rem] font-bold text-muted">{m.label}</dt>
              <dd className={cx('mt-0.5 text-[0.875rem] leading-snug font-semibold break-words text-forest-950 tabular-nums', m.mono && 'font-mono text-[0.8125rem]')}>{m.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </header>
  )
}

/** What was examined and the main findings, in a few sentences read from the run. */
function Summary({ d }: { d: BriefData }) {
  const { env, res, cur, alts, ranked, total, curIsTop, thr, scenarioOn } = d
  const rec = res.meta.record
  const years = rec.end_year - rec.start_year + 1
  const others = ranked.filter((r) => !r.is_current).length
  const top = alts[0]
  const f = cur ? seasonsFailed(cur) : null
  const shifts = res.climate_shift ?? []
  const readings = shifts.map(readShift)
  const consistent = readings.filter((r) => r.direction !== 'little' && r.evidence === 'consistent').length
  const days = env.inputs?.climate?.days
  const stability = cur && top && !curIsTop ? stabilitySentence(top, cur) : null
  const thrText = thr !== null ? ` of ${fmtIndex(thr)}` : ''

  const points: string[] = []
  if (cur && curIsTop) points.push(`Your current rotation, ${rotationLabel(cur)}, is the highest-ranked option in this analysis (rank #1 of ${total}).`)
  else if (top) {
    points.push(
      `${rotationLabel(top)} is the highest-ranked alternative in this analysis (rank #${top.scores?.rank ?? '—'} of ${total}).${
        cur ? ` Your current rotation, ${rotationLabel(cur)}, ranks #${cur.scores?.rank ?? '—'}.` : ''
      }`,
    )
  } else if (cur) points.push('The engine returned no alternative rotation for this field and these settings, so the current rotation is the only one assessed.')
  if (cur && f) {
    points.push(
      f.failed === 0
        ? `In the simulation, no crop season of your current rotation fell below the failure line${thrText} (0 of ${f.total} seasons).`
        : `In the simulation, your current rotation fell below the failure line${thrText} in ${f.failed} of ${f.total} crop seasons (${fmtPct(cur.hindcast.failure_freq)}).`,
    )
  }
  if (stability) points.push(stability)
  if (shifts.length) {
    points.push(
      consistent === 0
        ? `None of the ${shifts.length} climate indicators shows a consistent trend across the record under the trend test (section 2).`
        : `${consistent} of the ${shifts.length} climate indicators ${consistent === 1 ? 'shows' : 'show'} a consistent trend across the record under the trend test (section 2).`,
    )
  }
  points.push(`Ranks compare these ${total} rotation${total === 1 ? '' : 's'} under the priorities and assumptions of this run. They are not probabilities of success.`)

  return (
    <section aria-labelledby="brief-summary" className="rounded-[1.5rem] bg-white p-5 shadow-hairline ring-1 ring-border sm:p-7 print:rounded-none print:px-0 print:pt-2 print:pb-1 print:shadow-none print:ring-0">
      <h2 id="brief-summary" className="text-[1.4375rem] leading-tight tracking-[-0.02em]">
        What HindSight examined
      </h2>
      <p className="mt-2 max-w-4xl text-[1rem] leading-relaxed text-ink print:max-w-none">
        HindSight replayed {total} crop rotation{total === 1 ? '' : 's'} for this field{cur ? `: your current rotation and ${others} alternative${others === 1 ? '' : 's'}` : ''}. Each
        was simulated day by day through {years} years of NASA POWER daily weather ({rec.start_year}–{rec.end_year}
        {isNum(days) ? `; ${fmtNum(days)} daily records were read` : ''}), then ranked by the seven farmer priorities in section 1.
        {scenarioOn ? ` A hypothetical adjustment (${scenarioText(env.request?.scenario)}) was applied to the historical record before the simulation.` : ''} Every figure in this
        brief is read from that one engine run.
      </p>
      <ul className="mt-4 grid gap-x-8 gap-y-2.5 text-[0.9375rem] leading-snug text-ink md:grid-cols-2 print:grid-cols-2">
        {points.map((p) => (
          <li key={p} className="flex gap-2.5 break-inside-avoid">
            <span aria-hidden="true" className="mt-[0.45em] h-2 w-2 shrink-0 rounded-full bg-lime ring-1 ring-forest-950/25" />
            <span className="min-w-0">{p}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function DecisionBrief({ analysis, names, embedded, defaultPriorities }: DecisionBriefProps) {
  const env = analysis.envelope
  const d = briefData(env, names)
  const id = analysisIdOf(env, analysis)
  const date = analysisDateOf(env, analysis)
  return (
    <article data-brief={embedded ? 'embedded' : 'page'} aria-label={`Rotation Decision Brief for ${analysis.name}`} className="min-w-0 space-y-5 print:space-y-4">
      <Masthead analysis={analysis} d={d} embedded={embedded} />

      {d.scenarioOn && <ScenarioDisclaimer className="break-inside-avoid" />}
      {env.source === 'saved' && (
        <Callout tone="info" title="Saved demonstration result" className="break-inside-avoid">
          {env.notice ?? 'This is a stored output of the HindSight engine, not a fresh calculation.'}
          {env.fallback_reason ? ` The live engine could not run: ${env.fallback_reason}.` : ''}
        </Callout>
      )}

      <Summary d={d} />
      <FarmSnapshot d={d} farmName={analysis.name} defaults={defaultPriorities} />
      <ClimateContextSection d={d} />
      <CurrentAssessment d={d} />
      <LeadingAlternatives d={d} />
      <EvidenceSection d={d} />
      <VerificationChecklist d={d} />
      <DisclaimerSection />

      <footer className="flex flex-col gap-4 px-1 pt-1 sm:flex-row sm:items-end sm:justify-between print:block print:border-t print:border-sand-400 print:px-0 print:pt-3">
        <div className="min-w-0 text-[0.75rem] leading-snug text-muted">
          <p className="font-bold text-ink tabular-nums">
            HindSight Rotation Decision Brief · {analysis.name}
            {id ? ` · analysis ${id}` : ''}
            {date ? ` · ${longDate(date.iso)}` : ''}
            {d.res.meta.engine_version ? ` · engine v${d.res.meta.engine_version}` : ''}
          </p>
          <p className="mt-1">Data: {CITATIONS.map((c) => c.name).join(' · ')}. Full credits are in section 5.</p>
        </div>
        {!embedded && (
          <MascotNote mascot="blue" className="shrink-0 print:hidden">
            Brief complete. Take it to someone who knows your land.
          </MascotNote>
        )}
      </footer>
    </article>
  )
}
