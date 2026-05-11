import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  useTaskboard,
  dueState,
  type Task,
  type Tag,
} from "@/lib/taskboard-data";
import {
  useAllTimeEntries,
  entrySeconds,
  fmtHours,
  type TimeEntry,
} from "@/lib/time-tracking";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Printer,
  Download,
  CalendarIcon,
  Image as ImageIcon,
} from "lucide-react";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type Period =
  | "today"
  | "yesterday"
  | "week"
  | "last7"
  | "month"
  | "last30"
  | "quarter"
  | "all"
  | "custom";

function rangeFor(
  period: Period,
  custom?: { from?: Date; to?: Date },
): { from: Date; to: Date; label: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const addDays = (d: Date, n: number) => {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  };
  const fmtDay = (d: Date) =>
    d.toLocaleDateString([], { month: "short", day: "numeric" });
  const fmtFull = (d: Date) =>
    d.toLocaleDateString([], {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });

  if (period === "today") {
    return { from: start, to: addDays(start, 1), label: fmtFull(start) };
  }
  if (period === "yesterday") {
    const from = addDays(start, -1);
    return { from, to: start, label: fmtFull(from) };
  }
  if (period === "week") {
    const day = start.getDay();
    const mondayOffset = (day + 6) % 7;
    const from = addDays(start, -mondayOffset);
    const to = addDays(from, 7);
    return { from, to, label: `Week of ${fmtDay(from)}` };
  }
  if (period === "last7") {
    const from = addDays(start, -6);
    const to = addDays(start, 1);
    return {
      from,
      to,
      label: `Last 7 days · ${fmtDay(from)} – ${fmtDay(start)}`,
    };
  }
  if (period === "month") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return {
      from,
      to,
      label: from.toLocaleDateString([], { month: "long", year: "numeric" }),
    };
  }
  if (period === "last30") {
    const from = addDays(start, -29);
    const to = addDays(start, 1);
    return {
      from,
      to,
      label: `Last 30 days · ${fmtDay(from)} – ${fmtDay(start)}`,
    };
  }
  if (period === "quarter") {
    const q = Math.floor(now.getMonth() / 3);
    const from = new Date(now.getFullYear(), q * 3, 1);
    const to = new Date(now.getFullYear(), q * 3 + 3, 1);
    return { from, to, label: `Q${q + 1} ${now.getFullYear()}` };
  }
  if (period === "custom") {
    const from = custom?.from
      ? new Date(
          custom.from.getFullYear(),
          custom.from.getMonth(),
          custom.from.getDate(),
        )
      : start;
    const toBase = custom?.to ?? custom?.from ?? start;
    const to = new Date(
      toBase.getFullYear(),
      toBase.getMonth(),
      toBase.getDate() + 1,
    );
    return {
      from,
      to,
      label: `${fmtDay(from)} – ${new Date(to.getTime() - 1).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}`,
    };
  }
  return {
    from: new Date(0),
    to: new Date(8640000000000000),
    label: "All time",
  };
}

function inRange(
  iso: string | null | undefined,
  from: Date,
  to: Date,
): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= from.getTime() && t < to.getTime();
}

