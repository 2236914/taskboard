import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/reset-password")({ component: ResetPasswordPage });

function ResetPasswordPage() {
  const nav = useNavigate();
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase reset links arrive with a recovery session; once detected we allow updateUser.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    // Also check current session in case the listener fired before mount
    supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true); });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd !== pwd2) { toast.error("Passwords don't match"); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pwd });
      if (error) throw error;
      toast.success("Password updated.");
      nav({ to: "/" });
    } catch (err: any) {
      toast.error(err.message ?? "Couldn't update password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="size-10 rounded-lg bg-primary text-primary-foreground grid place-items-center font-semibold text-lg mx-auto mb-3">T</div>
          <h1 className="text-2xl font-semibold tracking-tight">Set a new password</h1>
        </div>
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Choose a new password</CardTitle>
            <CardDescription className="text-xs">
              {ready ? "Enter and confirm your new password." : "Verifying your reset link…"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="np" className="text-[10px] font-mono tracking-widest uppercase text-muted-foreground">New password</Label>
                <Input id="np" type="password" required minLength={8} maxLength={72} value={pwd} onChange={(e) => setPwd(e.target.value)} autoComplete="new-password" disabled={!ready} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="np2" className="text-[10px] font-mono tracking-widest uppercase text-muted-foreground">Confirm</Label>
                <Input id="np2" type="password" required minLength={8} maxLength={72} value={pwd2} onChange={(e) => setPwd2(e.target.value)} autoComplete="new-password" disabled={!ready} />
              </div>
              <Button type="submit" disabled={busy || !ready} className="w-full rounded-full">
                {busy ? <Loader2 className="animate-spin" size={14} /> : "Update password"}
              </Button>
            </form>
            <Link to="/auth" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
              <ArrowLeft size={12} /> Back to sign in
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
