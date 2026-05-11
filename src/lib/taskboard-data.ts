import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export type Tag = {
  id: string;
  name: string;
  color: string;
  parent_id: string | null;
  daily_target_minutes?: number | null;
  /** IANA timezone (e.g. "Asia/Tokyo") shown as a live clock on tag chips. */
  timezone?: string | null;
};
export type Note = {
  id: string;
  title: string;
  content: string;
  tag_id: string | null;
  pinned_at: string | null;
  is_public: boolean;
  public_slug: string | null;
  created_at: string;
  updated_at: string;
};
export type Task = {
  id: string;
  name: string;
  note: string | null;
  day: string;
  status: "todo" | "in_progress" | "done";
  tag_id: string | null;
  sort_order: number;
  pinned_at: string | null;
  due_at: string | null;
  reminder_offset_minutes: number | null;
  created_at: string;
  updated_at: string;
};
export type Attachment = {
  id: string;
  user_id: string;
  task_id: string | null;
  note_id: string | null;
  time_entry_id: string | null;
  file_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
};

/** Sort: pinned first (newest pin first), then by sort_order asc. */
export function sortTasks(arr: Task[]): Task[] {
  return [...arr].sort((a, b) => {
    if (!!a.pinned_at !== !!b.pinned_at) return a.pinned_at ? -1 : 1;
    if (a.pinned_at && b.pinned_at)
      return b.pinned_at.localeCompare(a.pinned_at);
    return Number(a.sort_order) - Number(b.sort_order);
  });
}

/** Sort notes: pinned first, then updated_at desc. */
export function sortNotes(arr: Note[]): Note[] {
  return [...arr].sort((a, b) => {
    if (!!a.pinned_at !== !!b.pinned_at) return a.pinned_at ? -1 : 1;
    return b.updated_at.localeCompare(a.updated_at);
  });
}

/** Categorize a due date relative to today (date-only comparison). */
export type DueState = "overdue" | "today" | "soon" | "future" | null;
export function dueState(
  due_at: string | null,
  status?: Task["status"],
): DueState {
  if (!due_at) return null;
  if (status === "done") return null;
  const due = new Date(due_at);
  const now = new Date();
  const dueDay = new Date(
    due.getFullYear(),
    due.getMonth(),
    due.getDate(),
  ).getTime();
  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const day = 86400000;
  if (dueDay < today) return "overdue";
  if (dueDay === today) return "today";
  if (dueDay - today <= 3 * day) return "soon";
  return "future";
}

