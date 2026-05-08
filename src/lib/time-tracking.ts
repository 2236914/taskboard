import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

const PAUSE_KEY = "tt:paused";
type PausedSnapshot = { tag_id: string | null; task_id: string | null; note: string | null; paused_at: string; reason?: string | null };
function readPaused(): PausedSnapshot | null {
  try { const v = localStorage.getItem(PAUSE_KEY); return v ? JSON.parse(v) : null; } catch { return null; }
}
function writePaused(v: PausedSnapshot | null) {
  try { v ? localStorage.setItem(PAUSE_KEY, JSON.stringify(v)) : localStorage.removeItem(PAUSE_KEY); } catch { /* ignore */ }
}

export type TimeEntry = {
  id: string;
  user_id: string;
  task_id: string | null;
  tag_id: string | null;
  started_at: string;
  ended_at: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

/** Format seconds → "h:mm:ss" or "m:ss". */
export function fmtDuration(totalSec: number, opts?: { compact?: boolean }): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  if (opts?.compact) return `${m}:${String(sec).padStart(2, "0")}`;
  return `0:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/** Format seconds → "Xh Ym" for reports. */
export function fmtHours(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h === 0 && m === 0) return "—";
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Compute clipped seconds for an entry within an optional [from, to) window. */
export function entrySeconds(e: TimeEntry, from?: Date, to?: Date): number {
  const start = new Date(e.started_at).getTime();
  const end = e.ended_at ? new Date(e.ended_at).getTime() : Date.now();
  const lo = from ? Math.max(start, from.getTime()) : start;
  const hi = to ? Math.min(end, to.getTime()) : end;
  return Math.max(0, Math.floor((hi - lo) / 1000));
}

/** Returns the currently running entry (if any) and start/stop helpers. */
export function useActiveTimer() {
  const { user } = useAuth();
  const [active, setActive] = useState<TimeEntry | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) { setActive(null); setLoading(false); return; }
    const { data } = await supabase
      .from("time_entries")
      .select("*")
      .is("ended_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setActive((data as TimeEntry | null) ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  // Realtime: keep active timer in sync across tabs
  const refreshRef = useRef(refresh);
  useEffect(() => { refreshRef.current = refresh; }, [refresh]);
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`time-entries-active-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "time_entries", filter: `user_id=eq.${user.id}` }, () => {
        refreshRef.current();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const stop = useCallback(async (opts?: { silent?: boolean; allowUndo?: boolean }): Promise<TimeEntry | null> => {
    if (!user) return null;
    const { data, error } = await supabase
      .from("time_entries")
      .update({ ended_at: new Date().toISOString() })
      .is("ended_at", null)
      .eq("user_id", user.id)
      .select()
      .maybeSingle();
    if (error) { toast.error("Couldn't stop timer"); return null; }
    setActive(null);
    if (!opts?.silent && data) {
      const snap = data as TimeEntry;
      const allowUndo = opts?.allowUndo !== false;
      toast.success("Clocked out", {
        action: allowUndo
          ? {
              label: "Undo",
              onClick: async () => {
                const { data: restored, error: undoErr } = await supabase
                  .from("time_entries")
                  .update({ ended_at: null })
                  .eq("id", snap.id)
                  .select()
                  .maybeSingle();
                if (undoErr) { toast.error("Couldn't undo"); return; }
                if (restored) {
                  setActive(restored as TimeEntry);
                  toast.success("Timer resumed");
                }
              },
            }
          : undefined,
      });
    }
    return (data as TimeEntry | null) ?? null;
  }, [user]);

  const startInternal = useCallback(async (
    payload: { task_id?: string | null; tag_id?: string | null; note?: string | null },
    opts?: { silent?: boolean; allowDuplicate?: boolean; keepPrevious?: boolean },
  ): Promise<TimeEntry | null> => {
    if (!user) return null;
    // Dedupe: if the same tag/task is already running, skip with a clear message
    if (
      !opts?.allowDuplicate &&
      active &&
      active.tag_id === (payload.tag_id ?? null) &&
      active.task_id === (payload.task_id ?? null)
    ) {
      if (!opts?.silent) {
        const elapsedSec = Math.max(0, Math.floor((Date.now() - new Date(active.started_at).getTime()) / 1000));
        toast.info("Already tracking this", {
          description: `Running for ${fmtDuration(elapsedSec, { compact: true })} — use Clock out to stop.`,
        });
      }
      return active;
    }
    if (!opts?.keepPrevious) {
      await stop({ silent: true });
    }
    const { data, error } = await supabase
      .from("time_entries")
      .insert({
        user_id: user.id,
        task_id: payload.task_id ?? null,
        tag_id: payload.tag_id ?? null,
        note: payload.note ?? null,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) { toast.error("Couldn't start timer"); return null; }
    setActive(data as TimeEntry);
    writePaused(null);
    if (!opts?.silent) {
      toast.success(opts?.keepPrevious ? "New session started (previous kept running)" : "Clocked in");
    }
    return data as TimeEntry;
  }, [user, stop, active]);

  const startTask = useCallback(async (task_id: string, tag_id: string | null, opts?: { keepPrevious?: boolean; allowDuplicate?: boolean }) => {
    return startInternal({ task_id, tag_id }, opts);
  }, [startInternal]);

  const startTag = useCallback(async (tag_id: string, note?: string, opts?: { keepPrevious?: boolean; allowDuplicate?: boolean }) => {
    return startInternal({ tag_id, note }, opts);
  }, [startInternal]);

  // Pause: stop current entry but remember it for one-click resume
  const pause = useCallback(async (reason?: string) => {
    if (!active) return;
    const trimmed = reason?.trim() || null;
    // Append break reason to the active entry's note before stopping
    if (trimmed) {
      const merged = active.note ? `${active.note}\n[Break: ${trimmed}]` : `[Break: ${trimmed}]`;
      await supabase.from("time_entries").update({ note: merged }).eq("id", active.id);
    }
    const snap: PausedSnapshot = {
      tag_id: active.tag_id,
      task_id: active.task_id,
      note: active.note,
      paused_at: new Date().toISOString(),
      reason: trimmed,
    };
    await stop({ silent: true });
    writePaused(snap);
    toast.message("Paused", { description: trimmed ? `Reason: ${trimmed}` : "Resume anytime to continue." });
  }, [active, stop]);

  const resume = useCallback(async () => {
    const snap = readPaused();
    if (!snap) { toast.error("Nothing to resume"); return null; }
    const r = await startInternal({ tag_id: snap.tag_id, task_id: snap.task_id, note: snap.note }, { silent: true });
    if (r) toast.success("Resumed");
    return r;
  }, [startInternal]);

  const paused = readPaused();

  return { active, loading, refresh, stop, startTask, startTag, pause, resume, paused };
}

/** Per-task time totals + entries list (for TaskModal). */
export function useTaskTime(taskId: string | null | undefined) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user || !taskId) { setEntries([]); setLoading(false); return; }
    const { data } = await supabase
      .from("time_entries")
      .select("*")
      .eq("task_id", taskId)
      .order("started_at", { ascending: false });
    setEntries((data ?? []) as TimeEntry[]);
    setLoading(false);
  }, [user, taskId]);

  useEffect(() => { refresh(); }, [refresh]);

  // Realtime for this task
  const refreshRef2 = useRef(refresh);
  useEffect(() => { refreshRef2.current = refresh; }, [refresh]);
  useEffect(() => {
    if (!user || !taskId) return;
    const ch = supabase
      .channel(`time-entries-task-${taskId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "time_entries", filter: `task_id=eq.${taskId}` }, () => refreshRef2.current())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, taskId]);

  const totalSec = entries.reduce((acc, e) => acc + entrySeconds(e), 0);

  const deleteEntry = async (id: string) => {
    await supabase.from("time_entries").delete().eq("id", id);
    setEntries((p) => p.filter((e) => e.id !== id));
  };

  const updateEntry = async (
    id: string,
    patch: { note?: string | null; started_at?: string; ended_at?: string | null },
  ) => {
    const { data } = await supabase
      .from("time_entries")
      .update(patch)
      .eq("id", id)
      .select()
      .maybeSingle();
    if (data) setEntries((p) => p.map((e) => (e.id === id ? (data as TimeEntry) : e)));
  };

  return { entries, totalSec, loading, refresh, deleteEntry, updateEntry };
}

/** All entries the user has, useful for Reports / Print. */
export function useAllTimeEntries() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) { setEntries([]); setLoading(false); return; }
    const { data } = await supabase
      .from("time_entries")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(1000);
    setEntries((data ?? []) as TimeEntry[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const refreshRef3 = useRef(refresh);
  useEffect(() => { refreshRef3.current = refresh; }, [refresh]);
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`time-entries-all-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "time_entries", filter: `user_id=eq.${user.id}` }, () => refreshRef3.current())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const createManualEntry = useCallback(async (input: {
    tag_id: string | null;
    task_id?: string | null;
    started_at: string;
    ended_at: string | null;
    note?: string | null;
  }): Promise<TimeEntry | null> => {
    if (!user) return null;
    const { data, error } = await supabase
      .from("time_entries")
      .insert({
        user_id: user.id,
        tag_id: input.tag_id,
        task_id: input.task_id ?? null,
        started_at: input.started_at,
        ended_at: input.ended_at,
        note: input.note ?? null,
      })
      .select()
      .single();
    if (error) { toast.error("Couldn't add entry"); return null; }
    if (data) { setEntries((p) => [data as TimeEntry, ...p]); toast.success("Entry added"); }
    return data as TimeEntry | null;
  }, [user]);

  const updateEntry = useCallback(async (
    id: string,
    patch: { tag_id?: string | null; task_id?: string | null; started_at?: string; ended_at?: string | null; note?: string | null },
  ) => {
    const { data, error } = await supabase
      .from("time_entries")
      .update(patch)
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) { toast.error("Couldn't update entry"); return; }
    if (data) { setEntries((p) => p.map((e) => (e.id === id ? (data as TimeEntry) : e))); toast.success("Entry updated"); }
  }, []);

  const deleteEntry = useCallback(async (id: string) => {
    // Snapshot the entry first so we can offer an undo
    const snapshot = await supabase.from("time_entries").select("*").eq("id", id).maybeSingle();
    const { error } = await supabase.from("time_entries").delete().eq("id", id);
    if (error) { toast.error("Couldn't delete entry"); return; }
    setEntries((p) => p.filter((e) => e.id !== id));
    const snap = snapshot.data as TimeEntry | null;
    toast.success("Entry deleted", {
      action: snap && user
        ? {
            label: "Undo",
            onClick: async () => {
              const { data, error: insErr } = await supabase
                .from("time_entries")
                .insert({
                  user_id: user.id,
                  tag_id: snap.tag_id,
                  task_id: snap.task_id,
                  started_at: snap.started_at,
                  ended_at: snap.ended_at,
                  note: snap.note,
                })
                .select()
                .single();
              if (insErr) { toast.error("Couldn't restore entry"); return; }
              if (data) { setEntries((p) => [data as TimeEntry, ...p]); toast.success("Entry restored"); }
            },
          }
        : undefined,
    });
  }, [user]);

  return { entries, loading, refresh, createManualEntry, updateEntry, deleteEntry };
}

/** Tick every second; returns "now" so components can re-render running timers. */
export function useNowTick(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}
