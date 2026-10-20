import React from 'react';
import { ErrorDiagnosticPanel } from './ErrorDiagnosticPanel';

type State = { hasError: boolean; message: string; name: string };

export class AppErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false, message: '', name: 'Error' };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'An unexpected rendering error occurred.',
      name: error instanceof Error ? error.name : 'FrontendRenderError',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('MF MPanel rendering error:', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-5 text-slate-900">
        <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8" role="alert">
          <div className="mb-4 grid h-10 w-10 place-items-center rounded-xl bg-rose-50 text-lg font-bold text-rose-700">!</div>
          <h1 className="text-xl font-semibold tracking-tight">MF MPanel could not render this page</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">The app caught a rendering error instead of leaving a blank screen. Reload once; if it continues, share the error text with the developer.</p>
          <pre className="mt-4 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-3 text-xs text-rose-800">{this.state.message}</pre>
          <div className="mt-4"><ErrorDiagnosticPanel error={{ name: this.state.name, message: this.state.message }} /></div>
          <button onClick={() => window.location.reload()} className="mt-5 min-h-10 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800">Reload application</button>
        </section>
      </main>
    );
  }
}
