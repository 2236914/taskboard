import { useEffect, useMemo, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MapPin, X } from "lucide-react";
import { useProfilePrefs } from "@/lib/profile-prefs";
import { toast } from "sonner";

// "Auto" sentinel for the Select component — RadixSelect can't take an
// empty-string value, so we use this synthetic key to mean "use the browser
// auto-detected timezone".
const TZ_AUTO = "__auto__";

/** Common IANA timezone identifiers used in the dropdown. */
const COMMON_TIMEZONES: string[] = [
  "UTC",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Lisbon",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Athens",
  "Africa/Cairo",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Bangkok",
  "Asia/Shanghai",
  "Asia/Manila",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
];

function detectTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

/** Returns true if `tz` is a valid IANA timezone the runtime understands. */
function isValidTz(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

/** "+08:00" style offset for the given tz at "now", for the dropdown labels. */
function offsetFor(tz: string): string {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "shortOffset",
    });
    const parts = dtf.formatToParts(new Date());
    const off = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
    // shortOffset returns "GMT+8" or "GMT-5:30" etc.
    return off.replace("GMT", "UTC");
  } catch {
    return "";
  }
}

export function LocationPopover({ children }: { children: React.ReactNode }) {
  const { locationLabel, timezone, setLocationLabel, setTimezone } =
    useProfilePrefs();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(locationLabel ?? "");
  const [tzDraft, setTzDraft] = useState<string>(timezone ?? TZ_AUTO);

  // Keep dropdown options stable but ensure any saved value is included even
  // if it's not in the curated list.
  const tzOptions = useMemo(() => {
    const set = new Set(COMMON_TIMEZONES);
    if (timezone && isValidTz(timezone)) set.add(timezone);
    return Array.from(set).sort();
  }, [timezone]);

  useEffect(() => {
    if (open) {
      setDraft(locationLabel ?? "");
      setTzDraft(timezone ?? TZ_AUTO);
    }
  }, [open, locationLabel, timezone]);

  const save = async () => {
    const v = draft.trim();
    await setLocationLabel(v || null);
    const tzValue = tzDraft === TZ_AUTO ? null : tzDraft;
    await setTimezone(tzValue);
    toast.success(
      v || tzValue ? "Location updated" : "Using auto-detected location",
    );
    setOpen(false);
  };

  const clear = async () => {
    await setLocationLabel(null);
    await setTimezone(null);
    setDraft("");
    setTzDraft(TZ_AUTO);
    toast.success("Using auto-detected location");
    setOpen(false);
  };

  const browserTz = detectTz();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 hover:text-foreground transition cursor-pointer"
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3">
        <div>
          <Label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            <MapPin size={11} className="inline mr-1" /> Location
          </Label>
          <p className="text-[11px] text-muted-foreground mt-1">
            Type your city — leave blank to auto-detect.
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

        <div>
          <Label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Timezone
          </Label>
          <p className="text-[11px] text-muted-foreground mt-1">
            Pinning a timezone makes the clock show that zone instead of your
            device's.
          </p>
        </div>
        <Select value={tzDraft} onValueChange={setTzDraft}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TZ_AUTO}>
              Auto · {browserTz} ({offsetFor(browserTz)})
            </SelectItem>
            {tzOptions.map((tz) => (
              <SelectItem key={tz} value={tz}>
                {tz} ({offsetFor(tz)})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex gap-1.5">
          <Button size="sm" onClick={save} className="h-7 text-xs flex-1">
            Save
          </Button>
          {(locationLabel || timezone) && (
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
