import { Link, useLocation } from "react-router-dom";
import { AlertTriangle, ArrowLeft } from "lucide-react";

export default function NotFound() {
  const loc = useLocation();
  return (
    <section
      aria-labelledby="notfound-title"
      className="min-h-[60vh] flex items-center justify-center px-4 page-enter"
    >
      <div className="w-full max-w-md text-center">
        <div
          aria-hidden
          className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl"
          style={{
            background: "rgba(var(--color-warn-rgb), 0.12)",
            border: "1px solid rgba(var(--color-warn-rgb), 0.22)",
          }}
        >
          <AlertTriangle size={18} style={{ color: "var(--color-warn)" }} />
        </div>
        <p className="section-label mb-2">Error 404</p>
        <h1 id="notfound-title" className="page-title mb-2">
          Page not found
        </h1>
        <p className="text-tx-3 text-sm">
          The path{" "}
          <code
            className="font-mono text-tx-2"
            style={{
              background: "rgba(var(--surface-rgb), 0.08)",
              padding: "2px 6px",
              borderRadius: "6px",
            }}
          >
            {loc.pathname}
          </code>{" "}
          does not match any known screen. It may have moved or been renamed.
        </p>

        <div className="mt-6 flex items-center justify-center gap-2">
          <Link to="/" className="btn-primary btn">
            <ArrowLeft size={14} />
            Back to dashboard
          </Link>
        </div>
      </div>
    </section>
  );
}
