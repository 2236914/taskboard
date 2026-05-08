import type { Task, Tag } from "@/lib/taskboard-data";

const STATUS_COLOR: Record<Task["status"], string> = {
  todo: "var(--status-todo)",
  in_progress: "var(--status-progress)",
  done: "var(--status-done)",
};
const STATUS_LABEL: Record<Task["status"], string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};

/** Single horizontal stacked bar: To do / In progress / Done. */
export function StatusStackedBar({ tasks }: { tasks: Task[] }) {
  const todo = tasks.filter((t) => t.status === "todo").length;
  const prog = tasks.filter((t) => t.status === "in_progress").length;
  const done = tasks.filter((t) => t.status === "done").length;
  const total = todo + prog + done;
  const pct = (n: number) => (total ? (n / total) * 100 : 0);

  if (total === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/30 py-8 px-4 text-center">
        <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">No tasks yet</div>
        <div className="text-[11px] text-muted-foreground">Create a task to see your status mix appear here.</div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="h-3 w-full rounded-full overflow-hidden bg-muted flex">
        {todo > 0 && (
          <div title={`To do · ${todo}`} style={{ width: `${pct(todo)}%`, background: STATUS_COLOR.todo }} />
        )}
        {prog > 0 && (
          <div title={`In progress · ${prog}`} style={{ width: `${pct(prog)}%`, background: STATUS_COLOR.in_progress }} />
        )}
        {done > 0 && (
          <div title={`Done · ${done}`} style={{ width: `${pct(done)}%`, background: STATUS_COLOR.done }} />
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-mono text-muted-foreground">
        {(["todo", "in_progress", "done"] as Task["status"][]).map((s) => {
          const n = s === "todo" ? todo : s === "in_progress" ? prog : done;
          return (
            <span key={s} className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: STATUS_COLOR[s] }} />
              <span className="text-foreground tabular-nums">{n}</span>
              <span>{STATUS_LABEL[s]}</span>
            </span>
          );
        })}
        <span className="ml-auto text-muted-foreground">
          {total} total · <span className="text-foreground">{total ? Math.round((done / total) * 100) : 0}% done</span>
        </span>
      </div>
    </div>
  );
}

/** Per-tag stacked horizontal bars (parent + children rolled up). */
export function TagStatusBars({ tasks, tags }: { tasks: Task[]; tags: Tag[] }) {
  const roots = tags.filter((t) => !t.parent_id);
  const hasAny = tasks.some((t) => t.tag_id);
  if (roots.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/30 py-6 px-4 text-center text-xs text-muted-foreground">
        No categories yet — create a tag to group your work.
      </div>
    );
  }
  if (!hasAny) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/30 py-6 px-4 text-center text-xs text-muted-foreground">
        No tasks have a tag yet. Tag a task to see breakdowns by category.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {roots.map((parent) => {
        const subs = tags.filter((t) => t.parent_id === parent.id);
        const ids = [parent.id, ...subs.map((s) => s.id)];
        const group = tasks.filter((t) => t.tag_id && ids.includes(t.tag_id));
        const todo = group.filter((t) => t.status === "todo").length;
        const prog = group.filter((t) => t.status === "in_progress").length;
        const done = group.filter((t) => t.status === "done").length;
        const total = group.length;
        const pct = (n: number) => (total ? (n / total) * 100 : 0);
        const donePct = total ? Math.round((done / total) * 100) : 0;
        return (
          <div key={parent.id} className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-full" style={{ background: parent.color }} />
              <span className="font-medium">{parent.name}</span>
              <span className="ml-auto font-mono text-[10px] text-muted-foreground tabular-nums">
                {done}/{total} · {donePct}%
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full overflow-hidden bg-muted flex">
              {todo > 0 && <div style={{ width: `${pct(todo)}%`, background: STATUS_COLOR.todo }} title={`To do · ${todo}`} />}
              {prog > 0 && <div style={{ width: `${pct(prog)}%`, background: STATUS_COLOR.in_progress }} title={`In progress · ${prog}`} />}
              {done > 0 && <div style={{ width: `${pct(done)}%`, background: STATUS_COLOR.done }} title={`Done · ${done}`} />}
            </div>
            {subs.length > 0 && (
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 pl-3.5 text-[10px] font-mono text-muted-foreground">
                {subs.map((s) => {
                  const sct = tasks.filter((t) => t.tag_id === s.id);
                  const sd = sct.filter((t) => t.status === "done").length;
                  return (
                    <span key={s.id} className="inline-flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
                      <span>{s.name}</span>
                      <span className="text-foreground tabular-nums">{sd}/{sct.length}</span>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Time-tracked horizontal bars per tag. */
export function TimeByTagBars({
  perTagSeconds, tags, untaggedSeconds,
}: { perTagSeconds: Record<string, number>; tags: Tag[]; untaggedSeconds: number }) {
  const rows = tags
    .map((t) => ({ tag: t, sec: perTagSeconds[t.id] ?? 0 }))
    .filter((r) => r.sec > 0)
    .sort((a, b) => b.sec - a.sec);
  if (untaggedSeconds > 0) rows.push({ tag: { id: "__none__", name: "Untagged", color: "var(--muted-foreground)", parent_id: null }, sec: untaggedSeconds });

  const max = rows.reduce((m, r) => Math.max(m, r.sec), 0);
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/30 py-6 px-4 text-center text-xs text-muted-foreground">
        No time tracked in this range. Open a task and click <span className="text-foreground font-medium">Clock in</span> to start.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {rows.map(({ tag, sec }) => {
        const w = max ? (sec / max) * 100 : 0;
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        return (
          <div key={tag.id} className="space-y-1">
            <div className="flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-full" style={{ background: tag.color }} />
              <span>{tag.name}</span>
              <span className="ml-auto font-mono text-[10px] tabular-nums text-muted-foreground">
                {h > 0 ? `${h}h ` : ""}{m}m
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden bg-muted">
              <div className="h-full rounded-full" style={{ width: `${w}%`, background: tag.color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
