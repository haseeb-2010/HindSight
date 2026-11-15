import { ErrorBoundary } from '../components/ErrorBoundary'
import { useResource, type Resource } from '../hooks/useResource'
import { api } from '../lib/api'
import type { AnalysisEnvelope, PresetsResponse } from '../lib/types'
import { DemoFarms } from '../sections/DemoFarms'
import { Features } from '../sections/Features'
import { FinalCta } from '../sections/FinalCta'
import { Footer } from '../sections/Footer'
import { Header } from '../sections/Header'
import { Hero } from '../sections/Hero'
import { HowItWorks } from '../sections/HowItWorks'
import { Science } from '../sections/Science'
import { TrustStrip } from '../sections/TrustStrip'

const pending = () => new Promise<never>(() => {})

export function HomePage() {
  const [presets, reloadPresets] = useResource<PresetsResponse>((signal) => api.presets(signal), 'presets')

  // The hero and feature examples use the first preset's saved engine result: it is served
  // instantly and no engine run or external download happens on page load.
  const spotlightPreset = presets.data?.presets[0]
  const spotlightId = spotlightPreset?.id ?? null
  const [demo, reloadDemo] = useResource<AnalysisEnvelope>(
    (signal) => (spotlightId ? api.demo(spotlightId, signal) : pending()),
    spotlightId ?? 'none',
  )
  const spotlight: Resource<AnalysisEnvelope> =
    presets.status === 'error' ? { status: 'error', data: null, error: presets.error } : demo
  const retrySpotlight = presets.status === 'error' ? reloadPresets : reloadDemo

  const placeName = spotlightPreset?.display.place ?? 'a demonstration farm'

  return (
    <>
      <Header />
      <main id="main">
        <ErrorBoundary label="Hero">
          <Hero spotlight={spotlight} spotlightPreset={spotlightPreset} onRetry={retrySpotlight} />
        </ErrorBoundary>
        <TrustStrip hindcast={presets.data?.hindcast} />
        <ErrorBoundary label="Features">
          <Features spotlight={spotlight} presets={presets.data} placeName={placeName} />
        </ErrorBoundary>
        <HowItWorks />
        <ErrorBoundary label="Demonstration farms">
          <DemoFarms presets={presets} onRetryPresets={reloadPresets} />
        </ErrorBoundary>
        <ErrorBoundary label="Science">
          <Science />
        </ErrorBoundary>
        <FinalCta />
      </main>
      <Footer engineVersion={presets.data?.engine_version} />
    </>
  )
}
