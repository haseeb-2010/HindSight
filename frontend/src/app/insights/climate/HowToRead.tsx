import { ArrowLeftRight, Satellite, Sigma, TrendingUp, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { fmtPct } from '../../../lib/format'
import { CLIMATE_RULES, readShift } from '../../lib/insights'
import { Panel } from '../../results/shared'

// The labels are taken from readShift() itself, so this explainer always quotes the wording the cards use.
const read = (change: number, p: number) => readShift({ id: '', label: '', unit: 'mm', early: 100, late: 100 + change, change, slope_per_decade: null, p_value: p })
const WORDS = {
  higher: read(50, 1).label,
  lower: read(-50, 1).label,
  little: read(0, 1).label,
  consistent: read(0, 0).evidenceLabel,
  limited: read(0, 1).evidenceLabel,
}

function Item({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-3.5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sand text-forest-950" aria-hidden="true">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <h4 className="text-[1rem] leading-snug">{title}</h4>
        <p className="mt-1 text-[0.9375rem] leading-relaxed text-ink">{children}</p>
      </div>
    </div>
  )
}

const Quote = ({ children }: { children: string }) => <strong className="font-extrabold text-forest-950">“{children}”</strong>

/** What each number on the climate cards means, and the written rule behind every label. */
export function HowToRead({ earlySpan, lateSpan, recordYears }: { earlySpan: string | null; lateSpan: string | null; recordYears: number | null }) {
  const { littleChangeFraction, minChange, alpha } = CLIMATE_RULES
  const all = recordYears ? `all ${recordYears} years` : 'every year'
  return (
    <Panel title="How to read these numbers">
      <div className="grid gap-x-10 gap-y-6 md:grid-cols-2">
        <Item icon={ArrowLeftRight} title="Earlier and later period">
          The record is split into {earlySpan && lateSpan ? `two periods, ${earlySpan} and ${lateSpan}` : 'an earlier and a later period'}. Each card shows an indicator’s
          yearly average in both. The change is the later average minus the earlier one.
        </Item>
        <Item icon={TrendingUp} title="Trend per decade">
          A Theil–Sen slope: the typical change per ten years across {all} of the record. It is the middle value of the slopes between every pair of years, so one extreme year
          sways it less than a straight-line fit would.
        </Item>
        <Item icon={Sigma} title="Trend test (p-value)">
          From Kendall’s trend test, which asks whether later years tend to be higher or lower than earlier ones. A small p-value means year-to-year changes this consistent would
          be unusual if there were no underlying trend. It is not the probability that the trend is real, and it says nothing about how large or how important the change is.
        </Item>
        <Item icon={Satellite} title="Weather record, not crop response">
          These indicators describe the weather record itself: gridded NASA POWER estimates for the area around your field, with no crop model involved. The season index
          elsewhere in HindSight is different: it is a modelled crop response to that weather. A change in the record does not by itself say how a crop responded.
        </Item>
      </div>

      <div className="mt-6 rounded-2xl bg-sand/60 p-4 sm:p-5">
        <h4 className="text-[1rem] leading-snug">The rule behind each label</h4>
        <ul className="mt-2.5 space-y-2 text-[0.9375rem] leading-relaxed text-ink">
          <li>
            <Quote>{WORDS.little}</Quote>: the difference between the two period averages is smaller than {fmtPct(littleChangeFraction)} of the earlier value, or smaller than{' '}
            <span className="tabular-nums">{minChange.mm} mm</span> for rainfall and evapotranspiration and{' '}
            <span className="tabular-nums">
              {minChange.days} {minChange.days === 1 ? 'day' : 'days'}
            </span>{' '}
            for day counts.
          </li>
          <li>
            <Quote>{WORDS.higher}</Quote> or <Quote>{WORDS.lower}</Quote>: the difference is at least that large.
          </li>
          <li>
            <Quote>{WORDS.consistent}</Quote>: the trend test gives a p-value below <span className="tabular-nums">{alpha}</span>.
          </li>
          <li>
            <Quote>{WORDS.limited}</Quote>: the p-value is <span className="tabular-nums">{alpha}</span> or higher, or the test could not be run. The two periods can still differ,
            but the difference may reflect year-to-year variation.
          </li>
        </ul>
      </div>
    </Panel>
  )
}
