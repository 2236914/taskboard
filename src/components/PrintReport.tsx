import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { useTaskboard, dueState, type Task, type Tag } from "@/lib/taskboard-data";
import { useAllTimeEntries, entrySeconds, fmtHours, type TimeEntry } from "@/lib/time-tracking";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Printer, Download, CalendarIcon } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type Period = "today" | "yesterday" | "week" | "last7" | "month" | "last30" | "quarter" | "all" | "custom";

function rangeFor(period: Period, custom?: { from?: Date; to?: Date }): { from: Date; to: Date; label: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const fmtDay = (d: Date) => d.toLocaleDateString([], { month: "short", day: "numeric" });
  const fmtFull = (d: Date) => d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" });

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
    return { from, to, label: `Last 7 days · ${fmtDay(from)} – ${fmtDay(start)}` };
  }
  if (period === "month") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { from, to, label: from.toLocaleDateString([], { month: "long", year: "numeric" }) };
  }
  if (period === "last30") {
    const from = addDays(start, -29);
    const to = addDays(start, 1);
    return { from, to, label: `Last 30 days · ${fmtDay(from)} – ${fmtDay(start)}` };
  }
  if (period === "quarter") {
    const q = Math.floor(now.getMonth() / 3);
    const from = new Date(now.getFullYear(), q * 3, 1);
    const to = new Date(now.getFullYear(), q * 3 + 3, 1);
    return { from, to, label: `Q${q + 1} ${now.getFullYear()}` };
  }
  if (period === "custom") {
    const from = custom?.from ? new Date(custom.from.getFullYear(), custom.from.getMonth(), custom.from.getDate()) : start;
    const toBase = custom?.to ?? custom?.from ?? start;
    const to = new Date(toBase.getFullYear(), toBase.getMonth(), toBase.getDate() + 1);
    return {
      from, to,
      label: `${fmtDay(from)} – ${new Date(to.getTime() - 1).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}`,
    };
  }
  return { from: new Date(0), to: new Date(8640000000000000), label: "All time" };
}

function inRange(iso: string | null | undefined, from: Date, to: Date): boolean {
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
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function PrintReport({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const { tasks, tags } = useTaskboard();
  const { entries } = useAllTimeEntries();
  const [period, setPeriod] = useState<Period>("today");
  const [tagId, setTagId] = useState<string>("all");
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();

  const { from, to, label } = useMemo(
    () => rangeFor(period, { from: customFrom, to: customTo }),
    [period, customFrom, customTo],
  );

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (tagId !== "all") {
        const child = tags.filter((x) => x.parent_id === tagId).map((x) => x.id);
        if (!(t.tag_id === tagId || (t.tag_id && child.includes(t.tag_id)))) return false;
      }
      if (period === "all") return true;
      return (
        inRange(t.updated_at, from, to) ||
        inRange(t.created_at, from, to) ||
        inRange(t.due_at ?? null, from, to)
      );
    });
  }, [tasks, tags, tagId, period, from, to]);

  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      if (tagId !== "all") {
        const child = tags.filter((x) => x.parent_id === tagId).map((x) => x.id);
        const ok = e.tag_id === tagId || (e.tag_id && child.includes(e.tag_id));
        if (!ok) return false;
      }
      if (period === "all") return true;
      const sec = entrySeconds(e, from, to);
      return sec > 0;
    });
  }, [entries, tags, tagId, period, from, to]);

  const groupedByStatus = useMemo(() => {
    const m: Record<Task["status"], Task[]> = { todo: [], in_progress: [], done: [] };
    filtered.forEach((t) => m[t.status].push(t));
    return m;
  }, [filtered]);

  const total = filtered.length;
  const done = groupedByStatus.done.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const overdue = filtered.filter((t) => dueState(t.due_at, t.status) === "overdue").length;

  const selectedTagName =
    tagId === "all" ? "All tags" : tags.find((t) => t.id === tagId)?.name ?? "Tag";

  const doPrint = () => {
    document.body.classList.add("printing-report");
    const cleanup = () => {
      document.body.classList.remove("printing-report");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    setTimeout(() => window.print(), 50);
  };

  const exportCsv = () => {
    const tagName = (id: string | null) => (id ? tags.find((t) => t.id === id)?.name ?? "" : "");
    // Tasks CSV
    const taskRows = [
      ["Name", "Status", "Tag", "Day", "Due", "Created", "Updated", "Note"],
      ...filtered.map((t) => [
        t.name, t.status, tagName(t.tag_id), t.day,
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
        const taskName = e.task_id ? tasks.find((t) => t.id === e.task_id)?.name ?? "" : "";
        return [
          new Date(e.started_at).toLocaleString(),
          e.ended_at ? new Date(e.ended_at).toLocaleString() : "(running)",
          sec, fmtHours(sec),
          tagName(e.tag_id), taskName, e.note ?? "",
        ];
      }),
    ];
    const csv =
      "TASKS\n" +
      taskRows.map((r) => r.map(csvEscape).join(",")).join("\n") +
      "\n\nTIME ENTRIES\n" +
      timeRows.map((r) => r.map(csvEscape).join(",")).join("\n");
    const stamp = new Date().toISOString().slice(0, 10);
    downloadFile(`taskboard-report-${stamp}.csv`, csv, "text/csv;charset=utf-8");
  };

  useEffect(() => {
    if (!open) document.body.classList.remove("printing-report");
  }, [open]);

  const userName =
    (user?.user_metadata as any)?.display_name ??
    (user?.user_metadata as any)?.username ??
    user?.email ??
    "you";

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
            <DialogDescription>Pick a period and optional tag, then print, save as PDF, or export CSV.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Period</Label>
              <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
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
                  <Label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">From</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" className={cn("h-9 w-full justify-start text-left font-normal text-xs", !customFrom && "text-muted-foreground")}>
                        <CalendarIcon size={13} />
                        {customFrom ? format(customFrom, "PP") : "Pick"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} initialFocus className={cn("p-3 pointer-events-auto")} />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">To</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" className={cn("h-9 w-full justify-start text-left font-normal text-xs", !customTo && "text-muted-foreground")}>
                        <CalendarIcon size={13} />
                        {customTo ? format(customTo, "PP") : "Pick"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={customTo} onSelect={setCustomTo} initialFocus className={cn("p-3 pointer-events-auto")} />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Tag filter</Label>
              <Select value={tagId} onValueChange={setTagId}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All tags</SelectItem>
                  {tags.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.parent_id ? "↳ " : ""}{t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-md border bg-muted/40 p-3 text-xs space-y-1 font-mono">
              <div><span className="text-muted-foreground">Range:</span> {label}</div>
              <div><span className="text-muted-foreground">Tag:</span> {selectedTagName}</div>
              <div><span className="text-muted-foreground">Tasks:</span> {total} · {pct}% done · {overdue} overdue</div>
              <div><span className="text-muted-foreground">Tracked:</span> {fmtHours(timeStats.totalSec)} across {filteredEntries.length} entr{filteredEntries.length === 1 ? "y" : "ies"}</div>
            </div>
          </div>
          <DialogFooter className="gap-2 flex-wrap">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="outline" onClick={exportCsv} className="gap-1.5"><Download size={14} /> Export CSV</Button>
            <Button onClick={doPrint} className="gap-1.5"><Printer size={14} /> Print</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hidden printable surface — only visible during print */}
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
        />
      </div>
    </>
  );
}

