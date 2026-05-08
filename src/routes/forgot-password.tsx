import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, MailCheck } from "lucide-react";

export const Route = createFileRoute("/forgot-password")({ component: ForgotPasswordPage });

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
    } catch (err: any) {
      toast.error(err.message ?? "Couldn't send reset email");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="size-10 rounded-lg bg-primary text-primary-foreground grid place-items-center font-semibold text-lg mx-auto mb-3">T</div>
          <h1 className="text-2xl font-semibold tracking-tight">Reset password</h1>
        </div>
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">{sent ? "Check your email" : "Forgot your password?"}</CardTitle>
            <CardDescription className="text-xs">
              {sent
                ? "If an account exists for that email, we sent a reset link."
                : "Enter the email on your account and we'll send a reset link."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {sent ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MailCheck size={16} className="text-primary" />
                Sent to <span className="font-medium text-foreground">{email}</span>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-[10px] font-mono tracking-widest uppercase text-muted-foreground">Email</Label>
                  <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                </div>
                <Button type="submit" disabled={busy} className="w-full rounded-full">
                  {busy ? <Loader2 className="animate-spin" size={14} /> : "Send reset link"}
                </Button>
              </form>
            )}
            <Link to="/auth" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
              <ArrowLeft size={12} /> Back to sign in
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
