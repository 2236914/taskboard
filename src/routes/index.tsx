import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { useNavPrefs, type NavStyle, type Theme } from "@/lib/nav-prefs";
import {
  useTaskboard,
  useDayNote,
  useNotes,
  useAttachmentCounts,
  dueState,
  type Task,
  type Tag,
  type Note,
} from "@/lib/taskboard-data";
import { TaskModal } from "@/components/TaskModal";
import { KanbanBoard } from "@/components/KanbanBoard";
import { TagsView } from "@/components/TagsView";
import { AttachmentPanel } from "@/components/AttachmentPanel";
import { SharePopover } from "@/components/SharePopover";
import { CommandPalette } from "@/components/CommandPalette";
import { ShortcutsDialog } from "@/components/ShortcutsDialog";
import { LiveClock } from "@/components/LiveClock";
import { PrintReport } from "@/components/PrintReport";
import { SettingsView } from "@/components/SettingsView";
import { FeedbackView } from "@/components/FeedbackView";
import { AdminView } from "@/components/AdminView";
import { useIsAdmin } from "@/lib/admin";
import { WorldClocks } from "@/components/WorldClocks";
import { TimezoneClock } from "@/components/TimezoneClock";
import { TimerPill } from "@/components/TimerPill";
import {
  StatusStackedBar,
  TagStatusBars,
  TimeByTagBars,
} from "@/components/charts/StatusCharts";
import {
  useAllTimeEntries,
  useActiveTimer,
  entrySeconds,
  fmtHours,
  fmtDuration,
  type TimeEntry,
} from "@/lib/time-tracking";
import {
  LogOut,
  Settings,
  Plus,
  LayoutGrid,
  Home as HomeIcon,
  BarChart3,
  ChevronRight,
  PanelLeft,
  LayoutList,
  Loader2,
  Circle,
  CircleDashed,
  CheckCircle2,
  StickyNote,
  Search,
  Tag as TagIcon,
  Pin,
  PinOff,
  Paperclip,
  CalendarClock,
  Keyboard,
  Trash2,
  Sparkles,
  Check,
  X,
  Sun,
  Moon,
  Monitor,
  Printer,
  FileText,
  Calendar as CalendarIcon,
  Timer,
  Play,
  Square,
  Pause,
  Edit3,
  PlayCircle,
  MessageSquare,
  Shield,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/")({ component: HomeRoute });

const DAYS = [
  { v: "mon", short: "Mon", long: "Monday" },
  { v: "tue", short: "Tue", long: "Tuesday" },
  { v: "wed", short: "Wed", long: "Wednesday" },
  { v: "thu", short: "Thu", long: "Thursday" },
  { v: "fri", short: "Fri", long: "Friday" },
  { v: "sat", short: "Sat", long: "Saturday" },
  { v: "sun", short: "Sun", long: "Sunday" },
];

type View =
  | "home"
  | "board"
  | "notes"
  | "reports"
  | "tags"
  | "clock"
  | "feedback"
  | "admin"
  | "settings";

function todayDay(): string {
  return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][new Date().getDay()];
}

const NAV_ITEMS: { v: View; l: string; i: typeof HomeIcon }[] = [
  { v: "home", l: "Home", i: HomeIcon },
  { v: "board", l: "Board", i: LayoutGrid },
  { v: "notes", l: "Notes", i: StickyNote },
  { v: "tags", l: "Tags", i: TagIcon },
  { v: "clock", l: "Clock", i: Timer },
  { v: "reports", l: "Reports", i: BarChart3 },
  { v: "feedback", l: "Feedback", i: MessageSquare },
  { v: "settings", l: "Settings", i: Settings },
];

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

function StatusDot({
  status,
  size = 8,
}: {
  status: Task["status"];
  size?: number;
}) {
  return (
    <span
      className="inline-block rounded-full shrink-0"
      style={{
        width: size,
        height: size,
        background: STATUS_META[status].color,
      }}
    />
  );
}

function TagPill({ tag, tags }: { tag: Tag; tags: Tag[] }) {
  const parent = tag.parent_id
    ? tags.find((t) => t.id === tag.parent_id)
    : undefined;
  const tz = tag.timezone ?? parent?.timezone ?? null;
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
      {tz && <TimezoneClock tz={tz} className="text-muted-foreground ml-0.5" />}
    </Badge>
  );
}

/* ============================================================================
   Shared shell context: lifted state + global keyboard
   ========================================================================== */

type ShellState = {
  view: View;
  setView: (v: View) => void;
  day: string;
  setDay: (d: string) => void;
  openNewTask: () => void;
  openEditTask: (t: Task) => void;
  openViewTask: (t: Task) => void;
  openNewNote: () => void;
  openPalette: () => void;
  openShortcuts: () => void;
};

// localStorage key for persisting `view` + `day` across refreshes so reload
// keeps the user where they were instead of bouncing back to Home.
const SHELL_PREFS_KEY = "taskboard:shell";

function readShellPrefs(): { view?: View; day?: string } {
  if (typeof window === "undefined") return {};
  try {
    const v = localStorage.getItem(SHELL_PREFS_KEY);
    return v ? JSON.parse(v) : {};
  } catch {
    return {};
  }
}

const VALID_VIEWS: View[] = [
  "home",
  "board",
  "notes",
  "reports",
  "tags",
  "clock",
  "feedback",
  "admin",
  "settings",
];

function useShellGlobals() {
  const stored = readShellPrefs();
  const [view, setView] = useState<View>(
    stored.view && VALID_VIEWS.includes(stored.view) ? stored.view : "home",
  );
  const [day, setDay] = useState(stored.day ?? todayDay());

  // Persist on every change so the next refresh restores the same view.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(SHELL_PREFS_KEY, JSON.stringify({ view, day }));
    } catch {
      // localStorage may be disabled (private mode); silently ignore.
    }
  }, [view, day]);
  const [taskOpen, setTaskOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [taskMode, setTaskMode] = useState<"view" | "edit">("edit");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const newNoteRef = useRef<(() => void) | null>(null);

  const openNewTask = useCallback(() => {
    setEditTask(null);
    setTaskMode("edit");
    setTaskOpen(true);
  }, []);
  const openEditTask = useCallback((t: Task) => {
    setEditTask(t);
    setTaskMode("edit");
    setTaskOpen(true);
  }, []);
  const openViewTask = useCallback((t: Task) => {
    setEditTask(t);
    setTaskMode("view");
    setTaskOpen(true);
  }, []);
  const openNewNote = useCallback(() => {
    setView("notes");
    // Run after the Notes view mounts and registers its handler.
    setTimeout(() => newNoteRef.current?.(), 60);
  }, []);
  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const openShortcuts = useCallback(() => setShortcutsOpen(true), []);

  // Global hotkeys
  useEffect(() => {
    let lastG = 0;
    const isTyping = () => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
    };
    const onKey = (e: KeyboardEvent) => {
      // Always allow ⌘K / Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((p) => !p);
        return;
      }
      if (isTyping()) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const now = Date.now();
      const inGSeq = now - lastG < 800;

      if (e.key === "g") {
        lastG = now;
        return;
      }
      if (inGSeq) {
        const k = e.key.toLowerCase();
        if (k === "h") {
          setView("home");
          lastG = 0;
          return;
        }
        if (k === "b") {
          setView("board");
          lastG = 0;
          return;
        }
        if (k === "n") {
          setView("notes");
          lastG = 0;
          return;
        }
        if (k === "t") {
          setView("tags");
          lastG = 0;
          return;
        }
        if (k === "r") {
          setView("reports");
          lastG = 0;
          return;
        }
        if (k === "c") {
          setView("clock");
          lastG = 0;
          return;
        }
      }

      if (e.key === "n") {
        e.preventDefault();
        if (view === "notes") openNewNote();
        else openNewTask();
        return;
      }
      if (e.key === "?") {
        e.preventDefault();
        setShortcutsOpen(true);
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, openNewTask, openNewNote]);

  const shell: ShellState = {
    view,
    setView,
    day,
    setDay,
    openNewTask,
    openEditTask,
    openViewTask,
    openNewNote,
    openPalette,
    openShortcuts,
  };

  return {
    shell,
    taskOpen,
    setTaskOpen,
    editTask,
    taskMode,
    paletteOpen,
    setPaletteOpen,
    shortcutsOpen,
    setShortcutsOpen,
    newNoteRef,
  };
}

function HomeRoute() {
  const { user, loading: authLoading } = useAuth();
  const { style } = useNavPrefs();
  const nav = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) nav({ to: "/auth" });
  }, [authLoading, user, nav]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        <Loader2 className="animate-spin" size={18} />
      </div>
    );
  }

  return style === "sidebar" ? <SidebarShell /> : <PillsShell />;
}

