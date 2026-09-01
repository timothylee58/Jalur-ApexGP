import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Session } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isSession(value: string | null): value is Session {
  return value === "FP1" || value === "FP2" || value === "FP3" || value === "Quali" || value === "Race";
}
