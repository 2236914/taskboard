import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Bug,
  Lightbulb,
  Heart,
  MessageSquare,
  Image as ImageIcon,
  X,
  Loader2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

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

const TYPE_META: Record<
  FeedbackType,
  { label: string; icon: React.ComponentType<{ size?: number }>; color: string }
> = {
  bug: { label: "Bug", icon: Bug, color: "#dc2626" },
  feature: { label: "Feature request", icon: Lightbulb, color: "#ea580c" },
  praise: { label: "Praise", icon: Heart, color: "#16a34a" },
  other: { label: "Other", icon: MessageSquare, color: "#64748b" },
};

const STATUS_META: Record<FeedbackStatus, { label: string; tone: string }> = {
  new: {
    label: "New",
    tone: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  },
  seen: {
    label: "Seen",
    tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  },
  responded: {
    label: "Responded",
    tone: "bg-green-500/15 text-green-700 dark:text-green-300",
  },
};

const MAX_IMAGES = 5;
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB per image

export function FeedbackView() {
  const { user } = useAuth();
  const [type, setType] = useState<FeedbackType>("other");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<FeedbackRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---- preview lifecycle ----
  useEffect(() => {
    const urls = pendingImages.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [pendingImages]);

  // ---- history ----
  const loadHistory = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("feedback")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      toast.error("Couldn't load your feedback history");
      return;
    }
    setHistory((data ?? []) as FeedbackRow[]);
    setHistoryLoading(false);
  }, [user]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // ---- file handling ----
  const addFiles = (files: FileList | File[]) => {
    const incoming = Array.from(files).filter((f) =>
      f.type.startsWith("image/"),
    );
    if (!incoming.length) {
      toast.error("Only image files are allowed");
      return;
    }
    const tooBig = incoming.find((f) => f.size > MAX_BYTES);
    if (tooBig) {
      toast.error(`"${tooBig.name}" is over 5 MB`);
      return;
    }
    setPendingImages((prev) => {
      const next = [...prev, ...incoming].slice(0, MAX_IMAGES);
      if (prev.length + incoming.length > MAX_IMAGES) {
        toast.message(`Capped at ${MAX_IMAGES} images per submission`);
      }
      return next;
    });
  };

  const removeFile = (i: number) => {
    setPendingImages((prev) => prev.filter((_, idx) => idx !== i));
  };

  // Paste anywhere in the form to attach screenshots.
  useEffect(() => {
    const onPaste = (ev: ClipboardEvent) => {
      const items = ev.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (const it of items) {
        if (it.kind === "file") {
          const f = it.getAsFile();
          if (f && f.type.startsWith("image/")) files.push(f);
        }
      }
      if (files.length) {
        ev.preventDefault();
        addFiles(files);
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, []);

  // ---- submit ----
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!subject.trim() || !message.trim()) {
      toast.error("Subject and message are required");
      return;
    }
    setBusy(true);
    try {
      // 1. Insert the row to mint an id.
      const { data: row, error: insertErr } = await supabase
        .from("feedback")
        .insert({
          user_id: user.id,
          type,
          subject: subject.trim(),
          message: message.trim(),
          image_paths: [],
        })
        .select()
        .single();
      if (insertErr || !row) throw insertErr ?? new Error("Insert failed");

      const created = row as FeedbackRow;

      // 2. Upload each image into the existing attachments bucket under the
      //    user's own folder so storage RLS allows it. Path layout:
      //    "{userId}/feedback/{feedbackId}/{ts}-{filename}"
      const paths: string[] = [];
      for (const f of pendingImages) {
        const safeName = f.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${user.id}/feedback/${created.id}/${Date.now()}-${safeName}`;
        const { error: upErr } = await supabase.storage
          .from("attachments")
          .upload(path, f, { contentType: f.type });
        if (upErr) {
          toast.error(`Couldn't upload ${f.name}`);
          continue;
        }
        paths.push(path);
      }

      // 3. Patch the row with the uploaded paths so we don't have to do
      //    another round-trip just to learn the file paths.
      if (paths.length) {
        await supabase
          .from("feedback")
          .update({ image_paths: paths })
          .eq("id", created.id);
        created.image_paths = paths;
      }

      toast.success("Thanks — we got it.");
      setSubject("");
      setMessage("");
      setType("other");
      setPendingImages([]);
      setHistory((prev) => [created, ...prev]);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't submit feedback",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Form */}
      <Card className="col-span-12 lg:col-span-7">
        <CardHeader>
          <CardDescription className="text-[11px] font-mono uppercase tracking-widest">
            Feedback
          </CardDescription>
          <CardTitle className="text-2xl tracking-tight">
            Tell us what's on your mind
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Bugs, ideas, praise — all welcome. Attach screenshots if it helps.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  Type
                </Label>
                <Select
                  value={type}
                  onValueChange={(v) => setType(v as FeedbackType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      ["bug", "feature", "praise", "other"] as FeedbackType[]
                    ).map((t) => {
                      const meta = TYPE_META[t];
                      const Icon = meta.icon;
                      return (
                        <SelectItem key={t} value={t}>
                          <span className="flex items-center gap-2">
                            <Icon size={13} />
                            {meta.label}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label
                  htmlFor="fb-subject"
                  className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground"
                >
                  Subject
                </Label>
                <Input
                  id="fb-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Short summary"
                  required
                  maxLength={120}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="fb-msg"
                className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground"
              >
                Message
              </Label>
              <Textarea
                id="fb-msg"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Steps to reproduce, what you'd expect, what you saw…"
                rows={6}
                required
                maxLength={4000}
                className="font-mono text-xs"
              />
              <div className="text-[10px] text-muted-foreground text-right">
                {message.length} / 4000
              </div>
            </div>

            {/* Image upload */}
            <div className="space-y-2">
              <Label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Screenshots (optional · up to {MAX_IMAGES})
              </Label>
              <DropZone
                onFiles={addFiles}
                onClick={() => fileInputRef.current?.click()}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              {previews.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {previews.map((url, i) => (
                    <div
                      key={url}
                      className="relative rounded-md border overflow-hidden bg-muted/30 aspect-square"
                    >
                      <img
                        src={url}
                        alt={pendingImages[i]?.name ?? ""}
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        className="absolute top-1 right-1 rounded-full bg-background/90 p-0.5 hover:bg-background"
                        aria-label="Remove image"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                type="submit"
                className="rounded-full"
                disabled={busy || !subject.trim() || !message.trim()}
              >
                {busy ? (
                  <>
                    <Loader2 size={13} className="animate-spin" /> Submitting…
                  </>
                ) : (
                  "Submit feedback"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* History */}
      <Card className="col-span-12 lg:col-span-5">
        <CardHeader>
          <CardDescription className="text-[11px] font-mono uppercase tracking-widest">
            Your submissions
          </CardDescription>
          <CardTitle className="text-base">
            {historyLoading ? "Loading…" : `${history.length} total`}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
          {historyLoading ? (
            <div className="py-10 text-center text-muted-foreground">
              <Loader2 className="inline animate-spin" size={16} />
            </div>
          ) : history.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-muted/30 py-10 px-4 text-center">
              <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">
                No feedback yet
              </div>
              <div className="text-[11px] text-muted-foreground">
                Anything you submit will show up here.
              </div>
            </div>
          ) : (
            history.map((f) => <HistoryItem key={f.id} item={f} />)
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------- Drop zone ----------

function DropZone({
  onFiles,
  onClick,
}: {
  onFiles: (files: FileList | File[]) => void;
  onClick: () => void;
}) {
  const [over, setOver] = useState(false);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
      }}
      className={`rounded-lg border border-dashed px-4 py-6 text-center cursor-pointer transition ${
        over ? "border-primary bg-primary/5" : "bg-muted/20 hover:bg-muted/40"
      }`}
    >
      <Upload size={18} className="inline-block text-muted-foreground mb-2" />
      <div className="text-xs">
        <span className="font-medium">Click to upload</span>,{" "}
        <span>drag and drop</span>, or paste an image
      </div>
      <div className="text-[10px] text-muted-foreground mt-1">
        PNG / JPG · up to 5 MB each
      </div>
    </div>
  );
}

// ---------- History item ----------

function HistoryItem({ item }: { item: FeedbackRow }) {
  const meta = TYPE_META[item.type];
  const status = STATUS_META[item.status];
  const Icon = meta.icon;
  const [signed, setSigned] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (!item.image_paths.length) return;
    (async () => {
      const urls: string[] = [];
      for (const p of item.image_paths) {
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
  }, [item.image_paths]);

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2">
      <div className="flex items-start gap-2">
        <span
          className="mt-0.5 inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider"
          style={{ color: meta.color, borderColor: meta.color + "40" }}
        >
          <Icon size={11} />
          {meta.label}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{item.subject}</div>
          <div className="text-[10px] font-mono text-muted-foreground">
            {format(new Date(item.created_at), "PPp")}
          </div>
        </div>
        <Badge
          variant="secondary"
          className={`shrink-0 text-[10px] font-mono uppercase tracking-wider ${status.tone}`}
        >
          {status.label}
        </Badge>
      </div>
      <div className="font-mono text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
        {item.message}
      </div>
      {signed.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 pt-1">
          {signed.map((u) => (
            <a
              key={u}
              href={u}
              target="_blank"
              rel="noreferrer"
              className="block rounded-md border overflow-hidden bg-muted/30 aspect-square"
            >
              <img
                src={u}
                alt=""
                className="h-full w-full object-cover hover:scale-105 transition"
                loading="lazy"
              />
            </a>
          ))}
        </div>
      )}
      {item.image_paths.length > 0 && signed.length === 0 && (
        <div className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
          <ImageIcon size={11} /> {item.image_paths.length} image
          {item.image_paths.length === 1 ? "" : "s"} (loading…)
        </div>
      )}
    </div>
  );
}
