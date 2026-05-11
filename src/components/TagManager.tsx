import { useEffect, useMemo, useState } from "react";
import { useTaskboard, type Tag } from "@/lib/taskboard-data";
import {
  Pencil,
  Trash2,
  Plus,
  ChevronRight,
  ChevronDown,
  CornerDownRight,
  X,
  Check,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TimezoneClock } from "@/components/TimezoneClock";

const PRESET_COLORS = [
  "#5055A0",
  "#3D6B3F",
  "#A03030",
  "#8F3A55",
  "#B85C38",
  "#4A6FA8",
  "#7C5BA0",
  "#3D8B7E",
];

// RadixSelect can't take "" as a value, so use a sentinel for "no timezone".
const TZ_NONE = "__none__";
const TAG_TIMEZONES: string[] = [
  "UTC",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Lisbon",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Athens",
  "Africa/Cairo",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Bangkok",
  "Asia/Shanghai",
  "Asia/Manila",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
];

export function TagManager({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { tags, addTag, updateTag, deleteTag } = useTaskboard();
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [newParent, setNewParent] = useState<string>("");
  const [editing, setEditing] = useState<Tag | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { roots, childrenByParent } = useMemo(() => {
    const roots: Tag[] = [];
    const map = new Map<string, Tag[]>();
    tags.forEach((t) => {
      if (!t.parent_id) roots.push(t);
      else {
        if (!map.has(t.parent_id)) map.set(t.parent_id, []);
        map.get(t.parent_id)!.push(t);
      }
    });
    return { roots, childrenByParent: map };
  }, [tags]);

  const toggle = (id: string) => {
    setExpanded((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const handleAdd = async () => {
    if (!newName.trim()) return;
    const err = await addTag(newName, newColor, newParent || null);
    if (!err) {
      setNewName("");
      setNewColor(PRESET_COLORS[0]);
    }
  };

  const renderTagRow = (tag: Tag, depth: number) => {
    const kids = childrenByParent.get(tag.id) ?? [];
    const isOpen = expanded.has(tag.id);
    return (
      <div key={tag.id}>
        <div
          className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 hover:bg-muted group"
          style={{ marginLeft: depth * 18 }}
        >
          {depth === 0 ? (
            kids.length > 0 ? (
              <button
                onClick={() => toggle(tag.id)}
                className="text-muted-foreground hover:text-foreground -ml-1"
              >
                {isOpen ? (
                  <ChevronDown size={13} />
                ) : (
                  <ChevronRight size={13} />
                )}
              </button>
            ) : (
              <span className="w-3" />
            )
          ) : (
            <CornerDownRight size={11} className="text-muted-foreground" />
          )}

          {
            <>
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: tag.color }}
              />
              <span className="flex-1 text-sm font-light truncate flex items-center gap-2">
                {tag.name}
                {tag.timezone && (
                  <TimezoneClock
                    tz={tag.timezone}
                    className="text-[10px] text-muted-foreground"
                  />
                )}
              </span>
              {depth === 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setNewParent(tag.id);
                    setExpanded((p) => new Set(p).add(tag.id));
                  }}
                  className="h-6 px-2 text-[10px] font-mono opacity-0 group-hover:opacity-100 transition rounded-full"
                >
                  + sub
                </Button>
              )}
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={() => setEditing(tag)}
              >
                <Pencil size={12} />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => {
                  if (
                    confirm(
                      `Delete "${tag.name}"${kids.length ? ` and its ${kids.length} sub-tag(s)` : ""}?`,
                    )
                  )
                    deleteTag(tag.id);
                }}
              >
                <Trash2 size={12} />
              </Button>
            </>
          }
        </div>
        {depth === 0 && isOpen && kids.map((k) => renderTagRow(k, depth + 1))}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl">Manage tags</DialogTitle>
          <DialogDescription className="text-xs">
            Categories with optional sub-tags.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-72 -mx-1 px-1">
          <div className="space-y-1.5">
            {roots.map((t) => renderTagRow(t, 0))}
            {tags.length === 0 && (
              <div className="text-center py-6 text-xs font-mono text-muted-foreground">
                no tags yet
              </div>
            )}
          </div>
        </ScrollArea>

        <Separator />

        <div className="space-y-3">
          <Label className="text-[10px] font-mono tracking-widest uppercase text-muted-foreground">
            New {newParent ? "sub-tag" : "tag"}
          </Label>
          {newParent && (
            <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground px-2 py-1.5 rounded-md bg-muted/60">
              <span className="flex items-center gap-1.5">
                <CornerDownRight size={11} />
                under{" "}
                <strong className="font-medium text-foreground">
                  {tags.find((t) => t.id === newParent)?.name}
                </strong>
              </span>
              <button
                onClick={() => setNewParent("")}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={12} />
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
              }}
              placeholder={newParent ? "sub-tag name" : "tag name"}
              maxLength={32}
            />
            <Button type="button" onClick={handleAdd} size="icon">
              <Plus size={14} />
            </Button>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setNewColor(c)}
                className={`w-6 h-6 rounded-full transition ${newColor === c ? "ring-2 ring-offset-2 ring-foreground" : ""}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
      </DialogContent>

      <EditTagDialog
        tag={editing}
        onClose={() => setEditing(null)}
        onSave={(patch) => {
          if (!editing) return;
          updateTag(editing.id, patch);
          setEditing(null);
        }}
      />
    </Dialog>
  );
}

// ------------------------------------------------------------------
// Edit tag dialog — opened by the pencil icon in the tag list
// ------------------------------------------------------------------
// Lifts tag editing out of the cramped inline row layout where the
// timezone select was getting clipped. Has room for name, color
// swatches, and a properly-sized timezone dropdown.
function EditTagDialog({
  tag,
  onClose,
  onSave,
}: {
  tag: Tag | null;
  onClose: () => void;
  onSave: (patch: Partial<Tag>) => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [timezone, setTimezone] = useState<string | null>(null);

  useEffect(() => {
    if (tag) {
      setName(tag.name);
      setColor(tag.color);
      setTimezone(tag.timezone ?? null);
    }
  }, [tag]);

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!name.trim()) return;
    onSave({ name: name.trim(), color, timezone });
  };

  return (
    <Dialog open={!!tag} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Edit tag</DialogTitle>
          <DialogDescription className="text-xs">
            Rename, recolour, or pin a timezone to this tag.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Name
            </Label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={64}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Color
            </Label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full transition ${color === c ? "ring-2 ring-offset-2 ring-foreground" : "hover:scale-110"}`}
                  style={{ background: c }}
                  aria-label={`Pick color ${c}`}
                />
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Timezone
            </Label>
            <Select
              value={timezone ?? TZ_NONE}
              onValueChange={(v) => setTimezone(v === TZ_NONE ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="No timezone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TZ_NONE}>No timezone</SelectItem>
                {TAG_TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              When set, tag chips show a live HH:MM clock in this zone.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="rounded-full"
              disabled={!name.trim()}
            >
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
