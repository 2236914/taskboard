import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { getPublicNote } from "@/server/notes.functions";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/n/$slug")({
  loader: async ({ params }) => {
    const data = await getPublicNote({ data: { slug: params.slug } });
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData }) => {
    const title = loaderData?.note?.title ?? "Shared note";
    const desc = (loaderData?.note?.content ?? "").slice(0, 160) || "A note shared via Taskboard.";
    return {
      meta: [
        { title: `${title} — Taskboard` },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "article" },
      ],
    };
  },
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-2xl font-semibold">Couldn't load note</h1>
          <p className="text-sm text-muted-foreground">{error.message}</p>
          <Button onClick={() => { router.invalidate(); reset(); }}>Retry</Button>
        </div>
      </div>
    );
  },
  notFoundComponent: () => (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="max-w-md text-center space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Note not found</h1>
        <p className="text-sm text-muted-foreground">
          This note doesn't exist or the owner has made it private.
        </p>
        <Button asChild><Link to="/">Go home</Link></Button>
      </div>
    </div>
  ),
  component: PublicNotePage,
});

function PublicNotePage() {
  const { note, images } = Route.useLoaderData();
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-3xl mx-auto px-4 md:px-6 h-12 flex items-center gap-2">
          <div className="size-6 rounded-md bg-primary text-primary-foreground grid place-items-center font-semibold text-xs">T</div>
          <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Taskboard · shared note</span>
          <Button asChild size="sm" variant="ghost" className="ml-auto h-7 text-xs">
            <Link to="/">Open Taskboard</Link>
          </Button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 md:px-6 py-10 md:py-16">
        <article className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              <span>Published</span>
              <span>·</span>
              <time dateTime={note.updated_at}>
                {new Date(note.updated_at).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
              </time>
              {note.tag && (
                <Badge variant="outline" className="font-mono text-[10px] gap-1 font-normal">
                  <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: note.tag.color }} />
                  {note.tag.name}
                </Badge>
              )}
            </div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">{note.title || "Untitled"}</h1>
          </div>

          <Card>
            <CardContent className="pt-5">
              <div className="font-mono text-sm leading-relaxed whitespace-pre-wrap break-words">
                {note.content || <span className="text-muted-foreground italic">This note is empty.</span>}
              </div>
            </CardContent>
          </Card>

          {images.length > 0 && (
            <div className="space-y-3">
              <CardHeader className="px-0 pb-1">
                <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Attached images</div>
              </CardHeader>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {images.map((img) => (
                  <a key={img.id} href={img.url} target="_blank" rel="noreferrer"
                    className="block rounded-lg border overflow-hidden bg-card hover:shadow-md transition">
                    <img src={img.url} alt={img.file_name} className="w-full h-auto block" loading="lazy" />
                    <div className="px-2 py-1.5 text-[10px] font-mono text-muted-foreground truncate">{img.file_name}</div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </article>
      </main>
    </div>
  );
}
