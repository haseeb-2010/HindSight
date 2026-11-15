import { Menu, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Logo } from '../components/brand/Logo'
import { ButtonRouterLink } from '../components/ui/Button'
import { useScrolled, useScrollSpy } from '../hooks/useScroll'
import { cx } from '../lib/cx'

const NAV = [
  { id: 'top', label: 'Home' },
  { id: 'how-it-works', label: 'How It Works' },
  { id: 'explore', label: 'Explore Farms' },
  { id: 'science', label: 'Data & Science' },
  { id: 'about', label: 'About' },
]
// Page order of the sections, for the scroll spy.
const SPY = ['top', 'about', 'how-it-works', 'explore', 'science']

export function Header() {
  const scrolled = useScrolled(24)
  const active = useScrollSpy(SPY)
  const [open, setOpen] = useState(false)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const first = panelRef.current?.querySelector<HTMLElement>('a')
    first?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        toggleRef.current?.focus()
      }
    }
    const onResize = () => window.innerWidth >= 1024 && setOpen(false)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
    }
  }, [open])

  const elevated = scrolled || open

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:pt-4">
      <a
        href="#main"
        className="sr-only rounded-full bg-forest-950 px-4 py-2 font-bold text-cream-50 focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50"
      >
        Skip to content
      </a>
      <div
        className={cx(
          'relative mx-auto flex items-center justify-between gap-4 border transition-[max-width,background-color,border-color,box-shadow,padding,border-radius] duration-500 ease-(--ease-soft)',
          elevated
            ? 'max-w-[68rem] rounded-full border-forest-950/[0.08] bg-cream-50/88 py-2 pr-2 pl-5 shadow-soft backdrop-blur-xl backdrop-saturate-150'
            : 'max-w-[80rem] rounded-full border-transparent px-4 py-3 sm:px-6 lg:px-8',
        )}
      >
        <a href="#top" aria-label="HindSight, back to top" className="shrink-0 rounded-lg" onClick={() => setOpen(false)}>
          <Logo />
        </a>

        <nav aria-label="Primary" className="hidden lg:block">
          <ul className="flex items-center gap-0.5 xl:gap-1">
            {NAV.map((item) => {
              const isActive = active === item.id
              return (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    aria-current={isActive ? 'location' : undefined}
                    className={cx(
                      'relative block rounded-full px-3.5 py-2 text-[0.9375rem] font-bold transition-colors duration-300',
                      isActive ? 'bg-forest-950/[0.07] text-forest-950' : 'text-forest-950/70 hover:bg-forest-950/[0.04] hover:text-forest-950',
                    )}
                  >
                    {item.label}
                  </a>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden sm:block">
            <ButtonRouterLink to="/app/analysis" arrow>
              Explore Your Field
            </ButtonRouterLink>
          </div>
          <button
            ref={toggleRef}
            type="button"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((o) => !o)}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-forest-950/10 bg-white/70 text-forest-950 transition-colors hover:bg-white lg:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        aria-hidden="true"
        onClick={() => setOpen(false)}
        className={cx(
          'fixed inset-0 -z-10 bg-forest-950/25 backdrop-blur-[2px] transition-opacity duration-300 lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />
      <div
        id="mobile-menu"
        ref={panelRef}
        hidden={!open}
        className="animate-pop mx-auto mt-2 max-w-[68rem] rounded-[1.75rem] border border-forest-950/[0.08] bg-cream-50 p-3 shadow-float lg:hidden"
      >
        <nav aria-label="Mobile">
          <ul className="flex flex-col">
            {NAV.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  onClick={() => setOpen(false)}
                  aria-current={active === item.id ? 'location' : undefined}
                  className={cx(
                    'flex items-center justify-between rounded-2xl px-4 py-3.5 font-display text-xl font-semibold text-forest-950 transition-colors',
                    active === item.id ? 'bg-sand' : 'hover:bg-sand/60',
                  )}
                >
                  {item.label}
                  {active === item.id && <span aria-hidden="true" className="h-2 w-2 rounded-full bg-forest-950" />}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <ButtonRouterLink to="/app/analysis" arrow size="lg" className="mt-3 w-full justify-between" onClick={() => setOpen(false)}>
          Explore Your Field
        </ButtonRouterLink>
      </div>
    </header>
  )
}
