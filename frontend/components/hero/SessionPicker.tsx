"use client";

import { motion } from "framer-motion";
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
    <div
      className={cn(
        // Mobile: equal-width grid that wraps to 3+2; sm+: natural flex pills.
        "grid grid-cols-3 gap-2 sm:flex sm:flex-wrap",
        className
      )}
    >
      {SESSIONS.map((session, index) => (
        <motion.div
          key={session}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.45,
            delay: 0.45 + index * 0.06,
            ease: [0.22, 1, 0.36, 1],
          }}
          className={cn(
            "min-w-0",
            // Last two sessions (Quali, Race) span remaining columns on a
            // 3-col mobile grid so the second row stays balanced.
            index >= 3 && "col-span-1 sm:col-auto",
            session === "Quali" && "col-start-1 sm:col-auto",
            session === "Race" && "col-start-2 sm:col-auto"
          )}
        >
          <Button
            type="button"
            variant={selected === session ? "default" : "outline"}
            className="min-h-11 w-full px-3 sm:min-h-10 sm:w-auto sm:px-4"
            onClick={() => handleSelect(session)}
          >
            {session}
          </Button>
        </motion.div>
      ))}
    </div>
  );
}
