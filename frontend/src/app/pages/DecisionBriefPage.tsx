import { FileDown, FileJson, FlaskConical, Printer, Table2 } from 'lucide-react'
import { useEffect } from 'react'
import { Button, ButtonRouterLink } from '../../components/ui/Button'
import { AnalysisRequired } from '../components/AnalysisRequired'
import { Callout } from '../components/controls'
import { PageHeader } from '../components/PageHeader'
import { DecisionBrief } from '../brief/DecisionBrief'
import { analysisIdOf, downloadCsv, downloadJson } from '../lib/export'
import { useCropNames } from '../state/useCropNames'
import { useWorkspace } from '../state/workspace'

/** The browser names a saved PDF after the page title, so the title carries the farm's name while printing. */
function usePrintTitle(title: string | null) {
  useEffect(() => {
    if (!title) return
    let previous: string | null = null
    const before = () => {
      previous = document.title
      document.title = title
    }
    const after = () => {
      if (previous !== null) document.title = previous
      previous = null
    }
    window.addEventListener('beforeprint', before)
    window.addEventListener('afterprint', after)
    return () => {
      after()
      window.removeEventListener('beforeprint', before)
      window.removeEventListener('afterprint', after)
    }
  }, [title])
}

export default function DecisionBriefPage() {
  const { current, stale, presets, defaultPriorities } = useWorkspace()
  const names = useCropNames()
  usePrintTitle(current ? `HindSight Decision Brief - ${current.name}` : null)

  const header = (
    <PageHeader
      eyebrow="Decision Brief"
      title="Your Rotation Decision Brief"
      intro="The whole analysis as one report: what was examined, how your current rotation performed in the simulation, which alternatives ranked highest and why, what they would trade, and what to check locally before changing anything."
      actions={
        current && (
          <ButtonRouterLink to="/app/scenarios" variant="secondary" icon={<FlaskConical />}>
            Scenario Lab
          </ButtonRouterLink>
        )
      }
      className="print:hidden"
    />
  )

  if (!current) {
    return (
      <div className="space-y-6">
        {header}
        <AnalysisRequired what="The Decision Brief is written from a finished analysis, so run one first." />
      </div>
    )
  }

  const env = current.envelope
  const meta = { id: current.id, at: current.at }
  const id = analysisIdOf(env, meta)
  return (
    <div className="space-y-5 print:space-y-0">
      {header}

      <section aria-label="Export this brief" className="rounded-[1.5rem] bg-white p-4 shadow-hairline ring-1 ring-border sm:p-5 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <Button icon={<FileDown />} onClick={() => window.print()}>
            Save as PDF
          </Button>
          <Button variant="secondary" icon={<Printer />} onClick={() => window.print()}>
            Print
          </Button>
          <span className="mx-1 hidden h-7 w-px bg-border-strong sm:block" aria-hidden="true" />
          <Button variant="secondary" icon={<Table2 />} onClick={() => downloadCsv(env, meta)}>
            Comparison CSV
          </Button>
          <Button variant="secondary" icon={<FileJson />} onClick={() => downloadJson(env, meta)}>
            Analysis JSON
          </Button>
        </div>
        <p className="mt-3 max-w-4xl text-[0.8125rem] leading-snug text-ink">
          <strong className="font-extrabold text-forest-950">Save as PDF</strong> and <strong className="font-extrabold text-forest-950">Print</strong> both open your browser’s print
          dialog. To get a PDF, choose “Save as PDF” as the destination there: the file is made by your browser from this page, laid out for A4 paper. The CSV has one row per
          rotation; the JSON is the complete engine response, exactly as received. Every file describes the analysis shown below
          {id ? (
            <>
              {' '}
              (<span className="font-mono text-[0.75rem]">{id}</span>)
            </>
          ) : null}{' '}
          and no other run.
        </p>
      </section>

      {stale && (
        <Callout tone="warn" title="This brief is from your previous settings" className="print:hidden">
          You have changed the farm settings since this analysis ran. The brief below still describes the analysis that ran. Rerun it from Farm Analysis to update the brief.
        </Callout>
      )}

      <DecisionBrief analysis={current} names={names} defaultPriorities={presets.status === 'ready' ? defaultPriorities : undefined} />
    </div>
  )
}
