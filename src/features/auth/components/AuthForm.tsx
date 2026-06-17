"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import type { AuthActionState } from "@src/app/auth/actions";
import { loginAction, signupAction } from "@src/app/auth/actions";

type AuthFormProps = {
  mode: "login" | "signup";
  next: string;
};

const initialState: AuthActionState = { status: "idle" };

export function AuthForm({ mode, next }: AuthFormProps) {
  const action = mode === "login" ? loginAction : signupAction;
  const [state, formAction, isPending] = useActionState(action, initialState);
  const isSignup = mode === "signup";

  return (
    <form className="auth-form" action={formAction}>
      <input type="hidden" name="next" value={next} />

      {isSignup && (
        <label>
          <span>Display name</span>
          <input name="displayName" autoComplete="name" placeholder="Rimshad" />
          {state.fieldErrors?.displayName && <small>{state.fieldErrors.displayName}</small>}
        </label>
      )}

      <label>
        <span>Email</span>
        <input name="email" type="email" autoComplete="email" placeholder="you@example.com" />
        {state.fieldErrors?.email && <small>{state.fieldErrors.email}</small>}
      </label>

      <label>
        <span>Password</span>
        <input
          name="password"
          type="password"
          autoComplete={isSignup ? "new-password" : "current-password"}
          placeholder="••••••••"
        />
        {state.fieldErrors?.password && <small>{state.fieldErrors.password}</small>}
      </label>

      {isSignup && (
        <label>
          <span>Confirm password</span>
          <input name="confirmPassword" type="password" autoComplete="new-password" placeholder="••••••••" />
          {state.fieldErrors?.confirmPassword && <small>{state.fieldErrors.confirmPassword}</small>}
        </label>
      )}

      {state.message && (
        <div className={state.status === "success" ? "auth-message success" : "auth-message error"}>
          {state.message}
        </div>
      )}

      <button className="auth-submit" type="submit" disabled={isPending}>
        {isPending ? <Loader2 className="icon-spin" size={18} /> : null}
        {isPending ? "Working..." : isSignup ? "Create account" : "Log in"}
      </button>
    </form>
  );
}
