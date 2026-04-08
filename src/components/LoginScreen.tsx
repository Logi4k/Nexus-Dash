import { useState } from "react";
import { signIn } from "@/lib/supabase";

interface Props {
  onSignIn: () => Promise<void>;
  onUseOffline: () => void;
}

export default function LoginScreen({ onSignIn, onUseOffline }: Props) {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const emailInputId = "login-email";
  const passwordInputId = "login-password";
  const errorId = "login-error";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signIn(email, password);
      await onSignIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 bg-bg-base"
    >
      <div
        className="w-full max-w-sm rounded-2xl p-8 bg-[rgba(var(--border-rgb),0.03)] border border-[rgba(var(--border-rgb),0.08)]"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <p className="text-2xl font-black tracking-tight text-tx-1">
            Nexus
          </p>
          <p className="text-sm mt-1 text-tx-4">
            Sign in to sync with Supabase, or continue locally.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={emailInputId} className="text-xs font-medium text-tx-3">
              Email
            </label>
            <input
              id={emailInputId}
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              aria-describedby={error ? errorId : undefined}
              aria-invalid={!!error}
              className="nx-input"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={passwordInputId} className="text-xs font-medium text-tx-3">
              Password
            </label>
            <input
              id={passwordInputId}
              type="password"
              placeholder="Enter your password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              aria-describedby={error ? errorId : undefined}
              aria-invalid={!!error}
              className="nx-input"
            />
          </div>

          {error && (
            <p id={errorId} className="text-xs text-loss" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary mt-1 py-3"
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={onUseOffline}
            className="btn-ghost py-3"
          >
            Continue Offline
          </button>
        </form>

        <p className="mt-4 text-[11px] leading-5 text-tx-4">
          Offline mode keeps your workspace usable on this device and lets you review the app immediately. You can sign in later to sync.
        </p>
      </div>
    </div>
  );
}
