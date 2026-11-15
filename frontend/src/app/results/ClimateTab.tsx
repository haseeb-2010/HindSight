import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react'
import { InfoTip } from '../../components/ui/InfoTip'
import { cx } from '../../lib/cx'
import { fmtNum, fmtP, isNum } from '../../lib/format'
import type { AnalysisEnvelope, ClimateShift } from '../../lib/types'
import { Callout } from '../components/controls'
import { isScenarioActive, scenarioText } from '../lib/config'
import { Panel } from './shared'

const digits = (unit: string) => (unit === 'mm' ? 0 : 1)

function ShiftCard({ s, early, late }: { s: ClimateShift; early: string; late: string }) {
  const d = digits(s.unit)
  const max = Math.max(isNum(s.early) ? s.early : 0, isNum(s.late) ? s.late : 0)
  const change = s.change
  const up = isNum(change) && change > 0
  const flat = !isNum(change) || Math.abs(change) < 10 ** -d / 2
  const Arrow = flat ? ArrowRight : up ? ArrowUpRight : ArrowDownRight
  const clear = isNum(s.p_value) && s.p_value < 0.05
  const sign = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '')
  return (
    <article className="flex flex-col rounded-[1.5rem] bg-white p-5 shadow-hairline ring-1 ring-border">
      <h3 className="text-[1.0625rem] leading-snug">{s.label}</h3>
      <div className="mt-4 space-y-2.5">
        {[
          { period: early, v: s.early, tone: 'bg-sage' },
          { period: late, v: s.late, tone: 'bg-forest-950' },
        ].map((row) => (
          <div key={row.period}>
            <div className="flex items-baseline justify-between gap-3 text-[0.8125rem]">
              <span className="font-bold text-ink tabular-nums">{row.period}</span>
              <span className="font-display text-[1.0625rem] font-semibold text-forest-950 tabular-nums">
                {fmtNum(row.v, d)} <span className="font-sans text-[0.75rem] font-bold text-ink">{s.unit}</span>
              </span>
            </div>
            <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-sand" aria-hidden="true">
              <div className={cx('bar-grow-x h-full rounded-full', row.tone)} style={{ width: `${isNum(row.v) && max > 0 ? Math.max(1.5, (row.v / max) * 100) : 0}%` }} />
            </div>
          </div>
        ))}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 text-[0.8125rem]">
        <div>
          <dt className="font-bold text-muted">Change between periods</dt>
          <dd className="mt-0.5 flex items-center gap-1 font-display text-[1.0625rem] font-semibold text-forest-950 tabular-nums">
            <Arrow className="h-4 w-4 text-forest-800" aria-hidden="true" />
            {isNum(change) ? `${sign(change)}${fmtNum(Math.abs(change), d)} ${s.unit}` : '—'}
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-1 font-bold text-muted">
            Trend
            <InfoTip label="Trend per decade">
              The typical change per ten years across all 40 years (Theil–Sen slope), which is less swayed by single extreme years than a straight average.
            </InfoTip>
          </dt>
          <dd className="mt-0.5 font-display text-[1.0625rem] font-semibold text-forest-950 tabular-nums">
            {isNum(s.slope_per_decade) ? `${sign(s.slope_per_decade)}${fmtNum(Math.abs(s.slope_per_decade), 1)} ${s.unit}/decade` : '—'}
          </dd>
        </div>
      </dl>
      <p className={cx('mt-3 rounded-xl px-3 py-2 text-[0.8125rem] leading-snug', clear ? 'bg-lime-100 text-forest-950' : 'bg-sand/70 text-ink')}>
        <span className="font-extrabold">{clear ? 'A consistent trend in this record.' : 'No clear trend in this record.'}</span>{' '}
        <span className="tabular-nums">Trend test {fmtP(s.p_value)}</span>
        <InfoTip label="What the p-value means" className="ml-1">
          From a Mann–Kendall-type trend test. A small p-value (below 0.05) means year-to-year changes this consistent would be unusual if there were no underlying trend. It is not
          the probability that the trend is real, and it says nothing about how large or important the change is.
        </InfoTip>
      </p>
    </article>
  )
}

export function ClimateTab({ env }: { env: AnalysisEnvelope }) {
  const res = env.result
  const shifts = res.climate_shift ?? []
  const w = res.meta.windows
  const early = w?.early ? `${w.early[0]}–${w.early[1]}` : 'Earlier period'
  const late = w?.late ? `${w.late[0]}–${w.late[1]}` : 'Later period'
  const scenarioOn = isScenarioActive(env.request?.scenario)

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[1.625rem] leading-tight tracking-[-0.02em]">How have local environmental conditions changed?</h2>
        <p className="mt-1 max-w-3xl text-[0.9375rem] text-muted">
          Compare environmental indicators between two historical periods and explore the direction of long-term trends. Each value is a yearly average for
          the period, from the NASA POWER record for this location.
        </p>
      </div>

      {scenarioOn && (
        <Callout tone="warn" title="A what-if scenario is applied to these numbers">
          This analysis ran with {scenarioText(env.request?.scenario)} applied to every day of the record, so the values below describe the adjusted record, not what was observed.
          Historical what-if scenario — not a climate forecast.
        </Callout>
      )}

      <Callout tone="info" title="Read rainfall changes with care">
        NASA POWER describes a grid cell about 50 km wide, not a rain gauge on your field. At the two Pakistan demonstration sites its rainfall differs from published climate
        normals by roughly +48% and −36%, and large shifts between periods can partly reflect changes in the underlying satellite and model record. HindSight shows the data as
        delivered and does not adjust it.
      </Callout>

      {shifts.length === 0 ? (
        <Panel>
          <p className="text-[0.9375rem] text-ink">The engine did not return climate indicators for this analysis.</p>
        </Panel>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shifts.map((s) => (
            <ShiftCard key={s.id} s={s} early={early} late={late} />
          ))}
        </div>
      )}

      <p className="text-[0.8125rem] leading-snug text-muted">
        These comparisons describe the past record only. They are not projections of future climate.
      </p>
    </div>
  )
}
