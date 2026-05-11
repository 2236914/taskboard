import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/lib/admin";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Bug,
  Lightbulb,
  Heart,
  MessageSquare,
  Loader2,
  Search,
  ShieldOff,
  Eye,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

type FeedbackType = "bug" | "feature" | "praise" | "other";
type FeedbackStatus = "new" | "seen" | "responded";

type FeedbackRow = {
  id: string;
  user_id: string;
  type: FeedbackType;
  subject: string;
  message: string;
  image_paths: string[];
  status: FeedbackStatus;
  created_at: string;
  updated_at: string;
};

type Profile = {
  id: string;
  display_name: string | null;
  username: string | null;
};

const TYPE_META: Record<
  FeedbackType,
  {
    label: string;
    icon: React.ComponentType<{ size?: number }>;
    color: string;
  }
> = {
  bug: { label: "Bug", icon: Bug, color: "#dc2626" },
  feature: { label: "Feature", icon: Lightbulb, color: "#ea580c" },
  praise: { label: "Praise", icon: Heart, color: "#16a34a" },
  other: { label: "Other", icon: MessageSquare, color: "#64748b" },
};

const STATUS_TONE: Record<FeedbackStatus, string> = {
  new: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  seen: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  responded: "bg-green-500/15 text-green-700 dark:text-green-300",
};

