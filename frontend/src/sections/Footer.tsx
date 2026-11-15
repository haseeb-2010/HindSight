import { ArrowUpRight } from 'lucide-react'
import { Logo } from '../components/brand/Logo'

const NAV = [
  { href: '#top', label: 'Home' },
  { href: '#how-it-works', label: 'How It Works' },
  { href: '#explore', label: 'Explore Farms' },
  { href: '#science', label: 'Data & Science' },
  { href: '#about', label: 'About' },
]

// Credits and citations as given in docs/DATA_SOURCES.md.
const CREDITS = [
  {
    name: 'NASA POWER',
    href: 'https://power.larc.nasa.gov/',
    text: 'Daily weather data were obtained from the NASA Langley Research Center (LaRC) POWER Project, funded through the NASA Earth Science/Applied Science Program.',
  },
  {
    name: 'ISRIC SoilGrids',
    href: 'https://doi.org/10.5194/soil-7-217-2021',
    text: 'Soil properties from SoilGrids 2.0, ISRIC – World Soil Information (Poggio et al., 2021, SOIL 7, 217–240), licensed CC BY 4.0.',
  },
  {
    name: 'NASA MODIS / LP DAAC',
    href: 'https://doi.org/10.5067/MODIS/MOD13Q1.061',
    text: 'Vegetation index from MODIS/Terra MOD13Q1 v061 (Didan, 2021), NASA Land Processes DAAC, accessed through the ORNL DAAC subsetting service.',
  },
]

export function Footer({ engineVersion }: { engineVersion?: string }) {
  return (
    <footer className="on-dark bg-forest-950 text-mist">
      <div className="container-page border-t border-white/10 pt-14 pb-10">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.6fr)_minmax(0,1.7fr)]">
          <div>
            <a href="#top" aria-label="HindSight, back to top" className="inline-block rounded-lg">
              <Logo tone="dark" />
            </a>
            <p className="mt-5 max-w-[22rem] text-[0.9375rem] leading-relaxed">
              A farmer-centered tool that replays crop rotations through four decades of NASA Earth data, so rotation
              decisions can start from evidence.
            </p>
            <p className="mt-4 text-[0.8125rem] font-semibold text-sage">
              A NASA Space Apps Challenge 2026 project. Not affiliated with or endorsed by NASA.
            </p>
          </div>

          <nav aria-label="Footer">
            <h2 className="font-sans text-[0.75rem] font-extrabold tracking-[0.1em] text-sage uppercase">Explore</h2>
            <ul className="mt-4 space-y-2.5">
              {NAV.map((n) => (
                <li key={n.href}>
                  <a href={n.href} className="rounded text-[0.9375rem] font-bold text-cream-50 transition-colors hover:text-lime">
                    {n.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h2 className="font-sans text-[0.75rem] font-extrabold tracking-[0.1em] text-sage uppercase">Data acknowledgments</h2>
            <ul className="mt-4 space-y-4">
              {CREDITS.map((c) => (
                <li key={c.name} className="text-[0.8125rem] leading-relaxed">
                  <a
                    href={c.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 rounded font-display text-[0.9375rem] font-semibold text-cream-50 transition-colors hover:text-lime"
                  >
                    {c.name}
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                  <p className="mt-1">{c.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 rounded-2xl bg-white/[0.05] p-5 ring-1 ring-white/10">
          <p className="text-[0.8125rem] leading-relaxed text-cream-50/90">
            <strong className="font-extrabold text-lime">Disclaimer.</strong> HindSight is an experimental decision-support tool. Its
            results are historical model simulations and should not be treated as yield forecasts, guarantees, or substitutes for local
            agricultural expertise.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-2 text-[0.8125rem] font-semibold text-sage sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 HindSight</p>
          <p>{engineVersion ? `Engine v${engineVersion} · ` : ''}Historical analysis period 1985–2024</p>
        </div>
      </div>
    </footer>
  )
}
