import { useMemo, useState } from "react";
import {
  useActiveTimer,
  useTaskTime,
  useNowTick,
  fmtDuration,
  fmtHours,
} from "@/lib/time-tracking";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Play, Square, Trash2, Timer, Pencil, Check, X } from "lucide-react";

/** Compact play/stop button for a task — used inside TaskModal header. */
export function TaskTimerControl({
  taskId,
  tagId,
}: {
  taskId: string;
  tagId: string | null;
}) {
  const { active, startTask, stop } = useActiveTimer();
  const isRunning = active?.task_id === taskId;
  const now = useNowTick(isRunning);
  const elapsed =
    isRunning && active
      ? Math.floor((now - new Date(active.started_at).getTime()) / 1000)
      : 0;

  return (
    <div className="flex items-center gap-2">
      {isRunning ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1.5 border-primary/40 text-primary"
          onClick={() => stop()}
        >
          <Square size={12} /> Stop
          <span className="font-mono tabular-nums text-[11px] ml-1">
            {fmtDuration(elapsed)}
          </span>
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => startTask(taskId, tagId)}
        >
          <Play size={12} /> Clock in
        </Button>
      )}
    </div>
  );
}

/** Full panel: live elapsed + total + history of past entries. */
export function TaskTimePanel({
  taskId,
  tagId,
}: {
  taskId: string;
  tagId: string | null;
}) {
  const { entries, totalSec, deleteEntry, updateEntry } = useTaskTime(taskId);
  const { active } = useActiveTimer();
  const isRunning = active?.task_id === taskId;
  const now = useNowTick(isRunning);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState("");

  const liveTotal = useMemo(() => totalSec, [totalSec]);

  const startEdit = (id: string, note: string | null) => {
    setEditingId(id);
    setDraftNote(note ?? "");
  };
  const saveEdit = async (id: string) => {
    await updateEntry(id, { note: draftNote.trim() || null });
    setEditingId(null);
  };

  return (
    <div className="rounded-lg border bg-muted/20">
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          <Timer size={11} /> Time tracked
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono tabular-nums text-foreground">
            {fmtHours(liveTotal)}
            {isRunning && <span className="text-primary ml-1">· running</span>}
          </span>
          <TaskTimerControl taskId={taskId} tagId={tagId} />
        </div>
      </div>
      <div className="p-2 max-h-56 overflow-y-auto">
        {entries.length === 0 ? (
          <div className="text-center py-3 text-[11px] font-mono text-muted-foreground">
            No entries yet. Click{" "}
            <span className="text-foreground">Clock in</span> to start tracking.
          </div>
        ) : (
          <ul className="space-y-1">
            {entries.map((e) => {
              const start = new Date(e.started_at);
              const end = e.ended_at ? new Date(e.ended_at) : null;
              const sec = end
                ? Math.floor((end.getTime() - start.getTime()) / 1000)
                : Math.floor((now - start.getTime()) / 1000);
              const isEditing = editingId === e.id;
              return (
                <li
                  key={e.id}
                  className="group rounded hover:bg-background px-2 py-1.5 text-[11px] font-mono"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${end ? "bg-muted-foreground" : "bg-primary animate-pulse"}`}
                    />
                    <span className="text-muted-foreground tabular-nums">
                      {start.toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                      })}{" "}
                      ·{" "}
                      {start.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className="text-muted-foreground">→</span>
                    <span className="tabular-nums">
                      {end
                        ? end.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "now"}
                    </span>
                    <span className="ml-auto tabular-nums text-foreground">
                      {fmtDuration(sec, { compact: true })}
                    </span>
                    {!isEditing && (
                      <>
                        <button
                          type="button"
                          onClick={() => startEdit(e.id, e.note)}
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary"
                          title="Edit note"
                        >
                          <Pencil size={11} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm("Delete this entry?"))
                              deleteEntry(e.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                          title="Delete"
                        >
                          <Trash2 size={11} />
                        </button>
                      </>
                    )}
                  </div>
                  {isEditing ? (
                    <div className="flex items-center gap-1 mt-1.5 pl-3.5">
                      <Input
                        value={draftNote}
                        onChange={(ev) => setDraftNote(ev.target.value)}
                        placeholder="Note for this entry…"
                        className="h-7 text-[11px] font-mono"
                        autoFocus
                        onKeyDown={(ev) => {
                          if (ev.key === "Enter") {
                            ev.preventDefault();
                            saveEdit(e.id);
                          }
                          if (ev.key === "Escape") setEditingId(null);
                        }}
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-primary"
                        onClick={() => saveEdit(e.id)}
                      >
                        <Check size={12} />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => setEditingId(null)}
                      >
                        <X size={12} />
                      </Button>
                    </div>
                  ) : (
                    e.note && (
                      <div className="pl-3.5 mt-0.5 text-muted-foreground italic truncate">
                        {e.note}
                      </div>
                    )
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