export function useTaskboard() {
  const { user } = useAuth();
  const [tags, setTags] = useState<Tag[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    const [tg, ts] = await Promise.all([
      supabase.from("tags").select("*").order("created_at"),
      supabase.from("tasks").select("*").order("sort_order"),
    ]);
    setTags((tg.data ?? []) as Tag[]);
    setTasks(
      ((ts.data ?? []) as Task[]).map((t) => ({
        ...t,
        sort_order: Number(t.sort_order),
      })),
    );
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Tag ops
  const addTag = async (
    name: string,
    color: string,
    parent_id: string | null = null,
  ) => {
    if (!user) return;
    const { data, error } = await supabase
      .from("tags")
      .insert({ user_id: user.id, name: name.trim(), color, parent_id })
      .select()
      .single();
    if (!error && data) setTags((p) => [...p, data as Tag]);
    return error;
  };
  const updateTag = async (id: string, patch: Partial<Tag>) => {
    const { data } = await supabase
      .from("tags")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (data) setTags((p) => p.map((t) => (t.id === id ? (data as Tag) : t)));
  };
  const deleteTag = async (id: string) => {
    await supabase.from("tags").delete().eq("id", id);
    setTags((p) => p.filter((t) => t.id !== id));
    setTasks((p) =>
      p.map((t) => (t.tag_id === id ? { ...t, tag_id: null } : t)),
    );
  };
  /** Move all items from src tag to dst, then delete src. */
  const mergeTag = async (srcId: string, dstId: string) => {
    if (srcId === dstId) return;
    await Promise.all([
      supabase.from("tasks").update({ tag_id: dstId }).eq("tag_id", srcId),
      supabase.from("notes").update({ tag_id: dstId }).eq("tag_id", srcId),
    ]);
    await supabase.from("tags").delete().eq("id", srcId);
    setTags((p) => p.filter((t) => t.id !== srcId));
    setTasks((p) =>
      p.map((t) => (t.tag_id === srcId ? { ...t, tag_id: dstId } : t)),
    );
  };

  // Task ops
  const addTask = async (input: {
    name: string;
    note?: string;
    day: string;
    status: Task["status"];
    tag_id: string | null;
    due_at?: string | null;
  }) => {
    if (!user) return;
    const same = tasks.filter(
      (t) => t.day === input.day && t.status === input.status,
    );
    const maxSort = same.length
      ? Math.max(...same.map((t) => Number(t.sort_order)))
      : 0;
    const sort_order = maxSort + 1000;
    const { data } = await supabase
      .from("tasks")
      .insert({
        ...input,
        user_id: user.id,
        sort_order,
        due_at: input.due_at ?? null,
      })
      .select()
      .single();
    if (data)
      setTasks((p) => [
        ...p,
        { ...(data as Task), sort_order: Number((data as Task).sort_order) },
      ]);
    return data as Task | null;
  };
  const updateTask = async (id: string, patch: Partial<Task>) => {
    setTasks((p) =>
      p.map((t) => (t.id === id ? ({ ...t, ...patch } as Task) : t)),
    );
    const { data } = await supabase
      .from("tasks")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (data)
      setTasks((p) =>
        p.map((t) =>
          t.id === id
            ? {
                ...(data as Task),
                sort_order: Number((data as Task).sort_order),
              }
            : t,
        ),
      );
  };
  const deleteTask = async (id: string) => {
    // Snapshot for undo before the row vanishes.
    const snap = tasks.find((t) => t.id === id) ?? null;
    setTasks((p) => p.filter((t) => t.id !== id));
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) {
      // Restore optimistic removal on failure.
      if (snap) setTasks((p) => [...p, snap]);
      toast.error("Couldn't delete task");
      return;
    }
    toast.success("Task deleted", {
      action:
        snap && user
          ? {
              label: "Undo",
              onClick: async () => {
                const { data, error: insErr } = await supabase
                  .from("tasks")
                  .insert({
                    user_id: user.id,
                    name: snap.name,
                    note: snap.note,
                    day: snap.day,
                    status: snap.status,
                    tag_id: snap.tag_id,
                    sort_order: snap.sort_order,
                    pinned_at: snap.pinned_at,
                    due_at: snap.due_at,
                  })
                  .select()
                  .single();
                if (insErr || !data) {
                  toast.error("Couldn't restore task");
                  return;
                }
                setTasks((p) => [
                  ...p,
                  {
                    ...(data as Task),
                    sort_order: Number((data as Task).sort_order),
                  },
                ]);
                toast.success("Task restored");
              },
            }
          : undefined,
    });
  };

  const moveTask = async (
    taskId: string,
    target: { day: string; status: Task["status"]; index: number },
  ) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const column = sortTasks(
      tasks.filter(
        (t) =>
          t.id !== taskId &&
          t.day === target.day &&
          t.status === target.status &&
          !t.pinned_at,
      ),
    );
    const idx = Math.max(0, Math.min(target.index, column.length));
    const before = column[idx - 1];
    const after = column[idx];
    const beforeS = before ? Number(before.sort_order) : null;
    const afterS = after ? Number(after.sort_order) : null;
    let newSort: number;
    if (beforeS == null && afterS == null) newSort = 1000;
    else if (beforeS == null) newSort = afterS! - 1000;
    else if (afterS == null) newSort = beforeS + 1000;
    else newSort = (beforeS + afterS) / 2;

    const patch: Partial<Task> = {
      day: target.day,
      status: target.status,
      sort_order: newSort,
    };
    setTasks((p) =>
      p.map((t) => (t.id === taskId ? ({ ...t, ...patch } as Task) : t)),
    );
    await supabase.from("tasks").update(patch).eq("id", taskId);
  };

  const togglePinTask = async (id: string) => {
    const t = tasks.find((x) => x.id === id);
    if (!t) return;
    await updateTask(id, {
      pinned_at: t.pinned_at ? null : new Date().toISOString(),
    });
  };

  return {
    tags,
    tasks,
    loading,
    refresh,
    addTag,
    updateTag,
    deleteTag,
    mergeTag,
    addTask,
    updateTask,
    deleteTask,
    moveTask,
    togglePinTask,
  };
}

