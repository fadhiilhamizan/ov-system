"use client";
import * as React from "react";
import { Paperclip, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const ACCEPT = "image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt";

/** Uploads a file to the task-results bucket and returns its public URL. */
export function ResultUpload({
  taskId,
  onUploaded,
  label,
  className,
}: {
  taskId: string;
  onUploaded: (url: string) => void;
  label?: string;
  className?: string;
}) {
  const [pending, setPending] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Upload only works when Supabase Storage is available.
  if (!isSupabaseConfigured) return null;

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error("Ukuran file maksimal 25MB.");
      return;
    }
    setPending(true);
    try {
      const supabase = createClient();
      const safe = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${taskId || "new"}/${Date.now()}-${safe}`;
      const { error } = await supabase.storage.from("task-results").upload(path, file, { upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("task-results").getPublicUrl(path);
      onUploaded(data.publicUrl);
      toast.success("File terunggah");
    } catch (err) {
      toast.error("Gagal upload: " + (err instanceof Error ? err.message : "unknown"));
    } finally {
      setPending(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={pending}
        title="Upload file / foto hasil"
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 rounded-md text-muted-foreground transition hover:text-foreground disabled:opacity-60",
          label ? "border border-border bg-card px-2.5 py-1 text-xs font-medium" : "size-7 justify-center hover:bg-muted",
          className,
        )}
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Paperclip className="size-3.5" />}
        {label}
      </button>
      <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={onFile} />
    </>
  );
}
