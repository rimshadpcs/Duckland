"use client";

import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@src/lib/supabase/client";

type AuthFormProps = {
  mode: "login" | "signup";
  next: string;
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

export function AuthForm({ mode, next }: AuthFormProps) {
  const isSignup = mode === "signup";
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error">("error");
  const [isPending, setIsPending] = useState(false);

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
    setMessage(null);

    if (Object.keys(nextErrors).length) return;

    setIsPending(true);
    try {
      const supabase = createSupabaseBrowserClient();

      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: displayName,
              full_name: displayName,
            },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
          },
        });

        if (error) {
          setMessageType("error");
          setMessage(mapAuthError(error.message));
          return;
        }

        if (!data.session) {
          setMessageType("success");
          setMessage("Check your email to confirm your account.");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
          setMessageType("error");
          setMessage(mapAuthError(error.message));
          return;
        }
      }

      window.location.assign(nextPath);
    } catch (error) {
      setMessageType("error");
      setMessage(error instanceof Error ? error.message : "Authentication failed. Please try again.");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <input type="hidden" name="next" value={next} />

      {isSignup && (
        <label>
          <span>Display name</span>
          <input name="displayName" autoComplete="name" placeholder="Rimshad" />
          {fieldErrors.displayName && <small>{fieldErrors.displayName}</small>}
        </label>
      )}

      <label>
        <span>Email</span>
        <input name="email" type="email" autoComplete="email" placeholder="you@example.com" />
        {fieldErrors.email && <small>{fieldErrors.email}</small>}
      </label>

      <label>
        <span>Password</span>
        <input
          name="password"
          type="password"
          autoComplete={isSignup ? "new-password" : "current-password"}
          placeholder="••••••••"
        />
        {fieldErrors.password && <small>{fieldErrors.password}</small>}
      </label>

      {isSignup && (
        <label>
          <span>Confirm password</span>
          <input name="confirmPassword" type="password" autoComplete="new-password" placeholder="••••••••" />
          {fieldErrors.confirmPassword && <small>{fieldErrors.confirmPassword}</small>}
        </label>
      )}

      {message && (
        <div className={messageType === "success" ? "auth-message success" : "auth-message error"}>
          {message}
        </div>
      )}

      <button className="auth-submit" type="submit" disabled={isPending}>
        {isPending ? <Loader2 className="icon-spin" size={18} /> : null}
        {isPending ? "Working..." : isSignup ? "Create account" : "Log in"}
      </button>
    </form>
  );
}
