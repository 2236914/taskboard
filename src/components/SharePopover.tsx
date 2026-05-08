import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Share2, Copy, Check, ExternalLink, Loader2 } from "lucide-react";
import type { Note } from "@/lib/taskboard-data";
import { toast } from "sonner";

export function SharePopover({
  note,
  onMakePublic,
  onMakePrivate,
}: {
  note: Note;
  onMakePublic: () => Promise<string | null>;
  onMakePrivate: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const url = note.public_slug
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/n/${note.public_slug}`
    : "";

  const toggle = async (checked: boolean) => {
    setBusy(true);
    try {
      if (checked) {
        const slug = await onMakePublic();
        if (slug) toast.success("Note is now public");
        else toast.error("Couldn't create share link");
      } else {
        await onMakePrivate();
        toast.success("Note is private again");
      }
    } finally { setBusy(false); }
  };

  const copy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Link copied");
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="icon" variant="ghost"
          className={`h-8 w-8 ${note.is_public ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
          title={note.is_public ? "Public" : "Share"}
        >
          <Share2 size={14} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="space-y-3">
          <div>
            <div className="text-sm font-medium">Share note</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Anyone with the link can view this note.
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border p-2.5">
            <div className="flex items-center gap-2">
              {busy && <Loader2 size={12} className="animate-spin" />}
              <span className="text-sm">Public link</span>
            </div>
            <Switch checked={note.is_public} onCheckedChange={toggle} disabled={busy} />
          </div>

          {note.is_public && url && (
            <div className="space-y-2">
              <div className="flex gap-1.5">
                <Input value={url} readOnly className="text-xs font-mono h-8" onFocus={(e) => e.currentTarget.select()} />
                <Button type="button" size="icon" variant="outline" className="h-8 w-8" onClick={copy}>
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                </Button>
                <Button type="button" size="icon" variant="outline" className="h-8 w-8" onClick={() => window.open(url, "_blank")}>
                  <ExternalLink size={13} />
                </Button>
              </div>
              <div className="text-[10px] font-mono text-muted-foreground">
                Toggle off to revoke access immediately.
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