export function AdminView() {
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | FeedbackStatus>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | FeedbackType>("all");
  const [search, setSearch] = useState("");
  const [signedThumbs, setSignedThumbs] = useState<Record<string, string>>({});
  const [detail, setDetail] = useState<FeedbackRow | null>(null);

  const refresh = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    const { data: rows, error } = await supabase
      .from("feedback")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      toast.error("Couldn't load feedback");
      setLoading(false);
      return;
    }
    const list = (rows ?? []) as FeedbackRow[];
    setFeedback(list);

    // Pull every submitter's profile in one shot for the username column.
    const ids = Array.from(new Set(list.map((r) => r.user_id)));
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name, username")
        .in("id", ids);
      const m: Record<string, Profile> = {};
      (profs ?? []).forEach((p) => {
        m[(p as Profile).id] = p as Profile;
      });
      setProfiles(m);
    }
    setLoading(false);
  }, [isAdmin]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Resolve signed URLs lazily for the first image of each item that has one.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = {};
      for (const f of feedback) {
        if (!f.image_paths.length) continue;
        const first = f.image_paths[0];
        if (signedThumbs[first]) continue;
        const { data } = await supabase.storage
          .from("attachments")
          .createSignedUrl(first, 3600);
        if (data?.signedUrl) next[first] = data.signedUrl;
      }
      if (!cancelled && Object.keys(next).length) {
        setSignedThumbs((prev) => ({ ...prev, ...next }));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedback]);

  const setStatus = async (id: string, status: FeedbackStatus) => {
    const previous = feedback.find((f) => f.id === id)?.status;
    setFeedback((prev) =>
      prev.map((f) => (f.id === id ? { ...f, status } : f)),
    );
    const { error } = await supabase
      .from("feedback")
      .update({ status })
      .eq("id", id);
    if (error) {
      toast.error("Couldn't update status");
      // Roll back optimistic change.
      if (previous) {
        setFeedback((prev) =>
          prev.map((f) => (f.id === id ? { ...f, status: previous } : f)),
        );
      }
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return feedback.filter((f) => {
      if (filter !== "all" && f.status !== filter) return false;
      if (typeFilter !== "all" && f.type !== typeFilter) return false;
      if (q) {
        const submitter = profiles[f.user_id];
        const haystack =
          (f.subject + " " + f.message).toLowerCase() +
          " " +
          (submitter?.username ?? "").toLowerCase() +
          " " +
          (submitter?.display_name ?? "").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [feedback, filter, typeFilter, search, profiles]);

  // ---- guard ----

  if (adminLoading) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        <Loader2 className="inline animate-spin" size={18} />
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <Card className="max-w-md mx-auto mt-12">
        <CardHeader>
          <CardDescription className="text-[11px] font-mono uppercase tracking-widest">
            Admin only
          </CardDescription>
          <CardTitle className="flex items-center gap-2 text-xl">
            <ShieldOff size={18} /> Not authorised
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This area is restricted to project owners. If you should have
            access, ask the workspace admin to flip{" "}
            <code className="font-mono text-xs">profiles.is_admin</code> for
            your account.
          </p>
        </CardContent>
      </Card>
    );
  }

  // ---- counts ----
  const counts = {
    total: feedback.length,
    new: feedback.filter((f) => f.status === "new").length,
    seen: feedback.filter((f) => f.status === "seen").length,
    responded: feedback.filter((f) => f.status === "responded").length,
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
            Admin · Feedback
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Feedback inbox
          </h1>
        </div>
        <div className="flex items-baseline gap-4 font-mono text-xs text-muted-foreground">
          <Stat label="Total" value={counts.total} />
          <Stat label="New" value={counts.new} accent="text-foreground" />
          <Stat label="Seen" value={counts.seen} />
          <Stat label="Responded" value={counts.responded} />
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search
            size={13}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search subject, message, user…"
            className="h-9 pl-7 w-64"
          />
        </div>
        <Select
          value={filter}
          onValueChange={(v) => setFilter(v as typeof filter)}
        >
          <SelectTrigger className="h-9 w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="seen">Seen</SelectItem>
            <SelectItem value="responded">Responded</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={typeFilter}
          onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}
        >
          <SelectTrigger className="h-9 w-[160px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="bug">Bug</SelectItem>
            <SelectItem value="feature">Feature</SelectItem>
            <SelectItem value="praise">Praise</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
        <span className="ml-auto text-[11px] font-mono text-muted-foreground">
          {filtered.length} shown
        </span>
      </div>

      {loading ? (
        <div className="py-16 text-center text-muted-foreground">
          <Loader2 className="inline animate-spin" size={18} />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            No feedback matches these filters.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((f) => (
            <FeedbackRowCard
              key={f.id}
              row={f}
              submitter={profiles[f.user_id]}
              thumb={f.image_paths[0] ? signedThumbs[f.image_paths[0]] : null}
              onSetStatus={(s) => setStatus(f.id, s)}
              onView={() => setDetail(f)}
            />
          ))}
        </div>
      )}

      <FeedbackDetailDialog
        feedback={detail}
        submitter={detail ? profiles[detail.user_id] : undefined}
        onClose={() => setDetail(null)}
        onSetStatus={(s) => {
          if (!detail) return;
          setStatus(detail.id, s);
          setDetail({ ...detail, status: s });
        }}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className={`text-base tabular-nums ${accent ?? ""}`}>{value}</span>
      <span className="text-[10px] uppercase tracking-widest">{label}</span>
    </span>
  );
}

function FeedbackRowCard({
  row,
  submitter,
  thumb,
  onSetStatus,
  onView,
}: {
  row: FeedbackRow;
  submitter?: Profile;
  thumb: string | null | undefined;
  onSetStatus: (s: FeedbackStatus) => void;
  onView: () => void;
}) {
  const meta = TYPE_META[row.type];
  const Icon = meta.icon;
  const [expanded, setExpanded] = useState(false);

  const submitterLabel =
    submitter?.display_name ||
    submitter?.username ||
    row.user_id.slice(0, 8) + "…";

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start gap-3">
          <span
            className="mt-0.5 inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider shrink-0"
            style={{ color: meta.color, borderColor: meta.color + "40" }}
          >
            <Icon size={11} />
            {meta.label}
          </span>
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">{row.subject}</div>
            <div className="text-[11px] font-mono text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-0.5">
              <span>{submitterLabel}</span>
              <span>·</span>
              <span>{format(new Date(row.created_at), "PPp")}</span>
              {row.image_paths.length > 0 && (
                <>
                  <span>·</span>
                  <span>
                    {row.image_paths.length} image
                    {row.image_paths.length === 1 ? "" : "s"}
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 text-[11px] gap-1"
              onClick={onView}
            >
              <Eye size={12} /> View
            </Button>
            <Select
              value={row.status}
              onValueChange={(v) => onSetStatus(v as FeedbackStatus)}
            >
              <SelectTrigger className="h-7 w-[124px] text-[11px]">
                <SelectValue>
                  <Badge
                    variant="secondary"
                    className={`text-[10px] font-mono uppercase tracking-wider ${STATUS_TONE[row.status]}`}
                  >
                    {row.status}
                  </Badge>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="seen">Seen</SelectItem>
                <SelectItem value="responded">Responded</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div
          className={`font-mono text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap break-words ${
            expanded ? "" : "line-clamp-3"
          }`}
        >
          {row.message}
        </div>
        {row.message.length > 200 && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="text-[11px] font-mono text-primary hover:underline"
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        )}

        {thumb && (
          <a
            href={thumb}
            target="_blank"
            rel="noreferrer"
            className="block w-32 mt-1 rounded-md border overflow-hidden bg-muted/30"
          >
            <img
              src={thumb}
              alt=""
              className="w-full h-auto block"
              loading="lazy"
            />
          </a>
        )}
      </CardContent>
    </Card>
  );
}

