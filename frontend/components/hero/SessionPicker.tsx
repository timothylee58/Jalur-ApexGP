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
        // Mobile: five equal pills on one row (no orphan cell, no clipped scroll).
        // sm+: natural-width wrapping pills.
        "flex w-full gap-1.5 sm:flex-wrap sm:gap-2",
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
            delay: 0.45 + index * 0.05,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="min-w-0 flex-1 sm:flex-none"
        >
          <Button
            type="button"
            variant={selected === session ? "default" : "outline"}
            className="h-11 w-full px-1.5 text-xs sm:h-10 sm:w-auto sm:px-4 sm:text-sm"
            onClick={() => handleSelect(session)}
          >
            {session}
          </Button>
        </motion.div>
      ))}
    </div>
  );
}
