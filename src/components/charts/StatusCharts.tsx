import { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from "recharts";
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

// ---------- shared empty state ----------

function EmptyCard({ title, hint }: { title: string; hint?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed bg-muted/30 py-8 px-4 text-center">
      <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">
        {title}
      </div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

// ---------- shared tooltip ----------

function ChartTip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{
    payload?: { name?: string; value?: number; color?: string; sub?: string };
  }>;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload;
  if (!p) return null;
  return (
    <div className="rounded-md border bg-popover px-2.5 py-1.5 text-[11px] shadow-md">
      <div className="flex items-center gap-2">
        {p.color && (
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: p.color }}
          />
        )}
        <span className="font-medium">{p.name}</span>
        <span className="ml-2 font-mono tabular-nums text-muted-foreground">
          {p.value}
        </span>
      </div>
      {p.sub && (
        <div className="mt-0.5 text-[10px] text-muted-foreground">{p.sub}</div>
      )}
    </div>
  );
}

// ---------- 1. Status donut ----------

/** Compact donut chart of task status with a centred % done. */
export function StatusStackedBar({ tasks }: { tasks: Task[] }) {
  const data = useMemo(() => {
    const todo = tasks.filter((t) => t.status === "todo").length;
    const prog = tasks.filter((t) => t.status === "in_progress").length;
    const done = tasks.filter((t) => t.status === "done").length;
    return [
      { name: "Done", value: done, color: STATUS_COLOR.done, key: "done" },
      {
        name: "In progress",
        value: prog,
        color: STATUS_COLOR.in_progress,
        key: "in_progress",
      },
      { name: "To do", value: todo, color: STATUS_COLOR.todo, key: "todo" },
    ];
  }, [tasks]);

  const total = data.reduce((a, b) => a + b.value, 0);
  const done = data.find((d) => d.key === "done")?.value ?? 0;
  const pct = total ? Math.round((done / total) * 100) : 0;

  if (total === 0) {
    return (
      <EmptyCard
        title="No tasks yet"
        hint="Create a task to see your status mix appear here."
      />
    );
  }

  return (
    <div className="flex items-center gap-5">
      <div className="relative h-[112px] w-[112px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              innerRadius={36}
              outerRadius={54}
              startAngle={90}
              endAngle={-270}
              paddingAngle={2}
              stroke="var(--background)"
              strokeWidth={2}
            >
              {data.map((d) => (
                <Cell key={d.key} fill={d.color} />
              ))}
            </Pie>
            <Tooltip content={<ChartTip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[20px] font-semibold leading-none tabular-nums tracking-tight">
            {pct}%
          </span>
          <span className="mt-0.5 text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
            done
          </span>
        </div>
      </div>

      <div className="flex-1 space-y-1.5">
        {data.map((d) => {
          const w = total ? (d.value / total) * 100 : 0;
          return (
            <div key={d.key} className="flex items-center gap-2 text-[11px]">
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ background: d.color }}
              />
              <span className="text-foreground">{d.name}</span>
              <span className="ml-auto font-mono tabular-nums text-muted-foreground">
                {d.value}
                <span className="ml-1.5 text-muted-foreground/60">
                  {Math.round(w)}%
                </span>
              </span>
            </div>
          );
        })}
        <div className="pt-1 mt-1 border-t border-border/50 flex items-baseline gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          <span>{total}</span>
          <span>total</span>
        </div>
      </div>
    </div>
  );
}

// ---------- 2. Per-tag status bars ----------

type TagRow = {
  id: string;
  name: string;
  color: string;
  todo: number;
  in_progress: number;
  done: number;
  total: number;
  donePct: number;
  subs: {
    id: string;
    name: string;
    color: string;
    done: number;
    total: number;
  }[];
};

