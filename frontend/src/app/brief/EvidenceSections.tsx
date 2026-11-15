// Sections 5 to 7 of the Decision Brief: evidence and limits, the local verification checklist and the disclaimer.
import { fmtNum, fmtP, isNum } from '../../lib/format'
import type { AnalysisEnvelope } from '../../lib/types'
import { scenarioText } from '../lib/config'
import { PROVENANCE_KINDS, textureLabel } from '../lib/labels'
import { CITATIONS, LIMITS } from '../results/ProvenanceTab'
import { BASIS_LABELS, buildChecklist, mergedSentences } from './checklist'
import { BRIEF_DISCLAIMER, Bullets, Fact, NA, Section, Sub, type BriefData } from './parts'

/* ------------------------------------------------------------------ 5. evidence and limitations */

function soilStatus(env: AnalysisEnvelope): string[] {
  const used = env.result.site.soil_used?.source ?? env.inputs?.soil?.used
  const sg = env.inputs?.soil?.soilgrids
  const profile = env.inputs?.soil?.profile
  const out = [
    used === 'soilgrids'
      ? 'The soil values came from a SoilGrids profile for this location: an estimate for the top 30 cm of a 250 m grid square.'
      : used === 'farmer'
        ? 'The soil texture, organic matter level and depth were entered by the farmer.'
        : used === 'default'
          ? 'No soil information was given, so the engine used its default soil.'
          : 'The soil source was not recorded with this analysis.',
  ]
  if (sg === 'profile' && used !== 'soilgrids') out.push(`A SoilGrids profile is stored for this location${profile?.texture_class ? ` (${textureLabel(profile.texture_class).toLowerCase()})` : ''}, but this run used the values entered in the form.`)
  else if (sg === 'no_data') out.push('SoilGrids holds no data for this location.')
  else if (sg === 'unavailable') out.push('A SoilGrids profile was requested but could not be retrieved when the analysis ran.')
  else if (sg === 'not_cached') out.push('No SoilGrids profile is stored for this location.')
  else if (sg === 'not_requested') out.push('A SoilGrids profile was not requested for this run.')
  else if (!sg) out.push('The SoilGrids status was not recorded with this analysis.')
  return out
}

