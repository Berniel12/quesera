"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface AuthPromptProps {
  open: boolean;
  onClose: () => void;
  action?: string;
}

export function AuthPrompt({
  open,
  onClose,
  action = "follow this topic",
}: AuthPromptProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-navy">
            Sign in to {action}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Create a free account to personalize your experience — follow
            topics, track changes, and build your signal dashboard.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 pt-4">
          <Button
            className="rounded-full h-11"
            onClick={() => {
              window.location.href = "/login";
            }}
          >
            Sign In
          </Button>
          <Button
            variant="outline"
            className="rounded-full h-11"
            onClick={onClose}
          >
            Maybe Later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
