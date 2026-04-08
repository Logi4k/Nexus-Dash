import { Component, type ReactNode } from "react";
import { toast } from "sonner";

interface Props {
  children: ReactNode;
  route?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/** Route-level ErrorBoundary — prevents one crashing page from killing the whole app. */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo) {
    const route = this.props.route ? `[${this.props.route}] ` : "";
    console.error(`${route}Uncaught error:`, error, info.componentStack);
    toast.error(`${route}Something went wrong`, {
      description: error.message || "An unexpected error occurred.",
      duration: 8000,
    });
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "40vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            padding: "2rem",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              background: "rgba(var(--loss-rgb), 0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
            }}
          >
            ⚠
          </div>
          <div>
            <p style={{ fontWeight: 700, color: "var(--tx-1)", marginBottom: 4 }}>
              {this.props.route ? `${this.props.route} encountered an error` : "Something went wrong"}
            </p>
            <p style={{ fontSize: 13, color: "var(--tx-3)", maxWidth: 360 }}>
              {this.state.error?.message || "An unexpected error occurred. Your data is safe."}
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "8px 20px",
              borderRadius: 10,
              background: "var(--tx-1)",
              color: "var(--bg-base)",
              fontWeight: 600,
              fontSize: 13,
              border: "none",
              cursor: "pointer",
            }}
          >
            Reload page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