/* ────────── SHELL: SIDEBAR ────────── */
function SidebarShell() {
  const g = useShellGlobals();
  const {
    shell,
    taskOpen,
    setTaskOpen,
    editTask,
    taskMode,
    paletteOpen,
    setPaletteOpen,
    shortcutsOpen,
    setShortcutsOpen,
    newNoteRef,
  } = g;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar shell={shell} />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar shell={shell} leftSlot={<SidebarTrigger />} />
          <main className="flex-1 px-4 md:px-8 py-6 pb-24 max-w-6xl w-full mx-auto">
            <ViewSwitch shell={shell} newNoteRef={newNoteRef} />
          </main>
        </div>
        <TaskModal
          key={`${editTask?.id ?? (taskOpen ? "new" : "closed")}-${taskMode}`}
          open={taskOpen}
          onClose={() => setTaskOpen(false)}
          defaultDay={shell.day}
          editTask={editTask}
          initialMode={taskMode}
        />
        <CommandPalette
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          setView={shell.setView}
          onNewTask={shell.openNewTask}
          onNewNote={shell.openNewNote}
          onShowShortcuts={shell.openShortcuts}
        />
        <ShortcutsDialog
          open={shortcutsOpen}
          onClose={() => setShortcutsOpen(false)}
        />
      </div>
    </SidebarProvider>
  );
}

