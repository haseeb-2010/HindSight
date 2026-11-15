import { useState } from 'react'
import { IndexLines, type Series } from '../../components/charts/IndexLines'
import { CROP_COLORS, MonthStrip } from '../../components/charts/MonthStrip'
import { InfoTip } from '../../components/ui/InfoTip'
import { failureThreshold, indexVaries, rankedRotations, rotationLabel } from '../../lib/analysis'
import { cx } from '../../lib/cx'
import { fmtIndex, fmtNum, fmtPct, isNum, yearList } from '../../lib/format'
import type { AnalysisEnvelope } from '../../lib/types'
import { Callout } from '../components/controls'
import { doyLabel } from '../lib/doy'
import { LIMIT_WORDS } from '../lib/labels'
import { HBars, Panel, RotationBadges, RotationPicker, TIP } from './shared'

const EXTRA_COLORS = ['var(--color-signal-600)', '#6f8a7c', '#8a7a2e']

export function DetailsTab({ env, names, selected, onSelect }: { env: AnalysisEnvelope; names: Record<string, string>; selected: string; onSelect: (id: string) => void }) {
  const res = env.result
  const all = rankedRotations(res)
  const cur = all.find((r) => r.is_current)
  const rot = all.find((r) => r.id === selected) ?? all[0]
  const [extra, setExtra] = useState<string[]>([])
  const thr = failureThreshold(env)
  if (!rot || !cur) return <Callout tone="warn">No rotation to show.</Callout>

  const order = [...new Set(rot.slots.map((s) => s.crop_id))]
  const varies = indexVaries(cur)
  const worst = cur.hindcast.worst_years
  const others = all.filter((r) => r.id !== rot.id && !r.is_current)
  const extras = others.filter((r) => extra.includes(r.id)).slice(0, EXTRA_COLORS.length)
  const series: Series[] = [
    ...(rot.is_current ? [] : [{ label: `${rotationLabel(cur)} (current)`, values: cur.hindcast.annual_index, color: 'var(--color-peri-chart)', dashed: true }]),
    { label: rot.is_current ? `${rotationLabel(rot)} (current)` : rotationLabel(rot), values: rot.hindcast.annual_index, color: rot.is_current ? 'var(--color-peri-chart)' : 'var(--color-forest-950)', dashed: rot.is_current },
    ...extras.map((r, i) => ({ label: rotationLabel(r), values: r.hindcast.annual_index, color: EXTRA_COLORS[i] })),
  ]
  const toggleExtra = (id: string) => setExtra((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id].slice(-EXTRA_COLORS.length)))
  const years = rot.hindcast.years

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[1.625rem] leading-tight tracking-[-0.02em]">Rotation details</h2>
        <p className="mt-1 mb-3 text-[0.9375rem] text-muted">Choose a rotation to see its calendar, each crop’s simulated seasons, and its year-by-year history.</p>
        <RotationPicker rotations={all} selected={rot.id} onSelect={onSelect} label="Rotation to inspect" />
      </div>

      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[0.75rem] font-extrabold tracking-[0.08em] text-muted uppercase">
              Rank #{rot.scores?.rank} of {all.length} · {rot.cycle_years}-year cycle
            </p>
            <h3 className="mt-1 text-[1.5rem] leading-tight tracking-[-0.02em]">{rotationLabel(rot)}</h3>
          </div>
          <RotationBadges r={rot} />
        </div>

        <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <div className="min-w-0">
            <h4 className="font-sans text-[0.8125rem] font-extrabold text-forest-950">Crop schedule</h4>
            <div className="mt-2.5">
              {rot.calendar?.length ? (
                <MonthStrip calendar={rot.calendar} cropOrder={order} cropNames={names} label={`Calendar of ${rotationLabel(rot)}`} />
              ) : (
                <p className="text-[0.875rem] text-muted">The engine did not return a calendar for this rotation.</p>
              )}
            </div>
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[0.8125rem] font-bold text-ink">
              {order.map((id, i) => (
                <li key={id} className="inline-flex items-center gap-1.5">
                  <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm" style={{ background: CROP_COLORS[i % CROP_COLORS.length] }} />
                  {names[id] ?? id}
                </li>
              ))}
              <li className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm border border-sand-400 bg-[repeating-linear-gradient(135deg,transparent_0_2px,rgb(207_203_194)_2px_3px)]" />
                No crop (bare soil)
              </li>
            </ul>
            <p className="mt-2 text-[0.8125rem] text-muted">A partly filled month had a crop for only part of it: the filled share is the share of days with a crop.</p>
          </div>
          <div>
            <h4 className="font-sans text-[0.8125rem] font-extrabold text-forest-950">Sowing dates</h4>
            <ul className="mt-2.5 space-y-1.5">
              {[...rot.slots]
                .sort((a, b) => a.year_offset * 365 + a.plant_doy - (b.year_offset * 365 + b.plant_doy))
                .map((s, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 rounded-xl bg-sand/60 px-3 py-2 text-[0.875rem]">
                    <span className="font-bold text-forest-950">{names[s.crop_id] ?? s.crop_id}</span>
                    <span className="font-semibold text-ink tabular-nums">
                      {rot.cycle_years > 1 ? `Year ${s.year_offset + 1}, ` : ''}
                      {doyLabel(s.plant_doy)}
                    </span>
                  </li>
                ))}
            </ul>
            <p className="mt-3 text-[0.875rem] text-ink">
              Soil covered <strong className="font-extrabold tabular-nums">{fmtPct(rot.indicators.cover_frac, 1)}</strong> of the cycle.
            </p>
          </div>
        </div>
      </Panel>

      <Panel title="Each crop’s simulated seasons">
        {rot.hindcast.by_slot?.length ? (
          <>
            {/* Table from md up */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[44rem] border-separate border-spacing-0 text-[0.875rem]">
                <thead className="text-[0.75rem] font-extrabold tracking-[0.04em] text-ink uppercase">
                  <tr>
                    {['Crop', 'Median index', 'Lower-decile index', 'Failure frequency', 'Seasons failed', 'Main limiting factor', 'Heat days', 'Frost days'].map((h, i) => (
                      <th key={h} scope="col" className={cx('pb-2.5 align-bottom', i === 0 || i === 5 ? 'text-left' : 'text-right', i > 0 && 'pl-3')}>
                        {h}
                        {h === 'Heat days' && (
                          <InfoTip label="Heat days" className="ml-1">
                            Average number of days per season above the crop’s heat threshold. Reported for information only: the engine does not multiply them into the season index, and they
                            are not a count of failures.
                          </InfoTip>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rot.hindcast.by_slot.map((b, i) => (
                    <tr key={i}>
                      <th scope="row" className="border-t border-border py-2.5 text-left font-extrabold text-forest-950">{names[b.crop_id] ?? b.crop_id}</th>
                      <td className="border-t border-border py-2.5 pl-3 text-right font-semibold text-ink tabular-nums">{fmtIndex(b.median)}</td>
                      <td className="border-t border-border py-2.5 pl-3 text-right font-semibold text-ink tabular-nums">{fmtIndex(b.p10)}</td>
                      <td className="border-t border-border py-2.5 pl-3 text-right font-semibold text-ink tabular-nums">{fmtPct(b.failure_freq, 1)}</td>
                      <td className="border-t border-border py-2.5 pl-3 text-right font-semibold text-ink tabular-nums">
                        {b.n_failed} of {b.n_seasons}
                      </td>
                      <td className="border-t border-border py-2.5 pl-3 text-left font-semibold text-ink">{LIMIT_WORDS[b.main_limit] ?? b.main_limit}</td>
                      <td className="border-t border-border py-2.5 pl-3 text-right font-semibold text-ink tabular-nums">{fmtNum(b.heat_days_mean, 1)}</td>
                      <td className="border-t border-border py-2.5 pl-3 text-right font-semibold text-ink tabular-nums">{fmtNum(b.frost_days_mean, 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Stacked on small screens */}
            <ul className="space-y-3 md:hidden">
              {rot.hindcast.by_slot.map((b, i) => (
                <li key={i} className="rounded-2xl bg-sand/50 p-4">
                  <p className="font-display text-[1.0625rem] font-semibold text-forest-950">{names[b.crop_id] ?? b.crop_id}</p>
                  <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[0.8125rem] text-ink">
                    {[
                      ['Median index', fmtIndex(b.median)],
                      ['Lower-decile index', fmtIndex(b.p10)],
                      ['Failure frequency', fmtPct(b.failure_freq, 1)],
                      ['Seasons failed', `${b.n_failed} of ${b.n_seasons}`],
                      ['Heat days (avg, info only)', fmtNum(b.heat_days_mean, 1)],
                      ['Frost days (avg)', fmtNum(b.frost_days_mean, 1)],
                    ].map(([k, v]) => (
                      <div key={k} className="contents">
                        <dt className="font-semibold">{k}</dt>
                        <dd className="text-right font-extrabold tabular-nums">{v}</dd>
                      </div>
                    ))}
                    <dt className="font-semibold">Main limiting factor</dt>
                    <dd className="text-right font-extrabold">{LIMIT_WORDS[b.main_limit] ?? b.main_limit}</dd>
                  </dl>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[0.8125rem] leading-snug text-muted">
              The limiting factor is the one that most often held the season index down: water, temperature outside the crop’s range, a killing frost, or none.
              Heat and frost days are averages per season.
            </p>
          </>
        ) : (
          <p className="text-[0.875rem] text-muted">The engine did not return per-crop results for this rotation.</p>
        )}
      </Panel>

      <Panel title="Year by year, 1985 onward" tip={TIP.index}>
        <p className="-mt-2 mb-4 text-[0.875rem] font-bold text-forest-950">Historical simulated annual index — not observed crop yield.</p>
        {others.length > 0 && (
          <div className="mb-4">
            <p className="mb-1.5 text-[0.8125rem] font-extrabold text-forest-950">Add other rotations to the chart (up to {EXTRA_COLORS.length})</p>
            <div className="flex flex-wrap gap-1.5">
              {others.map((r) => {
                const on = extra.includes(r.id)
                return (
                  <button
                    key={r.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleExtra(r.id)}
                    className={cx('max-w-full truncate rounded-full px-3 py-1.5 text-[0.8125rem] font-bold ring-1 transition-colors', on ? 'bg-forest-950 text-cream-50 ring-forest-950' : 'bg-white text-forest-950 ring-border-strong hover:bg-sand/70')}
                  >
                    #{r.scores?.rank} {rotationLabel(r)}
                  </button>
                )
              })}
            </div>
          </div>
        )}
        <IndexLines
          years={years}
          series={series}
          threshold={thr}
          highlightYears={varies ? (worst?.years ?? []) : []}
          highlightLabel="Weakest years of your current rotation"
          yLabel="Season index (S)"
          caption={`Simulated annual season index for ${years[0]} to ${years[years.length - 1]}: ${series.map((s) => s.label).join('; ')}.`}
          height={280}
        />
        <p className="mt-2 text-center text-[0.75rem] font-bold text-muted" aria-hidden="true">
          Year
        </p>
      </Panel>

      <Panel title="How would each rotation have performed when your current system struggled most?">
        {varies && worst?.years?.length ? (
          <>
            <p className="-mt-2 mb-4 max-w-3xl text-[0.9375rem] leading-relaxed text-ink">
              The five years with the lowest index for your current rotation were <strong className="font-extrabold text-forest-950">{yearList(worst.years)}</strong>. The bars show
              every rotation’s mean index in those same years.
            </p>
            <HBars
              title="Mean season index in those five years"
              tip={TIP.worst}
              rows={all.map((r) => ({ key: r.id, label: rotationLabel(r), value: r.hindcast.worst_years?.mean_index, current: r.is_current }))}
              format={(v) => v.toFixed(2)}
              max={Math.max(1, ...all.map((r) => (isNum(r.hindcast.worst_years?.mean_index) ? (r.hindcast.worst_years?.mean_index as number) : 0)))}
              caption="This looks back at past years. Doing better then does not guarantee doing better in a future bad year."
            />
          </>
        ) : (
          <p className="text-[0.9375rem] leading-relaxed text-ink">
            Your current rotation’s index barely changes from year to year in this analysis (as under full irrigation), so there are no meaningfully weaker years to compare.
          </p>
        )}
      </Panel>
    </div>
  )
}
