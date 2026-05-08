import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useNavPrefs, type NavStyle, type Theme } from "@/lib/nav-prefs";
import { useProfilePrefs } from "@/lib/profile-prefs";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  PanelLeft,
  LayoutList,
  Sun,
  Moon,
  Monitor,
  Loader2,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";

export function SettingsView() {
  const { user, signOut } = useAuth();
  const { style, setStyle, theme, setTheme } = useNavPrefs();
  const { locationLabel, setLocationLabel } = useProfilePrefs();
  const [locDraft, setLocDraft] = useState("");

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, username")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const meta = user.user_metadata as
        | { display_name?: string; username?: string }
        | undefined;
      setDisplayName(data?.display_name ?? meta?.display_name ?? "");
      setUsername(data?.username ?? meta?.username ?? "");
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const payload = {
      id: user.id,
      display_name: displayName.trim() || null,
      username: username.trim() || null,
    };
    const { error } = await supabase
      .from("profiles")
      .upsert(payload, { onConflict: "id" });
    if (error) toast.error(error.message);
    else {
      // Mirror to auth metadata so greeting updates immediately
      await supabase.auth.updateUser({
        data: {
          display_name: payload.display_name,
          username: payload.username,
        },
      });
      toast.success("Profile saved");
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
          <CardDescription className="text-xs">
            Edit how your name appears across the app.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input
                value={user?.email ?? ""}
                disabled
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Username</Label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
                disabled={loading}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Display name</Label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                disabled={loading}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={saveProfile}
              disabled={saving || loading}
              size="sm"
            >
              {saving ? (
                <Loader2 size={13} className="animate-spin mr-1.5" />
              ) : null}
              Save changes
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                >
                  Sign out
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Sign out of Taskboard?</AlertDialogTitle>
                  <AlertDialogDescription>
                    You'll need to sign back in to access your tasks, notes and
                    clock entries.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Stay signed in</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={async () => {
                      try {
                        await signOut();
                        toast.success("Signed out", {
                          description: "See you soon!",
                        });
                      } catch {
                        toast.error("Couldn't sign out");
                      }
                    }}
                  >
                    Sign out
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin size={15} /> Location
          </CardTitle>
          <CardDescription className="text-xs">
            Override the auto-detected location shown on the board clock. Leave
            blank to auto-detect.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 items-end">
            <div className="space-y-1.5">
              <Label className="text-xs">Your location</Label>
              <Input
                value={locDraft || locationLabel || ""}
                onChange={(e) => setLocDraft(e.target.value)}
                placeholder="e.g. Manila, PH"
                maxLength={64}
              />
            </div>
            <Button
              size="sm"
              onClick={async () => {
                const v = (locDraft || locationLabel || "").trim();
                await setLocationLabel(v || null);
                setLocDraft("");
                toast.success(v ? "Location saved" : "Using auto-detected");
              }}
            >
              Save
            </Button>
            {locationLabel && (
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  await setLocationLabel(null);
                  setLocDraft("");
                  toast.success("Using auto-detected");
                }}
              >
                Use auto
              </Button>
            )}
          </div>
          {locationLabel && (
            <p className="text-[11px] font-mono text-muted-foreground">
              Currently using <span className="text-foreground">manual</span>{" "}
              location.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Appearance</CardTitle>
          <CardDescription className="text-xs">
            Choose your theme and navigation layout.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <Label className="text-xs mb-2 block">Theme</Label>
            <div className="grid grid-cols-3 gap-2 max-w-md">
              <ThemeChip
                active={theme === "light"}
                onClick={() => setTheme("light" as Theme)}
                icon={<Sun size={14} />}
                label="Light"
              />
              <ThemeChip
                active={theme === "dark"}
                onClick={() => setTheme("dark" as Theme)}
                icon={<Moon size={14} />}
                label="Dark"
              />
              <ThemeChip
                active={theme === "system"}
                onClick={() => setTheme("system" as Theme)}
                icon={<Monitor size={14} />}
                label="System"
              />
            </div>
          </div>
          <Separator />
          <div>
            <Label className="text-xs mb-2 block">Navigation style</Label>
            <div className="grid grid-cols-2 gap-2 max-w-md">
              <ThemeChip
                active={style === "sidebar"}
                onClick={() => setStyle("sidebar" as NavStyle)}
                icon={<PanelLeft size={14} />}
                label="Sidebar"
              />
              <ThemeChip
                active={style === "pills"}
                onClick={() => setStyle("pills" as NavStyle)}
                icon={<LayoutList size={14} />}
                label="Pill tabs"
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Switches the layout immediately.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ThemeChip({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition ${
        active
          ? "border-primary bg-primary/5 text-foreground"
          : "border-input hover:bg-muted"
      }`}
    >
      {icon}
      <span>{label}</span>
      {active && (
        <span className="ml-auto text-[10px] font-mono text-primary">on</span>
      )}
    </button>
  );
}
