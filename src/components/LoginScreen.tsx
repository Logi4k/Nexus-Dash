import { useState } from "react";
import { signIn, signUp } from "@/lib/supabase";

interface Props {
  onSignIn: () => Promise<void>;
  onUseOffline: () => void;
}

type Mode = "signin" | "signup";

export default function LoginScreen({ onSignIn, onUseOffline }: Props) {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const emailInputId = "login-email";
  const passwordInputId = "login-password";
  const confirmInputId = "login-confirm";
  const errorId = "login-error";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (mode === "signup" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "signup") {
        await signUp(email, password);
        setSuccess("Account created. Check your email to confirm, then sign in.");
        setMode("signin");
        setPassword("");
        setConfirmPassword("");
      } else {
        await signIn(email, password);
        await onSignIn();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
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
            {mode === "signin"
              ? "Sign in to sync with Supabase, or continue locally."
              : "Create an account to sync your workspace."}
          </p>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-1 mb-6 p-1 rounded-lg bg-[rgba(var(--border-rgb),0.06)]">
          <button
            type="button"
            onClick={() => { setMode("signin"); setError(""); setSuccess(""); }}
            className={`flex-1 py-2 text-xs font-medium rounded-md transition-colors ${
              mode === "signin"
                ? "bg-bg-surface text-tx-1"
                : "text-tx-4 hover:text-tx-3"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode("signup"); setError(""); setSuccess(""); }}
            className={`flex-1 py-2 text-xs font-medium rounded-md transition-colors ${
              mode === "signup"
                ? "bg-bg-surface text-tx-1"
                : "text-tx-4 hover:text-tx-3"
            }`}
          >
            Sign Up
          </button>
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
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === "signup" ? 6 : undefined}
              aria-describedby={error ? errorId : undefined}
              aria-invalid={!!error}
              className="nx-input"
            />
          </div>

          {mode === "signup" && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor={confirmInputId} className="text-xs font-medium text-tx-3">
                Confirm Password
              </label>
              <input
                id={confirmInputId}
                type="password"
                placeholder="Confirm your password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                aria-describedby={error ? errorId : undefined}
                aria-invalid={!!error}
                className="nx-input"
              />
            </div>
          )}

          {error && (
            <p id={errorId} className="text-xs text-loss" role="alert">
              {error}
            </p>
          )}

          {success && (
            <p className="text-xs text-profit" role="status">
              {success}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary mt-1 py-3"
          >
            {loading
              ? mode === "signin" ? "Signing in..." : "Creating account..."
              : mode === "signin" ? "Sign In" : "Create Account"}
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
