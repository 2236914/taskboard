import { useMemo, useState, useRef, useEffect } from "react";
import {
  useTaskboard,
  sortTasks,
  useAttachmentCounts,
  dueState,
  type Task,
  type Tag,
} from "@/lib/taskboard-data";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Pin,
  PinOff,
  Trash2,
  Circle,
  CircleDashed,
  CheckCircle2,
  ChevronRight,
  Pencil,
  Paperclip,
  CalendarClock,
  Plus,
  X,
} from "lucide-react";

const STATUS_META: Record<
  Task["status"],
  { label: string; color: string; Icon: typeof Circle }
> = {
  todo: { label: "To do", color: "var(--status-todo)", Icon: Circle },
  in_progress: {
    label: "In progress",
    color: "var(--status-progress)",
    Icon: CircleDashed,
  },
  done: { label: "Done", color: "var(--status-done)", Icon: CheckCircle2 },
};

function TagPill({ tag, tags }: { tag: Tag; tags: Tag[] }) {
  const parent = tag.parent_id
    ? tags.find((t) => t.id === tag.parent_id)
    : undefined;
  return (
    <Badge
      variant="outline"
      className="font-mono text-[10px] px-2 py-0 h-5 rounded-md gap-1 font-normal"
    >
      <span
        className="inline-block w-1.5 h-1.5 rounded-full"
        style={{ background: tag.color }}
      />
      {parent && (
        <>
          <span className="text-muted-foreground">{parent.name}</span>
          <ChevronRight size={9} className="text-muted-foreground" />
        </>
      )}
      <span>{tag.name}</span>
    </Badge>
  );
}

function DueBadge({ task }: { task: Task }) {
  if (!task.due_at) return null;
  const state = dueState(task.due_at, task.status);
  const date = new Date(task.due_at);
  const label = date.toLocaleDateString([], { month: "short", day: "numeric" });
  const cls =
    state === "overdue"
      ? "bg-destructive/10 text-destructive border-destructive/30"
      : state === "today"
        ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
        : state === "soon"
          ? "bg-primary/10 text-primary border-primary/20"
          : "bg-muted text-muted-foreground border-transparent";
  return (
    <Badge
      variant="outline"
      className={`font-mono text-[10px] px-1.5 py-0 h-5 gap-1 font-normal ${cls}`}
    >
      <CalendarClock size={10} />
      {state === "overdue"
        ? `${label} · overdue`
        : state === "today"
          ? "Today"
          : label}
    </Badge>
  );
}

type CardProps = {
  task: Task;
  tags: Tag[];
  attachmentCount?: number;
  onTogglePin: () => void;
  onDelete: () => void;
  onEdit?: () => void;
  onView?: () => void;
  dragging?: boolean;
};

