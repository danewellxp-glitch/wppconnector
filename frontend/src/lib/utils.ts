import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function cleanPhone(phone: string): string {
  return phone.replace(/@(c\.us|g\.us|lid|newsletter)$/, '');
}
