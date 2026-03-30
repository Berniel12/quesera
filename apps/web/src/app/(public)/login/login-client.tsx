"use client";


import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Default to signup if ?mode=signup in URL (from "Get Started" button)
  const initialMode = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("mode") === "signup" ? "signup" : "signin";
  const [mode, setMode] = useState<"signin" | "signup">(initialMode as "signin" | "signup");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  // Derive redirect target from URL params
  function getRedirectTarget(): string {
    if (typeof window === "undefined") return "/dashboard";
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get("redirect") ?? "/dashboard";
    const onboarding = params.get("onboarding");
    // Only allow internal redirects (starting with /)
    const safePath = redirect.startsWith("/") ? redirect : "/dashboard";
    return onboarding ? `${safePath}?onboarding=${encodeURIComponent(onboarding)}` : safePath;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (mode === "signup") {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/api/auth/callback`,
        },
      });

      if (signUpError) {
        setError(signUpError.message);
      } else {
        setMessage("Check your email for a confirmation link.");
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
      } else {
        window.location.href = getRedirectTarget();
      }
    }

    setLoading(false);
  }

  async function handleGoogleSignIn() {
    setLoading(true);
    // Use explicit origin to avoid Render reverse proxy resolving to localhost
    const appOrigin = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${appOrigin}/api/auth/callback`,
      },
    });

    if (oauthError) {
      setError(oauthError.message);
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm px-6 py-16">
      <div className="text-center mb-8">
        <Link href="/" className="inline-block mb-6">
          <div className="mx-auto h-1.5 w-12 rounded-full bg-navy mb-3" />
          <span className="text-2xl font-bold tracking-tight text-navy">QUESERA</span>
        </Link>
        <h1 className="text-xl font-semibold text-navy">
          {mode === "signin" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {mode === "signin"
            ? "Sign in to access your personal signal feed"
            : "Start tracking the questions that matter to you"}
        </p>
      </div>

      <Card className="rounded-3xl border-border/40">
        <CardContent className="p-6">
          <Button
            variant="outline"
            className="w-full rounded-full h-11 mb-4 gap-3"
            onClick={handleGoogleSignIn}
            disabled={loading}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"/>
              <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"/>
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"/>
            </svg>
            Continue with Google
          </Button>

          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-card px-2 text-muted-foreground">or</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-full h-11"
              required
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-full h-11"
              required
              minLength={6}
            />

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            {message && (
              <p className="text-sm text-positive">{message}</p>
            )}

            <Button type="submit" className="w-full rounded-full h-11" disabled={loading}>
              {loading ? "..." : mode === "signin" ? "Sign In" : "Create Account"}
            </Button>
            {mode === "signin" && (
              <button
                type="button"
                onClick={async () => {
                  if (!email) { setError("Enter your email first"); return; }
                  setLoading(true);
                  const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: `${window.location.origin}/api/auth/callback`,
                  });
                  setLoading(false);
                  if (resetError) setError(resetError.message);
                  else setMessage("Check your email for a password reset link.");
                }}
                className="text-xs text-muted-foreground hover:text-navy hover:underline mt-2 block text-center w-full"
              >
                Forgot password?
              </button>
            )}
          </form>
        </CardContent>
      </Card>

      <p className="text-center text-sm text-muted-foreground mt-6">
        {mode === "signin" ? (
          <>
            No account?{" "}
            <button onClick={() => setMode("signup")} className="text-navy font-medium hover:underline">
              Create one
            </button>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <button onClick={() => setMode("signin")} className="text-navy font-medium hover:underline">
              Sign in
            </button>
          </>
        )}
      </p>
    </div>
  );
}
