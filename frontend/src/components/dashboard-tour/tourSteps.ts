// The words of a tour live here, not in the components. A tour is an ordered list of steps;
// each step names the dashboard block it points at through that block's `data-tour` attribute.

export interface TourStep {
  id: string
  /**
   * Value of the `data-tour` attribute on the element to spotlight, or null for a step with no
   * target (welcome and finish), which is shown in the middle of the screen.
   */
  target: string | null
  heading: string
  body: string
  /** A short caution shown as a label under the text. */
  note?: string
  /** Label of the main button; defaults to "Next". */
  primary?: string
  /** `intro` and `finish` steps are not counted in "3 of 6". */
  kind?: 'intro' | 'finish'
}

/** The first-visit tour of the workspace dashboard (/app). About a minute to read. */
export const DASHBOARD_TOUR: TourStep[] = [
  {
    id: 'welcome',
    target: null,
    kind: 'intro',
    heading: 'Hey! Welcome to HindSight.',
    body: 'I’m your field companion. Let me give you a quick tour so you know where everything lives.',
    primary: 'Let’s go',
  },
  {
    id: 'farm',
    target: 'dashboard-overview',
    heading: 'First, meet your field.',
    body: 'Here’s your selected farm, its location, and the information HindSight uses to understand its growing conditions. No field yet? Pick a demonstration farm right here.',
  },
  {
    id: 'climate',
    target: 'climate-insights',
    heading: 'Look back at the weather.',
    body: 'See how rainfall, heat, frost and water demand have changed at your location across four decades of NASA weather data.',
  },
  {
    id: 'rotations',
    target: 'rotation-comparison',
    heading: 'Explore other possibilities.',
    body: 'Compare your current crop rotation with alternatives, and see their potential benefits and trade-offs side by side.',
  },
  {
    id: 'priorities',
    target: 'farmer-priorities',
    heading: 'Your farm, your priorities.',
    body: 'Tell HindSight what matters most: stability, water conservation, forage or soil care. Your choices change how the rotations are ranked.',
  },
  {
    id: 'scenarios',
    target: 'scenario-lab',
    heading: 'What if conditions changed?',
    body: 'Try a warmer or drier version of the historical weather and see how the rotation comparison responds.',
    note: 'Historical what-if scenarios, not forecasts.',
  },
  {
    id: 'brief',
    target: 'decision-brief',
    heading: 'Take the insights with you.',
    body: 'Review the evidence, understand the trade-offs, and export a report to discuss with your local agricultural experts.',
  },
  {
    id: 'finish',
    target: null,
    kind: 'finish',
    heading: 'You’re all set!',
    body: 'Your field has a story. Let’s make better-informed decisions with it.',
    primary: 'Explore HindSight',
  },
]

/** Position of a step among the counted steps, e.g. { n: 3, of: 6 }; null for intro and finish steps. */
export function stepCount(steps: TourStep[], index: number): { n: number; of: number } | null {
  if (!steps[index] || steps[index].kind) return null
  const counted = steps.filter((s) => !s.kind)
  return { n: counted.indexOf(steps[index]) + 1, of: counted.length }
}