/** Per-tag stacked horizontal bar chart (parent + children rolled up). */
export function TagStatusBars({ tasks, tags }: { tasks: Task[]; tags: Tag[] }) {
  const rows = useMemo<TagRow[]>(() => {
    const roots = tags.filter((t) => !t.parent_id);
    return roots
      .map((parent) => {
        const subs = tags.filter((t) => t.parent_id === parent.id);
        const ids = [parent.id, ...subs.map((s) => s.id)];
        const group = tasks.filter((t) => t.tag_id && ids.includes(t.tag_id));
        const todo = group.filter((t) => t.status === "todo").length;
        const prog = group.filter((t) => t.status === "in_progress").length;
        const done = group.filter((t) => t.status === "done").length;
        const total = group.length;
        return {
          id: parent.id,
          name: parent.name,
          color: parent.color,
          todo,
          in_progress: prog,
          done,
          total,
          donePct: total ? Math.round((done / total) * 100) : 0,
          subs: subs.map((s) => {
            const sct = tasks.filter((t) => t.tag_id === s.id);
            return {
              id: s.id,
              name: s.name,
              color: s.color,
              done: sct.filter((t) => t.status === "done").length,
              total: sct.length,
            };
          }),
        };
      })
      .filter((r) => r.total > 0);
  }, [tasks, tags]);

  if (tags.filter((t) => !t.parent_id).length === 0) {
    return (
      <EmptyCard
        title="No categories yet"
        hint="Create a tag to group your work."
      />
    );
  }
  if (rows.length === 0) {
    return (
      <EmptyCard
        title="No tagged tasks"
        hint="Tag a task to see breakdowns by category."
      />
    );
  }

  return (
    <div className="space-y-3.5">
      {rows.map((row) => (
        <div key={row.id} className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs">
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{ background: row.color }}
            />
            <span className="font-medium truncate">{row.name}</span>
            <span className="ml-auto font-mono text-[10px] text-muted-foreground tabular-nums">
              {row.done}/{row.total} · {row.donePct}%
            </span>
          </div>

          {/* Stacked horizontal bar rendered via Recharts so each segment gets a hover tooltip. */}
          <div className="h-3 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={[row]}
                stackOffset="expand"
                margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
                barCategoryGap={0}
              >
                <XAxis type="number" hide domain={[0, 1]} />
                <YAxis type="category" hide dataKey="id" />
                <Tooltip
                  cursor={{ fill: "transparent" }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="rounded-md border bg-popover px-2.5 py-1.5 text-[11px] shadow-md space-y-0.5">
                        {payload
                          .slice()
                          .reverse()
                          .map((p) => (
                            <div
                              key={p.dataKey as string}
                              className="flex items-center gap-2"
                            >
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ background: p.color as string }}
                              />
                              <span className="capitalize">
                                {STATUS_LABEL[p.dataKey as Task["status"]]}
                              </span>
                              <span className="ml-auto font-mono tabular-nums">
                                {p.value as number}
                              </span>
                            </div>
                          ))}
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="todo"
                  stackId="a"
                  fill={STATUS_COLOR.todo}
                  radius={[6, 0, 0, 6]}
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="in_progress"
                  stackId="a"
                  fill={STATUS_COLOR.in_progress}
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="done"
                  stackId="a"
                  fill={STATUS_COLOR.done}
                  radius={[0, 6, 6, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {row.subs.length > 0 && (
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 pl-3.5 text-[10px] font-mono text-muted-foreground">
              {row.subs.map((s) => (
                <span
                  key={s.id}
                  className="inline-flex items-center gap-1"
                  title={`${s.done}/${s.total} done`}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: s.color }}
                  />
                  <span>{s.name}</span>
                  <span className="text-foreground tabular-nums">
                    {s.done}/{s.total}
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------- 3. Time by tag ----------

/** Horizontal bar chart of seconds tracked per tag, sorted descending. */
export function TimeByTagBars({
  perTagSeconds,
  tags,
  untaggedSeconds,
}: {
  perTagSeconds: Record<string, number>;
  tags: Tag[];
  untaggedSeconds: number;
}) {
  const data = useMemo(() => {
    const rows = tags
      .filter((t) => (perTagSeconds[t.id] ?? 0) > 0)
      .map((t) => ({
        id: t.id,
        name: t.name,
        color: t.color,
        sec: perTagSeconds[t.id] ?? 0,
      }))
      .sort((a, b) => b.sec - a.sec);
    if (untaggedSeconds > 0) {
      rows.push({
        id: "__none__",
        name: "Untagged",
        color: "var(--muted-foreground)",
        sec: untaggedSeconds,
      });
    }
    return rows;
  }, [perTagSeconds, tags, untaggedSeconds]);

  if (data.length === 0) {
    return (
      <EmptyCard
        title="No time tracked"
        hint={
          <>
            Open a task and click{" "}
            <span className="text-foreground font-medium">Clock in</span> to
            start.
          </>
        }
      />
    );
  }

  const fmt = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  };

  // Reserve enough left space for the longest tag name. ~7px per char + padding.
  const maxNameLen = Math.max(...data.map((d) => d.name.length));
  const yAxisWidth = Math.min(120, Math.max(60, maxNameLen * 7 + 12));

  // Height grows with row count so each bar gets ~26px.
  const height = Math.max(120, data.length * 30 + 16);

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={data.map((d) => ({
            ...d,
            value: d.sec,
            label: fmt(d.sec),
          }))}
          margin={{ top: 4, right: 36, bottom: 4, left: 0 }}
        >
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={yAxisWidth}
            axisLine={false}
            tickLine={false}
            tick={{
              fontSize: 11,
              fill: "var(--foreground)",
            }}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0]?.payload as {
                name: string;
                color: string;
                label: string;
              };
              return (
                <div className="rounded-md border bg-popover px-2.5 py-1.5 text-[11px] shadow-md">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: p.color }}
                    />
                    <span className="font-medium">{p.name}</span>
                    <span className="ml-2 font-mono tabular-nums text-muted-foreground">
                      {p.label}
                    </span>
                  </div>
                </div>
              );
            }}
          />
          <Bar
            dataKey="value"
            radius={[3, 3, 3, 3]}
            isAnimationActive={false}
            barSize={14}
          >
            {data.map((d) => (
              <Cell key={d.id} fill={d.color} />
            ))}
            <LabelList
              dataKey="label"
              position="right"
              style={{
                fontSize: 10,
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
                fill: "var(--muted-foreground)",
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
