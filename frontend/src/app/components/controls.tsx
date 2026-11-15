import { AlertTriangle, Info } from 'lucide-react'
import { useId, type CSSProperties, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import { Mascot } from '../../components/ui/Mascot'
import { cx } from '../../lib/cx'

const inputBase =
  'h-11 w-full rounded-xl border bg-white px-3.5 text-[0.9375rem] font-semibold text-forest-950 transition-colors ' +
  'placeholder:font-medium placeholder:text-muted/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-950 ' +
  'disabled:cursor-not-allowed disabled:bg-sand/60 disabled:text-muted'

/** Label, optional hint and error message wired to the control through ids. */
export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: ReactNode
  hint?: ReactNode
  error?: string | null
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode
  className?: string
}) {
  const id = useId()
  const hintId = `${id}-hint`
  const errId = `${id}-err`
  const describedBy = [hint ? hintId : null, error ? errId : null].filter(Boolean).join(' ') || undefined
  return (
    <div className={cx('min-w-0', className)}>
      <label htmlFor={id} className="mb-1.5 block text-[0.8125rem] font-extrabold text-forest-950">
        {label}
      </label>
      {children({ id, describedBy, invalid: !!error })}
      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-[0.8125rem] leading-snug text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errId} role="alert" className="mt-1.5 text-[0.8125rem] leading-snug font-bold text-signal-ink">
          {error}
        </p>
      )}
    </div>
  )
}

export function TextInput({ invalid, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      {...rest}
      aria-invalid={invalid || undefined}
      className={cx(inputBase, invalid ? 'border-signal-600' : 'border-border-strong hover:border-forest-950/40', className)}
    />
  )
}

export function SelectInput({ invalid, className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select
      {...rest}
      aria-invalid={invalid || undefined}
      className={cx(inputBase, 'cursor-pointer pr-8', invalid ? 'border-signal-600' : 'border-border-strong hover:border-forest-950/40', className)}
    >
      {children}
    </select>
  )
}

interface Option<T extends string | number> {
  value: T
  label: ReactNode
  hint?: string
}

/** A small set of exclusive choices shown as a pill row (a radio group). */
export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
  className,
  size = 'md',
}: {
  label: string
  value: T
  options: Option<T>[]
  onChange: (v: T) => void
  className?: string
  size?: 'sm' | 'md'
}) {
  const name = useId()
  return (
    <div role="radiogroup" aria-label={label} className={cx('inline-flex flex-wrap gap-1 rounded-2xl bg-sand p-1', className)}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <label
            key={String(o.value)}
            title={o.hint}
            className={cx(
              'relative cursor-pointer rounded-xl font-bold transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-forest-950',
              size === 'sm' ? 'px-2.5 py-1 text-[0.8125rem]' : 'px-3.5 py-2 text-[0.875rem]',
              active ? 'bg-forest-950 text-cream-50 shadow-hairline' : 'text-ink hover:bg-white/70',
            )}
          >
            <input type="radio" name={name} className="sr-only" checked={active} onChange={() => onChange(o.value)} />
            {o.label}
          </label>
        )
      })}
    </div>
  )
}

