import { useMemo } from "react";
import { useActiveTimer, useNowTick, fmtDuration } from "@/lib/time-tracking";
import { useTaskboard } from "@/lib/taskboard-data";
import { Button } from "@/components/ui/button";
import { Square, Timer } from "lucide-react";

export function TimerPill() {
  const { active, stop } = useActiveTimer();
  const { tasks, tags } = useTaskboard();
  const now = useNowTick(!!active);

  const elapsed = useMemo(() => {
    if (!active) return 0;
    return Math.floor((now - new Date(active.started_at).getTime()) / 1000);
  }, [active, now]);

  if (!active) return null;

  const task = active.task_id
    ? tasks.find((t) => t.id === active.task_id)
    : null;
  const tag = active.tag_id ? tags.find((t) => t.id === active.tag_id) : null;
  const label = task?.name ?? (tag ? `${tag.name} (timer)` : "Timer");

  return (
    <div
      className="hidden md:inline-flex items-center gap-2 h-8 pl-2 pr-1 rounded-full border bg-primary/5 border-primary/30"
      title="Running timer"
    >
      <span className="relative inline-flex">
        <Timer size={13} className="text-primary" />
        <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
      </span>
      <span className="text-xs max-w-[140px] truncate">{label}</span>
      <span className="text-[11px] font-mono tabular-nums text-primary">
        {fmtDuration(elapsed)}
      </span>
      <Button
        size="icon"
        variant="ghost"
        className="h-6 w-6 text-muted-foreground hover:text-destructive"
        onClick={() => stop()}
        title="Stop timer"
      >
        <Square size={11} />
      </Button>
    </div>
  );
}
