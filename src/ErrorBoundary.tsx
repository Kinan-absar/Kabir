import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorMessage = "An unexpected error occurred.";
      let isPermissionError = false;

      try {
        if (this.state.error?.message) {
          const parsed = JSON.parse(this.state.error.message);
          if (parsed.error && parsed.error.includes('Missing or insufficient permissions')) {
            isPermissionError = true;
            errorMessage = "You don't have permission to access this data. Please ensure you are logged in with an authorized account.";
          }
        }
      } catch (e) {
        // Not a JSON error message
        if (this.state.error?.message.includes('Missing or insufficient permissions')) {
          isPermissionError = true;
          errorMessage = "You don't have permission to access this data. Please ensure you are logged in with an authorized account.";
        } else {
          errorMessage = this.state.error?.message || errorMessage;
        }
      }

      return (
        <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6 font-sans">
          <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-stone-200 p-8 text-center">
            <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <AlertTriangle size={32} />
            </div>
            <h1 className="text-2xl font-black text-stone-900 mb-2">Something went wrong</h1>
            <p className="text-stone-500 mb-8 leading-relaxed">
              {errorMessage}
            </p>
            <div className="space-y-3">
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-emerald-900 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-emerald-800 transition-colors shadow-lg shadow-emerald-900/20"
              >
                <RefreshCw size={18} />
                Reload Application
              </button>
              {isPermissionError && (
                <p className="text-[10px] text-stone-400 font-medium uppercase tracking-widest">
                  Contact administrator if this persists
                </p>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
