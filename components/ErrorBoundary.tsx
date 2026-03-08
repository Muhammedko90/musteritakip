import React from 'react';

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
};

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ error, errorInfo });
    // keep a copy for support/debug
    try {
      localStorage.setItem(
        'lastFatalError',
        JSON.stringify({
          message: error?.message,
          stack: error?.stack,
          componentStack: errorInfo?.componentStack,
          time: new Date().toISOString()
        })
      );
    } catch {
      // ignore
    }
    // eslint-disable-next-line no-console
    console.error('Fatal UI error:', error, errorInfo);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const message = this.state.error?.message || 'Bilinmeyen hata';
    const stack = this.state.error?.stack || '';
    const componentStack = this.state.errorInfo?.componentStack || '';

    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 p-6 flex items-center justify-center">
        <div className="w-full max-w-3xl bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
          <h1 className="text-xl font-black mb-2">Uygulama Hatası</h1>
          <p className="text-sm text-slate-600 font-medium">
            Uygulama açılırken beklenmeyen bir hata oluştu. Aşağıdaki mesajı bana gönderirseniz hızlıca düzeltebilirim.
          </p>

          <div className="mt-4">
            <div className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">Mesaj</div>
            <pre className="text-xs bg-slate-50 border border-slate-200 rounded-2xl p-4 overflow-auto whitespace-pre-wrap">
              {message}
            </pre>
          </div>

          {(stack || componentStack) && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-bold text-slate-700">Detay</summary>
              <pre className="mt-2 text-[11px] bg-slate-50 border border-slate-200 rounded-2xl p-4 overflow-auto whitespace-pre-wrap">
                {stack}
                {componentStack ? `\n\n--- Component Stack ---\n${componentStack}` : ''}
              </pre>
            </details>
          )}

          <div className="mt-6 flex gap-2">
            <button
              className="px-4 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 font-bold text-sm"
              onClick={() => window.location.reload()}
            >
              Yenile
            </button>
            <button
              className="px-4 py-2 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm"
              onClick={() => {
                try {
                  localStorage.removeItem('lastFatalError');
                } catch {
                  // ignore
                }
                window.location.reload();
              }}
            >
              Temizle & Yenile
            </button>
          </div>
        </div>
      </div>
    );
  }
}

