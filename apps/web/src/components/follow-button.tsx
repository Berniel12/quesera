"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AuthPrompt } from "./auth-prompt";

interface FollowButtonProps {
  topicSlug: string;
  isAuthenticated: boolean;
  initialFollowing?: boolean;
}

export function FollowButton({
  topicSlug,
  isAuthenticated,
  initialFollowing = false,
}: FollowButtonProps) {
  const [following, setFollowing] = useState(initialFollowing);
  const [loading, setLoading] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);

  async function handleClick() {
    if (!isAuthenticated) {
      setShowAuthPrompt(true);
      return;
    }

    setLoading(true);
    try {
      const action = following ? "unfollow" : "follow";
      const res = await fetch(`/api/topics/${topicSlug}/follow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (res.ok) {
        const data = (await res.json()) as { following: boolean };
        setFollowing(data.following);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        onClick={handleClick}
        disabled={loading}
        variant={following ? "outline" : "default"}
        className="rounded-full h-10 px-6"
      >
        {loading
          ? "..."
          : following
            ? "Following"
            : isAuthenticated
              ? "Follow"
              : "Follow This Topic"}
      </Button>
      <AuthPrompt
        open={showAuthPrompt}
        onClose={() => setShowAuthPrompt(false)}
        action="follow this topic"
      />
    </>
  );
}
