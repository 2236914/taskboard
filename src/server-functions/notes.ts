import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SlugSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(40)
    .regex(/^[a-z0-9_-]+$/i),
});

export type PublicNotePayload = {
  note: {
    id: string;
    title: string;
    content: string;
    updated_at: string;
    tag: { name: string; color: string } | null;
  };
  images: Array<{
    id: string;
    file_name: string;
    mime_type: string;
    url: string;
  }>;
} | null;

export const getPublicNote = createServerFn({ method: "GET" })
  .inputValidator((input) => SlugSchema.parse(input))
  .handler(async ({ data }): Promise<PublicNotePayload> => {
    // Service role bypasses RLS, but we hard-filter to is_public=true so no
    // private data is reachable through this endpoint.
    const { data: note, error } = await supabaseAdmin
      .from("notes")
      .select("id,title,content,updated_at,tag_id,is_public,public_slug")
      .eq("public_slug", data.slug)
      .eq("is_public", true)
      .maybeSingle();

    if (error || !note) return null;

    let tag: { name: string; color: string } | null = null;
    if (note.tag_id) {
      const { data: t } = await supabaseAdmin
        .from("tags")
        .select("name,color")
        .eq("id", note.tag_id)
        .maybeSingle();
      if (t) tag = { name: t.name, color: t.color };
    }

    // Inline image attachments (signed URLs, 1 hour)
    const { data: atts } = await supabaseAdmin
      .from("attachments")
      .select("id,file_name,mime_type,file_path")
      .eq("note_id", note.id)
      .order("created_at", { ascending: true });

    const images: PublicNotePayload extends infer T
      ? T extends { images: infer I }
        ? I
        : never
      : never = [];
    for (const a of atts ?? []) {
      if (!a.mime_type.startsWith("image/")) continue;
      const { data: signed } = await supabaseAdmin.storage
        .from("attachments")
        .createSignedUrl(a.file_path, 3600);
      if (signed?.signedUrl) {
        images.push({
          id: a.id,
          file_name: a.file_name,
          mime_type: a.mime_type,
          url: signed.signedUrl,
        });
      }
    }

    return {
      note: {
        id: note.id,
        title: note.title,
        content: note.content,
        updated_at: note.updated_at,
        tag,
      },
      images,
    };
  });
