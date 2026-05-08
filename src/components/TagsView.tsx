import { useMemo, useState } from "react";
import { useTaskboard, useNotes, type Tag } from "@/lib/taskboard-data";
import { useActiveTimer, useNowTick, fmtDuration } from "@/lib/time-tracking";
import { Card, CardContent, CardHeader, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Pencil, Trash2, Plus, Search, Check, ChevronRight, GitMerge, CornerDownRight, Play, Square,
} from "lucide-react";

const PRESET_COLORS = [
  "#5055A0", "#3D6B3F", "#A03030", "#8F3A55",
  "#B85C38", "#4A6FA8", "#7C5BA0", "#3D8B7E",
];

export function TagsView() {
  const { tags, tasks, addTag, updateTag, deleteTag, mergeTag } = useTaskboard();
  const { notes } = useNotes();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Tag | null>(null);

  const stats = useMemo(() => {
    const m: Record<string, { tasks: number; notes: number }> = {};
    tags.forEach((t) => { m[t.id] = { tasks: 0, notes: 0 }; });
    tasks.forEach((t) => { if (t.tag_id && m[t.tag_id]) m[t.tag_id].tasks++; });
    notes.forEach((n) => { if (n.tag_id && m[n.tag_id]) m[n.tag_id].notes++; });
    return m;
  }, [tags, tasks, notes]);

  const filtered = useMemo(() => {
    if (!query.trim()) return tags;
    const q = query.toLowerCase();
    return tags.filter((t) => t.name.toLowerCase().includes(q));
  }, [tags, query]);

  const roots = filtered.filter((t) => !t.parent_id);
  const childrenOf = (id: string) => filtered.filter((t) => t.parent_id === id);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Manage tags</CardTitle>
          <CardDescription className="text-xs">
            Categories with optional sub-tags. Each tag tracks how many tasks and notes use it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 items-center">
            <div className="relative flex-1 max-w-md">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Search tags…" className="pl-8 h-9"
              />
            </div>
            <NewTagDialog onAdd={addTag} parents={tags.filter((t) => !t.parent_id)} />
          </div>

          {tags.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              No tags yet. Create your first one above.
            </div>
          ) : (
            <div className="space-y-2">
              {roots.map((parent) => {
                const subs = childrenOf(parent.id);
                const ps = stats[parent.id] ?? { tasks: 0, notes: 0 };
                const subsTotal = subs.reduce((acc, s) => {
                  const ss = stats[s.id] ?? { tasks: 0, notes: 0 };
                  return acc + ss.tasks + ss.notes;
                }, 0);

                return (
                  <div key={parent.id} className="rounded-lg border bg-card overflow-hidden">
                    <TagRow
                      tag={parent}
                      stats={ps}
                      totalSubs={subsTotal}
                      isEditing={editing?.id === parent.id}
                      onStartEdit={() => setEditing(parent)}
                      onCancelEdit={() => setEditing(null)}
                      onSave={(patch) => { updateTag(parent.id, patch); setEditing(null); }}
                      onDelete={() => {
                        if (confirm(`Delete "${parent.name}"${subs.length ? ` and ${subs.length} sub-tag(s)` : ""}? Items keep their data but lose this tag.`)) {
                          deleteTag(parent.id);
                        }
                      }}
                      mergeOptions={tags.filter((t) => t.id !== parent.id && !t.parent_id)}
                      onMerge={(dst) => mergeTag(parent.id, dst)}
                    />
                    {subs.length > 0 && (
                      <div className="border-t bg-muted/30 divide-y">
                        {subs.map((sub) => {
                          const ss = stats[sub.id] ?? { tasks: 0, notes: 0 };
                          return (
                            <div key={sub.id} className="pl-6">
                              <TagRow
                                tag={sub}
                                stats={ss}
                                isEditing={editing?.id === sub.id}
                                onStartEdit={() => setEditing(sub)}
                                onCancelEdit={() => setEditing(null)}
                                onSave={(patch) => { updateTag(sub.id, patch); setEditing(null); }}
                                onDelete={() => {
                                  if (confirm(`Delete sub-tag "${sub.name}"?`)) deleteTag(sub.id);
                                }}
                                mergeOptions={tags.filter((t) => t.id !== sub.id)}
                                onMerge={(dst) => mergeTag(sub.id, dst)}
                                indent
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
              {roots.length === 0 && (
                <div className="text-center py-8 text-xs font-mono text-muted-foreground">
                  No matches for "{query}"
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TagRow({
  tag, stats, totalSubs, isEditing, onStartEdit, onCancelEdit, onSave, onDelete, mergeOptions, onMerge, indent,
}: {
  tag: Tag;
  stats: { tasks: number; notes: number };
  totalSubs?: number;
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: (patch: Partial<Tag>) => void;
  onDelete: () => void;
  mergeOptions: Tag[];
  onMerge: (dstId: string) => void;
  indent?: boolean;
}) {
  const [name, setName] = useState(tag.name);
  const [color, setColor] = useState(tag.color);

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 p-3">
        {indent && <CornerDownRight size={12} className="text-muted-foreground" />}
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-8 max-w-[240px]"
          onKeyDown={(e) => { if (e.key === "Enter") onSave({ name, color }); }}
        />
        <div className="flex gap-1 flex-wrap">
          {PRESET_COLORS.map((c) => (
            <button key={c} type="button" onClick={() => setColor(c)}
              className={`w-5 h-5 rounded-full ${color === c ? "ring-2 ring-offset-1 ring-foreground" : ""}`}
              style={{ background: c }} />
          ))}
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-5 h-5 rounded-full cursor-pointer border-0 p-0 bg-transparent"
            title="Custom color"
          />
        </div>
        <div className="ml-auto flex gap-1">
          <Button size="sm" variant="ghost" onClick={onCancelEdit}>Cancel</Button>
          <Button size="sm" onClick={() => onSave({ name, color })} className="gap-1.5"><Check size={13} /> Save</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-3 hover:bg-muted/40 transition group">
      {indent && <CornerDownRight size={12} className="text-muted-foreground" />}
      <span className="w-3 h-3 rounded-full shrink-0" style={{ background: tag.color }} />
      <span className="font-medium text-sm truncate">{tag.name}</span>
      <div className="flex gap-1.5">
        <Badge variant="outline" className="text-[10px] font-mono font-normal h-5">
          {stats.tasks} task{stats.tasks === 1 ? "" : "s"}
        </Badge>
        <Badge variant="outline" className="text-[10px] font-mono font-normal h-5">
          {stats.notes} note{stats.notes === 1 ? "" : "s"}
        </Badge>
        {totalSubs != null && totalSubs > 0 && (
          <Badge variant="secondary" className="text-[10px] font-mono font-normal h-5">+{totalSubs} via subs</Badge>
        )}
      </div>
      <div className="ml-auto flex gap-1 items-center">
        <TagClockButton tagId={tag.id} />
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
          {mergeOptions.length > 0 && (
            <MergeDialog tag={tag} options={mergeOptions} stats={stats} onConfirm={onMerge} />
          )}
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onStartEdit} title="Edit">
            <Pencil size={13} />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 hover:text-destructive" onClick={onDelete} title="Delete">
            <Trash2 size={13} />
          </Button>
        </div>
      </div>
    </div>
  );
}

function TagClockButton({ tagId }: { tagId: string }) {
  const { active, startTag, stop } = useActiveTimer();
  const isRunning = active?.tag_id === tagId && !active?.task_id;
  const now = useNowTick(isRunning);
  const elapsed = isRunning && active ? Math.floor((now - new Date(active.started_at).getTime()) / 1000) : 0;
  if (isRunning) {
    return (
      <Button
        size="sm" variant="outline"
        className="h-8 gap-1.5 border-primary/40 text-primary"
        onClick={() => stop()}
        title="Clock out"
      >
        <Square size={11} /> Clock out
        <span className="font-mono tabular-nums text-[11px] ml-1">{fmtDuration(elapsed)}</span>
      </Button>
    );
  }
  return (
    <Button
      size="sm" variant="ghost"
      className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
      onClick={() => startTag(tagId)}
      title="Clock in to this tag"
    >
      <Play size={11} /> Clock in
    </Button>
  );
}

function MergeDialog({
  tag, options, stats, onConfirm,
}: {
  tag: Tag;
  options: Tag[];
  stats: { tasks: number; notes: number };
  onConfirm: (dstId: string) => void;
}) {
  const [dst, setDst] = useState<string>("");
  const [open, setOpen] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button size="icon" variant="ghost" className="h-8 w-8" title="Merge into another tag">
          <GitMerge size={13} />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Merge "{tag.name}" into…</AlertDialogTitle>
          <AlertDialogDescription>
            All {stats.tasks + stats.notes} item{stats.tasks + stats.notes === 1 ? "" : "s"} using "{tag.name}" will be reassigned to the chosen tag, then "{tag.name}" will be deleted.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-2">
          <Label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Destination</Label>
          <Select value={dst} onValueChange={setDst}>
            <SelectTrigger className="mt-1.5"><SelectValue placeholder="Pick a tag" /></SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: o.color }} />
                    {o.parent_id ? "↳ " : ""}{o.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={!dst}
            onClick={() => { onConfirm(dst); setOpen(false); }}
          >
            Merge
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function NewTagDialog({
  onAdd, parents,
}: {
  onAdd: (name: string, color: string, parent: string | null) => Promise<unknown>;
  parents: Tag[];
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [parent, setParent] = useState<string>("none");

  const submit = async () => {
    if (!name.trim()) return;
    await onAdd(name.trim(), color, parent === "none" ? null : parent);
    setName(""); setColor(PRESET_COLORS[0]); setParent("none"); setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5"><Plus size={13} /> New tag</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl">New tag</DialogTitle>
          <DialogDescription className="text-xs">Optionally place it under a parent.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Name</Label>
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)}
              maxLength={32}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              placeholder="Marketing, Personal, Urgent…" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Parent</Label>
            <Select value={parent} onValueChange={setParent}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— none (root) —</SelectItem>
                {parents.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                      {p.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Separator />
          <div className="space-y-1.5">
            <Label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Color</Label>
            <div className="flex gap-1.5 flex-wrap items-center">
              {PRESET_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition ${color === c ? "ring-2 ring-offset-2 ring-foreground" : ""}`}
                  style={{ background: c }} />
              ))}
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
                className="w-7 h-7 rounded-full cursor-pointer border-0 p-0 bg-transparent" title="Custom" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!name.trim()}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
