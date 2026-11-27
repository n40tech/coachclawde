import { Component, Suspense, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { Button } from '../shared/Button'

/**
 * Wraps routes whose pages load lazily (lib/lazyPage). While a page's chunk
 * loads (from the service-worker cache, so normally a few milliseconds)
 * nothing is shown: in-app navigation keeps the previous screen up anyway.
 * If the chunk can't be loaded (offline before the app was ever cached, or a
 * broken deploy), the page area offers a reload instead of the app going blank.
 */
export function PageSuspense({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  return (
    <PageErrorBoundary resetKey={pathname}>
      <Suspense fallback={null}>{children}</Suspense>
    </PageErrorBoundary>
  )
}

class PageErrorBoundary extends Component<{ resetKey: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidUpdate(prev: { resetKey: string }) {
    // Navigating elsewhere gets a fresh try.
    if (this.state.failed && prev.resetKey !== this.props.resetKey) this.setState({ failed: false })
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div role="alert" className="min-h-svh flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-base font-semibold text-snow">This screen didn’t load</p>
        <p className="text-sm text-frost leading-relaxed">Check your connection, then reload.</p>
        <Button variant="secondary" onClick={() => window.location.reload()}>
          <RefreshCw size={16} />
          Reload
        </Button>
      </div>
    )
  }
}
