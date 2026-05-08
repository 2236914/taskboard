import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const ROWS: Array<[string, string]> = [
  ["N", "New task (or new note in Notes view)"],
  ["/", "Focus search (in Notes)"],
  ["G then H", "Go to Home"],
  ["G then B", "Go to Board"],
  ["G then N", "Go to Notes"],
  ["G then T", "Go to Tags"],
  ["⌘ K  /  Ctrl K", "Open command palette"],
  ["?", "Show this shortcuts help"],
  ["Esc", "Close dialog or popover"],
];

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center rounded border bg-muted px-1.5 min-w-[22px] h-6 font-mono text-[10px] uppercase tracking-wider">
      {children}
    </kbd>
  );
}

export function ShortcutsDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl">Keyboard shortcuts</DialogTitle>
          <DialogDescription className="text-xs">
            Disabled while typing in inputs.
          </DialogDescription>
        </DialogHeader>
        <div className="divide-y">
          {ROWS.map(([keys, label]) => (
            <div
              key={keys}
              className="flex items-center justify-between py-2 text-sm"
            >
              <span>{label}</span>
              <div className="flex gap-1">
                {keys.split(" ").map((k, i) =>
                  k === "then" ? (
                    <span
                      key={i}
                      className="text-[10px] font-mono text-muted-foreground self-center"
                    >
                      then
                    </span>
                  ) : (
                    <Key key={i}>{k}</Key>
                  ),
                )}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
