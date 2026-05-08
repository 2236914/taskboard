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
}: {
  open: boolean;
  onClose: () => void;
  defaultDay: string;
  editTask?: Task | null;
}) {
  const { tags, addTask, updateTask } = useTaskboard();
  const isEdit = !!editTask;

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

  const reset = () => {
    setName("");
    setNote("");
    setTagId("none");
    setStatus("todo");
    setDueDate(undefined);
    setCreatedId(null);
  };

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
    if (isEdit && editTask) {
      await updateTask(editTask.id, payload);
    } else {
      await addTask(payload);
    }
    reset();
    onClose();
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

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="rounded-2xl sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {isEdit ? "Edit task" : "New task"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {isEdit
              ? "Update task details and attachments."
              : "Add a task to your board."}
          </DialogDescription>
        </DialogHeader>

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
                reset();
                onClose();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" className="rounded-full">
              {isEdit || createdId ? "Save" : "Add task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
