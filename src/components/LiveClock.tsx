import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { useProfilePrefs } from "@/lib/profile-prefs";
import { LocationPopover } from "@/components/LocationPopover";

type Loc = {
  city?: string;
  region?: string;
  country?: string;
  tz: string;
} | null;

function detectTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

async function reverseGeocode(
  lat: number,
  lon: number,
): Promise<Partial<Loc> | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=10&accept-language=en`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) return null;
    const j = await res.json();
    const a = j?.address ?? {};
    return {
      city: a.city ?? a.town ?? a.village ?? a.municipality ?? a.county,
      region: a.state ?? a.region,
      country: a.country,
    };
  } catch {
    return null;
  }
}

export function LiveClock({ compact = false }: { compact?: boolean }) {
  const [now, setNow] = useState<Date>(() => new Date());
  const [loc, setLoc] = useState<Loc>({ tz: detectTz() });
  const { locationLabel, timezone: manualTz } = useProfilePrefs();
  // When the user has set a manual timezone, use it for display. Otherwise
  // fall back to the auto-detected one from the geolocation lookup (or the
  // browser's own tz if geolocation isn't available).
  const effectiveTz = manualTz || loc?.tz || detectTz();

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    // Manual override takes precedence — skip geolocation entirely
    if (locationLabel) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    const cached = sessionStorage.getItem("taskboard:loc");
    if (cached) {
      try {
        setLoc(JSON.parse(cached));
        return;
      } catch {
        // ignore corrupt cache
      }
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const r = await reverseGeocode(
          pos.coords.latitude,
          pos.coords.longitude,
        );
        const next: Loc = { ...(r ?? {}), tz: detectTz() };
        setLoc(next);
        try {
          sessionStorage.setItem("taskboard:loc", JSON.stringify(next));
        } catch {
          // sessionStorage may be unavailable (e.g. private mode)
        }
      },
      () => {
        /* keep tz-only */
      },
      { maximumAge: 600_000, timeout: 5_000 },
    );
  }, [locationLabel]);

  const time = now.toLocaleTimeString([], {
    timeZone: effectiveTz,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const date = now.toLocaleDateString([], {
    timeZone: effectiveTz,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const place = locationLabel
    ? locationLabel
    : loc?.city
      ? [loc.city, loc.country].filter(Boolean).join(", ")
      : (loc?.tz ?? "");

  if (compact) {
    return (
      <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground">
        <span className="tabular-nums text-foreground">{time}</span>
        <span className="hidden sm:inline">{date}</span>
        <LocationPopover>
          <span className="hidden md:inline-flex items-center gap-1">
            <MapPin size={11} /> {place || "Set location"}
          </span>
        </LocationPopover>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
      <span className="text-2xl md:text-3xl font-semibold tabular-nums tracking-tight">
        {time}
      </span>
      <span className="text-xs md:text-sm text-muted-foreground">{date}</span>
      <LocationPopover>
        <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground">
          <MapPin size={12} /> {place || "Set location"}
          {locationLabel && (
            <span className="text-[9px] uppercase tracking-widest text-primary ml-1">
              manual
            </span>
          )}
        </span>
      </LocationPopover>
    </div>
  );
}