export function useDayNote(dayKey: string) {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoaded(false);
    supabase
      .from("day_notes")
      .select("content")
      .eq("day_key", dayKey)
      .maybeSingle()
      .then(({ data }) => {
        setContent(data?.content ?? "");
        setLoaded(true);
      });
  }, [user, dayKey]);

  const save = async (next: string) => {
    if (!user) return;
    setContent(next);
    await supabase
      .from("day_notes")
      .upsert(
        { user_id: user.id, day_key: dayKey, content: next },
        { onConflict: "user_id,day_key" },
      );
  };

  return { content, save, loaded };
}

function randomSlug(len = 10): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < len; i++)
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export function useNotes() {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notes")
      .select("*")
      .order("pinned_at", { ascending: false, nullsFirst: false })
      .order("updated_at", { ascending: false });
    setNotes((data ?? []) as Note[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addNote = async (input: {
    title: string;
    content?: string;
    tag_id?: string | null;
  }) => {
    if (!user) return null;
    const { data } = await supabase
      .from("notes")
      .insert({
        user_id: user.id,
        title: input.title.trim() || "Untitled",
        content: input.content ?? "",
        tag_id: input.tag_id ?? null,
      })
      .select()
      .single();
    if (data) setNotes((p) => sortNotes([data as Note, ...p]));
    return data as Note | null;
  };

  const updateNote = async (id: string, patch: Partial<Note>) => {
    setNotes((p) =>
      sortNotes(
        p.map((n) =>
          n.id === id
            ? { ...n, ...patch, updated_at: new Date().toISOString() }
            : n,
        ),
      ),
    );
    const { data } = await supabase
      .from("notes")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (data)
      setNotes((p) =>
        sortNotes(p.map((n) => (n.id === id ? (data as Note) : n))),
      );
  };

  const deleteNote = async (id: string) => {
    await supabase.from("notes").delete().eq("id", id);
    setNotes((p) => p.filter((n) => n.id !== id));
  };

  const togglePinNote = async (id: string) => {
    const n = notes.find((x) => x.id === id);
    if (!n) return;
    await updateNote(id, {
      pinned_at: n.pinned_at ? null : new Date().toISOString(),
    });
  };

  /** Make a note public (creates a slug if missing). Returns the slug. */
  const makePublic = async (id: string): Promise<string | null> => {
    const n = notes.find((x) => x.id === id);
    if (!n) return null;
    let slug = n.public_slug;
    // Try a few times in the unlikely case of a collision
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = slug ?? randomSlug(10);
      const { data, error } = await supabase
        .from("notes")
        .update({ is_public: true, public_slug: candidate })
        .eq("id", id)
        .select()
        .single();
      if (!error && data) {
        setNotes((p) => p.map((x) => (x.id === id ? (data as Note) : x)));
        return (data as Note).public_slug;
      }
      // Collision — generate a fresh slug and retry
      slug = null;
    }
    return null;
  };

  const makePrivate = async (id: string) => {
    await updateNote(id, { is_public: false });
  };

  return {
    notes,
    loading,
    refresh,
    addNote,
    updateNote,
    deleteNote,
    togglePinNote,
    makePublic,
    makePrivate,
  };
}

/* ===========================================================================
   ATTACHMENTS
   =========================================================================== */

export function useAttachments(parent: {
  taskId?: string;
  noteId?: string;
  timeEntryId?: string;
}) {
  const { user } = useAuth();
  const [items, setItems] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const key = parent.taskId ?? parent.noteId ?? parent.timeEntryId ?? null;

  const refresh = useCallback(async () => {
    if (!user || !key) {
      setItems([]);
      setLoading(false);
      return;
    }
    const q = supabase
      .from("attachments")
      .select("*")
      .order("created_at", { ascending: false });
    const { data } = parent.taskId
      ? await q.eq("task_id", parent.taskId)
      : parent.noteId
        ? await q.eq("note_id", parent.noteId)
        : await q.eq("time_entry_id", parent.timeEntryId!);
    setItems((data ?? []) as Attachment[]);
    setLoading(false);
  }, [user, key, parent.taskId, parent.noteId, parent.timeEntryId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const upload = async (
    files: FileList | File[],
  ): Promise<{ ok: number; errors: string[] }> => {
    if (!user || !key) return { ok: 0, errors: ["Not ready"] };
    const arr = Array.from(files);
    const errors: string[] = [];
    let ok = 0;
    setUploading(true);
    try {
      for (const file of arr) {
        if (file.size > 20 * 1024 * 1024) {
          errors.push(`${file.name}: too large (max 20 MB)`);
          continue;
        }
        if (items.length + ok >= 10) {
          errors.push(`Limit reached (10 files)`);
          break;
        }
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${user.id}/${key}/${Date.now()}_${safeName}`;
        const { error: upErr } = await supabase.storage
          .from("attachments")
          .upload(path, file, {
            contentType: file.type || "application/octet-stream",
            cacheControl: "3600",
            upsert: false,
          });
        if (upErr) {
          errors.push(`${file.name}: ${upErr.message}`);
          continue;
        }
        const { data: row, error: rowErr } = await supabase
          .from("attachments")
          .insert({
            user_id: user.id,
            task_id: parent.taskId ?? null,
            note_id: parent.noteId ?? null,
            time_entry_id: parent.timeEntryId ?? null,
            file_path: path,
            file_name: file.name,
            mime_type: file.type || "application/octet-stream",
            size_bytes: file.size,
          })
          .select()
          .single();
        if (rowErr) {
          await supabase.storage.from("attachments").remove([path]);
          errors.push(`${file.name}: ${rowErr.message}`);
          continue;
        }
        if (row) setItems((p) => [row as Attachment, ...p]);
        ok++;
      }
    } finally {
      setUploading(false);
    }
    return { ok, errors };
  };

  const remove = async (att: Attachment) => {
    const { error: sErr } = await supabase.storage
      .from("attachments")
      .remove([att.file_path]);
    const { error: dErr } = await supabase
      .from("attachments")
      .delete()
      .eq("id", att.id);
    if (sErr || dErr) {
      toast.error("Couldn't delete attachment");
      return;
    }
    setItems((p) => p.filter((x) => x.id !== att.id));
    toast.success("Attachment deleted");
  };

  const rename = async (att: Attachment, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === att.file_name) return;
    const { data, error } = await supabase
      .from("attachments")
      .update({ file_name: trimmed })
      .eq("id", att.id)
      .select()
      .maybeSingle();
    if (error) {
      toast.error("Couldn't rename");
      return;
    }
    if (data) {
      setItems((p) =>
        p.map((x) => (x.id === att.id ? (data as Attachment) : x)),
      );
      toast.success("Renamed");
    }
  };

  const getSignedUrl = async (att: Attachment): Promise<string | null> => {
    const { data } = await supabase.storage
      .from("attachments")
      .createSignedUrl(att.file_path, 3600);
    return data?.signedUrl ?? null;
  };

  return {
    items,
    loading,
    uploading,
    upload,
    remove,
    rename,
    getSignedUrl,
    refresh,
  };
}

/** Lightweight: per-id attachment counts for a parent type. */
export function useAttachmentCounts(kind: "task" | "note") {
  const { user } = useAuth();
  const [counts, setCounts] = useState<Record<string, number>>({});

  const refresh = useCallback(async () => {
    if (!user) return;
    const col = kind === "task" ? "task_id" : "note_id";
    const { data } = await supabase.from("attachments").select(`id,${col}`);
    const m: Record<string, number> = {};
    (data ?? []).forEach((row: Record<string, unknown>) => {
      const k = row[col];
      if (typeof k === "string") m[k] = (m[k] ?? 0) + 1;
    });
    setCounts(m);
  }, [user, kind]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { counts, refresh };
}
