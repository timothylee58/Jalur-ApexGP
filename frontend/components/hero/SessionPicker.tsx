"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SESSIONS, type Session } from "@/types";

interface SessionPickerProps {
  className?: string;
  selected?: Session;
}

export function SessionPicker({ className, selected }: SessionPickerProps) {
  const router = useRouter();

  function handleSelect(session: Session) {
    router.push(`/predict?session=${session}`);
  }

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {SESSIONS.map((session) => (
        <Button
          key={session}
          type="button"
          variant={selected === session ? "default" : "outline"}
          className="min-h-10 flex-1 sm:flex-none"
          onClick={() => handleSelect(session)}
        >
          {session}
        </Button>
      ))}
    </div>
  );
}