function TaskCardInner({
  task,
  tags,
  attachmentCount,
  onTogglePin,
  onDelete,
  onEdit,
  onView,
  dragging,
}: CardProps) {
  const meta = STATUS_META[task.status];
  const tag = tags.find((tg) => tg.id === task.tag_id);
  const isPinned = !!task.pinned_at;
  return (
    <div
      className={`bg-card border rounded-lg overflow-hidden hover:bg-muted/40 transition group relative ${
        dragging ? "shadow-2xl rotate-2 ring-2 ring-primary/40" : "shadow-sm"
      } ${isPinned ? "ring-1 ring-primary/30" : ""} ${onView && !dragging ? "cursor-pointer" : ""}`}
      style={{ borderLeftColor: meta.color, borderLeftWidth: 2 }}
      onClick={(e) => {
        // Only trigger view when clicking the card body itself, not on
        // the action buttons (which call e.stopPropagation()).
        if (onView && !dragging) onView();
        // Avoid stealing focus from buttons inside the card.
        e.stopPropagation();
      }}
    >
      {tag && (
        <div
          className="h-1.5 w-full"
          style={{ background: tag.color }}
          aria-hidden
        />
      )}
      <div className="p-3">
        {isPinned && (
          <Pin
            size={10}
            className="absolute top-2 right-2 text-primary fill-primary"
          />
        )}
        <div
          className={`text-sm mb-1.5 leading-snug pr-4 ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}
        >
          {task.name}
        </div>
        {task.note && (
          <div className="text-[11px] font-mono text-muted-foreground mb-2 leading-relaxed whitespace-pre-wrap line-clamp-3">
            {task.note}
          </div>
        )}
        <div className="flex items-center gap-1.5 flex-wrap">
          {tag && <TagPill tag={tag} tags={tags} />}
          <DueBadge task={task} />
          {!!attachmentCount && (
            <Badge
              variant="outline"
              className="font-mono text-[10px] px-1.5 py-0 h-5 gap-1 font-normal"
            >
              <Paperclip size={10} /> {attachmentCount}
            </Badge>
          )}
          <div className="ml-auto flex gap-0.5 opacity-0 group-hover:opacity-100 transition">
            {onEdit && (
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                title="Edit"
              >
                <Pencil size={11} />
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              className={`h-6 w-6 ${isPinned ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin();
              }}
              title={isPinned ? "Unpin" : "Pin to top"}
            >
              {isPinned ? <PinOff size={11} /> : <Pin size={11} />}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-muted-foreground hover:text-destructive"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              title="Delete"
            >
              <Trash2 size={11} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SortableTaskCard(
  props: CardProps & { id: string; disabled?: boolean },
) {
  const { id, disabled, ...rest } = props;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });
  const style = {
    // While dragging, only the DragOverlay should move — keep the in-place
    // card pinned to its slot so it can't compete with the overlay for
    // pointer position.
    transform: isDragging ? undefined : CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      // While dragging, the in-place card is invisible but should still
      // reserve its slot — keep it interactable=off so clicks don't fire.
      aria-hidden={isDragging || undefined}
      className="touch-none cursor-grab active:cursor-grabbing"
    >
      <TaskCardInner {...rest} />
    </div>
  );
}

function QuickAddRow({
  onAdd,
}: {
  onAdd: (name: string) => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const submit = async () => {
    const v = name.trim();
    if (!v || busy) return;
    setBusy(true);
    await onAdd(v);
    setBusy(false);
    setName("");
    inputRef.current?.focus();
  };

  if (!open) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-muted/50 h-8 text-xs font-mono"
        onClick={() => setOpen(true)}
      >
        <Plus size={12} className="mr-1.5" /> Add a card
      </Button>
    );
  }

  return (
    <div className="space-y-1.5">
      <Input
        ref={inputRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
          if (e.key === "Escape") {
            setOpen(false);
            setName("");
          }
        }}
        placeholder="Task title — Enter to add"
        className="h-8 text-xs"
        disabled={busy}
      />
      <div className="flex gap-1">
        <Button
          size="sm"
          className="h-7 text-xs"
          onClick={submit}
          disabled={busy || !name.trim()}
        >
          {busy ? "Adding…" : "Add"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs px-2"
          onClick={() => {
            setOpen(false);
            setName("");
          }}
        >
          <X size={12} />
        </Button>
      </div>
    </div>
  );
}

function Column({
  status,
  tasks,
  tags,
  counts,
  onTogglePin,
  onDelete,
  onEdit,
  onView,
  onQuickAdd,
  isOver,
}: {
  status: Task["status"];
  tasks: Task[];
  tags: Tag[];
  counts: Record<string, number>;
  onTogglePin: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (t: Task) => void;
  onView: (t: Task) => void;
  onQuickAdd: (name: string) => Promise<void> | void;
  isOver: boolean;
}) {
  const meta = STATUS_META[status];
  const pinned = tasks.filter((t) => t.pinned_at);
  const unpinned = tasks.filter((t) => !t.pinned_at);
  const ids = [...pinned.map((t) => t.id), ...unpinned.map((t) => t.id)];

  return (
    <Card
      className={`transition ${isOver ? "ring-2 ring-primary/40 bg-muted/20" : ""}`}
    >
      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
        <span className="text-[11px] font-mono uppercase tracking-wider flex items-center gap-2">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: meta.color }}
          />
          {meta.label}
        </span>
        <Badge
          variant="secondary"
          className="text-[10px] font-mono tabular-nums"
        >
          {tasks.length}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-2 min-h-[120px]" data-column={status}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {[...pinned, ...unpinned].map((t) => (
            <SortableTaskCard
              key={t.id}
              id={t.id}
              task={t}
              tags={tags}
              attachmentCount={counts[t.id]}
              disabled={!!t.pinned_at}
              onTogglePin={() => onTogglePin(t.id)}
              onDelete={() => onDelete(t.id)}
              onEdit={() => onEdit(t)}
              onView={() => onView(t)}
            />
          ))}
        </SortableContext>
        <div className="pt-1">
          <QuickAddRow onAdd={onQuickAdd} />
        </div>
      </CardContent>
    </Card>
  );
}