function AppSidebar({ shell }: { shell: ShellState }) {
  const { user } = useAuth();
  const name =
    (user?.user_metadata as { username?: string } | undefined)?.username ??
    user?.email?.split("@")[0] ??
    "you";
  const { tasks } = useTaskboard();
  const signOutCtl = useSignOutWithConfirm();
  const { isAdmin } = useIsAdmin();
  const navItems = useMemo(
    () =>
      isAdmin
        ? [
            ...NAV_ITEMS.slice(0, NAV_ITEMS.length - 1),
            { v: "admin" as View, l: "Admin", i: Shield },
            NAV_ITEMS[NAV_ITEMS.length - 1],
          ]
        : NAV_ITEMS,
    [isAdmin],
  );

  const dueCounts = useMemo(() => {
    let overdue = 0,
      today = 0;
    tasks.forEach((t) => {
      const s = dueState(t.due_at, t.status);
      if (s === "overdue") overdue++;
      if (s === "today") today++;
    });
    return { overdue, today };
  }, [tasks]);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b">
        <div className="px-2 py-1.5 flex items-center gap-2">
          <div className="size-7 rounded-md bg-primary text-primary-foreground grid place-items-center font-semibold text-sm">
            T
          </div>
          <div className="flex flex-col leading-none group-data-[collapsible=icon]:hidden">
            <span className="font-semibold text-sm">Taskboard</span>
            <span className="text-[10px] text-muted-foreground font-mono">
              workspace
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map(({ v, l, i: Icon }) => (
                <SidebarMenuItem key={v}>
                  <SidebarMenuButton
                    onClick={() => shell.setView(v)}
                    isActive={shell.view === v}
                    tooltip={l}
                  >
                    <Icon />
                    <span>{l}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {dueCounts.overdue + dueCounts.today > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Due</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {dueCounts.overdue > 0 && (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => shell.setView("reports")}
                      tooltip="Overdue tasks"
                    >
                      <CalendarClock className="text-destructive" />
                      <span>Overdue</span>
                      <Badge
                        variant="outline"
                        className="ml-auto h-5 text-[10px] font-mono border-destructive/40 text-destructive"
                      >
                        {dueCounts.overdue}
                      </Badge>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
                {dueCounts.today > 0 && (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => shell.setView("reports")}
                      tooltip="Due today"
                    >
                      <CalendarClock />
                      <span>Today</span>
                      <Badge
                        variant="secondary"
                        className="ml-auto h-5 text-[10px] font-mono"
                      >
                        {dueCounts.today}
                      </Badge>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={shell.openShortcuts}
              tooltip="Keyboard shortcuts"
            >
              <Keyboard />
              <span>Shortcuts</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => shell.setView("settings")}
              tooltip="Settings"
            >
              <Settings />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip={name} className="gap-2">
              <Avatar className="size-6">
                <AvatarFallback className="text-[10px] font-medium">
                  {name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="truncate">{name}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={signOutCtl.request} tooltip="Sign out">
              <LogOut />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      {signOutCtl.dialog}
    </Sidebar>
  );
}

/* ────────── SHELL: PILLS ────────── */
function PillsShell() {
  const g = useShellGlobals();
  const {
    shell,
    taskOpen,
    setTaskOpen,
    editTask,
    taskMode,
    paletteOpen,
    setPaletteOpen,
    shortcutsOpen,
    setShortcutsOpen,
    newNoteRef,
  } = g;
  const { isAdmin } = useIsAdmin();
  const navItems = useMemo(
    () =>
      isAdmin
        ? [
            ...NAV_ITEMS.slice(0, NAV_ITEMS.length - 1),
            { v: "admin" as View, l: "Admin", i: Shield },
            NAV_ITEMS[NAV_ITEMS.length - 1],
          ]
        : NAV_ITEMS,
    [isAdmin],
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b bg-background/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 md:px-8 h-14 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-md bg-primary text-primary-foreground grid place-items-center font-semibold text-sm">
              T
            </div>
            <span className="font-semibold text-sm hidden sm:inline">
              Taskboard
            </span>
          </div>
          <Tabs
            value={shell.view}
            onValueChange={(v) => shell.setView(v as View)}
            className="mx-auto"
          >
            <TabsList>
              {navItems.map(({ v, l, i: Icon }) => (
                <TabsTrigger key={v} value={v} className="gap-1.5 text-xs">
                  <Icon size={13} /> {l}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-2">
            <TimerPill />
            <Button
              onClick={shell.openPalette}
              size="sm"
              variant="outline"
              className="gap-1.5 hidden md:flex"
            >
              <Search size={13} /> <span className="text-xs">Search</span>
              <kbd className="ml-1 text-[9px] font-mono bg-muted px-1 rounded">
                ⌘K
              </kbd>
            </Button>
            <AccountMenu shell={shell} />
            <Button onClick={shell.openNewTask} size="sm" className="gap-1.5">
              <Plus size={13} /> New task
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1 px-4 md:px-8 py-6 pb-24 max-w-6xl w-full mx-auto">
        <ViewHeader view={shell.view} day={shell.day} />
        <div className="mt-5">
          <ViewSwitch shell={shell} newNoteRef={newNoteRef} />
        </div>
      </main>
      <TaskModal
        key={`${editTask?.id ?? (taskOpen ? "new" : "closed")}-${taskMode}`}
        open={taskOpen}
        onClose={() => setTaskOpen(false)}
        defaultDay={shell.day}
        editTask={editTask}
        initialMode={taskMode}
      />
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        setView={shell.setView}
        onNewTask={shell.openNewTask}
        onNewNote={shell.openNewNote}
        onShowShortcuts={shell.openShortcuts}
      />
      <ShortcutsDialog
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
    </div>
  );
}

/* ────────── TOP BAR (sidebar shell) ────────── */
function TopBar({
  shell,
  leftSlot,
}: {
  shell: ShellState;
  leftSlot?: React.ReactNode;
}) {
  return (
    <header className="border-b bg-background/80 backdrop-blur sticky top-0 z-20">
      <div className="px-4 md:px-8 h-14 flex items-center gap-3">
        {leftSlot}
        <Separator orientation="vertical" className="h-5" />
        <ViewHeader view={shell.view} day={shell.day} compact />
        <div className="ml-auto flex items-center gap-2">
          <TimerPill />
          <Button
            onClick={shell.openPalette}
            size="sm"
            variant="outline"
            className="gap-1.5 hidden md:flex"
          >
            <Search size={13} /> <span className="text-xs">Search</span>
            <kbd className="ml-1 text-[9px] font-mono bg-muted px-1 rounded">
              ⌘K
            </kbd>
          </Button>
          <AccountMenu shell={shell} />
          <Button onClick={shell.openNewTask} size="sm" className="gap-1.5">
            <Plus size={13} /> New task
          </Button>
        </div>
      </div>
    </header>
  );
}

function ViewHeader({
  view,
  day,
  compact,
}: {
  view: View;
  day: string;
  compact?: boolean;
}) {
  const titles: Record<View, string> = {
    home: "Home",
    board: DAYS.find((d) => d.v === day)?.long ?? "Board",
    notes: "Notes",
    tags: "Tags",
    clock: "Clock",
    reports: "Reports",
    feedback: "Feedback",
    admin: "Admin",
    settings: "Settings",
  };
  if (compact) {
    return (
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm font-medium truncate">{titles[view]}</span>
        <Badge variant="secondary" className="text-[10px] font-mono uppercase">
          {view}
        </Badge>
      </div>
    );
  }
  return (
    <div>
      <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
        {view}
      </div>
      <h1 className="text-2xl md:text-3xl font-semibold tracking-tight mt-0.5">
        {titles[view]}
      </h1>
    </div>
  );
}

function useSignOutWithConfirm() {
  const { signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const dialog = (
    <AlertDialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Sign out of Taskboard?</AlertDialogTitle>
          <AlertDialogDescription>
            You'll need to sign back in to access your tasks, notes and clock
            entries. Any running timer will keep tracking on the server.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Stay signed in</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await signOut();
                toast.success("Signed out", { description: "See you soon!" });
                setOpen(false);
              } catch {
                toast.error("Couldn't sign out");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Signing out…" : "Sign out"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
  return { request: () => setOpen(true), dialog };
}

function AccountMenu({ shell }: { shell: ShellState }) {
  const { user } = useAuth();
  const { style, setStyle, theme, setTheme } = useNavPrefs();
  const name =
    (user?.user_metadata as { username?: string } | undefined)?.username ??
    user?.email?.split("@")[0] ??
    "you";
  const signOutCtl = useSignOutWithConfirm();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 h-8 pl-1 pr-2">
          <Avatar className="size-6">
            <AvatarFallback className="text-[10px] font-medium">
              {name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs hidden sm:inline">{name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="font-medium text-sm">{name}</div>
          <div className="text-[11px] text-muted-foreground font-mono truncate font-normal">
            {user?.email}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[10px] font-mono tracking-wider uppercase text-muted-foreground font-normal">
          Theme
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={theme}
          onValueChange={(v) => setTheme(v as Theme)}
        >
          <DropdownMenuRadioItem value="light">
            <Sun size={13} className="mr-2" />
            Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon size={13} className="mr-2" />
            Dark
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Monitor size={13} className="mr-2" />
            System
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[10px] font-mono tracking-wider uppercase text-muted-foreground font-normal">
          Navigation
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={style}
          onValueChange={(v) => setStyle(v as NavStyle)}
        >
          <DropdownMenuRadioItem value="sidebar">
            <PanelLeft size={13} className="mr-2" />
            Sidebar
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="pills">
            <LayoutList size={13} className="mr-2" />
            Pill tabs
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => shell.setView("settings")}>
          <Settings size={13} className="mr-2" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => shell.setView("tags")}>
          <TagIcon size={13} className="mr-2" />
          Manage tags
        </DropdownMenuItem>
        <DropdownMenuItem onClick={shell.openShortcuts}>
          <Keyboard size={13} className="mr-2" />
          Shortcuts
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            signOutCtl.request();
          }}
          className="text-destructive focus:text-destructive"
        >
          <LogOut size={13} className="mr-2" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
      {signOutCtl.dialog}
    </DropdownMenu>
  );
}

/* ────────── VIEW SWITCH ────────── */
function ViewSwitch({
  shell,
  newNoteRef,
}: {
  shell: ShellState;
  newNoteRef: React.MutableRefObject<(() => void) | null>;
}) {
  return (
    <div className="fade-up">
      {shell.view === "home" && (
        <HomeView setView={shell.setView} setDay={shell.setDay} />
      )}
      {shell.view === "board" && (
        <BoardView
          day={shell.day}
          setDay={shell.setDay}
          onEditTask={shell.openEditTask}
          onViewTask={shell.openViewTask}
        />
      )}
      {shell.view === "notes" && <NotesView newNoteRef={newNoteRef} />}
      {shell.view === "tags" && <TagsView />}
      {shell.view === "clock" && <ClockView />}
      {shell.view === "reports" && <ReportsView />}
      {shell.view === "feedback" && <FeedbackView />}
      {shell.view === "admin" && <AdminView />}
      {shell.view === "settings" && <SettingsView />}
    </div>
  );
}

/* ────────── HOME ────────── */
function HomeView({
  setView,
  setDay,
}: {
  setView: (v: View) => void;
  setDay: (d: string) => void;
}) {
  const { user } = useAuth();
  const { tasks, tags, loading } = useTaskboard();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(i);
  }, []);

  const today = todayDay();
  const todayTasks = tasks.filter((t) => t.day === today);
  const done = tasks.filter((t) => t.status === "done").length;
  const inProg = tasks.filter((t) => t.status === "in_progress").length;
  const todo = tasks.filter((t) => t.status === "todo").length;
  const total = tasks.length || 1;
  const pct = Math.round((done / total) * 100);

  const greetMeta = user?.user_metadata as
    | { display_name?: string; username?: string }
    | undefined;
  const greetingName =
    greetMeta?.display_name ??
    greetMeta?.username ??
    user?.email?.split("@")[0] ??
    "you";
  const hour = now.getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  if (loading)
    return (
      <div className="py-20 text-center">
        <Loader2 className="animate-spin inline" size={18} />
      </div>
    );

  return (
    <div className="grid grid-cols-12 gap-4">
      <Card className="col-span-12 md:col-span-8">
        <CardHeader>
          <CardDescription className="text-[11px] font-mono uppercase tracking-wider">
            {now.toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </CardDescription>
          <CardTitle className="text-2xl md:text-3xl font-semibold tracking-tight">
            {greeting}, {greetingName}.
          </CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2 flex-wrap">
          <Button
            variant="default"
            size="sm"
            onClick={() => {
              setDay(today);
              setView("board");
            }}
          >
            Open today's board →
          </Button>
          <Badge variant="secondary" className="px-3 py-1 font-normal">
            {todayTasks.length} task{todayTasks.length === 1 ? "" : "s"} today
          </Badge>
        </CardContent>
      </Card>

      <Card className="col-span-12 md:col-span-4 bg-primary text-primary-foreground border-0">
        <CardContent className="pt-6 pb-6 flex flex-col justify-between h-full min-h-[170px]">
          <div className="text-[10px] font-mono uppercase tracking-wider opacity-60">
            Local time
          </div>
          <div>
            <div className="text-5xl font-semibold tracking-tight tabular-nums">
              {now.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
            <div className="text-xs opacity-60 mt-1">
              {now.toLocaleDateString([], { weekday: "long" })}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="col-span-12 md:col-span-5">
        <CardHeader className="pb-2">
          <CardDescription className="text-[10px] font-mono tracking-wider uppercase">
            Status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-5">
            <Ring
              done={done}
              prog={inProg}
              todo={todo}
              total={total}
              pct={pct}
            />
            <div className="flex flex-col gap-2 text-sm">
              <Legend status="done" value={done} />
              <Legend status="in_progress" value={inProg} />
              <Legend status="todo" value={todo} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="col-span-12 md:col-span-7">
        <CardHeader className="pb-2">
          <CardDescription className="text-[10px] font-mono tracking-wider uppercase">
            Week
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {DAYS.map((d) => {
            const dt = tasks.filter((t) => t.day === d.v);
            const dn = dt.filter((t) => t.status === "done").length;
            const pct = dt.length ? (dn / dt.length) * 100 : 0;
            const isToday = d.v === today;
            return (
              <div key={d.v} className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setDay(d.v);
                    setView("board");
                  }}
                  className={`text-[11px] font-mono w-9 uppercase text-left hover:text-foreground transition ${isToday ? "text-foreground font-medium" : "text-muted-foreground"}`}
                >
                  {d.short}
                </button>
                <Progress value={pct} className="flex-1 h-1.5" />
                <span className="text-[11px] font-mono text-muted-foreground w-12 text-right tabular-nums">
                  {dn}/{dt.length}
                </span>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="col-span-12 md:col-span-6">
        <CardHeader className="pb-2">
          <CardDescription className="text-[10px] font-mono tracking-wider uppercase">
            Categories
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TagTreeStats tags={tags} tasks={tasks} />
        </CardContent>
      </Card>

      <Card className="col-span-12 md:col-span-6">
        <CardHeader className="pb-2">
          <CardDescription className="text-[10px] font-mono tracking-wider uppercase">
            Today
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 max-h-64 overflow-y-auto">
          {todayTasks.length === 0 && (
            <div className="text-xs text-muted-foreground py-3">
              Nothing scheduled today.
            </div>
          )}
          {todayTasks.map((t) => {
            const tag = tags.find((tg) => tg.id === t.tag_id);
            return (
              <div
                key={t.id}
                className="flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-muted"
              >
                <StatusDot status={t.status} />
                <span
                  className={`flex-1 text-sm truncate ${t.status === "done" ? "line-through text-muted-foreground" : ""}`}
                >
                  {t.name}
                </span>
                {tag && <TagPill tag={tag} tags={tags} />}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <DailyNotesTile />

      <Card className="col-span-12 md:col-span-6">
        <CardContent className="pt-5">
          <WorldClocks />
        </CardContent>
      </Card>
    </div>
  );
}

function TagTreeStats({ tags, tasks }: { tags: Tag[]; tasks: Task[] }) {
  const roots = tags.filter((t) => !t.parent_id);
  if (tags.length === 0) {
    return <div className="text-xs text-muted-foreground">No tags yet.</div>;
  }
  const total = tasks.length || 1;
  const countFor = (tagId: string, includeSubs = false) => {
    let count = tasks.filter((t) => t.tag_id === tagId).length;
    if (includeSubs) {
      tags
        .filter((t) => t.parent_id === tagId)
        .forEach((sub) => {
          count += tasks.filter((t) => t.tag_id === sub.id).length;
        });
    }
    return count;
  };

  return (
    <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
      {roots.map((parent) => {
        const subs = tags.filter((t) => t.parent_id === parent.id);
        const ct = countFor(parent.id, true);
        const pct = (ct / total) * 100;
        return (
          <div key={parent.id}>
            <div className="flex items-center gap-2.5">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: parent.color }}
              />
              <span className="text-sm flex-1 truncate">{parent.name}</span>
              <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
                {ct}
              </span>
            </div>
            <div className="ml-4 mt-1.5 h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, background: parent.color }}
              />
            </div>
            {subs.length > 0 && (
              <div className="ml-4 mt-1.5 flex flex-wrap gap-1">
                {subs.map((s) => {
                  const sct = countFor(s.id);
                  return (
                    <Badge
                      key={s.id}
                      variant="outline"
                      className="text-[10px] font-mono px-1.5 py-0 h-5 gap-1 font-normal"
                    >
                      <span
                        className="inline-block w-1.5 h-1.5 rounded-full"
                        style={{ background: s.color }}
                      />
                      {s.name}
                      <span className="text-muted-foreground">·{sct}</span>
                    </Badge>
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

function Legend({ status, value }: { status: Task["status"]; value: number }) {
  const m = STATUS_META[status];
  return (
    <div className="flex items-center gap-2">
      <span className="w-2 h-2 rounded-full" style={{ background: m.color }} />
      <span>{m.label}</span>
      <span className="font-mono text-xs text-muted-foreground tabular-nums">
        · {value}
      </span>
    </div>
  );
}

function Ring({
  done,
  prog,
  todo,
  total,
  pct,
}: {
  done: number;
  prog: number;
  todo: number;
  total: number;
  pct: number;
}) {
  const r = 30,
    c = 2 * Math.PI * r;
  const safe = total > 0 ? total : 1;
  const dPct = (done / safe) * c;
  const pPct = (prog / safe) * c;
  const tPct = total > 0 ? (todo / safe) * c : c;
  return (
    <div className="relative">
      <svg width="84" height="84" viewBox="0 0 84 84" className="-rotate-90">
        <circle
          cx="42"
          cy="42"
          r={r}
          fill="none"
          stroke="var(--muted)"
          strokeWidth="6"
        />
        <circle
          cx="42"
          cy="42"
          r={r}
          fill="none"
          stroke="var(--status-done)"
          strokeWidth="6"
          strokeDasharray={`${dPct} ${c}`}
          strokeLinecap="round"
        />
        <circle
          cx="42"
          cy="42"
          r={r}
          fill="none"
          stroke="var(--status-progress)"
          strokeWidth="6"
          strokeDasharray={`${pPct} ${c}`}
          strokeDashoffset={-dPct}
          strokeLinecap="round"
        />
        <circle
          cx="42"
          cy="42"
          r={r}
          fill="none"
          stroke="var(--status-todo)"
          strokeWidth="6"
          strokeDasharray={`${tPct} ${c}`}
          strokeDashoffset={-(dPct + pPct)}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-semibold leading-none tabular-nums">
          {pct}%
        </span>
        <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mt-0.5">
          done
        </span>
      </div>
    </div>
  );
}

function DailyNotesTile() {
  const dayKey = new Date().toISOString().slice(0, 10);
  const { content, save } = useDayNote(dayKey);
  const { addTask } = useTaskboard();
  const { addNote, updateNote, notes } = useNotes();
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<
    { name: string; note?: string }[] | null
  >(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());

  const journalTitle = `Journal · ${new Date().toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", year: "numeric" })}`;
  const existingJournalNote = notes.find((n) => n.title === journalTitle);

  const day = todayDay();

  const suggest = async () => {
    if (!content.trim() || busy) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("suggest-tasks", {
        body: { text: content, max: 8 },
      });
      if (error) throw error;
      const arr = (data?.tasks ?? []) as { name: string; note?: string }[];
      if (!arr.length) {
        toast.message("No actionable tasks found in your notes.");
        setSuggestions(null);
        return;
      }
      setSuggestions(arr);
      setPicked(new Set(arr.map((_, i) => i)));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't suggest tasks");
    } finally {
      setBusy(false);
    }
  };

  const addPicked = async () => {
    if (!suggestions) return;
    const toAdd = suggestions.filter((_, i) => picked.has(i));
    if (!toAdd.length) return;
    setBusy(true);
    let ok = 0;
    for (const t of toAdd) {
      const r = await addTask({
        name: t.name,
        note: t.note ?? "",
        day,
        status: "todo",
        tag_id: null,
      });
      if (r) ok++;
    }
    setBusy(false);
    setSuggestions(null);
    setPicked(new Set());
    toast.success(`Added ${ok} task${ok === 1 ? "" : "s"} to today's board`);
  };

  const saveAsNote = async () => {
    if (!content.trim() || busy) return;
    setBusy(true);
    try {
      if (existingJournalNote) {
        await updateNote(existingJournalNote.id, { content });
        toast.success("Journal updated in Notes");
      } else {
        const n = await addNote({ title: journalTitle, content });
        if (n) toast.success("Journal saved as a note");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="col-span-12 overflow-hidden">
      <Collapsible>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/50 transition text-left">
            <span className="text-sm flex items-center gap-3">
              <Badge
                variant="secondary"
                className="text-[10px] font-mono uppercase"
              >
                Notes
              </Badge>
              <span className="font-medium">Daily journal</span>
            </span>
            <span className="text-xs text-muted-foreground max-w-md truncate hidden sm:block">
              {content
                ? content.slice(0, 80)
                : "Click to add notes for today →"}
            </span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Separator />
          <div className="p-4 space-y-3">
            <Textarea
              value={content}
              onChange={(e) => save(e.target.value)}
              placeholder="brain dump, links, decisions…"
              maxLength={5000}
              className="min-h-[120px] font-mono text-xs leading-relaxed resize-y"
            />
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[10px] font-mono text-muted-foreground">
                {content.length} chars
              </span>
              <div className="flex items-center gap-2">
                <span
                  className="text-[10px] font-mono"
                  style={{ color: "var(--status-done)" }}
                >
                  ✓ auto-saved
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1.5"
                  onClick={saveAsNote}
                  disabled={busy || !content.trim()}
                >
                  <FileText size={12} />
                  {existingJournalNote ? "Update note" : "Save as note"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1.5"
                  onClick={suggest}
                  disabled={busy || !content.trim()}
                >
                  {busy && !suggestions ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Sparkles size={12} />
                  )}
                  Suggest tasks
                </Button>
              </div>
            </div>

            {suggestions && (
              <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    AI suggestions · today
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    onClick={() => {
                      setSuggestions(null);
                      setPicked(new Set());
                    }}
                  >
                    <X size={12} />
                  </Button>
                </div>
                <div className="space-y-1.5">
                  {suggestions.map((t, i) => {
                    const on = picked.has(i);
                    return (
                      <button
                        key={i}
                        onClick={() => {
                          const n = new Set(picked);
                          if (on) n.delete(i);
                          else n.add(i);
                          setPicked(n);
                        }}
                        className={`w-full text-left flex items-start gap-2 p-2 rounded-md border transition ${
                          on
                            ? "bg-primary/5 border-primary/30"
                            : "bg-card border-border hover:bg-muted/50"
                        }`}
                      >
                        <span
                          className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                            on
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-muted-foreground/40"
                          }`}
                        >
                          {on && <Check size={10} />}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="text-xs block">{t.name}</span>
                          {t.note && (
                            <span className="text-[10px] font-mono text-muted-foreground block mt-0.5 line-clamp-2">
                              {t.note}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {picked.size}/{suggestions.length} selected
                  </span>
                  <Button
                    size="sm"
                    className="h-7 text-xs"
                    onClick={addPicked}
                    disabled={busy || picked.size === 0}
                  >
                    {busy ? "Adding…" : `Add ${picked.size} to board`}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

/* ────────── NOTES ────────── */
function NotesView({
  newNoteRef,
}: {
  newNoteRef: React.MutableRefObject<(() => void) | null>;
}) {
  const {
    notes,
    loading,
    addNote,
    updateNote,
    deleteNote,
    togglePinNote,
    makePublic,
    makePrivate,
  } = useNotes();
  const { tags } = useTaskboard();
  const { counts: noteAttCounts } = useAttachmentCounts("note");
  const [filter, setFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "7d" | "30d">(
    "all",
  );
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const searchRef = useRef<HTMLInputElement>(null);

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelected(new Set());

  const filtered = useMemo(() => {
    const now = Date.now();
    const cutoff =
      dateFilter === "today"
        ? new Date(new Date().setHours(0, 0, 0, 0)).getTime()
        : dateFilter === "7d"
          ? now - 7 * 86400000
          : dateFilter === "30d"
            ? now - 30 * 86400000
            : null;
    return notes.filter((n) => {
      if (filter !== "all" && n.tag_id !== filter) return false;
      if (cutoff !== null && new Date(n.updated_at).getTime() < cutoff)
        return false;
      if (
        query &&
        !`${n.title} ${n.content}`.toLowerCase().includes(query.toLowerCase())
      )
        return false;
      return true;
    });
  }, [notes, filter, dateFilter, query]);

  useEffect(() => {
    if (!activeId && filtered.length > 0) setActiveId(filtered[0].id);
    if (activeId && !filtered.find((n) => n.id === activeId))
      setActiveId(filtered[0]?.id ?? null);
  }, [filtered, activeId]);

  const active = notes.find((n) => n.id === activeId) ?? null;
  const parents = tags.filter((t) => !t.parent_id);

  const handleNew = useCallback(async () => {
    const n = await addNote({ title: "Untitled note", content: "" });
    if (n) setActiveId(n.id);
  }, [addNote]);

  // expose for global "n" hotkey + palette
  useEffect(() => {
    newNoteRef.current = handleNew;
    return () => {
      if (newNoteRef.current === handleNew) newNoteRef.current = null;
    };
  }, [handleNew, newNoteRef]);

  // "/" focuses search when not typing elsewhere
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/") return;
      const el = document.activeElement as HTMLElement | null;
      if (
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.isContentEditable)
      )
        return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (loading)
    return (
      <div className="py-20 text-center">
        <Loader2 className="animate-spin inline" size={18} />
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes…  (/)"
            className="w-full h-9 pl-8 pr-3 rounded-md border border-input bg-transparent text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[160px] h-9 text-xs">
            <TagIcon size={12} className="mr-1.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tags</SelectItem>
            {tags.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.parent_id ? "↳ " : ""}
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={dateFilter}
          onValueChange={(v) => setDateFilter(v as typeof dateFilter)}
        >
          <SelectTrigger className="w-[150px] h-9 text-xs">
            <CalendarIcon size={12} className="mr-1.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any date</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" className="gap-1.5" onClick={handleNew}>
          <Plus size={13} /> New note
        </Button>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <Card className="col-span-12 md:col-span-4 max-h-[70vh] overflow-hidden flex flex-col">
          <CardHeader className="pb-2 space-y-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-[10px] font-mono tracking-wider uppercase">
                {filtered.length} note{filtered.length === 1 ? "" : "s"}
                {selected.size > 0 && (
                  <span className="ml-2 text-foreground">
                    · {selected.size} selected
                  </span>
                )}
              </CardDescription>
              {filtered.length > 0 && (
                <button
                  onClick={() => {
                    if (selected.size === filtered.length) clearSelection();
                    else setSelected(new Set(filtered.map((n) => n.id)));
                  }}
                  className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground"
                >
                  {selected.size === filtered.length ? "Clear" : "Select all"}
                </button>
              )}
            </div>
            {selected.size > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap p-1.5 rounded-md bg-muted/50 border">
                <Select
                  value=""
                  onValueChange={async (v) => {
                    const tagId = v === "none" ? null : v;
                    await Promise.all(
                      Array.from(selected).map((id) =>
                        updateNote(id, { tag_id: tagId }),
                      ),
                    );
                    toast.success(
                      `Tagged ${selected.size} note${selected.size === 1 ? "" : "s"}`,
                    );
                  }}
                >
                  <SelectTrigger className="h-7 text-[11px] flex-1 min-w-[120px]">
                    <TagIcon size={11} className="mr-1" />
                    <SelectValue placeholder="Set tag…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— no tag —</SelectItem>
                    {tags.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.parent_id ? "↳ " : ""}
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[11px] gap-1 px-2"
                  onClick={async () => {
                    await Promise.all(
                      Array.from(selected).map((id) => togglePinNote(id)),
                    );
                    toast.success("Toggled pin");
                  }}
                >
                  <Pin size={11} /> Pin
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[11px] gap-1 px-2 text-destructive hover:text-destructive"
                  onClick={async () => {
                    if (
                      !confirm(
                        `Delete ${selected.size} note${selected.size === 1 ? "" : "s"}?`,
                      )
                    )
                      return;
                    await Promise.all(
                      Array.from(selected).map((id) => deleteNote(id)),
                    );
                    clearSelection();
                    toast.success("Deleted");
                  }}
                >
                  <Trash2 size={11} /> Delete
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-[11px] px-2"
                  onClick={clearSelection}
                >
                  <X size={11} />
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-1 overflow-y-auto flex-1 px-2">
            {filtered.length === 0 && (
              <div className="text-xs text-muted-foreground text-center py-10">
                No notes. Click <span className="font-medium">New note</span>.
              </div>
            )}
            {filtered.map((n) => {
              const tag = tags.find((t) => t.id === n.tag_id);
              const isActive = n.id === activeId;
              const isPinned = !!n.pinned_at;
              const att = noteAttCounts[n.id] ?? 0;
              const isSelected = selected.has(n.id);
              const selectionMode = selected.size > 0;
              return (
                <div
                  key={n.id}
                  className={`group w-full rounded-md transition border flex items-start ${
                    isActive
                      ? "bg-muted border-border"
                      : "border-transparent hover:bg-muted/60"
                  } ${isPinned ? "ring-1 ring-primary/30" : ""} ${isSelected ? "bg-primary/5 border-primary/30" : ""}`}
                >
                  <div
                    className={`pl-2.5 pt-3 ${selectionMode ? "" : "opacity-0 group-hover:opacity-100"} transition-opacity`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelected(n.id)}
                      aria-label="Select note"
                    />
                  </div>
                  <button
                    onClick={() =>
                      selectionMode ? toggleSelected(n.id) : setActiveId(n.id)
                    }
                    className="flex-1 text-left px-3 py-2.5 min-w-0"
                  >
                    <div className="flex items-start gap-2">
                      {tag && (
                        <span
                          className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                          style={{ background: tag.color }}
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate flex items-center gap-1.5">
                          {isPinned && (
                            <Pin
                              size={10}
                              className="text-primary fill-primary shrink-0"
                            />
                          )}
                          {n.is_public && (
                            <Badge
                              variant="outline"
                              className="h-4 px-1 text-[9px] font-mono font-normal"
                            >
                              public
                            </Badge>
                          )}
                          {n.title || "Untitled"}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {n.content ? n.content.slice(0, 60) : "Empty"}
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                          {tag && <TagPill tag={tag} tags={tags} />}
                          {att > 0 && (
                            <Badge
                              variant="outline"
                              className="font-mono text-[10px] px-1.5 py-0 h-5 gap-1 font-normal"
                            >
                              <Paperclip size={10} /> {att}
                            </Badge>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              togglePinNote(n.id);
                            }}
                            className={`ml-auto rounded p-0.5 transition ${
                              isPinned
                                ? "text-primary"
                                : "text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-primary"
                            }`}
                            title={isPinned ? "Unpin" : "Pin to top"}
                          >
                            {isPinned ? (
                              <PinOff size={11} />
                            ) : (
                              <Pin size={11} />
                            )}
                          </button>
                          <span className="text-[10px] font-mono text-muted-foreground">
                            {new Date(n.updated_at).toLocaleDateString([], {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="col-span-12 md:col-span-8 max-h-[70vh] overflow-hidden flex flex-col">
          {active ? (
            <NoteEditor
              key={active.id}
              note={active}
              tags={tags}
              parents={parents}
              onUpdate={(patch) => updateNote(active.id, patch)}
              onTogglePin={() => togglePinNote(active.id)}
              onMakePublic={() => makePublic(active.id)}
              onMakePrivate={() => makePrivate(active.id)}
              onDelete={() => {
                if (confirm("Delete this note?")) deleteNote(active.id);
              }}
            />
          ) : (
            <div className="flex-1 grid place-items-center text-sm text-muted-foreground">
              Select or create a note
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function NoteEditor({
  note,
  tags,
  parents,
  onUpdate,
  onTogglePin,
  onDelete,
  onMakePublic,
  onMakePrivate,
}: {
  note: Note;
  tags: Tag[];
  parents: Tag[];
  onUpdate: (patch: Partial<Note>) => void;
  onTogglePin: () => void;
  onDelete: () => void;
  onMakePublic: () => Promise<string | null>;
  onMakePrivate: () => Promise<void>;
}) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [tagId, setTagId] = useState<string>(note.tag_id ?? "none");
  const [showAtt, setShowAtt] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => {
      if (title !== note.title || content !== note.content) {
        onUpdate({ title: title.trim() || "Untitled", content });
      }
    }, 500);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, content]);

  const setTag = (v: string) => {
    setTagId(v);
    onUpdate({ tag_id: v === "none" ? null : v });
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="border-b px-4 py-3 flex items-center gap-2 flex-wrap">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Note title…"
          className="flex-1 min-w-[160px] bg-transparent text-base font-semibold tracking-tight outline-none placeholder:text-muted-foreground"
          maxLength={200}
        />
        <Select value={tagId} onValueChange={setTag}>
          <SelectTrigger className="w-[170px] h-8 text-xs">
            <SelectValue placeholder="No tag" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">— no tag —</SelectItem>
            {parents.map((p) => {
              const subs = tags.filter((s) => s.parent_id === p.id);
              return (
                <div key={p.id}>
                  <SelectItem value={p.id}>{p.name}</SelectItem>
                  {subs.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      ↳ {s.name}
                    </SelectItem>
                  ))}
                </div>
              );
            })}
          </SelectContent>
        </Select>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setShowAtt((v) => !v)}
          className={`h-8 w-8 ${showAtt ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
          title="Attachments"
        >
          <Paperclip size={14} />
        </Button>
        <SharePopover
          note={note}
          onMakePublic={onMakePublic}
          onMakePrivate={onMakePrivate}
        />
        <Button
          size="icon"
          variant="ghost"
          onClick={onTogglePin}
          className={`h-8 w-8 ${note.pinned_at ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
          title={note.pinned_at ? "Unpin" : "Pin to top"}
        >
          {note.pinned_at ? <PinOff size={14} /> : <Pin size={14} />}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={onDelete}
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          title="Delete note"
        >
          <Trash2 size={14} />
        </Button>
      </div>

      {showAtt && (
        <div className="border-b p-3 bg-muted/20">
          <AttachmentPanel parent={{ noteId: note.id }} compact />
        </div>
      )}

      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write your note…"
        maxLength={20000}
        className="flex-1 resize-none rounded-none border-0 focus-visible:ring-0 font-mono text-xs leading-relaxed p-4"
      />
      <div className="border-t px-4 py-2 flex items-center justify-between text-[10px] font-mono text-muted-foreground">
        <span>{content.length} chars</span>
        <span style={{ color: "var(--status-done)" }}>✓ auto-saved</span>
      </div>
    </div>
  );
}

/* ────────── BOARD ────────── */
function BoardView({
  day,
  setDay,
  onEditTask,
  onViewTask,
}: {
  day: string;
  setDay: (d: string) => void;
  onEditTask: (t: Task) => void;
  onViewTask: (t: Task) => void;
}) {
  const { tasks, loading } = useTaskboard();
  const [printIds, setPrintIds] = useState<string[] | null>(null);
  const dayTasks = useMemo(
    () => tasks.filter((t) => t.day === day),
    [tasks, day],
  );
  const done = dayTasks.filter((t) => t.status === "done").length;
  const pct = dayTasks.length ? Math.round((done / dayTasks.length) * 100) : 0;

  if (loading)
    return (
      <div className="py-20 text-center">
        <Loader2 className="animate-spin inline" size={18} />
      </div>
    );

  return (
    <div className="space-y-5">
      <Card className="bg-card/50">
        <CardContent className="py-4">
          <LiveClock />
        </CardContent>
      </Card>

      <Tabs value={day} onValueChange={setDay}>
        <TabsList className="flex-wrap h-auto">
          {DAYS.map((d) => (
            <TabsTrigger key={d.v} value={d.v} className="text-xs">
              {d.short}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex items-center gap-3 px-1">
        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
          Progress
        </span>
        <Progress value={pct} className="flex-1 h-1.5" />
        <span className="text-[11px] font-mono text-muted-foreground w-24 text-right tabular-nums">
          {pct}% · {done}/{dayTasks.length}
        </span>
      </div>

      <div className="text-[10px] font-mono text-muted-foreground px-1">
        Drag cards between columns or reorder within. Click pencil to edit.
        Pinned cards stay on top.
      </div>

      <KanbanBoard
        day={day}
        onEditTask={onEditTask}
        onViewTask={onViewTask}
        onPrintSelection={(ids) => setPrintIds(ids)}
      />
      {printIds !== null && (
        <PrintReport
          open={true}
          onClose={() => setPrintIds(null)}
          filterTaskIds={printIds}
        />
      )}
    </div>
  );
}

/* ────────── REPORTS ────────── */
function ReportsView() {
  const { tasks, tags, loading } = useTaskboard();
  const { entries } = useAllTimeEntries();
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "done").length;
  const inProg = tasks.filter((t) => t.status === "in_progress").length;
  const todo = tasks.filter((t) => t.status === "todo").length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const [printOpen, setPrintOpen] = useState(false);

  // Time-entry filters
  const [timeRange, setTimeRange] = useState<
    "all" | "today" | "7d" | "30d" | "month"
  >("all");
  const [timeTagId, setTimeTagId] = useState<string>("all");

  const overdue = useMemo(
    () => tasks.filter((t) => dueState(t.due_at, t.status) === "overdue"),
    [tasks],
  );
  const dueToday = useMemo(
    () => tasks.filter((t) => dueState(t.due_at, t.status) === "today"),
    [tasks],
  );

  const timeWindow = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    if (timeRange === "all") return null;
    if (timeRange === "today")
      return {
        from: startOfDay,
        to: new Date(startOfDay.getTime() + 86400000),
      };
    if (timeRange === "7d")
      return {
        from: new Date(startOfDay.getTime() - 6 * 86400000),
        to: new Date(startOfDay.getTime() + 86400000),
      };
    if (timeRange === "30d")
      return {
        from: new Date(startOfDay.getTime() - 29 * 86400000),
        to: new Date(startOfDay.getTime() + 86400000),
      };
    if (timeRange === "month")
      return {
        from: new Date(now.getFullYear(), now.getMonth(), 1),
        to: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      };
    return null;
  }, [timeRange]);

  // Time totals — applies tag filter + time window
  const { perTag, untagged, totalSec } = useMemo(() => {
    const m: Record<string, number> = {};
    let untag = 0;
    let tot = 0;
    const childIds =
      timeTagId !== "all"
        ? tags.filter((x) => x.parent_id === timeTagId).map((x) => x.id)
        : [];
    entries.forEach((e) => {
      if (timeTagId !== "all") {
        const ok =
          e.tag_id === timeTagId || (e.tag_id && childIds.includes(e.tag_id));
        if (!ok) return;
      }
      const s = timeWindow
        ? entrySeconds(e, timeWindow.from, timeWindow.to)
        : entrySeconds(e);
      if (s <= 0) return;
      tot += s;
      if (e.tag_id) m[e.tag_id] = (m[e.tag_id] ?? 0) + s;
      else untag += s;
    });
    return { perTag: m, untagged: untag, totalSec: tot };
  }, [entries, tags, timeTagId, timeWindow]);

  if (loading)
    return (
      <div className="py-20 text-center">
        <Loader2 className="animate-spin inline" size={18} />
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => setPrintOpen(true)}
        >
          <Printer size={13} /> Print report
        </Button>
      </div>
      <PrintReport open={printOpen} onClose={() => setPrintOpen(false)} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total" value={total} />
        <Stat
          label="Done"
          value={done}
          unit={`· ${pct}%`}
          accent="var(--status-done)"
        />
        <Stat
          label="In progress"
          value={inProg}
          accent="var(--status-progress)"
        />
        <Stat label="To do" value={todo} accent="var(--status-todo)" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status overview</CardTitle>
          <CardDescription className="text-xs">
            All tasks across the board.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StatusStackedBar tasks={tasks} />
        </CardContent>
      </Card>

      {(overdue.length > 0 || dueToday.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <DueListCard
            title="Overdue"
            tone="destructive"
            tasks={overdue}
            tags={tags}
          />
          <DueListCard
            title="Due today"
            tone="amber"
            tasks={dueToday}
            tags={tags}
          />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">By category</CardTitle>
          <CardDescription className="text-xs">
            Status mix per parent tag.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TagStatusBars tasks={tasks} tags={tags} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-2">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="text-base">Time tracked</CardTitle>
              <CardDescription className="text-xs">
                Total{" "}
                <span className="text-foreground font-mono">
                  {fmtHours(totalSec)}
                </span>{" "}
                · grouped by tag.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={timeRange}
                onValueChange={(v) => setTimeRange(v as typeof timeRange)}
              >
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <CalendarIcon size={12} className="mr-1.5" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="month">This month</SelectItem>
                </SelectContent>
              </Select>
              <Select value={timeTagId} onValueChange={setTimeTagId}>
                <SelectTrigger className="w-[150px] h-8 text-xs">
                  <TagIcon size={12} className="mr-1.5" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All tags</SelectItem>
                  {tags.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.parent_id ? "↳ " : ""}
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <TimeByTagBars
            perTagSeconds={perTag}
            tags={tags}
            untaggedSeconds={untagged}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function DueListCard({
  title,
  tone,
  tasks,
  tags,
}: {
  title: string;
  tone: "destructive" | "amber";
  tasks: Task[];
  tags: Tag[];
}) {
  const accent = tone === "destructive" ? "var(--destructive)" : "#d97706";
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: accent }}
          />
          <CardTitle className="text-sm">{title}</CardTitle>
          <Badge
            variant="secondary"
            className="ml-auto h-5 text-[10px] font-mono"
          >
            {tasks.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-1 max-h-60 overflow-y-auto">
        {tasks.length === 0 && (
          <div className="text-xs text-muted-foreground py-2">
            Nothing here. Nice.
          </div>
        )}
        {tasks.map((t) => {
          const tag = tags.find((tg) => tg.id === t.tag_id);
          return (
            <div
              key={t.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted text-sm"
            >
              <StatusDot status={t.status} />
              <span className="flex-1 truncate">{t.name}</span>
              {tag && <TagPill tag={tag} tags={tags} />}
              <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
                {new Date(t.due_at!).toLocaleDateString([], {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function SubStat({
  label,
  color,
  count,
  done,
}: {
  label: string;
  color: string;
  count: number;
  done: number;
}) {
  const pct = count ? (done / count) * 100 : 0;
  return (
    <div className="bg-card rounded-md p-2.5 border">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: color }}
        />
        <span className="text-xs truncate">{label}</span>
      </div>
      <div className="flex items-end justify-between">
        <span className="text-lg font-semibold leading-none tabular-nums">
          {count}
        </span>
        <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
          {done}/{count}
        </span>
      </div>
      <div className="h-[2px] bg-muted rounded-full overflow-hidden mt-1.5">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
  accent,
}: {
  label: string;
  value: number;
  unit?: string;
  accent?: string;
}) {
  return (
    <Card className="relative overflow-hidden">
      {accent && (
        <span
          className="absolute top-0 left-0 h-full w-[3px]"
          style={{ background: accent }}
        />
      )}
      <CardContent className="pt-5 pb-5">
        <div className="text-[10px] font-mono tracking-wider uppercase text-muted-foreground mb-2">
          {label}
        </div>
        <div className="text-3xl font-semibold tracking-tight tabular-nums">
          {value}
          {unit && (
            <span className="text-xs text-muted-foreground ml-1.5 font-normal">
              {unit}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ────────── CLOCK VIEW ────────── */

function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function ClockView() {
  const { tags, loading } = useTaskboard();
  const { active, startTag, stop, pause, resume, paused } = useActiveTimer();
  const { entries, createManualEntry, updateEntry, deleteEntry } =
    useAllTimeEntries();
  const isRunning = !!active;
  const nowMs = useNowTickMs(isRunning);
  const [now, setNow] = useState(new Date());
  const [manualOpen, setManualOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<TimeEntry | null>(null);
  const [attachEntry, setAttachEntry] = useState<TimeEntry | null>(null);
  const [confirmDelEntry, setConfirmDelEntry] = useState<TimeEntry | null>(
    null,
  );
  const [confirmStopOpen, setConfirmStopOpen] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [pauseReason, setPauseReason] = useState("");

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const dateKey = now.toDateString();
  const todayStart = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey]);

  // nowMs is intentionally referenced so the memo recomputes while a timer is running
  const todaySecByTag = useMemo(() => {
    void nowMs;
    const m: Record<string, number> = {};
    entries.forEach((e) => {
      if (!e.tag_id) return;
      const sec = entrySeconds(e, todayStart);
      if (sec > 0) m[e.tag_id] = (m[e.tag_id] ?? 0) + sec;
    });
    return m;
  }, [entries, todayStart, nowMs]);

  const activeElapsed = active
    ? Math.floor((nowMs - new Date(active.started_at).getTime()) / 1000)
    : 0;

  const activeTag = active?.tag_id
    ? tags.find((t) => t.id === active.tag_id)
    : null;
  const roots = tags.filter((t) => !t.parent_id);

  const recent = useMemo(
    () => entries.filter((e) => e.ended_at).slice(0, 12),
    [entries],
  );

  if (loading) {
    return (
      <div className="text-muted-foreground">
        <Loader2 className="animate-spin" size={16} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Hero */}
      <Card className="overflow-hidden">
        <CardContent className="py-8 px-6">
          <div className="grid md:grid-cols-2 gap-6 items-center">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">
                {isRunning
                  ? "Currently tracking"
                  : paused
                    ? "Paused"
                    : "Not tracking"}
              </div>
              <div className="text-5xl md:text-6xl font-semibold tabular-nums tracking-tight leading-none">
                {fmtDuration(activeElapsed)}
              </div>
              {activeTag ? (
                <div className="mt-3 flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: activeTag.color }}
                  />
                  <span className="text-sm font-medium">{activeTag.name}</span>
                  {activeTag.parent_id && (
                    <span className="text-xs text-muted-foreground">
                      · {tags.find((t) => t.id === activeTag.parent_id)?.name}
                    </span>
                  )}
                </div>
              ) : paused ? (
                <div className="mt-3 text-xs text-muted-foreground">
                  Paused{" "}
                  {paused.tag_id
                    ? `· ${tags.find((t) => t.id === paused.tag_id)?.name ?? "tag"}`
                    : ""}
                </div>
              ) : (
                <div className="mt-3 text-xs text-muted-foreground">
                  Pick a category below or add a manual entry.
                </div>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {isRunning && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 border-primary/40 text-primary"
                      onClick={() => setConfirmStopOpen(true)}
                    >
                      <Square size={12} /> Clock out
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => {
                        setPauseReason("");
                        setPauseOpen(true);
                      }}
                    >
                      <Pause size={12} /> Pause
                    </Button>
                  </>
                )}
                {!isRunning && paused && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 border-primary/40 text-primary"
                    onClick={() => resume()}
                  >
                    <PlayCircle size={12} /> Resume
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => setManualOpen(true)}
                >
                  <Plus size={12} /> Manual entry
                </Button>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
                Now
              </div>
              <div className="text-4xl font-light tabular-nums">
                {now.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {now.toLocaleDateString([], {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Categories */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Categories</CardTitle>
          <CardDescription className="text-xs">
            Click a tag to clock in. Set a daily target in Tags to see progress
            here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {roots.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No tags yet — create one in the Tags view.
            </div>
          )}
          {roots.map((parent) => {
            const subs = tags.filter((t) => t.parent_id === parent.id);
            return (
              <div
                key={parent.id}
                className="rounded-lg border bg-card overflow-hidden"
              >
                <ClockRow
                  tag={parent}
                  active={active}
                  todaySec={todaySecByTag[parent.id] ?? 0}
                  startTag={startTag}
                  stop={stop}
                  nowMs={nowMs}
                  dayKey={todayStart.toDateString()}
                />
                {subs.length > 0 && (
                  <div className="border-t bg-muted/30 divide-y">
                    {subs.map((sub) => (
                      <div key={sub.id} className="pl-6">
                        <ClockRow
                          tag={sub}
                          active={active}
                          todaySec={todaySecByTag[sub.id] ?? 0}
                          startTag={startTag}
                          stop={stop}
                          nowMs={nowMs}
                          dayKey={todayStart.toDateString()}
                          indent
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Recent */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent entries</CardTitle>
          <CardDescription className="text-xs">
            Click an entry to edit, or attach files.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <div className="text-center py-6 text-xs font-mono text-muted-foreground">
              No completed sessions yet.
            </div>
          ) : (
            <ul className="divide-y text-xs">
              {recent.map((e) => {
                const tag = e.tag_id
                  ? tags.find((t) => t.id === e.tag_id)
                  : null;
                const start = new Date(e.started_at);
                const end = new Date(e.ended_at!);
                const sec = Math.floor(
                  (end.getTime() - start.getTime()) / 1000,
                );
                return (
                  <li
                    key={e.id}
                    className="group flex items-center gap-3 py-2.5 font-mono"
                  >
                    {tag ? (
                      <span className="flex items-center gap-1.5 min-w-[120px]">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ background: tag.color }}
                        />
                        <span className="truncate">{tag.name}</span>
                      </span>
                    ) : (
                      <span className="min-w-[120px] text-muted-foreground">
                        — untagged —
                      </span>
                    )}
                    <span className="text-muted-foreground tabular-nums">
                      {start.toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                      })}{" "}
                      ·{" "}
                      {start.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className="text-muted-foreground">→</span>
                    <span className="tabular-nums">
                      {end.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className="ml-auto tabular-nums text-foreground">
                      {fmtDuration(sec, { compact: true })}
                    </span>
                    <button
                      type="button"
                      onClick={() => setAttachEntry(e)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary"
                      title="Attachments"
                    >
                      <Paperclip size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditEntry(e)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary"
                      title="Edit"
                    >
                      <Edit3 size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelEntry(e)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                      title="Delete"
                    >
                      <Trash2 size={12} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <ManualEntryDialog
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        tags={tags}
        onCreate={async (v) => {
          await createManualEntry(v);
          setManualOpen(false);
        }}
      />

      <EditEntryDialog
        entry={editEntry}
        tags={tags}
        onClose={() => setEditEntry(null)}
        onSave={async (id, patch) => {
          await updateEntry(id, patch);
          setEditEntry(null);
        }}
      />

      <Dialog
        open={!!attachEntry}
        onOpenChange={(o) => !o && setAttachEntry(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Entry attachments</DialogTitle>
            <DialogDescription className="text-xs">
              Files linked to this time entry.
            </DialogDescription>
          </DialogHeader>
          {attachEntry && (
            <AttachmentPanel parent={{ timeEntryId: attachEntry.id }} />
          )}
        </DialogContent>
      </Dialog>

      {/* Pause with reason */}
      <Dialog open={pauseOpen} onOpenChange={setPauseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Take a break</DialogTitle>
            <DialogDescription className="text-xs">
              We'll stop the timer and remember your session so you can resume.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Quick reasons</Label>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {["Lunch", "Coffee", "Meeting", "Errand", "Stretch"].map(
                  (r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setPauseReason(r)}
                      className={`text-[11px] px-2 py-1 rounded-md border transition ${
                        pauseReason === r
                          ? "bg-primary text-primary-foreground border-primary"
                          : "hover:bg-muted"
                      }`}
                    >
                      {r}
                    </button>
                  ),
                )}
              </div>
            </div>
            <div>
              <Label className="text-xs">Reason (optional)</Label>
              <Input
                autoFocus
                placeholder="Lunch, meeting, coffee…"
                value={pauseReason}
                onChange={(ev) => setPauseReason(ev.target.value)}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter") {
                    pause(pauseReason);
                    setPauseOpen(false);
                  }
                }}
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Tip: press Enter to pause immediately.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                pause();
                setPauseOpen(false);
              }}
            >
              Skip reason
            </Button>
            <Button
              onClick={() => {
                pause(pauseReason);
                setPauseOpen(false);
              }}
            >
              Pause
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete entry confirmation */}
      <AlertDialog
        open={!!confirmDelEntry}
        onOpenChange={(o) => !o && setConfirmDelEntry(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete time entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes this session from your records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDelEntry) {
                  deleteEntry(confirmDelEntry.id);
                  setConfirmDelEntry(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmStopOpen} onOpenChange={setConfirmStopOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clock out now?</AlertDialogTitle>
            <AlertDialogDescription>
              {activeTag
                ? `You're tracking "${activeTag.name}" for ${fmtDuration(activeElapsed, { compact: true })}.`
                : `Current session: ${fmtDuration(activeElapsed, { compact: true })}.`}{" "}
              The timer will stop and the session will be saved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep tracking</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                stop();
                setConfirmStopOpen(false);
              }}
            >
              Clock out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ClockRow({
  tag,
  active,
  todaySec,
  startTag,
  stop,
  nowMs,
  indent,
  dayKey,
}: {
  tag: Tag;
  active: {
    id: string;
    tag_id: string | null;
    task_id: string | null;
    started_at: string;
  } | null;
  todaySec: number;
  startTag: (
    tagId: string,
    note?: string,
    opts?: { keepPrevious?: boolean; allowDuplicate?: boolean },
  ) => Promise<unknown>;
  stop: () => Promise<unknown>;
  nowMs: number;
  indent?: boolean;
  dayKey?: string;
}) {
  const isRunning = active?.tag_id === tag.id && !active?.task_id;
  const liveElapsed =
    isRunning && active
      ? Math.floor((nowMs - new Date(active.started_at).getTime()) / 1000)
      : 0;
  const totalSec = todaySec + (isRunning ? liveElapsed : 0);
  const targetMin = tag.daily_target_minutes ?? 0;
  const targetSec = targetMin * 60;
  const pct =
    targetSec > 0 ? Math.min(100, Math.round((totalSec / targetSec) * 100)) : 0;
  const reached = targetSec > 0 && totalSec >= targetSec;
  const overSec = reached ? totalSec - targetSec : 0;
  // Rollover overage band, visually capped at one extra full target width
  const overPct =
    reached && targetSec > 0
      ? Math.min(100, Math.round((overSec / targetSec) * 100))
      : 0;

  // Fire a one-time toast the moment the daily target is hit; reset at midnight (dayKey change)
  const toastedRef = useRef(false);
  useEffect(() => {
    toastedRef.current = false;
  }, [dayKey, tag.id]);
  useEffect(() => {
    if (reached && !toastedRef.current) {
      toastedRef.current = true;
      toast.success(`Daily target reached for ${tag.name}`, {
        description: `Rolling into bonus time · +${fmtHours(overSec || 1)} so far`,
      });
    }
    if (!reached) toastedRef.current = false;
  }, [reached, tag.name, overSec]);

  const [switchOpen, setSwitchOpen] = useState(false);
  const handleClockIn = () => {
    // If the clicked tag is the same as the running one, the hook will dedupe.
    // If a *different* timer is running, ask the user what to do.
    if (active && !isRunning) {
      setSwitchOpen(true);
      return;
    }
    startTag(tag.id);
  };

  return (
    <div
      className={`p-3 transition ${isRunning ? "bg-primary/5" : "hover:bg-muted/40"}`}
    >
      <div className="flex items-center gap-3">
        <span
          className="w-3 h-3 rounded-full shrink-0"
          style={{ background: tag.color }}
        />
        <span
          className={`text-sm truncate ${indent ? "text-muted-foreground" : "font-medium"}`}
        >
          {tag.name}
        </span>
        <span className="ml-auto flex items-center gap-3">
          <span className="text-[11px] font-mono tabular-nums text-muted-foreground">
            {fmtDuration(totalSec, { compact: true })}
            {targetMin > 0 && (
              <>
                <span className={`ml-1 ${reached ? "text-primary" : ""}`}>
                  / {fmtHours(targetSec)}
                </span>
                {reached && overSec > 0 && (
                  <span className="ml-1 text-primary">
                    · +{fmtHours(overSec)}
                  </span>
                )}
              </>
            )}
          </span>
          {isRunning ? (
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 border-primary/40 text-primary min-w-[110px] justify-center"
              onClick={() => stop()}
            >
              <Square size={11} /> Clock out
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 min-w-[110px] justify-center"
              onClick={handleClockIn}
            >
              <Play size={11} /> Clock in
            </Button>
          )}
        </span>
      </div>
      {targetMin > 0 && (
        <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden flex">
          <div
            className="h-full transition-all"
            style={{
              width: `${pct}%`,
              background: reached ? "var(--primary)" : tag.color,
            }}
          />
          {reached && overPct > 0 && (
            <div
              className="h-full transition-all opacity-40"
              style={{
                width: `${overPct}%`,
                background: "var(--primary)",
                marginLeft: "-100%",
              }}
            />
          )}
        </div>
      )}

      <AlertDialog open={switchOpen} onOpenChange={setSwitchOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Another timer is running</AlertDialogTitle>
            <AlertDialogDescription>
              You're already tracking a session. Stop it and switch to{" "}
              <strong>{tag.name}</strong>, or keep both running in parallel?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => {
                startTag(tag.id, undefined, {
                  keepPrevious: true,
                  allowDuplicate: true,
                });
                setSwitchOpen(false);
              }}
            >
              Keep both
            </Button>
            <AlertDialogAction
              onClick={() => {
                startTag(tag.id);
                setSwitchOpen(false);
              }}
            >
              Switch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ManualEntryDialog({
  open,
  onClose,
  tags,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  tags: Tag[];
  onCreate: (v: {
    tag_id: string | null;
    started_at: string;
    ended_at: string | null;
    note: string | null;
  }) => Promise<void>;
}) {
  const [tagId, setTagId] = useState<string>("");
  const [start, setStart] = useState(() =>
    toLocalInputValue(new Date(Date.now() - 60 * 60 * 1000)),
  );
  const [end, setEnd] = useState(() => toLocalInputValue(new Date()));
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) {
      setTagId("");
      setStart(toLocalInputValue(new Date(Date.now() - 60 * 60 * 1000)));
      setEnd(toLocalInputValue(new Date()));
      setNote("");
    }
  }, [open]);

  const submit = async () => {
    const s = new Date(start);
    const e = new Date(end);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) {
      toast.error("Invalid dates");
      return;
    }
    if (e.getTime() <= s.getTime()) {
      toast.error("End must be after start");
      return;
    }
    await onCreate({
      tag_id: tagId || null,
      started_at: s.toISOString(),
      ended_at: e.toISOString(),
      note: note.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add manual entry</DialogTitle>
          <DialogDescription className="text-xs">
            Log time you forgot to track.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Category</Label>
            <Select value={tagId} onValueChange={setTagId}>
              <SelectTrigger>
                <SelectValue placeholder="— untagged —" />
              </SelectTrigger>
              <SelectContent>
                {tags.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    <span className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ background: t.color }}
                      />
                      {t.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Start</Label>
              <Input
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">End</Label>
              <Input
                type="datetime-local"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Note (optional)</Label>
            <Textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What were you working on?"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>Add entry</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditEntryDialog({
  entry,
  tags,
  onClose,
  onSave,
}: {
  entry: TimeEntry | null;
  tags: Tag[];
  onClose: () => void;
  onSave: (
    id: string,
    patch: {
      tag_id: string | null;
      started_at: string;
      ended_at: string | null;
      note: string | null;
    },
  ) => Promise<void>;
}) {
  const [tagId, setTagId] = useState<string>("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!entry) return;
    setTagId(entry.tag_id ?? "");
    setStart(toLocalInputValue(new Date(entry.started_at)));
    setEnd(entry.ended_at ? toLocalInputValue(new Date(entry.ended_at)) : "");
    setNote(entry.note ?? "");
  }, [entry]);

  if (!entry) return null;

  const submit = async () => {
    const s = new Date(start);
    if (isNaN(s.getTime())) {
      toast.error("Invalid start");
      return;
    }
    let endIso: string | null = null;
    if (end) {
      const e = new Date(end);
      if (isNaN(e.getTime())) {
        toast.error("Invalid end");
        return;
      }
      if (e.getTime() <= s.getTime()) {
        toast.error("End must be after start");
        return;
      }
      endIso = e.toISOString();
    }
    await onSave(entry.id, {
      tag_id: tagId || null,
      started_at: s.toISOString(),
      ended_at: endIso,
      note: note.trim() || null,
    });
  };

  return (
    <Dialog open={!!entry} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit entry</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Category</Label>
            <Select value={tagId} onValueChange={setTagId}>
              <SelectTrigger>
                <SelectValue placeholder="— untagged —" />
              </SelectTrigger>
              <SelectContent>
                {tags.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    <span className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ background: t.color }}
                      />
                      {t.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Start</Label>
              <Input
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">End</Label>
              <Input
                type="datetime-local"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Note</Label>
            <Textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function useNowTickMs(active: boolean): number {
  const [n, setN] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setN(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return n;
}
