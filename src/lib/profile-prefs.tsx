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
  loading: boolean;
  setLocationLabel: (v: string | null) => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<ProfilePrefs>({
  locationLabel: null,
  loading: true,
  setLocationLabel: async () => {},
  refresh: async () => {},
});

export function ProfilePrefsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [locationLabel, setLocLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setLocLabel(null);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("location_label")
      .eq("id", user.id)
      .maybeSingle();
    setLocLabel(
      (data as { location_label?: string | null } | null)?.location_label ??
        null,
    );
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

  return (
    <Ctx.Provider value={{ locationLabel, loading, setLocationLabel, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export const useProfilePrefs = () => useContext(Ctx);
