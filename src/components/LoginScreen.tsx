import { useState, useEffect, useRef } from "react";
import { signIn } from "@/lib/supabase";

interface Props {
  onSignIn: () => void;
}

const MAX_ATTEMPTS = 3;
const LOCKOUT_SECS = 30;

export default function LoginScreen({ onSignIn }: Props) {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockUntil, setLockUntil] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Countdown timer for lockout
  useEffect(() => {
    if (lockUntil === null) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setCountdown(0);
      return;
    }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((lockUntil - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining === 0) {
        setLockUntil(null);
        setFailedAttempts(0);
      }
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [lockUntil]);

  const isLocked = lockUntil !== null && Date.now() < lockUntil;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isLocked) return;
    setError("");
    setLoading(true);
    try {
      await signIn(email, password);
      // Success — reset counter
      setFailedAttempts(0);
      setLockUntil(null);
      onSignIn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sign in failed";
      setError(msg);
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);
      if (newAttempts >= MAX_ATTEMPTS) {
        const until = Date.now() + LOCKOUT_SECS * 1000;
        setLockUntil(until);
        setError(`Too many failed attempts. Please wait ${LOCKOUT_SECS}s before trying again.`);
      }
    } finally {
      setLoading(false);
    }
  }

  const buttonDisabled = loading || isLocked;
  const buttonText = isLocked
    ? `Try again in ${countdown}s`
    : loading
    ? "Signing in…"
    : "Sign In";

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 bg-bg-base"
    >
      <div
        className="w-full max-w-sm rounded-2xl p-8 bg-white/[0.03] border border-white/[0.08]"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <p className="text-2xl font-black tracking-tight text-tx-1">
            Nexus
          </p>
          <p className="text-sm mt-1 text-tx-4">
            Sign in to continue
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            placeholder="Email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLocked}
            className="nx-input"
          />
          <input
            type="password"
            placeholder="Password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLocked}
            className="nx-input"
          />

          {error && (
            <p className="text-xs text-loss">{error}</p>
          )}

          <button
            type="submit"
            disabled={buttonDisabled}
            className="btn-primary mt-1 py-3"
          >
            {buttonText}
          </button>
        </form>
      </div>
    </div>
  );
}
