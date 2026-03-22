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
  const [mode, setMode] = useState<"signin" | "signup">("signin");
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
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
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
            : "Start tracking the subjects that matter to you"}
        </p>
      </div>

      <Card className="rounded-3xl border-border/40">
        <CardContent className="p-6">
          <Button
            variant="outline"
            className="w-full rounded-full h-11 mb-4"
            onClick={handleGoogleSignIn}
            disabled={loading}
          >
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
