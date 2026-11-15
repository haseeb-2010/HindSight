import { Droplets, Layers, RotateCcw, Scale, ShieldCheck, SlidersHorizontal } from 'lucide-react'
import { useId } from 'react'
import { Button } from '../../components/ui/Button'
import { cx } from '../../lib/cx'
import { Callout, Card, ChoiceCard, Segmented, Slider } from '../components/controls'
import { PRIORITIES, PRIORITY_ORDER } from '../lib/labels'
import { PRIORITY_TEMPLATES, matchingTemplate, templateWeights, type PriorityTemplate } from '../lib/priorityTemplates'
import { Chip } from '../results/shared'
import { useWorkspace } from '../state/workspace'
import { StepFrame } from './StepFrame'

const WORDS = ['Ignored', 'Minor', 'Low', 'Moderate', 'High', 'Top priority']
const TEMPLATE_ICONS: Record<PriorityTemplate['id'], typeof Scale> = { balanced: Scale, water: Droplets, soil: Layers, stable: ShieldCheck }

function PriorityRow({ id, value, isDefault, onChange }: { id: string; value: number; isDefault: boolean; onChange: (v: number) => void }) {
  const meta = PRIORITIES[id]
  const hint = useId()
  return (
    <li className="rounded-2xl bg-white p-4 ring-1 ring-border">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-[1.0625rem] leading-tight">{meta.label}</h3>
          <p id={hint} className="mt-1 text-[0.8125rem] leading-snug text-ink">
            {meta.explain}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-display text-[1.75rem] leading-none font-semibold text-forest-950 tabular-nums" aria-hidden="true">
            {value}
            <span className="text-[0.875rem] text-muted">/5</span>
          </p>
          <p className={cx('mt-1 text-[0.6875rem] font-extrabold tracking-wide uppercase', value === 0 ? 'text-muted' : 'text-forest-800')}>{WORDS[value]}</p>
        </div>
      </div>
      <div className="mt-2">
        <Slider label={`${meta.label} weight`} describedBy={hint} value={value} min={0} max={5} step={1} onChange={onChange} format={(v) => `${v} of 5, ${WORDS[v]}`} />
      </div>
      <div className="flex items-center justify-between text-[0.6875rem] font-bold text-muted" aria-hidden="true">
        <span>0 · not counted</span>
        {isDefault ? <span>default</span> : <span className="text-forest-800">changed</span>}
        <span>5 · matters most</span>
      </div>
    </li>
  )
}

