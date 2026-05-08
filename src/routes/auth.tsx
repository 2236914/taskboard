import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({ component: AuthPage });

function AuthPage() {
  const nav = useNavigate();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  // signin
  const [identifier, setIdentifier] = useState("");
  const [signinPwd, setSigninPwd] = useState("");

  // signup
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [signupPwd, setSignupPwd] = useState("");

  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) nav({ to: "/" });
  }, [user, loading, nav]);

  const resolveEmail = async (id: string): Promise<string> => {
    if (id.includes("@")) return id;
    const { data, error } = await supabase.rpc("email_for_username", { _username: id });
    if (error || !data) throw new Error("No account found with that username");
    return data as string;
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const emailToUse = await resolveEmail(identifier.trim());
      const { error } = await supabase.auth.signInWithPassword({ email: emailToUse, password: signinPwd });
      if (error) throw error;
      nav({ to: "/" });
    } catch (err: any) {
      toast.error(err.message ?? "Sign in failed");
    } finally {
      setBusy(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const uname = username.trim();
    if (!/^[a-zA-Z0-9_]{3,24}$/.test(uname)) {
      toast.error("Username must be 3–24 chars (letters, numbers, _)");
      return;
    }
    setBusy(true);
    try {
      // Pre-check uniqueness for nicer UX
      const { data: existing } = await supabase
        .from("profiles").select("id").ilike("username", uname).maybeSingle();
      if (existing) throw new Error("Username already taken");

      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password: signupPwd,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: { username: uname, display_name: displayName.trim() || uname },
        },
      });
      if (error) throw error;
      toast.success("Account created — signed in.");
      nav({ to: "/" });
    } catch (err: any) {
      toast.error(err.message ?? "Sign up failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="size-10 rounded-lg bg-primary text-primary-foreground grid place-items-center font-semibold text-lg mx-auto mb-3">T</div>
          <h1 className="text-2xl font-semibold tracking-tight">Taskboard</h1>
          <p className="text-xs text-muted-foreground mt-1">A calm workspace for your week.</p>
        </div>

        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="pb-4">
            <Tabs value={mode} onValueChange={(v) => setMode(v as "signin" | "signup")}>
              <TabsList className="grid grid-cols-2 w-full rounded-full">
                <TabsTrigger value="signin" className="rounded-full">Sign in</TabsTrigger>
                <TabsTrigger value="signup" className="rounded-full">Create account</TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="mt-5">
                <CardTitle className="text-lg mb-1">Welcome back</CardTitle>
                <CardDescription className="text-xs">Use your username or email.</CardDescription>
                <form onSubmit={handleSignIn} className="space-y-3 mt-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="ident" className="text-[10px] font-mono tracking-widest uppercase text-muted-foreground">Username or email</Label>
                    <Input id="ident" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required autoComplete="username" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="pwd1" className="text-[10px] font-mono tracking-widest uppercase text-muted-foreground">Password</Label>
                      <Link to="/forgot-password" className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground">
                        Forgot?
                      </Link>
                    </div>
                    <Input id="pwd1" type="password" value={signinPwd} onChange={(e) => setSigninPwd(e.target.value)} required minLength={8} maxLength={72} autoComplete="current-password" />
                  </div>
                  <Button type="submit" disabled={busy} className="w-full rounded-full">
                    {busy ? <Loader2 className="animate-spin" size={14} /> : "Sign in"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="mt-5">
                <CardTitle className="text-lg mb-1">Create your account</CardTitle>
                <CardDescription className="text-xs">Pick a username — you'll use it to sign in.</CardDescription>
                <form onSubmit={handleSignUp} className="space-y-3 mt-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="uname" className="text-[10px] font-mono tracking-widest uppercase text-muted-foreground">Username</Label>
                      <Input id="uname" value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} maxLength={24} pattern="[a-zA-Z0-9_]+" autoComplete="username" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="dname" className="text-[10px] font-mono tracking-widest uppercase text-muted-foreground">Display name</Label>
                      <Input id="dname" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={60} placeholder="optional" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-[10px] font-mono tracking-widest uppercase text-muted-foreground">Email</Label>
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pwd2" className="text-[10px] font-mono tracking-widest uppercase text-muted-foreground">Password</Label>
                    <Input id="pwd2" type="password" value={signupPwd} onChange={(e) => setSignupPwd(e.target.value)} required minLength={8} maxLength={72} autoComplete="new-password" />
                  </div>
                  <Button type="submit" disabled={busy} className="w-full rounded-full">
                    {busy ? <Loader2 className="animate-spin" size={14} /> : "Create account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardHeader>
          <CardContent />
        </Card>
      </div>
    </div>
  );
}
