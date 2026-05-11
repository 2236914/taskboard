import { useEffect, useMemo, useState } from "react";
import { Plus, X, Globe } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTzTime } from "@/components/TimezoneClock";

const STORAGE_KEY = "taskboard:world-clocks";
const DEFAULT_TIMEZONES = ["Asia/Manila", "America/New_York", "Europe/London"];

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

function readZones(): string[] {
  if (typeof window === "undefined") return DEFAULT_TIMEZONES;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (!v) return DEFAULT_TIMEZONES;
    const parsed = JSON.parse(v);
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
      return parsed;
    }
    return DEFAULT_TIMEZONES;
  } catch {
    return DEFAULT_TIMEZONES;
  }
}

function shortName(tz: string): string {
  // "Asia/Manila" → "Manila". For UTC keep as-is.
  if (tz === "UTC") return tz;
  return tz.split("/").pop()?.replace(/_/g, " ") ?? tz;
}

/** Live clocks for several cities. Persisted to localStorage per device. */
export function WorldClocks() {
  const [zones, setZones] = useState<string[]>(() => readZones());

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(zones));
    } catch {
      // ignore — localStorage may be disabled
    }
  }, [zones]);

  const addable = useMemo(
    () => COMMON_TIMEZONES.filter((tz) => !zones.includes(tz)),
    [zones],
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Globe size={13} className="text-muted-foreground" />
        <span className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
          World clocks
        </span>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="ml-auto h-6 w-6"
              disabled={addable.length === 0}
              title="Add timezone"
            >
              <Plus size={13} />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 space-y-2">
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Add timezone
            </div>
            <Select
              value=""
              onValueChange={(v) =>
                setZones((prev) => (prev.includes(v) ? prev : [...prev, v]))
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Pick a timezone" />
              </SelectTrigger>
              <SelectContent>
                {addable.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </PopoverContent>
        </Popover>
      </div>
      {zones.length === 0 ? (
        <div className="text-[11px] text-muted-foreground italic">
          No timezones added.
        </div>
      ) : (
        <ul className="space-y-1">
          {zones.map((tz) => (
            <WorldClockRow
              key={tz}
              tz={tz}
              onRemove={() => setZones((prev) => prev.filter((t) => t !== tz))}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function WorldClockRow({ tz, onRemove }: { tz: string; onRemove: () => void }) {
  const time = useTzTime(tz);
  return (
    <li className="flex items-center gap-2 text-xs group">
      <span className="flex-1 truncate" title={tz}>
        {shortName(tz)}
      </span>
      <span className="font-mono tabular-nums text-foreground">
        {time ?? "—"}
      </span>
      <button
        type="button"
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 transition text-muted-foreground hover:text-destructive"
        title="Remove"
        aria-label={`Remove ${tz}`}
      >
        <X size={11} />
      </button>
    </li>
  );
}
