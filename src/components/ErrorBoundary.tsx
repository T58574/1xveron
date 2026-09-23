import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen w-screen bg-[#090a0d] text-zinc-100 p-4">
          <div className="p-6 bg-[#0f1015] border border-[#f59e0b]/30 rounded-xl shadow-2xl flex flex-col items-center gap-4 max-w-md w-full">
            <h2 className="text-xl font-bold text-[#f59e0b]">Something went wrong</h2>
            <p className="text-sm text-zinc-400 text-center break-words w-full">
              {this.state.error?.toString()}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 px-6 py-2 bg-[#f59e0b] hover:bg-amber-400 text-black font-semibold rounded-lg shadow-sm transition-all"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
