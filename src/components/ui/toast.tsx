"use client";
import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      theme="dark"
      toastOptions={{
        classNames: {
          toast: "bg-card border-border text-foreground",
          title: "text-foreground font-medium",
          description: "text-muted-foreground",
        },
      }}
    />
  );
}
export { toast } from "sonner";
