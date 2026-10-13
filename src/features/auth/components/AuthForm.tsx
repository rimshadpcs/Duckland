"use client";

import { useState, type FormEvent, type InputHTMLAttributes } from "react";
import { AlertCircle, MailCheck } from "lucide-react";
import { createSupabaseBrowserClient } from "@src/lib/supabase/client";

type AuthFormProps = {
  mode: "login" | "signup";
  next: string;
  initialError?: string | null;
};

type FieldErrors = Record<string, string>;

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function mapAuthError(message: string) {
  const lower = message.toLowerCase();

  if (lower.includes("invalid login credentials")) {
    return "Email or password is incorrect.";
  }

  if (lower.includes("already registered") || lower.includes("already exists")) {
    return "An account already exists for this email.";
  }

  return message || "Authentication failed. Please try again.";
}

function getAuthRedirectOrigin() {
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL;
  if (configuredOrigin && configuredOrigin !== "null") {
    return configuredOrigin.replace(/\/$/, "");
  }

  return window.location.origin;
}

function Field({
  id,
  label,
  error,
  ...inputProps
}: {
  id: string;
  label: string;
  error?: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="fd-field">
      <label htmlFor={id} className="fd-label">{label}</label>
      <input
        id={id}
        className="fd-input"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        {...inputProps}
      />
      {error ? <small id={`${id}-error`} className="fd-field-error">{error}</small> : null}
    </div>
  );
}

export function AuthForm({ mode, next, initialError = null }: AuthFormProps) {
  const isSignup = mode === "signup";
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(initialError);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const switchHref = `${isSignup ? "/login" : "/signup"}?next=${encodeURIComponent(next)}`;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const displayName = String(formData.get("displayName") || "").trim();
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const password = String(formData.get("password") || "");
    const confirmPassword = String(formData.get("confirmPassword") || "");
    const nextPath = next && next !== "/" && next.startsWith("/") && !next.startsWith("//") ? next : "/study";
    const nextErrors: FieldErrors = {};

    if (isSignup && displayName.length < 2) nextErrors.displayName = "Enter your display name.";
    if (!isValidEmail(email)) nextErrors.email = "Enter a valid email address.";
    if (isSignup ? password.length < 8 : !password) {
      nextErrors.password = isSignup ? "Use at least 8 characters." : "Enter your password.";
    }
    if (isSignup && password !== confirmPassword) nextErrors.confirmPassword = "Passwords must match.";

    setFieldErrors(nextErrors);
    setError(null);

    if (Object.keys(nextErrors).length) return;

    setIsPending(true);
    try {
      const supabase = createSupabaseBrowserClient();

      if (isSignup) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: displayName,
              full_name: displayName,
            },
            emailRedirectTo: `${getAuthRedirectOrigin()}/auth/callback?next=${encodeURIComponent(nextPath)}`,
          },
        });

        if (signUpError) {
          setError(mapAuthError(signUpError.message));
          return;
        }

        if (!data.session) {
          setConfirmationEmail(email);
          return;
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

        if (signInError) {
          setError(mapAuthError(signInError.message));
          return;
        }
      }

      window.location.assign(nextPath);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Authentication failed. Please try again.");
    } finally {
      setIsPending(false);
    }
  };

  if (confirmationEmail) {
    return (
      <div className="fd-auth-form fd-check-inbox" role="status">
        <div className="fd-icon-tile" aria-hidden="true">
          <MailCheck size={20} strokeWidth={1.8} />
        </div>
        <div className="fd-auth-copy">
          <h1>Check your email</h1>
          <p>
            We sent a confirmation link to <strong style={{ color: "var(--fd-ink)" }}>{confirmationEmail}</strong>. Open it to finish
            creating your account.
          </p>
        </div>
        <p className="fd-hint-text">
          Didn’t get it? Check your spam folder, or{" "}
          <button type="button" className="fd-link" style={{ border: "none", background: "none", padding: 0, cursor: "pointer" }} onClick={() => setConfirmationEmail(null)}>
            try a different email
          </button>
          .
        </p>
      </div>
    );
  }

  return (
    <form className="fd-auth-form" onSubmit={handleSubmit} noValidate>
      <div className="fd-auth-copy">
        <h1>{isSignup ? "Create your account" : "Log in to keep studying"}</h1>
        <p>{isSignup ? "Learn anything by explaining it simply." : "Your rooms are where you left them."}</p>
      </div>

      {error ? (
        <div className="fd-notice is-error" role="alert">
          <AlertCircle size={16} strokeWidth={1.8} />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="fd-auth-fields">
        {isSignup ? (
          <Field id="displayName" name="displayName" label="Display name" autoComplete="name" placeholder="Your name" error={fieldErrors.displayName} />
        ) : null}
        <Field id="email" name="email" type="email" label="Email" autoComplete="email" placeholder="you@example.com" error={fieldErrors.email} />
        {isSignup ? (
          <div className="fd-auth-pair">
            <Field id="password" name="password" type="password" label="Password" autoComplete="new-password" error={fieldErrors.password} />
            <Field id="confirmPassword" name="confirmPassword" type="password" label="Confirm password" autoComplete="new-password" error={fieldErrors.confirmPassword} />
          </div>
        ) : (
          <Field id="password" name="password" type="password" label="Password" autoComplete="current-password" error={fieldErrors.password} />
        )}
      </div>

      <div className="fd-auth-actions">
        <button className="fd-btn fd-btn-accent fd-btn-lg fd-btn-block" type="submit" disabled={isPending}>
          {isPending ? <span className="fd-spinner" aria-hidden="true" /> : null}
          {isPending ? (isSignup ? "Creating account…" : "Logging in…") : isSignup ? "Create account" : "Log in"}
        </button>
        <p>
          {isSignup ? "Already have an account? " : "New to Feynduck? "}
          <a className="fd-link" href={switchHref}>{isSignup ? "Log in" : "Create an account"}</a>
        </p>
      </div>
    </form>
  );
}