function csvEscape(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadFile(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function PrintReport({
  open,
  onClose,
  filterTaskIds,
}: {
  open: boolean;
  onClose: () => void;
  /** When provided, only these task ids are included in the report —
   *  overrides the period filter for tasks. Time entries still filter by
   *  period so the report stays coherent. */
  filterTaskIds?: string[] | null;
}) {
  const { user } = useAuth();
  const { tasks, tags } = useTaskboard();
  const { entries } = useAllTimeEntries();
  const [period, setPeriod] = useState<Period>(
    filterTaskIds && filterTaskIds.length ? "all" : "today",
  );
  const [tagId, setTagId] = useState<string>("all");
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();

  const { from, to, label } = useMemo(
    () => rangeFor(period, { from: customFrom, to: customTo }),
    [period, customFrom, customTo],
  );

  const filtered = useMemo(() => {
    // Caller-supplied id filter (e.g. multi-select bulk print) wins — we
    // include exactly those tasks regardless of period or tag filter.
    if (filterTaskIds && filterTaskIds.length) {
      const set = new Set(filterTaskIds);
      return tasks.filter((t) => set.has(t.id));
    }
    return tasks.filter((t) => {
      if (tagId !== "all") {
        const child = tags
          .filter((x) => x.parent_id === tagId)
          .map((x) => x.id);
        if (!(t.tag_id === tagId || (t.tag_id && child.includes(t.tag_id))))
          return false;
      }
      if (period === "all") return true;
      return (
        inRange(t.updated_at, from, to) ||
        inRange(t.created_at, from, to) ||
        inRange(t.due_at ?? null, from, to)
      );
    });
  }, [tasks, tags, tagId, period, from, to, filterTaskIds]);

  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      if (tagId !== "all") {
        const child = tags
          .filter((x) => x.parent_id === tagId)
          .map((x) => x.id);
        const ok = e.tag_id === tagId || (e.tag_id && child.includes(e.tag_id));
        if (!ok) return false;
      }
      if (period === "all") return true;
      const sec = entrySeconds(e, from, to);
      return sec > 0;
    });
  }, [entries, tags, tagId, period, from, to]);

  const groupedByStatus = useMemo(() => {
    const m: Record<Task["status"], Task[]> = {
      todo: [],
      in_progress: [],
      done: [],
    };
    filtered.forEach((t) => m[t.status].push(t));
    return m;
  }, [filtered]);

  const total = filtered.length;
  const done = groupedByStatus.done.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const overdue = filtered.filter(
    (t) => dueState(t.due_at, t.status) === "overdue",
  ).length;

  const selectedTagName =
    tagId === "all"
      ? "All tags"
      : (tags.find((t) => t.id === tagId)?.name ?? "Tag");

  const doPrint = () => {
    document.body.classList.add("printing-report");
    const cleanup = () => {
      document.body.classList.remove("printing-report");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    setTimeout(() => window.print(), 50);
  };

  // Capture the hidden print-root as a PNG. The `.print-root` div is the
  // exact same DOM that the print stylesheet shows, so the image matches
  // the printed page 1:1. It's normally display:none — we temporarily flip
  // it visible (offscreen) for the capture.
  const [savingImage, setSavingImage] = useState(false);
  const saveAsImage = async () => {
    const root = document.querySelector(".print-root") as HTMLElement | null;
    if (!root) {
      toast.error("Nothing to capture");
      return;
    }
    setSavingImage(true);
    const previous = {
      display: root.style.display,
      position: root.style.position,
      left: root.style.left,
      top: root.style.top,
      zIndex: root.style.zIndex,
      background: root.style.background,
    };
    try {
      // Reveal offscreen so layout settles but the user doesn't see a flash.
      root.style.display = "block";
      root.style.position = "fixed";
      root.style.left = "-99999px";
      root.style.top = "0";
      root.style.zIndex = "-1";
      root.style.background = "#ffffff";
      // Give the browser a frame to lay out / load any signed image URLs
      // already in the DOM.
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      const dataUrl = await toPng(root, {
        backgroundColor: "#ffffff",
        pixelRatio: 2,
        cacheBust: true,
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `taskboard-report-${new Date().toISOString().slice(0, 10)}.png`;
      a.click();
      toast.success("Image saved");
    } catch (err) {
      console.error("[print] saveAsImage failed", err);
      toast.error("Couldn't save image");
    } finally {
      Object.assign(root.style, previous);
      setSavingImage(false);
    }
  };

  const exportCsv = () => {
    const tagName = (id: string | null) =>
      id ? (tags.find((t) => t.id === id)?.name ?? "") : "";
    // Tasks CSV
    const taskRows = [
      ["Name", "Status", "Tag", "Day", "Due", "Created", "Updated", "Note"],
      ...filtered.map((t) => [
        t.name,
        t.status,
        tagName(t.tag_id),
        t.day,
        t.due_at ? new Date(t.due_at).toLocaleString() : "",
        new Date(t.created_at).toLocaleString(),
        new Date(t.updated_at).toLocaleString(),
        t.note ?? "",
      ]),
    ];
    // Time entries CSV
    const isAll = period === "all";
    const timeRows = [
      ["Started", "Ended", "Duration (sec)", "Duration", "Tag", "Task", "Note"],
      ...filteredEntries.map((e) => {
        const sec = isAll ? entrySeconds(e) : entrySeconds(e, from, to);
        const taskName = e.task_id
          ? (tasks.find((t) => t.id === e.task_id)?.name ?? "")
          : "";
        return [
          new Date(e.started_at).toLocaleString(),
          e.ended_at ? new Date(e.ended_at).toLocaleString() : "(running)",
          sec,
          fmtHours(sec),
          tagName(e.tag_id),
          taskName,
          e.note ?? "",
        ];
      }),
    ];
    const csv =
      "TASKS\n" +
      taskRows.map((r) => r.map(csvEscape).join(",")).join("\n") +
      "\n\nTIME ENTRIES\n" +
      timeRows.map((r) => r.map(csvEscape).join(",")).join("\n");
    const stamp = new Date().toISOString().slice(0, 10);
    downloadFile(
      `taskboard-report-${stamp}.csv`,
      csv,
      "text/csv;charset=utf-8",
    );
  };

  useEffect(() => {
    if (!open) document.body.classList.remove("printing-report");
  }, [open]);

  const meta = user?.user_metadata as
    | { display_name?: string; username?: string }
    | undefined;
  const userName = meta?.display_name ?? meta?.username ?? user?.email ?? "you";

  // Image attachments per task, resolved to signed URLs so they render in
  // the printable surface. Refetched when the visible task set changes.
  const [taskImages, setTaskImages] = useState<Record<string, string[]>>({});
  useEffect(() => {
    if (!open) return;
    const ids = filtered.map((t) => t.id);
    if (!ids.length) {
      setTaskImages({});
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: rows } = await supabase
        .from("attachments")
        .select("task_id, file_path, mime_type")
        .in("task_id", ids);
      const grouped: Record<string, string[]> = {};
      for (const r of (rows ?? []) as Array<{
        task_id: string | null;
        file_path: string;
        mime_type: string;
      }>) {
        if (!r.task_id) continue;
        if (!r.mime_type.startsWith("image/")) continue;
        const { data: signed } = await supabase.storage
          .from("attachments")
          .createSignedUrl(r.file_path, 3600);
        if (signed?.signedUrl) {
          (grouped[r.task_id] ??= []).push(signed.signedUrl);
        }
      }
      if (!cancelled) setTaskImages(grouped);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, filtered]);

  // Per-tag time totals for the chosen window
  const timeStats = useMemo(() => {
    const isAll = period === "all";
    const m: Record<string, number> = {};
    let untag = 0;
    let totalSec = 0;
    filteredEntries.forEach((e) => {
      const sec = isAll ? entrySeconds(e) : entrySeconds(e, from, to);
      if (sec <= 0) return;
      totalSec += sec;
      if (e.tag_id) m[e.tag_id] = (m[e.tag_id] ?? 0) + sec;
      else untag += sec;
    });
    return { perTag: m, untagged: untag, totalSec };
  }, [filteredEntries, period, from, to]);

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Print / export report</DialogTitle>
            <DialogDescription>
              Pick a period and optional tag, then print, save as PDF, or export
              CSV.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Period</Label>
              <Select
                value={period}
                onValueChange={(v) => setPeriod(v as Period)}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="yesterday">Yesterday</SelectItem>
                  <SelectItem value="week">This week</SelectItem>
                  <SelectItem value="last7">Last 7 days</SelectItem>
                  <SelectItem value="month">This month</SelectItem>
                  <SelectItem value="last30">Last 30 days</SelectItem>
                  <SelectItem value="quarter">This quarter</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                  <SelectItem value="custom">Custom range…</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {period === "custom" && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                    From
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className={cn(
                          "h-9 w-full justify-start text-left font-normal text-xs",
                          !customFrom && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon size={13} />
                        {customFrom ? format(customFrom, "PP") : "Pick"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={customFrom}
                        onSelect={setCustomFrom}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                    To
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className={cn(
                          "h-9 w-full justify-start text-left font-normal text-xs",
                          !customTo && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon size={13} />
                        {customTo ? format(customTo, "PP") : "Pick"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={customTo}
                        onSelect={setCustomTo}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Tag filter</Label>
              <Select value={tagId} onValueChange={setTagId}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All tags</SelectItem>
                  {tags.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.parent_id ? "↳ " : ""}
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-md border bg-muted/40 p-3 text-xs space-y-1 font-mono">
              <div>
                <span className="text-muted-foreground">Range:</span> {label}
              </div>
              <div>
                <span className="text-muted-foreground">Tag:</span>{" "}
                {selectedTagName}
              </div>
              <div>
                <span className="text-muted-foreground">Tasks:</span> {total} ·{" "}
                {pct}% done · {overdue} overdue
              </div>
              <div>
                <span className="text-muted-foreground">Tracked:</span>{" "}
                {fmtHours(timeStats.totalSec)} across {filteredEntries.length}{" "}
                entr{filteredEntries.length === 1 ? "y" : "ies"}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 flex-wrap">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="outline" onClick={exportCsv} className="gap-1.5">
              <Download size={14} /> CSV
            </Button>
            <Button
              variant="outline"
              onClick={saveAsImage}
              disabled={savingImage}
              className="gap-1.5"
            >
              <ImageIcon size={14} />
              {savingImage ? "Saving…" : "Save as image"}
            </Button>
            <Button onClick={doPrint} className="gap-1.5">
              <Printer size={14} /> Print
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hidden printable surface — portaled to <body> so the print CSS
          rule `body.printing-report > *:not(.print-root)` actually targets
          it as a direct child instead of hiding it inside the app wrapper. */}
      {typeof document !== "undefined" &&
        createPortal(
          <div className="print-root" aria-hidden>
            <ReportSheet
              title={`Taskboard Report — ${label}`}
              tagLabel={selectedTagName}
              userName={userName}
              tasks={filtered}
              tags={tags}
              entries={filteredEntries}
              range={{ from, to, isAll: period === "all" }}
              stats={{ total, done, pct, overdue }}
              grouped={groupedByStatus}
              timeStats={timeStats}
              taskImages={taskImages}
            />
          </div>,
          document.body,
        )}
    </>
  );
}

function ReportSheet({
  title,
  tagLabel,
  userName,
  tasks,
  tags,
  entries,
  range,
  stats,
  grouped,
  timeStats,
  taskImages,
}: {
  title: string;
  tagLabel: string;
  userName: string;
  tasks: Task[];
  tags: Tag[];
  entries: TimeEntry[];
  range: { from: Date; to: Date; isAll: boolean };
  stats: { total: number; done: number; pct: number; overdue: number };
  grouped: Record<Task["status"], Task[]>;
  timeStats: {
    perTag: Record<string, number>;
    untagged: number;
    totalSec: number;
  };
  taskImages: Record<string, string[]>;
}) {
  const tagName = (id: string | null) =>
    id ? (tags.find((t) => t.id === id)?.name ?? "—") : "—";

  // Time per task within range
  const timePerTask = (() => {
    const m: Record<string, number> = {};
    entries.forEach((e) => {
      if (!e.task_id) return;
      const sec = range.isAll
        ? entrySeconds(e)
        : entrySeconds(e, range.from, range.to);
      if (sec > 0) m[e.task_id] = (m[e.task_id] ?? 0) + sec;
    });
    return m;
  })();

  const tagRows = (() => {
    const rows = tags
      .filter((t) => (timeStats.perTag[t.id] ?? 0) > 0)
      .map((t) => ({
        id: t.id,
        name: t.name,
        color: t.color,
        sec: timeStats.perTag[t.id],
      }))
      .sort((a, b) => b.sec - a.sec);
    if (timeStats.untagged > 0)
      rows.push({
        id: "__none__",
        name: "Untagged",
        color: "#999",
        sec: timeStats.untagged,
      });
    return rows;
  })();
  const maxTagSec = tagRows.reduce((m, r) => Math.max(m, r.sec), 0);

  // Inline SVG status bar
  const STATUS_FILL = {
    todo: "#a3a3a3",
    in_progress: "#3b82f6",
    done: "#22c55e",
  };
  const totalForBar = stats.total || 1;
  const segWidth = (n: number) => (n / totalForBar) * 100;

  return (
    <div
      style={{
        fontFamily:
          'Geist, "Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
        color: "#0f172a",
        background: "#fff",
        padding: "4mm 0",
        maxWidth: "190mm",
        margin: "0 auto",
        lineHeight: 1.45,
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 24,
          borderBottom: "2px solid #0f172a",
          paddingBottom: 14,
          marginBottom: 22,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 9,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "#64748b",
              fontWeight: 600,
            }}
          >
            Taskboard · Report
          </div>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 700,
              margin: "6px 0 0",
              letterSpacing: "-0.01em",
            }}
          >
            {title}
          </h1>
        </div>
        <div
          style={{
            textAlign: "right",
            fontSize: 10,
            color: "#475569",
            lineHeight: 1.6,
            fontFamily: "ui-monospace, SFMono-Regular, monospace",
          }}
        >
          <div>
            <span style={{ color: "#94a3b8" }}>Owner</span> · {userName}
          </div>
          <div>
            <span style={{ color: "#94a3b8" }}>Filter</span> · {tagLabel}
          </div>
          <div>
            <span style={{ color: "#94a3b8" }}>Generated</span> ·{" "}
            {new Date().toLocaleString()}
          </div>
        </div>
      </header>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, 1fr)",
          gap: 8,
          marginBottom: 22,
        }}
      >
        <Stat label="Total" value={stats.total} />
        <Stat
          label="Done"
          value={`${stats.done}`}
          accent={`${stats.pct}%`}
          tone="positive"
        />
        <Stat label="In progress" value={grouped.in_progress.length} />
        <Stat label="To do" value={grouped.todo.length} />
        <Stat
          label="Overdue"
          value={stats.overdue}
          tone={stats.overdue > 0 ? "warning" : undefined}
        />
        <Stat label="Tracked" value={fmtHours(timeStats.totalSec)} />
      </section>

      {/* Status bar chart */}
      <section style={{ marginBottom: 22, breakInside: "avoid" }}>
        <SectionHeading>Status overview</SectionHeading>
        <svg
          width="100%"
          height="14"
          style={{
            display: "block",
            borderRadius: 7,
            overflow: "hidden",
            background: "#f1f5f9",
          }}
        >
          {(() => {
            let x = 0;
            const segs: React.ReactElement[] = [];
            (["todo", "in_progress", "done"] as Task["status"][]).forEach(
              (s) => {
                const n = grouped[s].length;
                if (n === 0) return;
                const w = segWidth(n);
                segs.push(
                  <rect
                    key={s}
                    x={`${x}%`}
                    y={0}
                    width={`${w}%`}
                    height={14}
                    fill={STATUS_FILL[s]}
                  />,
                );
                x += w;
              },
            );
            return segs;
          })()}
        </svg>
        <div
          style={{
            display: "flex",
            gap: 18,
            fontSize: 10,
            marginTop: 8,
            color: "#475569",
          }}
        >
          <Legend
            color={STATUS_FILL.todo}
            label={`To do · ${grouped.todo.length}`}
          />
          <Legend
            color={STATUS_FILL.in_progress}
            label={`In progress · ${grouped.in_progress.length}`}
          />
          <Legend
            color={STATUS_FILL.done}
            label={`Done · ${grouped.done.length}`}
          />
        </div>
      </section>

      {/* Time tracked section */}
      {timeStats.totalSec > 0 && (
        <section style={{ marginBottom: 22, breakInside: "avoid" }}>
          <SectionHeading
            right={
              <span
                style={{
                  fontFamily: "ui-monospace, SFMono-Regular, monospace",
                  fontSize: 11,
                  color: "#0f172a",
                  fontWeight: 600,
                }}
              >
                {fmtHours(timeStats.totalSec)}
              </span>
            }
          >
            Time tracked
          </SectionHeading>
          {tagRows.map((r) => {
            const w = maxTagSec ? (r.sec / maxTagSec) * 100 : 0;
            const pct =
              timeStats.totalSec > 0
                ? Math.round((r.sec / timeStats.totalSec) * 100)
                : 0;
            return (
              <div key={r.id} style={{ marginBottom: 8 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    fontSize: 10.5,
                    marginBottom: 3,
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      background: r.color,
                      marginRight: 8,
                    }}
                  />
                  <span style={{ fontWeight: 500 }}>{r.name}</span>
                  <span style={{ marginLeft: 8, color: "#94a3b8" }}>
                    {pct}%
                  </span>
                  <span
                    style={{
                      marginLeft: "auto",
                      fontFamily: "ui-monospace, SFMono-Regular, monospace",
                      color: "#475569",
                    }}
                  >
                    {fmtHours(r.sec)}
                  </span>
                </div>
                <svg
                  width="100%"
                  height="6"
                  style={{
                    display: "block",
                    background: "#f1f5f9",
                    borderRadius: 3,
                  }}
                >
                  <rect x={0} y={0} width={`${w}%`} height={6} fill={r.color} />
                </svg>
              </div>
            );
          })}
        </section>
      )}

      {(["todo", "in_progress", "done"] as Task["status"][]).map((s) => (
        <section key={s} style={{ marginBottom: 18, breakInside: "avoid" }}>
          <SectionHeading
            right={
              <span
                style={{
                  fontFamily: "ui-monospace, SFMono-Regular, monospace",
                  fontSize: 10,
                  color: "#64748b",
                }}
              >
                {grouped[s].length} task{grouped[s].length === 1 ? "" : "s"}
              </span>
            }
          >
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: 4,
                background: STATUS_FILL[s],
                marginRight: 8,
                verticalAlign: "middle",
              }}
            />
            {s === "todo"
              ? "To do"
              : s === "in_progress"
                ? "In progress"
                : "Done"}
          </SectionHeading>
          {grouped[s].length === 0 ? (
            <div
              style={{
                fontSize: 10.5,
                color: "#94a3b8",
                padding: "6px 0",
                fontStyle: "italic",
              }}
            >
              No tasks in this group.
            </div>
          ) : (
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 10.5,
              }}
            >
              <thead>
                <tr
                  style={{
                    textAlign: "left",
                    color: "#94a3b8",
                    fontSize: 9,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  <th style={{ padding: "6px 8px", width: "50%" }}>Task</th>
                  <th style={{ padding: "6px 8px" }}>Tag</th>
                  <th style={{ padding: "6px 8px" }}>Day</th>
                  <th style={{ padding: "6px 8px" }}>Due</th>
                  <th style={{ padding: "6px 8px", textAlign: "right" }}>
                    Time
                  </th>
                </tr>
              </thead>
              <tbody>
                {grouped[s].map((t, i) => (
                  <tr
                    key={t.id}
                    style={{
                      borderTop: "1px solid #f1f5f9",
                      background: i % 2 === 0 ? "#fafafa" : "transparent",
                    }}
                  >
                    <td style={{ padding: "6px 8px" }}>
                      <div style={{ fontWeight: 500 }}>{t.name}</div>
                      {t.note && (
                        <div
                          style={{
                            color: "#64748b",
                            fontSize: 9.5,
                            marginTop: 2,
                            lineHeight: 1.4,
                          }}
                        >
                          {t.note}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "6px 8px", color: "#475569" }}>
                      {tagName(t.tag_id)}
                    </td>
                    <td
                      style={{
                        padding: "6px 8px",
                        textTransform: "capitalize",
                        color: "#475569",
                      }}
                    >
                      {t.day}
                    </td>
                    <td style={{ padding: "6px 8px", color: "#475569" }}>
                      {t.due_at ? new Date(t.due_at).toLocaleDateString() : "—"}
                    </td>
                    <td
                      style={{
                        padding: "6px 8px",
                        textAlign: "right",
                        fontFamily: "ui-monospace, SFMono-Regular, monospace",
                        color: "#0f172a",
                      }}
                    >
                      {timePerTask[t.id] ? fmtHours(timePerTask[t.id]) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ))}

      {/* Task screenshots — only render if any of the included tasks has at
          least one image attachment. */}
      {(() => {
        const withImages = tasks.filter(
          (t) => (taskImages[t.id]?.length ?? 0) > 0,
        );
        if (!withImages.length) return null;
        return (
          <section style={{ marginBottom: 18, breakInside: "avoid" }}>
            <SectionHeading>Attachments</SectionHeading>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {withImages.map((t) => (
                <div key={t.id} style={{ breakInside: "avoid" }}>
                  <div
                    style={{
                      fontSize: 10.5,
                      fontWeight: 500,
                      marginBottom: 4,
                      color: "#0f172a",
                    }}
                  >
                    {t.name}
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, 1fr)",
                      gap: 6,
                    }}
                  >
                    {(taskImages[t.id] ?? []).map((url, i) => (
                      <img
                        key={i}
                        src={url}
                        alt=""
                        style={{
                          width: "100%",
                          maxHeight: 140,
                          objectFit: "cover",
                          border: "1px solid #e2e8f0",
                          borderRadius: 4,
                          display: "block",
                        }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })()}

      {tasks.length === 0 && entries.length === 0 && (
        <div
          style={{
            fontSize: 11,
            color: "#94a3b8",
            padding: "32px 12px",
            textAlign: "center",
            border: "1px dashed #e2e8f0",
            borderRadius: 6,
          }}
        >
          Nothing matched these filters.
        </div>
      )}

      <footer
        style={{
          marginTop: 28,
          paddingTop: 12,
          borderTop: "1px solid #e2e8f0",
          fontSize: 9,
          color: "#94a3b8",
          textAlign: "center",
          letterSpacing: 1,
          textTransform: "uppercase",
          fontFamily: "ui-monospace, SFMono-Regular, monospace",
        }}
      >
        Taskboard · {new Date().getFullYear()}
      </footer>
    </div>
  );
}

function SectionHeading({
  children,
  right,
}: {
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        borderBottom: "1px solid #e2e8f0",
        paddingBottom: 5,
        marginBottom: 10,
      }}
    >
      <h2
        style={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 1.5,
          color: "#0f172a",
          margin: 0,
        }}
      >
        {children}
      </h2>
      {right}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  tone,
}: {
  label: string;
  value: string | number;
  accent?: string;
  tone?: "positive" | "warning";
}) {
  const valueColor =
    tone === "positive"
      ? "#15803d"
      : tone === "warning"
        ? "#b91c1c"
        : "#0f172a";
  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 6,
        padding: "8px 10px",
        background: "#fff",
      }}
    >
      <div
        style={{
          fontSize: 8.5,
          textTransform: "uppercase",
          letterSpacing: 1.2,
          color: "#94a3b8",
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 700,
          marginTop: 4,
          color: valueColor,
          letterSpacing: "-0.01em",
          lineHeight: 1.1,
          display: "flex",
          alignItems: "baseline",
          gap: 6,
        }}
      >
        <span>{value}</span>
        {accent && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 500,
              color: "#64748b",
              fontFamily: "ui-monospace, SFMono-Regular, monospace",
            }}
          >
            {accent}
          </span>
        )}
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span
        style={{
          display: "inline-block",
          width: 8,
          height: 8,
          borderRadius: 4,
          background: color,
        }}
      />
      {label}
    </span>
  );
}
