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
    <div className={cn("flex flex-wrap gap-2", className)}>
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
          className="flex-1 sm:flex-none"
        >
          <Button
            type="button"
            variant={selected === session ? "default" : "outline"}
            className="min-h-10 w-full sm:w-auto"
            onClick={() => handleSelect(session)}
          >
            {session}
          </Button>
        </motion.div>
      ))}
    </div>
  );
}
