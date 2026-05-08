import { useCallback, useEffect, useState } from "react";
import { useTaskboard, useAttachments, type Task } from "@/lib/taskboard-data";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AttachmentPanel } from "@/components/AttachmentPanel";
import { TaskTimePanel } from "@/components/TaskTimer";
import { CalendarIcon, X } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const DAYS = [
  { v: "mon", l: "Monday" },
  { v: "tue", l: "Tuesday" },
  { v: "wed", l: "Wednesday" },
  { v: "thu", l: "Thursday" },
  { v: "fri", l: "Friday" },
  { v: "sat", l: "Saturday" },
  { v: "sun", l: "Sunday" },
];

export function TaskModal({
  open,
  onClose,
  defaultDay,
  editTask,
  initialMode = "edit",
}: {
  open: boolean;
  onClose: () => void;
  defaultDay: string;
  editTask?: Task | null;
  /** When opening for an existing task, "view" shows a read-only details
   *  pane with an Edit button. "edit" jumps straight to the form. */
  initialMode?: "view" | "edit";
}) {
  const { tags, addTask, updateTask } = useTaskboard();
  const isExistingTask = !!editTask;
  // View mode only makes sense for an existing task; new-task always edits.
  const [mode, setMode] = useState<"view" | "edit">(
    isExistingTask ? initialMode : "edit",
  );

  const [name, setName] = useState(editTask?.name ?? "");
  const [note, setNote] = useState(editTask?.note ?? "");
  const [day, setDay] = useState(editTask?.day ?? defaultDay);
  const [tagId, setTagId] = useState<string>(editTask?.tag_id ?? "none");
  const [status, setStatus] = useState<Task["status"]>(
    editTask?.status ?? "todo",
  );
  const [dueDate, setDueDate] = useState<Date | undefined>(
    editTask?.due_at ? new Date(editTask.due_at) : undefined,
  );
  const [createdId, setCreatedId] = useState<string | null>(
    editTask?.id ?? null,
  );
  const [pendingPaste, setPendingPaste] = useState<File[] | null>(null);

  // Sync local form state whenever the task we're editing changes — protects
  // against stale fields when the same modal instance is reused (e.g. the
  // dialog closed-and-reopened on the same task without a key change).
  useEffect(() => {
    setName(editTask?.name ?? "");
    setNote(editTask?.note ?? "");
    setDay(editTask?.day ?? defaultDay);
    setTagId(editTask?.tag_id ?? "none");
    setStatus(editTask?.status ?? "todo");
    setDueDate(editTask?.due_at ? new Date(editTask.due_at) : undefined);
    setCreatedId(editTask?.id ?? null);
    setMode(editTask ? initialMode : "edit");
  }, [editTask, defaultDay, initialMode]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const payload = {
      name: name.trim(),
      note: note.trim() || undefined,
      day,
      status,
      tag_id: tagId === "none" ? null : tagId,
      due_at: dueDate ? dueDate.toISOString() : null,
    };
    if (isExistingTask && editTask) {
      await updateTask(editTask.id, payload);
      // After saving an edit, drop back to read-only view of the same task.
      setMode("view");
    } else {
      await addTask(payload);
      onClose();
    }
  };

  // Allow attaching files mid-create: persist the task on first attachment.
  const ensureTaskId = useCallback(async (): Promise<string | null> => {
    if (createdId) return createdId;
    if (!name.trim()) return null;
    const t = await addTask({
      name: name.trim(),
      note: note.trim() || undefined,
      day,
      status,
      tag_id: tagId === "none" ? null : tagId,
      due_at: dueDate ? dueDate.toISOString() : null,
    });
    if (t) {
      setCreatedId(t.id);
      return t.id;
    }
    return null;
  }, [createdId, name, note, day, status, tagId, dueDate, addTask]);

  const parents = tags.filter((t) => !t.parent_id);
  const taskId = createdId;

  // Paste-to-attach: capture pasted images/files anywhere in the dialog.
  const { upload: uploadAtt } = useAttachments({ taskId: taskId ?? undefined });
  useEffect(() => {
    if (!open) return;
    const onPaste = async (ev: ClipboardEvent) => {
      const items = ev.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (const it of items) {
        if (it.kind === "file") {
          const f = it.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length === 0) return;
      ev.preventDefault();
      const id = taskId;
      if (!id) {
        if (!name.trim()) {
          toast.error("Add a task name first to attach files");
          return;
        }
        // Queue files; effect below will flush them once the attachments hook re-binds with taskId
        setPendingPaste((prev) => [...(prev ?? []), ...files]);
        await ensureTaskId();
        return;
      }
      const { ok, errors } = await uploadAtt(files);
      if (ok > 0) toast.success(`Attached ${ok} file${ok === 1 ? "" : "s"}`);
      errors.forEach((e) => toast.error(e));
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [open, taskId, name, uploadAtt, ensureTaskId]);

  // Flush queued pasted files once the task is persisted and attachments hook is bound.
  useEffect(() => {
    if (!taskId || !pendingPaste || pendingPaste.length === 0) return;
    const files = pendingPaste;
    setPendingPaste(null);
    (async () => {
      const { ok, errors } = await uploadAtt(files);
      if (ok > 0) toast.success(`Attached ${ok} file${ok === 1 ? "" : "s"}`);
      errors.forEach((e) => toast.error(e));
    })();
  }, [taskId, pendingPaste, uploadAtt]);

  // Tag lookup for the view-mode summary line.
  const selectedTag =
    tagId !== "none" ? tags.find((t) => t.id === tagId) : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        // Don't clear local state on close — the parent already swaps
        // the dialog's `key` when a different task is opened, which forces
        // a remount with fresh state. Resetting here caused the form to
        // appear empty when reopening the same task.
        if (!o) onClose();
      }}
    >
      <DialogContent className="rounded-2xl sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {mode === "view"
              ? "Task"
              : isExistingTask
                ? "Edit task"
                : "New task"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {mode === "view"
              ? "Read-only details. Click Edit to make changes."
              : isExistingTask
                ? "Update task details and attachments."
                : "Add a task to your board."}
          </DialogDescription>
        </DialogHeader>

        {mode === "view" && editTask ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Task
              </Label>
              <div
                className={cn(
                  "text-base leading-snug",
                  status === "done" && "line-through text-muted-foreground",
                )}
              >
                {name || (
                  <span className="text-muted-foreground italic">
                    (no name)
                  </span>
                )}
              </div>
            </div>

            {note && (
              <div className="space-y-1.5">
                <Label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  Note
                </Label>
                <div className="rounded-md border bg-muted/30 px-3 py-2 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words">
                  {note}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Detail label="Status">
                <span className="capitalize">
                  {status === "in_progress" ? "In progress" : status}
                </span>
              </Detail>
              <Detail label="Day">
                <span className="capitalize">
                  {DAYS.find((d) => d.v === day)?.l ?? day}
                </span>
              </Detail>
              <Detail label="Tag">
                {selectedTag ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: selectedTag.color }}
                    />
                    {selectedTag.name}
                  </span>
                ) : (
                  <span className="text-muted-foreground">— none —</span>
                )}
              </Detail>
              <Detail label="Due">
                {dueDate ? (
                  format(dueDate, "PPP")
                ) : (
                  <span className="text-muted-foreground">No due date</span>
                )}
              </Detail>
            </div>

            {taskId && (
              <TaskTimePanel
                taskId={taskId}
                tagId={tagId === "none" ? null : tagId}
              />
            )}

            {taskId && (
              <div className="space-y-1.5">
                <AttachmentPanel parent={{ taskId }} compact />
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={onClose}
              >
                Close
              </Button>
              <Button
                type="button"
                className="rounded-full"
                onClick={() => setMode("edit")}
              >
                Edit
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label
                htmlFor="t-name"
                className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground"
              >
                Task name
              </Label>
              <Input
                id="t-name"
                autoFocus
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={200}
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="t-note"
                className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground"
              >
                Note (optional)
              </Label>
              <Textarea
                id="t-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={1000}
                rows={2}
                className="font-mono text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  Day
                </Label>
                <Select value={day} onValueChange={setDay}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS.map((d) => (
                      <SelectItem key={d.v} value={d.v}>
                        {d.l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  Status
                </Label>
                <Select
                  value={status}
                  onValueChange={(v) => setStatus(v as Task["status"])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">To do</SelectItem>
                    <SelectItem value="in_progress">In progress</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  Tag
                </Label>
                <Select value={tagId} onValueChange={setTagId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— none —</SelectItem>
                    {parents.map((p) => {
                      const subs = tags.filter((s) => s.parent_id === p.id);
                      return (
                        <SelectGroup key={p.id}>
                          <SelectItem value={p.id}>
                            <span className="flex items-center gap-2">
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{ background: p.color }}
                              />
                              <span className="font-medium">{p.name}</span>
                            </span>
                          </SelectItem>
                          {subs.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              <span className="flex items-center gap-2 pl-3">
                                <span
                                  className="w-1.5 h-1.5 rounded-full"
                                  style={{ background: s.color }}
                                />
                                <span className="text-muted-foreground">↳</span>{" "}
                                {s.name}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  Due date
                </Label>
                <div className="flex gap-1">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className={cn(
                          "h-9 flex-1 justify-start text-left font-normal text-xs",
                          !dueDate && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon size={13} />
                        {dueDate ? (
                          format(dueDate, "PPP")
                        ) : (
                          <span>Pick date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dueDate}
                        onSelect={setDueDate}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                  {dueDate && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => setDueDate(undefined)}
                      title="Clear"
                    >
                      <X size={13} />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Time tracking — once the task exists */}
            {taskId && (
              <TaskTimePanel
                taskId={taskId}
                tagId={tagId === "none" ? null : tagId}
              />
            )}

            {/* Attachments — visible when editing, or after the first save while creating */}
            {taskId ? (
              <div className="space-y-1.5">
                <AttachmentPanel parent={{ taskId }} compact />
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="rounded-lg border border-dashed px-3 py-4 text-center text-[11px] font-mono text-muted-foreground">
                  <button
                    type="button"
                    className="underline-offset-2 hover:underline disabled:opacity-50"
                    disabled={!name.trim()}
                    onClick={async () => {
                      await ensureTaskId();
                    }}
                  >
                    Save task to add attachments & track time →
                  </button>
                </div>
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={() => {
                  if (isExistingTask) {
                    // Existing task: drop edits and bounce back to view.
                    setMode("view");
                  } else {
                    onClose();
                  }
                }}
              >
                Cancel
              </Button>
              <Button type="submit" className="rounded-full">
                {isExistingTask || createdId ? "Save" : "Add task"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        {label}
      </Label>
      <div className="text-sm">{children}</div>
    </div>
  );
}