export function KanbanBoard({
  day,
  onEditTask,
  onViewTask,
}: {
  day: string;
  onEditTask: (t: Task) => void;
  onViewTask: (t: Task) => void;
}) {
  const { tasks, tags, moveTask, togglePinTask, deleteTask, addTask } =
    useTaskboard();
  const { counts } = useAttachmentCounts("task");
  const dayTasks = useMemo(
    () => sortTasks(tasks.filter((t) => t.day === day)),
    [tasks, day],
  );

  const cols: Task["status"][] = ["todo", "in_progress", "done"];
  const tasksByStatus = useMemo(() => {
    const m: Record<Task["status"], Task[]> = {
      todo: [],
      in_progress: [],
      done: [],
    };
    dayTasks.forEach((t) => m[t.status].push(t));
    return m;
  }, [dayTasks]);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<Task["status"] | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const findStatus = (id: string): Task["status"] | null => {
    const t = tasks.find((x) => x.id === id);
    return t ? t.status : null;
  };

  const handleStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const handleOver = (e: DragOverEvent) => {
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) {
      setOverCol(null);
      return;
    }
    if (cols.includes(overId as Task["status"])) {
      setOverCol(overId as Task["status"]);
    } else {
      setOverCol(findStatus(overId));
    }
  };

  const handleEnd = (e: DragEndEvent) => {
    const activeIdStr = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    setActiveId(null);
    setOverCol(null);
    if (!overId) return;

    const activeTask = tasks.find((t) => t.id === activeIdStr);
    if (!activeTask || activeTask.pinned_at) return;

    let targetStatus: Task["status"];
    let targetIndex: number;

    if (cols.includes(overId as Task["status"])) {
      targetStatus = overId as Task["status"];
      targetIndex = tasksByStatus[targetStatus].filter(
        (t) => !t.pinned_at,
      ).length;
    } else {
      const overTask = tasks.find((t) => t.id === overId);
      if (!overTask) return;
      targetStatus = overTask.status;
      const unpinned = tasksByStatus[targetStatus].filter(
        (t) => !t.pinned_at && t.id !== activeIdStr,
      );
      targetIndex = unpinned.findIndex((t) => t.id === overId);
      if (targetIndex < 0) targetIndex = unpinned.length;
    }

    moveTask(activeIdStr, { day, status: targetStatus, index: targetIndex });
  };

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleStart}
      onDragOver={handleOver}
      onDragEnd={handleEnd}
      onDragCancel={() => {
        setActiveId(null);
        setOverCol(null);
      }}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cols.map((status) => (
          <DroppableColumnWrapper key={status} status={status}>
            <Column
              status={status}
              tasks={tasksByStatus[status]}
              tags={tags}
              counts={counts}
              onTogglePin={togglePinTask}
              onDelete={deleteTask}
              onEdit={onEditTask}
              onView={onViewTask}
              onQuickAdd={async (name) => {
                await addTask({ name, day, status, tag_id: null });
              }}
              isOver={overCol === status}
            />
          </DroppableColumnWrapper>
        ))}
      </div>
      <DragOverlay>
        {activeTask && (
          <TaskCardInner
            task={activeTask}
            tags={tags}
            attachmentCount={counts[activeTask.id]}
            onTogglePin={() => {}}
            onDelete={() => {}}
            dragging
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}

function DroppableColumnWrapper({
  status,
  children,
}: {
  status: Task["status"];
  children: React.ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id: status, data: { type: "column" } });
  return <div ref={setNodeRef}>{children}</div>;
}
