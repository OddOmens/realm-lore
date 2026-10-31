import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-12 text-center">
        <div className="grid size-10 place-items-center rounded-lg bg-destructive/10 text-destructive">
          <AlertTriangle size={18} />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">Something went wrong</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            This page crashed unexpectedly. Your data is safe — try refreshing or navigating away.
          </p>
        </div>
        <details className="text-left max-w-lg w-full">
          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
            Show error details
          </summary>
          <pre className="mt-2 text-xs font-mono text-destructive bg-surface border border-border rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
            {this.state.error.message}
            {'\n'}
            {this.state.error.stack}
          </pre>
        </details>
        <button
          onClick={() => this.setState({ error: null })}
          className="btn btn-outline"
        >
          <RefreshCw /> Try again
        </button>
      </div>
    );
  }
}