function FeedbackDetailDialog({
  feedback,
  submitter,
  onClose,
  onSetStatus,
}: {
  feedback: FeedbackRow | null;
  submitter?: Profile;
  onClose: () => void;
  onSetStatus: (s: FeedbackStatus) => void;
}) {
  const [signed, setSigned] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (!feedback || !feedback.image_paths.length) {
      setSigned([]);
      return;
    }
    (async () => {
      const urls: string[] = [];
      for (const p of feedback.image_paths) {
        const { data } = await supabase.storage
          .from("attachments")
          .createSignedUrl(p, 3600);
        if (data?.signedUrl) urls.push(data.signedUrl);
      }
      if (!cancelled) setSigned(urls);
    })();
    return () => {
      cancelled = true;
    };
  }, [feedback]);

  if (!feedback) {
    return (
      <Dialog open={false} onOpenChange={onClose}>
        <DialogContent />
      </Dialog>
    );
  }

  const meta = TYPE_META[feedback.type];
  const Icon = meta.icon;
  const submitterLabel =
    submitter?.display_name ||
    submitter?.username ||
    feedback.user_id.slice(0, 8) + "…";

  return (
    <Dialog open={!!feedback} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <span
              className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider"
              style={{ color: meta.color, borderColor: meta.color + "40" }}
            >
              <Icon size={11} />
              {meta.label}
            </span>
            <Badge
              variant="secondary"
              className={`text-[10px] font-mono uppercase tracking-wider ${STATUS_TONE[feedback.status]}`}
            >
              {feedback.status}
            </Badge>
          </div>
          <DialogTitle className="text-xl tracking-tight">
            {feedback.subject}
          </DialogTitle>
          <DialogDescription className="text-[11px] font-mono">
            From <span className="text-foreground">{submitterLabel}</span> ·{" "}
            {format(new Date(feedback.created_at), "PPpp")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">
              Message
            </div>
            <div className="rounded-md border bg-muted/30 px-3 py-2 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words">
              {feedback.message}
            </div>
          </div>

          {feedback.image_paths.length > 0 && (
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">
                Screenshots ({feedback.image_paths.length})
              </div>
              {signed.length === 0 ? (
                <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                  <Loader2 size={11} className="animate-spin" /> Loading images…
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {signed.map((u) => (
                    <a
                      key={u}
                      href={u}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-md border overflow-hidden bg-muted/30 hover:shadow-md transition"
                    >
                      <img
                        src={u}
                        alt=""
                        className="w-full h-auto block"
                        loading="lazy"
                      />
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 pt-2">
          <div className="mr-auto">
            <Select
              value={feedback.status}
              onValueChange={(v) => onSetStatus(v as FeedbackStatus)}
            >
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue placeholder="Set status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">Mark as New</SelectItem>
                <SelectItem value="seen">Mark as Seen</SelectItem>
                <SelectItem value="responded">Mark as Responded</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={onClose}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
