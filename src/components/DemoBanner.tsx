import { useState } from "react";
import { X, Sparkles } from "lucide-react";
import { IS_DEMO } from "@/integrations/supabase/client";

/**
 * Tiny banner shown only when VITE_DEMO_MODE=true at build time.
 * Tells visitors what they're looking at and links to the live app.
 */
export function DemoBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (!IS_DEMO || dismissed) return null;

  return (
    <div className="sticky top-0 z-50 w-full border-b bg-foreground text-background">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-1.5 text-xs font-mono">
        <Sparkles size={13} className="shrink-0" />
        <span>
          <span className="font-semibold uppercase tracking-widest mr-2">
            Demo
          </span>
          <span className="opacity-80">
            Sample data · resets when you refresh · uploads stored locally in
            your browser
          </span>
        </span>
        <button
          onClick={() => setDismissed(true)}
          className="ml-auto rounded p-1 hover:bg-background/10"
          aria-label="Dismiss demo banner"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