/** A larger selectable card (radio) for choices that need a sentence of explanation. */
export function ChoiceCard({
  name,
  checked,
  onChange,
  icon,
  title,
  children,
  className,
}: {
  name: string
  checked: boolean
  onChange: () => void
  icon?: ReactNode
  title: ReactNode
  children?: ReactNode
  className?: string
}) {
  return (
    <label
      className={cx(
        'relative flex cursor-pointer flex-col gap-2 rounded-2xl p-4 ring-1 transition-[box-shadow,background-color] duration-300',
        'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-forest-950',
        checked ? 'bg-lime-100 shadow-soft ring-2 ring-forest-950' : 'bg-white ring-border hover:shadow-soft hover:ring-border-strong',
        className,
      )}
    >
      <input type="radio" name={name} className="sr-only" checked={checked} onChange={onChange} />
      <span className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2.5 font-display text-[1.0625rem] leading-tight font-semibold text-forest-950">
          {icon && <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-forest-950 text-lime">{icon}</span>}
          {title}
        </span>
        <span
          aria-hidden="true"
          className={cx('flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2', checked ? 'border-forest-950' : 'border-sand-400')}
        >
          {checked && <span className="h-2.5 w-2.5 rounded-full bg-forest-950" />}
        </span>
      </span>
      {children && <span className="block text-[0.875rem] leading-snug text-ink">{children}</span>}
    </label>
  )
}

/** Range slider. `origin` paints the track from that value (for sliders centred on zero). */
export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
  origin,
  ticks,
  describedBy,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  format?: (v: number) => string
  origin?: number
  ticks?: { value: number; label: string }[]
  describedBy?: string
}) {
  const pct = (v: number) => ((v - min) / (max - min)) * 100
  const from = Math.min(pct(origin ?? min), pct(value))
  const to = Math.max(pct(origin ?? min), pct(value))
  return (
    <div>
      <input
        type="range"
        className="hs-range"
        aria-label={label}
        aria-describedby={describedBy}
        aria-valuetext={format ? format(value) : undefined}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ '--from': `${from}%`, '--to': `${to}%` } as CSSProperties}
      />
      {ticks && (
        <div className="relative mt-0.5 h-4 text-[0.6875rem] font-bold text-muted" aria-hidden="true">
          {ticks.map((t) => (
            <span
              key={t.value}
              className="absolute -translate-x-1/2 whitespace-nowrap first:translate-x-0 last:-translate-x-full"
              style={{ left: `${pct(t.value)}%` }}
            >
              {t.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: ReactNode }) {
  const id = useId()
  return (
    <div className="flex items-start gap-3">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-950',
          checked ? 'bg-forest-950' : 'bg-sand-400',
        )}
      >
        <span className={cx('absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow-hairline transition-transform duration-300', checked && 'translate-x-5')} />
      </button>
      <label htmlFor={id} className="min-w-0 cursor-pointer">
        <span className="block text-[0.9375rem] font-extrabold text-forest-950">{label}</span>
        {description && <span className="mt-0.5 block text-[0.8125rem] leading-snug text-ink">{description}</span>}
      </label>
    </div>
  )
}

export function Callout({ tone = 'info', title, children, className }: { tone?: 'info' | 'warn' | 'plain'; title?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        'flex gap-2.5 rounded-2xl p-4 text-[0.875rem] leading-snug ring-1',
        tone === 'info' && 'bg-peri-50 text-ink ring-peri',
        tone === 'warn' && 'bg-signal-50 text-ink ring-signal/30',
        tone === 'plain' && 'bg-sand/70 text-ink ring-transparent',
        className,
      )}
    >
      {tone === 'warn' ? (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-signal-ink" aria-hidden="true" />
      ) : (
        <Info className={cx('mt-0.5 h-4 w-4 shrink-0', tone === 'info' ? 'text-peri-ink' : 'text-forest-800')} aria-hidden="true" />
      )}
      <div className="min-w-0">
        {title && <p className="font-extrabold text-forest-950">{title}</p>}
        <div className={cx(!!title && 'mt-0.5')}>{children}</div>
      </div>
    </div>
  )
}

/** A mascot with a short speech bubble: the workspace's quiet helper. */
export function MascotNote({ mascot = 'mint', children, className }: { mascot?: 'mint' | 'blue'; children: ReactNode; className?: string }) {
  return (
    <div className={cx('flex items-end gap-2.5', className)}>
      <Mascot name={mascot} decorative className="w-14 shrink-0 sm:w-16" sizes="64px" />
      <p className="mb-2 rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 text-[0.8125rem] leading-snug font-semibold text-forest-950 shadow-hairline ring-1 ring-border">
        {children}
      </p>
    </div>
  )
}

export function Card({ children, className, as: Tag = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'section' | 'article' }) {
  return <Tag className={cx('rounded-[1.5rem] bg-white p-5 shadow-hairline ring-1 ring-border sm:p-6', className)}>{children}</Tag>
}
