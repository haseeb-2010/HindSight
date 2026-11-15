import { Check, HardDrive, Lock, SlidersHorizontal, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'
import { BASELINE, scenarioSummary, type ScenarioDef } from '../lib/scenarios'
import { Chip } from '../results/shared'
import { adjustmentKind, sentenceCase } from './words'

/** The adjustment currently set with the sliders, offered as one more scenario to tick. */
export interface CustomEntry {
  def: ScenarioDef
  /** Why it cannot be ticked: it equals the baseline, or a scenario already in the list (named in `sameAs`). */
  blocked: 'baseline' | 'duplicate' | null
  sameAs?: string
}

function Tile({
  def,
  detail,
  checked,
  disabled,
  locked,
  onToggle,
  tag,
  actions,
}: {
  def: ScenarioDef
  detail?: ReactNode
  checked: boolean
  disabled?: boolean
  locked?: boolean
  onToggle?: () => void
  tag?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div
      className={cx(
        'flex min-w-0 flex-col rounded-2xl ring-1 transition-[background-color,box-shadow] duration-200',
        checked ? 'bg-lime-100 ring-forest-950/35' : 'bg-white ring-border',
        !checked && !disabled && 'hover:ring-border-strong',
      )}
    >
      <label
        className={cx(
          'relative flex min-w-0 flex-1 items-start gap-3 rounded-2xl p-3.5 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-forest-950',
          disabled || locked ? 'cursor-default' : 'cursor-pointer',
          disabled && 'opacity-60',
        )}
      >
        <input type="checkbox" className="sr-only scroll-mt-56" data-scenario={def.id} checked={checked} disabled={disabled || locked} onChange={onToggle} />
        <span aria-hidden="true" className={cx('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md', checked ? 'bg-forest-950 text-lime' : 'bg-sand ring-1 ring-sand-400')}>
          {locked ? <Lock className="h-3 w-3" strokeWidth={3} /> : checked ? <Check className="h-3.5 w-3.5" strokeWidth={3.5} /> : null}
        </span>
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[0.9375rem] leading-snug font-extrabold text-forest-950">{def.label}</span>
            {tag}
          </span>
          <span className="mt-0.5 block text-[0.8125rem] leading-snug font-semibold text-ink">{detail ?? sentenceCase(scenarioSummary(def))}</span>
        </span>
      </label>
      {actions && <div className="flex flex-wrap gap-1.5 px-3.5 pb-3 pl-[2.875rem]">{actions}</div>}
    </div>
  )
}

function Group({ title, hint, wide, children }: { title: string; hint?: string; wide?: boolean; children: ReactNode }) {
  return (
    <div>
      <h3 className="font-sans text-[0.75rem] font-extrabold tracking-[0.08em] text-muted uppercase">{title}</h3>
      {hint && <p className="mt-0.5 text-[0.8125rem] leading-snug text-muted">{hint}</p>}
      <div className={cx('mt-2 grid gap-2', !wide && 'sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2')}>{children}</div>
    </div>
  )
}

const smallButton =
  'inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1.5 text-[0.75rem] font-extrabold text-forest-950 ring-1 ring-border-strong transition-colors hover:bg-sand/70 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-950'

/**
 * The scenarios that can be run, as a checklist. The baseline is always ticked and always first;
 * nothing here runs anything.
 */
export function ScenarioPicker({
  siteName,
  builtins,
  custom,
  saved,
  sessionOnly,
  selected,
  maxOthers,
  onToggle,
  onLoad,
  onRemove,
  note,
}: {
  siteName: string
  /** The built-in scenarios other than the baseline. */
  builtins: ScenarioDef[]
  custom: CustomEntry
  saved: ScenarioDef[]
  /** Ids of saved scenarios the browser refused to store: kept for this session only. */
  sessionOnly: Set<string>
  selected: string[]
  /** How many scenarios can be compared with the baseline in one go. */
  maxOthers: number
  onToggle: (id: string) => void
  onLoad: (s: ScenarioDef) => void
  onRemove: (s: ScenarioDef) => void
  /** Announces what the last list action did (loaded, removed). */
  note: string | null
}) {
  const full = selected.length >= maxOthers
  const groups = [
    { kind: 'temperature', title: 'Temperature stress tests', hint: 'Every day of the record shifted by the same number of degrees.' },
    { kind: 'rainfall', title: 'Precipitation stress tests', hint: 'Every day’s rainfall multiplied by the same factor.' },
    { kind: 'combined', title: 'Combined', hint: 'Both adjustments applied together.' },
  ]
  const tile = (s: ScenarioDef, extra?: { tag?: ReactNode; actions?: ReactNode }) => {
    const on = selected.includes(s.id)
    return <Tile key={s.id} def={s} checked={on} disabled={!on && full} onToggle={() => onToggle(s.id)} {...extra} />
  }

  return (
    <div className="space-y-5">
      <Group title="Baseline" wide>
        <Tile
          def={BASELINE}
          checked
          locked
          tag={<Chip tone="forest">Always included, always first</Chip>}
          detail={<>The actual historical record for {siteName}: temperature 0 °C, precipitation ×1.0.</>}
        />
      </Group>

      {groups.map((g) => {
        const items = builtins.filter((s) => adjustmentKind(s) === g.kind)
        return items.length ? (
          <Group key={g.kind} title={g.title} hint={g.hint} wide={items.length === 1}>
            {items.map((s) => tile(s))}
          </Group>
        ) : null
      })}

      <Group title="Your scenarios" hint="The adjustment set with the sliders, and any scenarios you have saved." wide>
        <Tile
          def={custom.def}
          checked={!custom.blocked && selected.includes(custom.def.id)}
          disabled={!!custom.blocked || (!selected.includes(custom.def.id) && full)}
          onToggle={() => onToggle(custom.def.id)}
          tag={
            <Chip tone="white">
              <SlidersHorizontal className="h-3 w-3" aria-hidden="true" /> From the sliders
            </Chip>
          }
          detail={
            custom.blocked === 'baseline'
              ? 'The sliders are at the historical baseline. Move one to build a scenario of your own.'
              : custom.blocked === 'duplicate'
                ? `${sentenceCase(scenarioSummary(custom.def))}. The same adjustment as “${custom.sameAs}”, so tick that one instead.`
                : `${sentenceCase(scenarioSummary(custom.def))}. Not saved.`
          }
        />
        {saved.map((s) =>
          tile(s, {
            tag: sessionOnly.has(s.id) ? (
              <Chip tone="signal">This session only</Chip>
            ) : (
              <Chip tone="peri">
                <HardDrive className="h-3 w-3" aria-hidden="true" /> Saved on this device
              </Chip>
            ),
            actions: (
              <>
                <button type="button" className={smallButton} onClick={() => onLoad(s)}>
                  <SlidersHorizontal className="h-3 w-3" aria-hidden="true" /> Load into sliders
                  <span className="sr-only">: {s.label}</span>
                </button>
                <button type="button" className={smallButton} onClick={() => onRemove(s)}>
                  <Trash2 className="h-3 w-3" aria-hidden="true" /> Remove
                  <span className="sr-only">: {s.label}</span>
                </button>
              </>
            ),
          }),
        )}
      </Group>

      {note && (
        <p role="status" className="text-[0.8125rem] font-bold text-forest-950">
          {note}
        </p>
      )}
    </div>
  )
}
