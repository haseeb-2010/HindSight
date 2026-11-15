import { ArrowRight, LoaderCircle } from 'lucide-react'
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps as RouterLinkBaseProps } from 'react-router-dom'
import { cx } from '../../lib/cx'

type Variant = 'primary' | 'accent' | 'secondary' | 'ghostDark'
type Size = 'md' | 'lg'

const base =
  'group/btn relative inline-flex select-none items-center justify-center gap-3 rounded-full font-sans font-bold ' +
  'whitespace-nowrap transition-[background-color,color,box-shadow,transform,border-color] duration-300 ease-(--ease-soft) ' +
  'active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-55 disabled:active:scale-100 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-3'

const variants: Record<Variant, string> = {
  primary:
    'bg-primary text-primary-foreground shadow-[0_10px_24px_-10px_rgb(28_58_42/0.55)] hover:bg-primary-hover ' +
    'hover:shadow-[0_16px_32px_-12px_rgb(28_58_42/0.6)] focus-visible:outline-forest-950',
  accent:
    'bg-lime text-forest-950 shadow-[0_10px_30px_-12px_rgb(238_243_132/0.6)] hover:bg-[#f3f79e] focus-visible:outline-lime',
  secondary:
    'bg-surface text-forest-950 border border-border-strong/80 shadow-hairline hover:border-forest-950/40 ' +
    'hover:shadow-soft focus-visible:outline-forest-950',
  ghostDark:
    'bg-white/5 text-cream-50 border border-white/20 hover:bg-white/10 hover:border-white/35 focus-visible:outline-lime',
}

const arrowBubble: Record<Variant, string> = {
  primary: 'bg-lime text-forest-950',
  accent: 'bg-forest-950 text-lime',
  secondary: 'bg-sand text-forest-950',
  ghostDark: 'bg-white/15 text-cream-50',
}

const sizes: Record<Size, { plain: string; arrow: string; bubble: string }> = {
  md: { plain: 'h-11 px-5 text-[0.9375rem]', arrow: 'h-11 pl-5 pr-1.5 text-[0.9375rem]', bubble: 'h-8 w-8' },
  lg: { plain: 'h-14 px-7 text-base', arrow: 'h-14 pl-6 pr-2 text-base', bubble: 'h-10 w-10' },
}

interface CommonProps {
  variant?: Variant
  size?: Size
  arrow?: boolean
  icon?: ReactNode
  loading?: boolean
  children: ReactNode
}

function Inner({ variant = 'primary', size = 'md', arrow, icon, loading, children }: CommonProps) {
  return (
    <>
      {icon && !loading && <span className="-ml-1 flex shrink-0 items-center [&>svg]:h-[1.1em] [&>svg]:w-[1.1em]">{icon}</span>}
      {loading && <LoaderCircle aria-hidden="true" className="-ml-1 h-[1.1em] w-[1.1em] animate-spin" />}
      <span>{children}</span>
      {arrow && (
        <span
          aria-hidden="true"
          className={cx(
            'flex shrink-0 items-center justify-center rounded-full transition-transform duration-300 ease-(--ease-soft)',
            'group-hover/btn:translate-x-0.5',
            arrowBubble[variant],
            sizes[size].bubble,
          )}
        >
          <ArrowRight className="h-[1.05em] w-[1.05em] transition-transform duration-300 group-hover/btn:-rotate-45" strokeWidth={2.4} />
        </span>
      )}
    </>
  )
}

function classes(variant: Variant, size: Size, arrow: boolean | undefined, className?: string) {
  return cx(base, variants[variant], arrow ? sizes[size].arrow : sizes[size].plain, className)
}

type ButtonProps = CommonProps & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>

export function Button({ variant = 'primary', size = 'md', arrow, icon, loading, children, className, disabled, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled}
      aria-busy={loading || undefined}
      className={classes(variant, size, arrow, className)}
    >
      <Inner variant={variant} size={size} arrow={arrow} icon={icon} loading={loading}>
        {children}
      </Inner>
    </button>
  )
}

type LinkProps = CommonProps & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children'>

export function ButtonLink({ variant = 'primary', size = 'md', arrow, icon, children, className, ...rest }: LinkProps) {
  return (
    <a {...rest} className={classes(variant, size, arrow, className)}>
      <Inner variant={variant} size={size} arrow={arrow} icon={icon}>
        {children}
      </Inner>
    </a>
  )
}

type RouterLinkProps = CommonProps & Omit<RouterLinkBaseProps, 'children'>

/** Same look as ButtonLink, for in-app routes (no full page load). */
export function ButtonRouterLink({ variant = 'primary', size = 'md', arrow, icon, children, className, ...rest }: RouterLinkProps) {
  return (
    <Link {...rest} className={classes(variant, size, arrow, className)}>
      <Inner variant={variant} size={size} arrow={arrow} icon={icon}>
        {children}
      </Inner>
    </Link>
  )
}
