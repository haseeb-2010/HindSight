import { Droplets } from 'lucide-react'
import { currentRotation, failureThreshold } from '../../../lib/analysis'
import { fmtIndex } from '../../../lib/format'
import type { SlotStats } from '../../../lib/types'
import { joinList } from '../../lib/insights'
import { LIMIT_WORDS } from '../../lib/labels'
import { Chip, Panel, Stat, TIP } from '../../results/shared'
import type { InsightProps } from '../types'

const LIMIT_TIP =
  'The factor that most often held this crop’s season index down in the simulation: water, temperature outside the crop’s range, a killing frost, or none. ' +
  'Where seasons fell below the failure line, it is counted over those seasons.'

/** Which crops of the current rotation the engine reports as limited mainly by water (hindcast.by_slot[].main_limit). */
export function LimitedSeasons({ env, names, className }: InsightProps & { className?: string }) {
  const cur = currentRotation(env.result)
  const slots = cur?.hindcast.by_slot ?? []
  const thr = failureThreshold(env)
  const mode = env.request?.water?.mode

  if (!cur || slots.length === 0) {
    return (
      <Panel title="Was water the limit for your current rotation?" className={className}>
        <p className="text-[0.9375rem] text-ink">Not available: the engine did not return per-crop results for the current rotation in this analysis.</p>
      </Panel>
    )
  }

  // by_slot follows the rotation's crop order, so the matching slot gives the rotation year.
  const label = (s: SlotStats, i: number) => {
    const name = names[s.crop_id] ?? s.crop_id
    const slot = cur.slots.length === slots.length && cur.slots[i]?.crop_id === s.crop_id ? cur.slots[i] : undefined
    return cur.cycle_years > 1 && slot ? `${name} (year ${slot.year_offset + 1})` : name
  }
  const limited = slots.map((s, i) => ({ s, name: label(s, i) })).filter((x) => x.s.main_limit === 'water')
  const others = slots.map((s, i) => ({ s, name: label(s, i) })).filter((x) => x.s.main_limit !== 'water')

  const lead =
    limited.length === 0
      ? 'Water was not the main limiting factor for any crop in your current rotation in this simulation.'
      : others.length === 0
        ? slots.length === 1
          ? `Water was the main limiting factor for ${limited[0].name}, the only crop in your current rotation.`
          : `Water was the main limiting factor for every crop in your current rotation: ${joinList(limited.map((x) => x.name))}.`
        : `Water was the main limiting factor for ${joinList(limited.map((x) => x.name))}, but not for ${joinList(others.map((x) => x.name))}.`

  return (
    <Panel title="Was water the limit for your current rotation?" tip={LIMIT_TIP} className={className}>
      <p className="text-[0.9375rem] leading-relaxed text-ink">
        {lead}
        {limited.length === 0 && mode === 'full' && ' Under full irrigation the model refills the root zone before a crop becomes short of water, so this is what the simulation is expected to show.'}
      </p>
      <ul className="mt-4 space-y-3">
        {slots.map((s, i) => (
          <li key={i} className="rounded-2xl bg-sand/50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-[1.0625rem] leading-tight">{label(s, i)}</h4>
              {s.main_limit === 'water' ? (
                <Chip tone="peri">
                  <Droplets className="h-3 w-3" aria-hidden="true" /> Limited mainly by water
                </Chip>
              ) : (
                <Chip tone="white">Not limited mainly by water</Chip>
              )}
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
              <Stat className="col-span-2" label="Main limiting factor" value={<span className="text-[1.0625rem]">{LIMIT_WORDS[s.main_limit] ?? s.main_limit}</span>} />
              <Stat label="Seasons below the failure line" tip={TIP.failure(thr)} value={`${s.n_failed} of ${s.n_seasons}`} />
              <Stat label="Median season index" tip={`${TIP.median} ${TIP.index}`} value={fmtIndex(s.median)} />
            </dl>
            {s.main_limit === 'water' && s.n_seasons > 0 && s.n_failed === 0 && (
              <p className="mt-3 text-[0.8125rem] leading-snug text-ink">No season fell below the failure line. Water is the factor that most often held this crop’s index down.</p>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[0.8125rem] leading-snug text-muted">Simulated crop seasons of the current rotation over the record. The season index is not crop yield.</p>
    </Panel>
  )
}
