import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'
import { SECTIONS, type SectionId } from './engineFacts'

/** One lettered section of the page. The heading takes focus when it is reached from the section list. */
export function ScienceSection({ id, title, intro, children, tone = 'plain' }: { id: SectionId; title: string; intro: ReactNode; children: ReactNode; tone?: 'plain' | 'caution' }) {
  const meta = SECTIONS.find((s) => s.id === id)
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-[calc(var(--sci-offset,7rem)+1rem)]">
      <header
        className={cx(
          'mb-5 flex items-start gap-3.5 border-t-2 pt-6',
          tone === 'caution' ? 'border-signal-600' : 'border-forest-950',
        )}
      >
        <span
          aria-hidden="true"
          className={cx(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-display text-[1.0625rem] font-semibold',
            tone === 'caution' ? 'bg-signal-50 text-signal-ink ring-1 ring-signal/30' : 'bg-forest-950 text-lime',
          )}
        >
          {meta?.letter}
        </span>
        <div className="min-w-0 max-w-3xl">
          <h2 id={`${id}-title`} tabIndex={-1} className="text-[1.5rem] leading-tight tracking-[-0.02em] focus:outline-none sm:text-[1.75rem]">
            {title}
          </h2>
          <p className="mt-1.5 text-[1rem] leading-relaxed text-ink">{intro}</p>
        </div>
      </header>
      <div className="space-y-5">{children}</div>
    </section>
  )
}

/** A formula exactly as it is written in docs/METHODOLOGY.md or the engine code. */
export function Formula({ children, source, className }: { children: ReactNode; source?: string; className?: string }) {
  return (
    <div className={cx('rounded-xl bg-sand/70 px-3.5 py-2.5', className)}>
      <p className="font-mono text-[0.8125rem] leading-relaxed font-semibold break-words text-forest-950">{children}</p>
      {source && <p className="mt-1 text-[0.75rem] leading-snug text-ink">{source}</p>}
    </div>
  )
}

/** The engine file a statement can be checked against. */
export function FileRef({ children }: { children: ReactNode }) {
  return <code className="rounded-md bg-sand px-1.5 py-0.5 font-mono text-[0.75rem] font-semibold break-words text-forest-950">{children}</code>
}

/** Small uppercase label above a group. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx('text-[0.6875rem] font-extrabold tracking-[0.08em] text-muted uppercase', className)}>{children}</p>
}

/** A term with its plain description, used in definition lists. */
export function Fact({ term, children }: { term: ReactNode; children: ReactNode }) {
  return (
    <div className="grid gap-x-4 gap-y-0.5 py-2.5 first:pt-0 last:pb-0 sm:grid-cols-[9.5rem_minmax(0,1fr)]">
      <dt className="text-[0.8125rem] font-extrabold text-forest-950">{term}</dt>
      <dd className="text-[0.875rem] leading-snug text-ink">{children}</dd>
    </div>
  )
}

export function FactList({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cx('divide-y divide-border', className)}>{children}</dl>
}

/** A quiet tile inside a panel. */
export function Tile({ title, children, className, tone = 'sand' }: { title?: ReactNode; children: ReactNode; className?: string; tone?: 'sand' | 'lime' | 'peri' | 'white' | 'signal' }) {
  return (
    <div
      className={cx(
        'rounded-2xl p-4',
        tone === 'sand' && 'bg-sand/60',
        tone === 'lime' && 'bg-lime-100 ring-1 ring-forest-950/10',
        tone === 'peri' && 'bg-peri-50 ring-1 ring-peri',
        tone === 'white' && 'bg-white ring-1 ring-border',
        tone === 'signal' && 'bg-signal-50 ring-1 ring-signal/30',
        className,
      )}
    >
      {title && <h4 className="font-display text-[1rem] leading-snug font-semibold text-forest-950">{title}</h4>}
      <div className={cx('text-[0.875rem] leading-relaxed text-ink', !!title && 'mt-1.5')}>{children}</div>
    </div>
  )
}

/** Numbered steps, in order. */
export function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="space-y-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 text-[0.9375rem] leading-relaxed text-ink">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-forest-950 font-display text-[0.75rem] font-semibold text-lime tabular-nums" aria-hidden="true">
            {i + 1}
          </span>
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ol>
  )
}

export function Bullets({ items, className }: { items: ReactNode[]; className?: string }) {
  return (
    <ul className={cx('space-y-1.5 text-[0.875rem] leading-relaxed text-ink', className)}>
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5">
          <span aria-hidden="true" className="mt-[0.55rem] h-1.5 w-1.5 shrink-0 rounded-full bg-forest-800" />
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ul>
  )
}

/** Diagram frame with a caption that says in words what the picture shows. */
export function Figure({ children, caption, className }: { children: ReactNode; caption: ReactNode; className?: string }) {
  return (
    <figure className={cx('rounded-2xl bg-cream-50 p-3 ring-1 ring-border sm:p-4', className)}>
      {children}
      <figcaption className="mt-2.5 text-[0.8125rem] leading-snug text-ink">{caption}</figcaption>
    </figure>
  )
}
