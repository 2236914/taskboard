import { useEffect, useState } from "react";
import { Clock as ClockIcon } from "lucide-react";

const TZ_FMT_CACHE = new Map<string, Intl.DateTimeFormat>();
function fmtFor(tz: string): Intl.DateTimeFormat | null {
  if (TZ_FMT_CACHE.has(tz)) return TZ_FMT_CACHE.get(tz)!;
  try {
    const fmt = new Intl.DateTimeFormat([], {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    TZ_FMT_CACHE.set(tz, fmt);
    return fmt;
  } catch {
    return null;
  }
}

/** Returns current "HH:MM" in the given tz, or null if tz is invalid. */
export function useTzTime(tz: string | null | undefined): string | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    // Tick once a minute so HH:MM stays accurate without burning CPU.
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  if (!tz) return null;
  const fmt = fmtFor(tz);
  if (!fmt) return null;
  try {
    return fmt.format(new Date(now));
  } catch {
    return null;
  }
}

/** Tiny inline clock badge — shows "HH:MM" for the given timezone with a
 *  clock icon. Renders nothing when tz is falsy or invalid. */
export function TimezoneClock({
  tz,
  className,
}: {
  tz: string | null | undefined;
  className?: string;
}) {
  const time = useTzTime(tz);
  if (!time) return null;
  return (
    <span
      className={
        "inline-flex items-center gap-0.5 font-mono tabular-nums " +
        (className ?? "")
      }
      title={tz ?? undefined}
    >
      <ClockIcon size={9} className="opacity-60" />
      {time}
    </span>
  );
}
