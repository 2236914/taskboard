import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

type ProfilePrefs = {
  locationLabel: string | null;
  /** IANA timezone string (e.g. "Asia/Manila") or null when auto-detecting. */
  timezone: string | null;
  loading: boolean;
  setLocationLabel: (v: string | null) => Promise<void>;
  setTimezone: (v: string | null) => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<ProfilePrefs>({
  locationLabel: null,
  timezone: null,
  loading: true,
  setLocationLabel: async () => {},
  setTimezone: async () => {},
  refresh: async () => {},
});

export function ProfilePrefsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [locationLabel, setLocLabel] = useState<string | null>(null);
  const [timezone, setTz] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setLocLabel(null);
      setTz(null);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("location_label, timezone")
      .eq("id", user.id)
      .maybeSingle();
    const row = data as {
      location_label?: string | null;
      timezone?: string | null;
    } | null;
    setLocLabel(row?.location_label ?? null);
    setTz(row?.timezone ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setLocationLabel = async (v: string | null) => {
    if (!user) return;
    setLocLabel(v);
    await supabase
      .from("profiles")
      .upsert({ id: user.id, location_label: v }, { onConflict: "id" });
  };

  const setTimezone = async (v: string | null) => {
    if (!user) return;
    setTz(v);
    await supabase
      .from("profiles")
      .upsert({ id: user.id, timezone: v }, { onConflict: "id" });
  };

  return (
    <Ctx.Provider
      value={{
        locationLabel,
        timezone,
        loading,
        setLocationLabel,
        setTimezone,
        refresh,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useProfilePrefs = () => useContext(Ctx);
