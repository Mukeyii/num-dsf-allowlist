/**
 * ErrorBoundary.tsx — React class boundary that catches render errors in its subtree.
 * Logs to console and shows a reload fallback (with error message in dev builds).
 */
import { Component, ErrorInfo, ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-8">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center entity-card-shadow">
            <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-red-500 text-[28px]">error</span>
            </div>
            <h1 className="text-lg font-bold text-slate-900 mb-2">Something went wrong</h1>
            <p className="text-sm text-slate-500 mb-2">An unexpected error occurred. Please reload the page.</p>
            {import.meta.env.DEV && this.state.error && (
              <pre className="text-left text-[10px] font-mono bg-slate-50 rounded-xl p-3 text-red-700 overflow-auto max-h-32 mb-4">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2 text-sm font-bold text-white rounded-xl transition-all active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, #8a1750, #675df9)' }}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
