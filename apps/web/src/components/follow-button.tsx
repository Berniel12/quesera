"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

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

  async function handleClick() {
    // Not logged in: go straight to login. No dialog, no bait-and-switch.
    if (!isAuthenticated) {
      window.location.href = "/login";
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
            : "Sign in to follow"}
    </Button>
  );
}
