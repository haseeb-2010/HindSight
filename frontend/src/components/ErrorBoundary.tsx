import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  label?: string
}

interface State {
  failed: boolean
}

/** Keeps one broken section from blanking the whole page. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[HindSight] ${this.props.label ?? 'Section'} failed to render`, error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      this.props.fallback ?? (
        <div role="alert" className="container-page py-10 text-center text-sm text-muted">
          This part of the page could not be displayed. Reload the page to try again.
        </div>
      )
    )
  }
}
