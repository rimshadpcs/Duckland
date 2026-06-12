import type { TextareaHTMLAttributes } from "react";
import { cn } from "@src/lib/utils";

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn("study-textarea", className)} {...props} />;
}
