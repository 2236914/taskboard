import { useNavigate } from "@tanstack/react-router";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { useTaskboard, useNotes } from "@/lib/taskboard-data";
import { useActiveTimer } from "@/lib/time-tracking";
import { Home, LayoutGrid, StickyNote, Tag as TagIcon, BarChart3, Plus, Keyboard, Settings, Play, Square } from "lucide-react";

type View = "home" | "board" | "notes" | "reports" | "tags" | "settings";

export function CommandPalette({
  open, onClose, setView, onNewTask, onNewNote, onShowShortcuts,
}: {
  open: boolean;
  onClose: () => void;
  setView: (v: View) => void;
  onNewTask: () => void;
  onNewNote: () => void;
  onShowShortcuts: () => void;
}) {
  const navigate = useNavigate();
  const { tasks, tags } = useTaskboard();
  const { notes } = useNotes();
  const { active, stop, startTag } = useActiveTimer();
  const rootTags = tags.filter((t) => !t.parent_id);

  const run = (fn: () => void | Promise<void>) => { onClose(); void fn(); };

  return (
    <CommandDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <CommandInput placeholder="Search tasks, notes, tags, or jump to…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>

        <CommandGroup heading="Quick actions">
          <CommandItem onSelect={() => run(onNewTask)}>
            <Plus /> <span>New task</span>
          </CommandItem>
          <CommandItem onSelect={() => run(onNewNote)}>
            <Plus /> <span>New note</span>
          </CommandItem>
          <CommandItem onSelect={() => run(onShowShortcuts)}>
            <Keyboard /> <span>Keyboard shortcuts</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Time tracking">
          {active ? (
            <CommandItem onSelect={() => run(async () => { await stop(); })}>
              <Square /> <span>Stop running timer</span>
            </CommandItem>
          ) : (
            rootTags.slice(0, 8).map((t) => (
              <CommandItem key={`timer-${t.id}`} value={`start timer ${t.name}`} onSelect={() => run(async () => { await startTag(t.id); })}>
                <Play />
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: t.color }} />
                <span>Start timer for {t.name}</span>
              </CommandItem>
            ))
          )}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Go to">
          <CommandItem onSelect={() => run(() => setView("home"))}><Home /> Home</CommandItem>
          <CommandItem onSelect={() => run(() => setView("board"))}><LayoutGrid /> Board</CommandItem>
          <CommandItem onSelect={() => run(() => setView("notes"))}><StickyNote /> Notes</CommandItem>
          <CommandItem onSelect={() => run(() => setView("tags"))}><TagIcon /> Tags</CommandItem>
          <CommandItem onSelect={() => run(() => setView("reports"))}><BarChart3 /> Reports</CommandItem>
          <CommandItem onSelect={() => run(() => setView("settings"))}><Settings /> Settings</CommandItem>
        </CommandGroup>

        {tasks.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Tasks">
              {tasks.slice(0, 30).map((t) => (
                <CommandItem
                  key={t.id}
                  value={`task ${t.name} ${t.day} ${t.status}`}
                  onSelect={() => run(() => setView("board"))}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground inline-block" />
                  <span className="truncate">{t.name}</span>
                  <span className="ml-auto text-[10px] font-mono text-muted-foreground uppercase">{t.day}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {notes.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Notes">
              {notes.slice(0, 20).map((n) => (
                <CommandItem
                  key={n.id}
                  value={`note ${n.title} ${n.content.slice(0, 80)}`}
                  onSelect={() => run(() => setView("notes"))}
                >
                  <StickyNote />
                  <span className="truncate">{n.title || "Untitled"}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {tags.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Tags">
              {tags.slice(0, 20).map((t) => (
                <CommandItem
                  key={t.id}
                  value={`tag ${t.name}`}
                  onSelect={() => run(() => setView("tags"))}
                >
                  <span className="w-2 h-2 rounded-full inline-block" style={{ background: t.color }} />
                  <span>{t.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />
        <CommandGroup heading="App">
          <CommandItem onSelect={() => run(() => navigate({ to: "/auth" }))}>
            Open auth page
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