export function PrioritiesStep({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const { config, update, defaultPriorities, crops, presets } = useWorkspace()
  const value = (k: string) => config.priorities[k] ?? defaultPriorities[k] ?? 0
  const changed = Object.keys(config.priorities).some((k) => config.priorities[k] !== defaultPriorities[k])
  const allZero = PRIORITY_ORDER.every((k) => value(k) === 0)
  const set = (k: string, v: number) => update((c) => ({ ...c, priorities: { ...c.priorities, [k]: v } }))
  const weights = Object.fromEntries(PRIORITY_ORDER.map((k) => [k, value(k)]))
  const active = presets.status === 'ready' ? matchingTemplate(weights, defaultPriorities) : null
  const templateName = useId()
  // A template only fills in the sliders; the farmer can still move every one of them afterwards.
  const applyTemplate = (t: PriorityTemplate) => update((c) => ({ ...c, priorities: t.weights ? templateWeights(t, defaultPriorities) : {} }))
  const marketOn = value('market') > 0
  const list = crops.data?.crops ?? []
  const fallback = crops.data?.default_market_rating ?? 2
  const rate = (id: string, v: number) =>
    update((c) => {
      const next = { ...c.market_rating }
      if (v === 0) delete next[id]
      else next[id] = v
      return { ...c, market_rating: next }
    })

  return (
    <StepFrame
      step="priorities"
      title="What matters most to your farm?"
      intro="Every farm has different priorities. Adjust these weights to influence how HindSight ranks rotation alternatives."
      onBack={onBack}
      onNext={onNext}
      nextLabel="Continue to Scenario Settings"
      footer={
        <Button variant="secondary" icon={<RotateCcw />} disabled={!changed} onClick={() => update((c) => ({ ...c, priorities: {} }))}>
          Reset to defaults
        </Button>
      }
    >
      <Callout tone="info" title="Weights change the ranking, not the simulation">
        <span className="flex items-start gap-2">
          <Scale className="mt-0.5 hidden h-4 w-4 shrink-0 text-peri-ink sm:block" aria-hidden="true" />
          <span>
            The simulated seasons stay the same whatever you choose here. Your weights decide how the rotations are ordered against each other, so a
            rotation that ranks first for one farm may not for another. Scores are relative comparisons, not chances of success.
          </span>
        </span>
      </Callout>

      <Card as="section">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-3xl">
            <h2 className="text-[1.25rem]">Start from a priority profile</h2>
            <p className="mt-1 text-[0.9375rem] text-muted">
              Optional starting points. Choosing one fills in the seven sliders below, and you can still adjust each of them. These are preference templates, not
              scientifically optimal settings: the right weights are the ones that describe your farm.
            </p>
          </div>
          <Chip tone={active ? 'lime' : 'white'}>
            <SlidersHorizontal className="h-3 w-3" aria-hidden="true" /> {active ? active.label : 'Custom weights'}
          </Chip>
        </div>
        <div role="radiogroup" aria-label="Priority profile" className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {PRIORITY_TEMPLATES.map((t) => {
            const Icon = TEMPLATE_ICONS[t.id]
            const w = templateWeights(t, defaultPriorities)
            return (
              <ChoiceCard key={t.id} name={templateName} checked={active?.id === t.id} onChange={() => applyTemplate(t)} icon={<Icon className="h-4 w-4" aria-hidden="true" />} title={t.label}>
                {t.summary}
                <span className="mt-2 block text-[0.75rem] font-bold text-forest-800 tabular-nums">
                  {PRIORITY_ORDER.map((k) => `${PRIORITIES[k].short} ${w[k]}`).join(' · ')}
                </span>
              </ChoiceCard>
            )
          })}
        </div>
        <p className="mt-3 text-[0.8125rem] leading-snug text-ink">
          The weights are applied the next time you run the analysis. Results already on screen keep the weights they were run with, and those exact weights are shown with
          every saved analysis and in the Decision Brief.
        </p>
      </Card>

      {presets.status === 'loading' ? (
        <div className="grid gap-3 lg:grid-cols-2" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-36 rounded-2xl" />)}
        </div>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {PRIORITY_ORDER.map((k) => (
            <PriorityRow key={k} id={k} value={value(k)} isDefault={value(k) === (defaultPriorities[k] ?? 0)} onChange={(v) => set(k, v)} />
          ))}
        </ul>
      )}

      {allZero && (
        <Callout tone="warn">With every weight at 0, the engine treats all seven priorities as equally important.</Callout>
      )}

      <Card as="section">
        <h2 className="text-[1.25rem]">How well can you sell each crop?</h2>
        <p className="mt-1 max-w-3xl text-[0.9375rem] text-muted">
          Used by the Market suitability priority. Rate the crops you know: 1 is very poor market access, 5 is very good. Crops you leave unrated use
          the engine’s default rating of {fallback}.
        </p>
        {!marketOn && (
          <Callout tone="plain" className="mt-3">
            Market suitability is set to 0, so these ratings will not affect the ranking until you raise it.
          </Callout>
        )}
        <ul className="mt-4 grid gap-x-8 gap-y-2.5 md:grid-cols-2">
          {list.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-border pb-2.5">
              <span className="text-[0.9375rem] font-bold text-forest-950">{c.name}</span>
              <Segmented
                size="sm"
                label={`Market rating for ${c.name}`}
                value={config.market_rating[c.id] ?? 0}
                onChange={(v) => rate(c.id, v)}
                options={[{ value: 0, label: 'Not rated' }, ...[1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) }))]}
              />
            </li>
          ))}
        </ul>
      </Card>
    </StepFrame>
  )
}
