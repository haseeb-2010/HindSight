import { useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { usePrefersReducedMotion } from '../../hooks/useMotion'
import { MascotNote } from '../components/controls'
import { hasLocation } from '../lib/config'
import { ResultsView, isTabId, type TabId } from '../results/ResultsView'
import { RunProgress } from '../results/RunProgress'
import { useWorkspace } from '../state/workspace'
import { FieldStep } from '../steps/FieldStep'
import { PrioritiesStep } from '../steps/PrioritiesStep'
import { ReviewStep } from '../steps/ReviewStep'
import { RotationStep } from '../steps/RotationStep'
import { ScenarioStep } from '../steps/ScenarioStep'
import { SoilWaterStep } from '../steps/SoilWaterStep'
import { StepNav } from '../steps/StepNav'
import { STEP_IDS, isStepId, stepIssues, type StepId } from '../steps/steps'

export function AnalysisPage() {
  const ws = useWorkspace()
  const { config, current, presets, crops, selectPreset, run } = ws
  const [params, setParams] = useSearchParams()
  const reduced = usePrefersReducedMotion()
  const located = hasLocation(config)
  const issues = stepIssues(config, crops.data?.limits)

  const asked = params.get('step')
  let step: StepId = isStepId(asked) ? asked : current ? 'results' : 'field'
  if (!located && step !== 'field') step = 'field'
  if (step === 'results' && !current && run.status === 'idle') step = located ? 'review' : 'field'
  const tabParam = params.get('tab')
  const tab: TabId = isTabId(tabParam) ? tabParam : 'overview'

  const go = useCallback(
    (next: StepId, nextTab?: TabId) => {
      setParams(next === 'results' && nextTab && nextTab !== 'overview' ? { step: next, tab: nextTab } : { step: next })
      window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })
      // move focus to the new step's heading so keyboard and screen-reader users land in the right place
      window.setTimeout(() => document.querySelector<HTMLElement>('#step-title, #results-title')?.focus({ preventScroll: true }), 80)
    },
    [setParams, reduced],
  )

  // Deep link from the homepage: /app/analysis?preset=chakwal selects that demonstration farm.
  const presetParam = params.get('preset')
  useEffect(() => {
    if (!presetParam || presets.status !== 'ready') return
    const p = presets.data.presets.find((x) => x.id === presetParam)
    if (p) selectPreset(p)
    setParams({ step: 'field' }, { replace: true })
  }, [presetParam, presets.status, presets.data, selectPreset, setParams])

  const index = STEP_IDS.indexOf(step)
  const back = () => go(STEP_IDS[Math.max(0, index - 1)])
  const next = () => go(STEP_IDS[Math.min(STEP_IDS.length - 1, index + 1)])

  return (
    // grid-cols-1 is minmax(0,1fr): on phones the column must not grow to fit the sideways-scrolling
    // step strip (about 1000px of pills), or every step and results tab is wider than the screen.
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[16.5rem_minmax(0,1fr)] lg:gap-8 print:block">
      <StepNav active={step} issues={issues} locked={!located} hasResults={!!current} stale={ws.stale} onGo={(s) => go(s)} />
      <div className="min-w-0">
        {step === 'field' && <FieldStep onNext={() => (issues.field ? undefined : next())} issue={issues.field} />}
        {step === 'soil' && <SoilWaterStep onBack={back} onNext={() => (issues.soil ? undefined : next())} issue={issues.soil} />}
        {step === 'rotation' && <RotationStep onBack={back} onNext={() => (issues.rotation ? undefined : next())} issue={issues.rotation} />}
        {step === 'priorities' && <PrioritiesStep onBack={back} onNext={next} />}
        {step === 'scenario' && <ScenarioStep onBack={back} onNext={next} />}
        {step === 'review' && <ReviewStep onBack={back} onGo={(s) => go(s)} onDone={() => go('results')} issues={issues} />}
        {step === 'results' &&
          (current ? (
            <ResultsView analysis={current} tab={tab} onTab={(t) => setParams(t === 'overview' ? { step: 'results' } : { step: 'results', tab: t }, { replace: true })} onEdit={() => go('review')} />
          ) : run.status !== 'idle' ? (
            <RunProgress run={run} onRetry={() => ws.analyse()} onCancel={ws.cancelRun} onEdit={() => go('review')} />
          ) : (
            <div className="flex flex-col items-start gap-4 rounded-[1.5rem] bg-white p-8 ring-1 ring-border">
              <MascotNote mascot="blue">No analysis yet. Review your settings and run one to see results here.</MascotNote>
              <Button arrow onClick={() => go('review')}>
                Review settings
              </Button>
            </div>
          ))}
      </div>
    </div>
  )
}
