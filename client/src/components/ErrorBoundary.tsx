import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCcw, RefreshCw } from "lucide-react";
import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isChunkError: boolean;
  isReloading: boolean;
}

const RELOAD_KEY = "chunk-error-reload-ts";
const RELOAD_COOLDOWN_MS = 10_000;

function isChunkLoadError(error: Error | null): boolean {
  if (!error) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("failed to fetch dynamically imported module") ||
    msg.includes("loading chunk") ||
    msg.includes("loading css chunk") ||
    msg.includes("dynamically imported module") ||
    msg.includes("importing a module script failed") ||
    msg.includes("error loading dynamically imported module")
  );
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, isChunkError: false, isReloading: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    const isChunk = isChunkLoadError(error);
    return { hasError: true, error, isChunkError: isChunk };
  }

  componentDidCatch(error: Error) {
    if (isChunkLoadError(error)) {
      // Auto-reload for chunk errors (once per cooldown period)
      try {
        const last = sessionStorage.getItem(RELOAD_KEY);
        if (!last || Date.now() - Number(last) > RELOAD_COOLDOWN_MS) {
          sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
          this.setState({ isReloading: true });
          // Small delay so user sees the "updating" message
          setTimeout(() => window.location.reload(), 500);
          return;
        }
      } catch {
        // sessionStorage unavailable
      }
    }
  }

  render() {
    if (this.state.hasError) {
      // Chunk error with auto-reload in progress
      if (this.state.isChunkError && this.state.isReloading) {
        return (
          <div className="flex items-center justify-center min-h-screen p-8 bg-background">
            <div className="flex flex-col items-center w-full max-w-md p-8">
              <RefreshCw size={48} className="text-primary mb-6 animate-spin" />
              <h2 className="text-xl mb-2 text-foreground">Atualizando...</h2>
              <p className="text-sm text-muted-foreground text-center">
                Uma nova versão do sistema foi detectada. Recarregando automaticamente.
              </p>
            </div>
          </div>
        );
      }

      // Chunk error but already reloaded recently (prevent loop)
      if (this.state.isChunkError) {
        return (
          <div className="flex items-center justify-center min-h-screen p-8 bg-background">
            <div className="flex flex-col items-center w-full max-w-md p-8">
              <RefreshCw size={48} className="text-primary mb-6" />
              <h2 className="text-xl mb-2 text-foreground">Nova versão disponível</h2>
              <p className="text-sm text-muted-foreground text-center mb-6">
                O sistema foi atualizado. Clique no botão abaixo para carregar a versão mais recente.
              </p>
              <button
                onClick={() => {
                  try { sessionStorage.removeItem(RELOAD_KEY); } catch {}
                  window.location.reload();
                }}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg",
                  "bg-primary text-primary-foreground",
                  "hover:opacity-90 cursor-pointer"
                )}
              >
                <RefreshCw size={16} />
                Atualizar agora
              </button>
            </div>
          </div>
        );
      }

      // Generic error (non-chunk)
      return (
        <div className="flex items-center justify-center min-h-screen p-8 bg-background">
          <div className="flex flex-col items-center w-full max-w-2xl p-8">
            <AlertTriangle
              size={48}
              className="text-destructive mb-6 flex-shrink-0"
            />

            <h2 className="text-xl mb-4 text-foreground">Ocorreu um erro inesperado.</h2>

            <div className="p-4 w-full rounded bg-muted overflow-auto mb-6">
              <pre className="text-sm text-muted-foreground whitespace-break-spaces">
                {this.state.error?.message}
              </pre>
            </div>

            <button
              onClick={() => window.location.reload()}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg",
                "bg-primary text-primary-foreground",
                "hover:opacity-90 cursor-pointer"
              )}
            >
              <RotateCcw size={16} />
              Recarregar página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
