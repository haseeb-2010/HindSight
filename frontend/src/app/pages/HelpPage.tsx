import { Sparkles } from 'lucide-react'
import { ButtonRouterLink } from '../../components/ui/Button'
import { Mascot } from '../../components/ui/Mascot'
import { Card, MascotNote } from '../components/controls'
import { Accordion } from '../results/ProvenanceTab'
import { TIP } from '../results/shared'

const HOW: [string, string][] = [
  ['Choose your field', 'Pick one of the three demonstration farms, or search for a place, type coordinates, or click the map. HindSight analyses one point, not a field boundary.'],
  ['Describe soil and water', 'Accept the SoilGrids suggestion if there is one, or choose a texture yourself. Say whether the field is rainfed, fully irrigated or has a limited allowance.'],
  ['Enter your current rotation', 'Add each crop with its sowing date. The calendar shows how the engine places them through the year and warns if seasons overlap.'],
  ['Set your priorities', 'Move the seven sliders. They change how rotations are ranked against each other, not the simulation itself.'],
  ['Optional: scenario and advanced settings', 'Test a warmer, cooler, wetter or drier version of the past record, or adjust assumptions. These are what-if checks on history, not forecasts.'],
  ['Review, run and explore', 'Check the summary, run the analysis and move through the result tabs. Change any setting and rerun whenever you like.'],
  ['Read the findings', 'Field Intelligence explains the analysis in plain language: how local conditions changed, when the soil is bare, which rotations held up in hard years, and the water and soil-care trade-offs.'],
  ['Test what-ifs and take the brief with you', 'The Scenario Lab re-runs the engine with warmer or drier versions of the past record. The Decision Brief gathers the evidence, trade-offs and local checks on one page you can print or save as a PDF.'],
]

const QA: [string, string][] = [
  [
    'How long does an analysis take?',
    'A demonstration farm takes a few seconds, because its weather is already stored. A custom field first downloads 41 years of daily weather from NASA POWER, which usually takes under a minute but can take longer if the service is busy. After the first run for a location, the weather is kept and later runs are fast.',
  ],
  [
    'Why are some crops missing from the list?',
    'HindSight only offers crops whose values have been checked against a published source, including a yield-response factor. Rice, chickpea, mung bean, pearl millet and mustard are not offered yet for that reason.',
  ],
  [
    'Is the top-ranked rotation the one I should grow?',
    'Not necessarily. The ranking compares only the rotations evaluated, using your weights, on a model that leaves out pests, disease, nutrients, prices and management. Use it as evidence to weigh alongside your own knowledge and local advice.',
  ],
  [
    'What does “these results are from your previous settings” mean?',
    'You changed an input after the analysis ran. The results on screen still belong to the earlier settings until you choose Rerun analysis.',
  ],
  [
    'Are my analyses saved?',
    'Yes, on this device only. Each finished analysis is kept in this browser’s storage and listed under My Analyses, where you can rename, compare, export or delete it. There are no accounts and nothing is synchronised to other devices, so clearing your browser data removes them: export the JSON first if you want to keep one.',
  ],
  [
    'Are the Scenario Lab results climate forecasts?',
    'No. A scenario adds the same temperature offset to every day of the 1985–2024 record, or multiplies every day’s rain by the same factor, and replays the rotations through that adjusted past. It does not simulate future weather timing or changing rainfall patterns. Use it as a stress test of how sensitive the ranking is.',
  ],
  [
    'What is the difference between a live analysis and a saved demonstration result?',
    'A live analysis was calculated by the engine when you asked for it. A saved demonstration result is engine output that was generated earlier from the same stored NASA data and is shown as-is. HindSight always labels which one you are looking at.',
  ],
  [
    'What if SoilGrids or the weather service is unavailable?',
    'SoilGrids is optional: enter the soil yourself and carry on. If NASA POWER cannot be reached for a custom field, the analysis stops with a message and you can try again; nothing is invented in its place.',
  ],
]

const GLOSSARY: [string, string][] = [
  ['Season index (S)', TIP.index],
  ['Median season index', TIP.median],
  ['Lower-decile index (P10)', TIP.p10],
  ['Failure frequency', TIP.failure(null)],
  ['Crop water demand', TIP.water],
  ['Irrigation requirement', TIP.irrigation],
  ['Soil cover', TIP.cover],
  ['Heavy rain on bare soil', TIP.erosion],
  ['Pareto efficient', TIP.pareto],
  ['Rank ranges', `${TIP.robustLegume} ${TIP.robustRain}`],
]

export function HelpPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-3xl">
          <h1 className="text-[1.875rem] leading-[1.08] tracking-[-0.03em] sm:text-[2.375rem]">Help</h1>
          <p className="mt-2.5 text-[1.0625rem] leading-relaxed text-muted">How to run an analysis, what the terms mean, and answers to common questions.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonRouterLink to="/app?tour=1" variant="secondary" icon={<Sparkles />} data-tour-replay-link>
            Take a tour
          </ButtonRouterLink>
          <ButtonRouterLink to="/app/demo" variant="secondary">
            Guided Tour of an analysis
          </ButtonRouterLink>
          <ButtonRouterLink to="/app/analysis" arrow>
            Go to Farm Analysis
          </ButtonRouterLink>
        </div>
      </div>

      <section className="flex flex-col gap-4 rounded-[1.5rem] bg-lime-100 p-5 ring-1 ring-forest-950/10 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-center gap-4">
          <Mascot name="blue" decorative className="w-16 shrink-0" sizes="64px" />
          <div>
            <h2 className="text-[1.25rem] leading-tight">Need a refresher? Take the tour again.</h2>
            <p className="mt-1 max-w-2xl text-[0.9375rem] text-ink">
              The dashboard tour takes about a minute: the blue mascot walks you through your field, the climate patterns, the rotation comparison, your priorities, the
              Scenario Lab and the Decision Brief. Replaying it changes nothing in your farm settings or analyses.
            </p>
          </div>
        </div>
        <ButtonRouterLink to="/app?tour=1" arrow className="shrink-0 self-start sm:self-center">
          Take a tour
        </ButtonRouterLink>
      </section>

      <Card as="section">
        <h2 className="text-[1.375rem]">Running an analysis</h2>
        <ol className="mt-4 grid gap-x-8 gap-y-4 md:grid-cols-2">
          {HOW.map(([title, body], i) => (
            <li key={title} className="flex gap-3.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-forest-950 font-display text-[0.8125rem] font-semibold text-lime tabular-nums">{i + 1}</span>
              <div>
                <h3 className="text-[1.0625rem]">{title}</h3>
                <p className="mt-0.5 text-[0.9375rem] leading-snug text-ink">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-[1.375rem]">Common questions</h2>
          <div className="space-y-2">
            {QA.map(([q, a], i) => (
              <Accordion key={q} title={q} open={i === 0}>
                <p>{a}</p>
              </Accordion>
            ))}
          </div>
        </section>
        <section>
          <h2 className="mb-3 text-[1.375rem]">Terms used in the results</h2>
          <dl className="divide-y divide-border rounded-2xl bg-white px-4 ring-1 ring-border">
            {GLOSSARY.map(([term, def]) => (
              <div key={term} className="py-3">
                <dt className="font-display text-[1rem] font-semibold text-forest-950">{term}</dt>
                <dd className="mt-0.5 text-[0.9375rem] leading-snug text-ink">{def}</dd>
              </div>
            ))}
          </dl>
          <MascotNote mascot="blue" className="mt-4">
            Inside the workspace, the small ⓘ buttons explain each term right where you meet it.
          </MascotNote>
        </section>
      </div>
    </div>
  )
}
