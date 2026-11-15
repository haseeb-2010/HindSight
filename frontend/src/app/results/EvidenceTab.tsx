import { AlertCircle, BookOpenCheck, CheckCircle2, ListChecks, MessageSquareText } from 'lucide-react'
import type { ReactNode } from 'react'
import { rankedRotations, rotationLabel } from '../../lib/analysis'
import { cx } from '../../lib/cx'
import type { AnalysisEnvelope } from '../../lib/types'
import { Callout, MascotNote } from '../components/controls'
import { RotationBadges, RotationPicker } from './shared'

function Block({ icon, title, items, tone = 'white', empty, bullet }: { icon: ReactNode; title: string; items: string[] | undefined; tone?: 'white' | 'sand' | 'warn' | 'lime'; empty: string; bullet?: ReactNode }) {
  return (
    <section
      className={cx(
        'rounded-[1.5rem] p-5 ring-1',
        tone === 'white' && 'bg-white ring-border',
        tone === 'sand' && 'bg-sand/70 ring-transparent',
        tone === 'lime' && 'bg-lime-100 ring-forest-950/10',
        tone === 'warn' && 'bg-white ring-sand-400',
      )}
    >
      <h3 className="flex items-center gap-2 text-[1.125rem]">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-forest-950 text-lime">{icon}</span>
        {title}
      </h3>
      {items?.length ? (
        <ul className="mt-3 space-y-2 text-[0.9375rem] leading-snug text-ink">
          {items.map((t) => (
            <li key={t} className="flex gap-2.5">
              {bullet ?? <span aria-hidden="true" className="mt-[0.55rem] h-1.5 w-1.5 shrink-0 rounded-full bg-forest-800" />}
              <span>{t}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-[0.9375rem] text-muted">{empty}</p>
      )}
    </section>
  )
}

export function EvidenceTab({ env, selected, onSelect }: { env: AnalysisEnvelope; selected: string; onSelect: (id: string) => void }) {
  const all = rankedRotations(env.result)
  const rot = all.find((r) => r.id === selected) ?? all[0]
  if (!rot) return <Callout tone="warn">No rotation to explain.</Callout>
  const ex = rot.explanation

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[1.625rem] leading-tight tracking-[-0.02em]">Why did HindSight suggest these rotations?</h2>
        <p className="mt-1 mb-3 max-w-3xl text-[0.9375rem] text-muted">
          Every statement below is written by the engine from its own numbers, using fixed sentence templates. Nothing is added or left out to make a rotation look better.
        </p>
        <RotationPicker rotations={all} selected={rot.id} onSelect={onSelect} label="Rotation to explain" />
      </div>

      <section className="rounded-[1.5rem] bg-forest-950 p-5 text-cream-50 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="text-[0.75rem] font-extrabold tracking-[0.08em] text-sage uppercase">
            Rank #{rot.scores?.rank} of {all.length} {rot.is_current ? '· your current rotation' : '· alternative'}
          </p>
          <RotationBadges r={rot} compact />
        </div>
        <h3 className="mt-1.5 text-[1.5rem] leading-tight tracking-[-0.02em] text-cream-50">{rotationLabel(rot)}</h3>
        <p className="mt-3 max-w-3xl text-[1.0625rem] leading-relaxed text-cream-50/95">{ex?.summary ?? 'The engine did not return an explanation for this rotation.'}</p>
      </section>

      {ex && (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Block
              icon={<MessageSquareText className="h-4 w-4" aria-hidden="true" />}
              title={rot.is_current ? 'How it performed' : 'Why it was suggested'}
              items={ex.reasons}
              empty="No reasons were returned."
            />
            <Block
              icon={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
              title="Potential benefits"
              items={ex.benefits}
              tone="lime"
              empty="The engine found no specific advantage over the other rotations compared."
              bullet={<CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-forest-800" aria-hidden="true" />}
            />
            <Block icon={<BookOpenCheck className="h-4 w-4" aria-hidden="true" />} title="Supporting evidence" items={ex.evidence} tone="sand" empty="No supporting evidence was returned." />
            <Block
              icon={<AlertCircle className="h-4 w-4" aria-hidden="true" />}
              title="Information gaps"
              items={ex.gaps}
              tone="warn"
              empty="No gaps were listed."
              bullet={<AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-signal-ink" aria-hidden="true" />}
            />
          </div>
          <section className="rounded-[1.5rem] bg-white p-5 ring-1 ring-border sm:p-6">
            <div className="grid items-center gap-5 md:grid-cols-[minmax(0,1fr)_auto]">
              <div>
                <h3 className="flex items-center gap-2 text-[1.125rem]">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-forest-950 text-lime">
                    <ListChecks className="h-4 w-4" aria-hidden="true" />
                  </span>
                  What to check locally
                </h3>
                {ex.local_review?.length ? (
                  <ol className="mt-3 space-y-2 text-[0.9375rem] leading-snug text-ink">
                    {ex.local_review.map((t, i) => (
                      <li key={t} className="flex gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sand font-display text-[0.75rem] font-semibold text-forest-950 tabular-nums">{i + 1}</span>
                        <span>{t}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-3 text-[0.9375rem] text-muted">No local checks were listed.</p>
                )}
              </div>
              <MascotNote mascot="mint" className="md:max-w-[17rem]">
                The model cannot see your seed supply, your buyers or your pests. These are the next questions to take to someone who can.
              </MascotNote>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
