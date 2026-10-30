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
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <AlertTriangle size={24} className="text-red-400" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">Something went wrong</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            This page crashed unexpectedly. Your data is safe — try refreshing or navigating away.
          </p>
        </div>
        <details className="text-left max-w-lg w-full">
          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
            Show error details
          </summary>
          <pre className="mt-2 text-xs font-mono text-red-400 bg-secondary/50 border border-border rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
            {this.state.error.message}
            {'\n'}
            {this.state.error.stack}
          </pre>
        </details>
        <button
          onClick={() => this.setState({ error: null })}
          className="flex items-center gap-2 h-9 px-4 rounded-md text-sm font-medium bg-secondary border border-border text-foreground hover:bg-secondary/80 transition-colors"
        >
          <RefreshCw size={14} /> Try again
        </button>
      </div>
    );
  }
}
