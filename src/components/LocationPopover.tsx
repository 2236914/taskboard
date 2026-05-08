import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MapPin, X } from "lucide-react";
import { useProfilePrefs } from "@/lib/profile-prefs";
import { toast } from "sonner";

export function LocationPopover({ children }: { children: React.ReactNode }) {
  const { locationLabel, setLocationLabel } = useProfilePrefs();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(locationLabel ?? "");

  const save = async () => {
    const v = draft.trim();
    await setLocationLabel(v || null);
    toast.success(v ? "Location updated" : "Using auto-detected location");
    setOpen(false);
  };

  const clear = async () => {
    await setLocationLabel(null);
    setDraft("");
    toast.success("Using auto-detected location");
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setDraft(locationLabel ?? "");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 hover:text-foreground transition cursor-pointer"
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3">
        <div>
          <Label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            <MapPin size={11} className="inline mr-1" /> Location
          </Label>
          <p className="text-[11px] text-muted-foreground mt-1">
            Type your city or leave blank to auto-detect.
          </p>
        </div>
        <Input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder="e.g. Manila, PH"
          maxLength={64}
          className="h-8 text-xs"
        />
        <div className="flex gap-1.5">
          <Button size="sm" onClick={save} className="h-7 text-xs flex-1">
            Save
          </Button>
          {locationLabel && (
            <Button
              size="sm"
              variant="ghost"
              onClick={clear}
              className="h-7 text-xs gap-1"
            >
              <X size={11} /> Auto
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
