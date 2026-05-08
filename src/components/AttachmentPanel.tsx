import { useEffect, useRef, useState } from "react";
import { useAttachments, type Attachment } from "@/lib/taskboard-data";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Paperclip, Upload, Trash2, FileText, ImageIcon, Loader2, Download, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";

function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function isImage(mime: string) {
  return mime.startsWith("image/");
}

function ThumbImage({ att, getSignedUrl }: { att: Attachment; getSignedUrl: (a: Attachment) => Promise<string | null> }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { getSignedUrl(att).then(setUrl); }, [att, getSignedUrl]);
  if (!url) return <div className="h-full w-full grid place-items-center bg-muted"><ImageIcon size={16} className="text-muted-foreground" /></div>;
  return <img src={url} alt={att.file_name} className="h-full w-full object-cover" />;
}

export function AttachmentPanel({
  parent,
  compact,
}: {
  parent: { taskId?: string; noteId?: string; timeEntryId?: string };
  compact?: boolean;
}) {
  const { items, loading, uploading, upload, remove, rename, getSignedUrl } = useAttachments(parent);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [confirmDel, setConfirmDel] = useState<Attachment | null>(null);

  const handleFiles = async (files: FileList | File[]) => {
    const { ok, errors } = await upload(files);
    if (ok > 0) toast.success(`Uploaded ${ok} file${ok === 1 ? "" : "s"}`);
    errors.forEach((e) => toast.error(e));
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(e.target.files);
    e.target.value = "";
  };

  const openFile = async (att: Attachment) => {
    const url = await getSignedUrl(att);
    if (url) window.open(url, "_blank");
  };

  return (
    <div
      className={`rounded-lg border ${dragOver ? "border-primary bg-primary/5" : "border-dashed"} transition`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
      }}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-dashed">
        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          <Paperclip size={11} /> Attachments
          {items.length > 0 && <span className="text-foreground">· {items.length}/10</span>}
        </div>
        <Button
          type="button" size="sm" variant="ghost" className="h-7 gap-1.5 text-xs"
          onClick={() => inputRef.current?.click()}
          disabled={uploading || items.length >= 10}
        >
          {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
          Add files
        </Button>
        <input ref={inputRef} type="file" multiple hidden onChange={onPick} />
      </div>

      <div className={`p-3 ${compact ? "min-h-[70px]" : "min-h-[100px]"}`}>
        {loading ? (
          <div className="grid place-items-center py-4 text-muted-foreground"><Loader2 size={14} className="animate-spin" /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-4 text-[11px] font-mono text-muted-foreground">
            Drop files here or click <span className="text-foreground">Add files</span> · max 20 MB · up to 10
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {items.map((att) => (
              <div key={att.id} className="group relative border rounded-md overflow-hidden bg-card">
                <div className="aspect-square bg-muted">
                  {isImage(att.mime_type) ? (
                    <ThumbImage att={att} getSignedUrl={getSignedUrl} />
                  ) : (
                    <div className="h-full w-full grid place-items-center">
                      <FileText size={20} className="text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="p-1.5">
                  {renamingId === att.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        autoFocus
                        value={renameDraft}
                        onChange={(e) => setRenameDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { rename(att, renameDraft); setRenamingId(null); }
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                        className="text-[10px] font-mono w-full bg-background border rounded px-1 py-0.5"
                      />
                      <button type="button" onClick={() => { rename(att, renameDraft); setRenamingId(null); }} className="text-primary"><Check size={10} /></button>
                      <button type="button" onClick={() => setRenamingId(null)} className="text-muted-foreground"><X size={10} /></button>
                    </div>
                  ) : (
                    <div className="text-[10px] truncate font-mono" title={att.file_name}>{att.file_name}</div>
                  )}
                  <div className="text-[9px] font-mono text-muted-foreground">{fmtSize(att.size_bytes)}</div>
                </div>
                <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button
                    type="button"
                    onClick={() => openFile(att)}
                    className="rounded bg-background/90 hover:bg-background border p-1"
                    title="Open / download"
                  >
                    <Download size={10} />
                  </button>
                  <button
                    type="button"
                    onClick={() => { setRenamingId(att.id); setRenameDraft(att.file_name); }}
                    className="rounded bg-background/90 hover:bg-background border p-1"
                    title="Rename"
                  >
                    <Pencil size={10} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDel(att)}
                    className="rounded bg-background/90 hover:bg-destructive hover:text-destructive-foreground border p-1"
                    title="Delete"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete attachment?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDel?.file_name} will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (confirmDel) { remove(confirmDel); setConfirmDel(null); } }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
