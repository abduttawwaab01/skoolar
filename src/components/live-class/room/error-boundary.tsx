'use client';

import { Component, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class LiveClassErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="h-screen w-screen bg-slate-900 flex items-center justify-center">
          <div className="text-center space-y-4 max-w-sm mx-auto px-6">
            <div className="size-16 mx-auto rounded-2xl bg-red-500/20 flex items-center justify-center">
              <AlertTriangle className="size-8 text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-white">Something went wrong</h2>
            <p className="text-sm text-slate-400">
              The live class encountered an unexpected error. Please try reconnecting.
            </p>
            <Button
              onClick={this.handleRetry}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <RefreshCw className="size-4 mr-2" /> Retry
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