function ReportSheet({
  title, tagLabel, userName, tasks, tags, entries, range, stats, grouped, timeStats,
}: {
  title: string; tagLabel: string; userName: string;
  tasks: Task[]; tags: Tag[];
  entries: TimeEntry[];
  range: { from: Date; to: Date; isAll: boolean };
  stats: { total: number; done: number; pct: number; overdue: number };
  grouped: Record<Task["status"], Task[]>;
  timeStats: { perTag: Record<string, number>; untagged: number; totalSec: number };
}) {
  const tagName = (id: string | null) => (id ? tags.find((t) => t.id === id)?.name ?? "—" : "—");

  // Time per task within range
  const timePerTask = (() => {
    const m: Record<string, number> = {};
    entries.forEach((e) => {
      if (!e.task_id) return;
      const sec = range.isAll ? entrySeconds(e) : entrySeconds(e, range.from, range.to);
      if (sec > 0) m[e.task_id] = (m[e.task_id] ?? 0) + sec;
    });
    return m;
  })();

  const tagRows = (() => {
    const rows = tags
      .filter((t) => (timeStats.perTag[t.id] ?? 0) > 0)
      .map((t) => ({ id: t.id, name: t.name, color: t.color, sec: timeStats.perTag[t.id] }))
      .sort((a, b) => b.sec - a.sec);
    if (timeStats.untagged > 0) rows.push({ id: "__none__", name: "Untagged", color: "#999", sec: timeStats.untagged });
    return rows;
  })();
  const maxTagSec = tagRows.reduce((m, r) => Math.max(m, r.sec), 0);

  // Inline SVG status bar
  const STATUS_FILL = { todo: "#a3a3a3", in_progress: "#3b82f6", done: "#22c55e" };
  const totalForBar = stats.total || 1;
  const segWidth = (n: number) => (n / totalForBar) * 100;

  return (
    <div style={{
      fontFamily: "Geist, system-ui, sans-serif",
      color: "#111", background: "#fff",
      padding: "8mm 0", maxWidth: "210mm", margin: "0 auto",
    }}>
      <header style={{ borderBottom: "1px solid #ddd", paddingBottom: 12, marginBottom: 16 }}>
        <div style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: "#666" }}>
          Taskboard · {userName}
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: "4px 0 0" }}>{title}</h1>
        <div style={{ fontSize: 12, color: "#444", marginTop: 4 }}>
          Tag: {tagLabel} · Generated {new Date().toLocaleString()}
        </div>
      </header>

      <section style={{ display: "flex", gap: 16, marginBottom: 16, fontSize: 12 }}>
        <Stat label="Total" value={stats.total} />
        <Stat label="Done" value={`${stats.done} (${stats.pct}%)`} />
        <Stat label="In progress" value={grouped.in_progress.length} />
        <Stat label="To do" value={grouped.todo.length} />
        <Stat label="Overdue" value={stats.overdue} />
        <Stat label="Tracked" value={fmtHours(timeStats.totalSec)} />
      </section>

      {/* Status bar chart */}
      <section style={{ marginBottom: 18, breakInside: "avoid" }}>
        <h2 style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#666", marginBottom: 6 }}>
          Status overview
        </h2>
        <svg width="100%" height="22" style={{ display: "block", borderRadius: 4, overflow: "hidden", background: "#eee" }}>
          {(() => {
            let x = 0;
            const segs: React.ReactElement[] = [];
            (["todo", "in_progress", "done"] as Task["status"][]).forEach((s) => {
              const n = grouped[s].length;
              if (n === 0) return;
              const w = segWidth(n);
              segs.push(<rect key={s} x={`${x}%`} y={0} width={`${w}%`} height={22} fill={STATUS_FILL[s]} />);
              x += w;
            });
            return segs;
          })()}
        </svg>
        <div style={{ display: "flex", gap: 14, fontSize: 10, marginTop: 6, color: "#444" }}>
          <Legend color={STATUS_FILL.todo} label={`To do · ${grouped.todo.length}`} />
          <Legend color={STATUS_FILL.in_progress} label={`In progress · ${grouped.in_progress.length}`} />
          <Legend color={STATUS_FILL.done} label={`Done · ${grouped.done.length}`} />
        </div>
      </section>

      {/* Time tracked section */}
      {timeStats.totalSec > 0 && (
        <section style={{ marginBottom: 18, breakInside: "avoid" }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, borderBottom: "1px solid #eee", paddingBottom: 4, marginBottom: 8 }}>
            Time tracked · {fmtHours(timeStats.totalSec)}
          </h2>
          {tagRows.map((r) => {
            const w = maxTagSec ? (r.sec / maxTagSec) * 100 : 0;
            return (
              <div key={r.id} style={{ marginBottom: 6 }}>
                <div style={{ display: "flex", fontSize: 11, marginBottom: 2 }}>
                  <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 4, background: r.color, marginRight: 6, alignSelf: "center" }} />
                  <span>{r.name}</span>
                  <span style={{ marginLeft: "auto", fontFamily: "ui-monospace, monospace", color: "#444" }}>{fmtHours(r.sec)}</span>
                </div>
                <svg width="100%" height="8" style={{ display: "block", background: "#eee", borderRadius: 4 }}>
                  <rect x={0} y={0} width={`${w}%`} height={8} fill={r.color} />
                </svg>
              </div>
            );
          })}
        </section>
      )}

      {(["todo", "in_progress", "done"] as Task["status"][]).map((s) => (
        <section key={s} style={{ marginBottom: 14, breakInside: "avoid" }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, borderBottom: "1px solid #eee", paddingBottom: 4, marginBottom: 6 }}>
            {s === "todo" ? "To do" : s === "in_progress" ? "In progress" : "Done"} ({grouped[s].length})
          </h2>
          {grouped[s].length === 0 ? (
            <div style={{ fontSize: 11, color: "#888", padding: "4px 0" }}>No tasks.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#666" }}>
                  <th style={{ padding: "4px 6px", width: "48%" }}>Task</th>
                  <th style={{ padding: "4px 6px" }}>Tag</th>
                  <th style={{ padding: "4px 6px" }}>Day</th>
                  <th style={{ padding: "4px 6px" }}>Due</th>
                  <th style={{ padding: "4px 6px", textAlign: "right" }}>Time</th>
                </tr>
              </thead>
              <tbody>
                {grouped[s].map((t) => (
                  <tr key={t.id} style={{ borderTop: "1px solid #f1f1f1" }}>
                    <td style={{ padding: "4px 6px" }}>
                      {t.name}
                      {t.note && <div style={{ color: "#666", fontSize: 10, marginTop: 2 }}>{t.note}</div>}
                    </td>
                    <td style={{ padding: "4px 6px" }}>{tagName(t.tag_id)}</td>
                    <td style={{ padding: "4px 6px", textTransform: "capitalize" }}>{t.day}</td>
                    <td style={{ padding: "4px 6px" }}>
                      {t.due_at ? new Date(t.due_at).toLocaleDateString() : "—"}
                    </td>
                    <td style={{ padding: "4px 6px", textAlign: "right", fontFamily: "ui-monospace, monospace" }}>
                      {timePerTask[t.id] ? fmtHours(timePerTask[t.id]) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ))}

      {tasks.length === 0 && entries.length === 0 && (
        <div style={{ fontSize: 12, color: "#888", padding: 12, textAlign: "center" }}>
          Nothing matched these filters.
        </div>
      )}

      <footer style={{ marginTop: 24, fontSize: 10, color: "#999", textAlign: "center" }}>
        Taskboard
      </footer>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ flex: 1, border: "1px solid #eee", borderRadius: 6, padding: "8px 10px" }}>
      <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 1, color: "#888" }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 600, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 4, background: color }} />
      {label}
    </span>
  );
}
