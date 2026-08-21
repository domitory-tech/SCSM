import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, Trash2 } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("Uncaught application error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleClearCacheAndReload = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.warn("Could not clear storage:", e);
    }
    window.location.reload();
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans text-slate-800">
          <div className="max-w-lg w-full bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200 text-center space-y-5">
            <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-black text-slate-900">
                เกิดข้อผิดพลาดในการแสดงผล
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                ระบบพบปัญหาในการโหลดส่วนประกอบหน้าเว็บชั่วคราว
                กรุณากดปุ่มรีโหลดเพื่อเริ่มต้นการทำงานใหม่อีกครั้ง
              </p>
            </div>

            {this.state.error && (
              <div className="text-left bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-mono text-rose-800 overflow-x-auto max-h-36">
                <div className="font-bold mb-1">Error: {this.state.error.toString()}</div>
                {this.state.errorInfo && (
                  <pre className="text-[10px] text-slate-500 whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>รีโหลดหน้าเว็บ</span>
              </button>

              <button
                type="button"
                onClick={this.handleClearCacheAndReload}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-bold rounded-xl border border-slate-300 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-4 h-4 text-slate-500" />
                <span>ล้างแคชและโหลดใหม่</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