export function EvidenceSection({ d }: { d: BriefData }) {
  const { env, res, cur, alts, names } = d
  const req = env.request
  const rec = res.meta.record
  const climate = env.inputs?.climate
  const ndvi = env.inputs?.ndvi
  const check = res.validation?.ndvi_check
  const prov = res.provenance ?? []
  const about = [...(cur ? [cur] : []), ...alts]
  // The engine repeats one method sentence per rotation with that rotation's own figure; one instance is enough here.
  const evidence = mergedSentences(about, (r) => r.explanation?.evidence, true)
  const gaps = mergedSentences(about, (r) => r.explanation?.gaps)
  const notes = [...(env.notes ?? []), ...(res.meta.warnings ?? [])]
  const opts = req?.options
  const excluded = req?.constraints?.excluded_crops ?? []
  const scoped = (s: { text: string; scope: string | null }) => (
    <>
      {s.text}
      {s.scope && <span className="text-muted"> (for {s.scope})</span>}
    </>
  )
  return (
    <Section n={5} title="Evidence and limitations" lead="Where the numbers in this brief came from, what was checked against independent data, and what the model cannot tell you.">
      <Sub title="Data used in this run">
        {prov.length ? (
          <>
          <p className="mb-2 text-[0.75rem] font-bold text-ink md:hidden print:hidden">Scroll the table sideways to see every column.</p>
          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full min-w-[34rem] border-collapse text-left text-[0.8125rem] print:min-w-0">
              <caption className="sr-only">Where each part of the analysis came from, as reported by the engine</caption>
              <thead>
                <tr className="text-[0.75rem] text-muted">
                  {['Part of the analysis', 'Kind', 'Source'].map((c) => (
                    <th key={c} scope="col" className="border-b border-border-strong py-2 pr-3 font-bold">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {prov.map((p) => (
                  <tr key={p.item} className="break-inside-avoid border-b border-border">
                    <th scope="row" className="py-2.5 pr-3 align-top font-bold text-forest-950">
                      {p.item}
                    </th>
                    <td className="py-2.5 pr-3 align-top font-semibold text-ink">{PROVENANCE_KINDS[p.kind]?.label ?? p.kind.replace(/_/g, ' ')}</td>
                    <td className="py-2.5 align-top text-ink">{p.source === 'farmer' ? 'Entered by the farmer' : p.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        ) : (
          <p className="text-[0.9375rem] text-ink">The engine did not return a list of data sources for this analysis.</p>
        )}
      </Sub>

      <dl className="grid gap-x-10 gap-y-5 md:grid-cols-2 print:grid-cols-2">
        <Fact label="Weather record">
          {climate ? (
            <>
              {climate.source ?? 'NASA POWER'}
              <span className="mt-0.5 block text-[0.8125rem] font-semibold text-ink tabular-nums">
                {climate.start && climate.end ? `Daily data from ${climate.start} to ${climate.end}` : 'Dates not recorded'}
                {isNum(climate.days) ? ` · ${fmtNum(climate.days)} daily records` : ''}
                {climate.grid_note ? ` · ${climate.grid_note}` : ''}
              </span>
            </>
          ) : (
            <span className="font-semibold text-ink">The weather inputs were not recorded with this analysis.</span>
          )}
        </Fact>
        <Fact label="Historical period analysed">
          <span className="tabular-nums">
            {rec.start_year}–{rec.end_year} ({rec.end_year - rec.start_year + 1} years)
          </span>
          {climate?.start && Number(climate.start.slice(0, 4)) < rec.start_year && (
            <span className="mt-0.5 block text-[0.8125rem] font-semibold text-ink">Earlier days in the weather record only warm up the soil-water balance.</span>
          )}
        </Fact>
        <Fact label="Soil-source status">
          <span className="block text-[0.875rem] font-semibold text-ink">{soilStatus(env).join(' ')}</span>
        </Fact>
        <Fact label="Scenario">
          {d.scenarioOn ? (
            <>
              Hypothetical what-if adjustment: {scenarioText(req?.scenario)}
              <span className="mt-0.5 block text-[0.8125rem] font-semibold text-ink">Applied uniformly to every day of the historical record. Not a forecast.</span>
            </>
          ) : req?.scenario ? (
            'Historical baseline (no adjustment)'
          ) : (
            NA
          )}
        </Fact>
        <Fact label="Settings of this run" className="md:col-span-2 print:col-span-2">
          <span className="block text-[0.875rem] font-semibold text-ink tabular-nums">
            {opts
              ? [
                  isNum(opts.failure_threshold) ? `Failure line ${opts.failure_threshold.toFixed(2)}` : null,
                  opts.apply_legume_effect === false ? 'legume effect switched off' : opts.apply_legume_effect === true ? 'legume effect on (flat +20% on the next non-legume crop)' : null,
                  isNum(opts.top_n) ? `up to ${opts.top_n} alternatives requested` : null,
                  isNum(req?.constraints?.max_cycle_years) ? `cycles of up to ${req.constraints.max_cycle_years} years` : null,
                  excluded.length ? `crops excluded: ${excluded.map((c) => names[c] ?? c).join(', ')}` : 'no crop excluded',
                ]
                  .filter(Boolean)
                  .join(' · ')
              : 'The settings were not recorded with this analysis.'}
          </span>
        </Fact>
      </dl>

      <Sub title="Independent vegetation-greenness check (optional)">
        {check ? (
          <div className="text-[0.9375rem] leading-relaxed text-ink">
            <p>
              <strong className="font-extrabold text-forest-950 tabular-nums">
                Performed: r = {fmtNum(check.r, 2)} over {check.n_years} years ({fmtP(check.p_value)}).
              </strong>{' '}
              This is the correlation between peak MODIS greenness in the crop months and the current rotation’s yearly index. A value of +1 would mean they rise and fall together
              every year; 0 means no relationship.
            </p>
            {check.note && <p className="mt-1.5 text-[0.875rem] text-ink">Engine note: {check.note}</p>}
            {ndvi?.point && (
              <p className="mt-1.5 text-[0.8125rem] text-muted tabular-nums">
                NDVI pixel at {ndvi.point.lat.toFixed(2)}, {ndvi.point.lon.toFixed(2)}
                {ndvi.source ? ` · ${ndvi.source}` : ''}
                {isNum(ndvi.good_quality_observations) && isNum(ndvi.observations) ? ` · ${ndvi.good_quality_observations} good-quality observations of ${ndvi.observations}` : ''}.
              </p>
            )}
          </div>
        ) : (
          <p className="text-[0.9375rem] leading-relaxed text-ink">
            <strong className="font-extrabold text-forest-950">Not available for this analysis.</strong>{' '}
            {ndvi?.reason ??
              (ndvi?.used === false
                ? 'No MODIS NDVI series is stored for this location, so the optional check was skipped.'
                : 'The engine reports this check only when the season index varies from year to year and at least 8 years overlap with the satellite record.')}
          </p>
        )}
        <p className="mt-2 text-[0.8125rem] leading-snug text-muted">
          MODIS NDVI measures how green the vegetation is. It is not crop yield, one 250 m pixel can mix several fields, and the check never feeds back into the model.
        </p>
      </Sub>

      <div className="grid gap-x-10 gap-y-6 md:grid-cols-2 print:grid-cols-2">
        <Sub title="Methods, as reported by the engine">
          <Bullets items={evidence.map(scoped)} empty="The engine returned no method notes for these rotations." />
          <p className="mt-3 text-[0.8125rem] leading-snug text-muted">
            Each analysis also re-ranks the rotations with rainfall 30% lower and 30% higher, and with the legume effect at 0%, 7%, 20% and 32%
            {opts?.apply_legume_effect === false ? ' (skipped in this run: the legume effect was switched off)' : ''}. The rank ranges in section 4 come from those tests.
          </p>
        </Sub>
        <Sub title="Information gaps, as reported by the engine">
          <Bullets items={gaps.map(scoped)} empty="The engine returned no information gaps for these rotations." />
        </Sub>
      </div>

      {notes.length > 0 && (
        <Sub title="Notes returned with this run">
          <Bullets items={notes} />
        </Sub>
      )}

      <Sub title="What this analysis can and cannot tell you">
        <dl className="grid gap-x-10 gap-y-4 md:grid-cols-2 print:grid-cols-2">
          {LIMITS.map((l) => (
            <div key={l.title} className="min-w-0 break-inside-avoid">
              <dt className="text-[0.875rem] font-extrabold text-forest-950">{l.title}</dt>
              <dd className="mt-0.5 text-[0.8125rem] leading-snug text-ink">{l.body}</dd>
            </div>
          ))}
        </dl>
      </Sub>

      <Sub title="Source credits">
        <ul className="space-y-2.5 text-[0.8125rem] leading-snug text-ink">
          {CITATIONS.map((c) => (
            <li key={c.name} className="break-inside-avoid">
              <strong className="font-extrabold text-forest-950">{c.name}.</strong> {c.text}{' '}
              {c.href && (
                <a href={c.href} target="_blank" rel="noreferrer noopener" className="font-bold break-all text-forest-950 underline decoration-sage underline-offset-2 hover:decoration-forest-950">
                  {c.href.replace(/^https?:\/\//, '')}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[0.8125rem] leading-snug text-muted">HindSight uses these public datasets. It is not affiliated with or endorsed by NASA, ISRIC or FAO.</p>
      </Sub>
    </Section>
  )
}

/* ------------------------------------------------------------------ 6. local verification checklist */

export function VerificationChecklist({ d }: { d: BriefData }) {
  const { env, cur, alts, curIsTop, names } = d
  const leads = curIsTop && cur ? [cur, ...alts] : alts.length ? alts : cur ? [cur] : []
  const items = buildChecklist(env, leads, names, LIMITS.map((l) => l.title))
  return (
    <Section
      n={6}
      title="Local verification checklist"
      lead="Checks to make with people who know your land before changing a rotation. Each one names what it rests on: a sentence the engine returned, a documented limit of the model, or a value from this analysis."
    >
      {items.length === 0 ? (
        <p className="text-[0.9375rem] text-ink">The engine returned no local-review items for this analysis.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="break-inside-avoid rounded-2xl bg-sand/45 p-4 print:rounded-none print:border-b print:border-sand-300 print:bg-transparent print:px-0 print:py-3">
              <label className="flex cursor-pointer items-start gap-3 print:cursor-auto">
                <input type="checkbox" className="peer sr-only" />
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 border-forest-950 bg-white text-transparent transition-colors peer-checked:bg-forest-950 peer-checked:text-lime peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-forest-950"
                >
                  <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2.5 6.4l2.3 2.3 4.7-5.2" />
                  </svg>
                </span>
                <span className="min-w-0 font-display text-[1rem] leading-snug font-semibold text-forest-950">{item.check}</span>
              </label>
              <ul className="mt-2 space-y-1 pl-8 text-[0.8125rem] leading-snug text-ink">
                {item.basis.map((b, i) => (
                  <li key={i}>
                    <span className="font-extrabold text-forest-950">{BASIS_LABELS[b.kind]}:</span> {b.text}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[0.8125rem] leading-snug text-muted">
        The tick boxes are for your own use on screen or on paper. HindSight does not store them.
      </p>
    </Section>
  )
}

/* ------------------------------------------------------------------ 7. disclaimer */

export function DisclaimerSection() {
  return (
    <Section n={7} title="Disclaimer">
      <p data-brief-disclaimer className="break-inside-avoid rounded-2xl bg-sand/60 p-4 text-[1rem] leading-relaxed font-semibold text-forest-950 print:rounded-none print:border print:border-forest-950 print:bg-transparent">
        {BRIEF_DISCLAIMER}
      </p>
    </Section>
  )
}
