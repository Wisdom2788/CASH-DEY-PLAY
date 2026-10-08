import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-white bg-[#111214]">
          <div className="w-16 h-16 rounded-full bg-[#1A1B1E] border border-[#FF5A36]/40 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-[#FF5A36]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h3 className="font-bebas text-xl text-white tracking-wider mb-1">
            SOMETHING WENT WRONG
          </h3>
          <p className="text-xs text-[#9A9A9A] mb-4 max-w-[260px]">
            An unexpected error occurred. Please try again or restart the app.
          </p>
          {this.state.error && (
            <p className="text-[10px] text-[#6F7278] mb-4 font-mono max-w-[280px] break-all">
              {this.state.error.message}
            </p>
          )}
          <button
            onClick={this.handleRetry}
            className="px-6 py-2.5 rounded-full bg-[#00B85F] text-[#111214] font-bold text-xs uppercase tracking-wider active:scale-95 transition cursor-pointer"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
