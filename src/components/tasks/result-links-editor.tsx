"use client";
import * as React from "react";
import { LinkListEditor, type DraftLink } from "@/components/ui/link-list-editor";
import { useT } from "@/lib/i18n/provider";

/**
 * The links a task produced, optionally published to Super Link.
 *
 * The mechanics moved to `components/ui/link-list-editor` when Reach & Offer
 * grew the same control; what is left here is the task-specific copy.
 */
export {
  toDraft, newDraft, validateLinks, cleanLinks, type DraftLink,
} from "@/components/ui/link-list-editor";

export function ResultLinksEditor({
  links,
  onChange,
}: {
  links: DraftLink[];
  onChange: (next: DraftLink[]) => void;
}) {
  const t = useT();
  return (
    <LinkListEditor
      links={links}
      onChange={onChange}
      title={t("Tautan hasil")}
      addLabel={t("Tambah tautan")}
      emptyHint={t("Belum ada tautan. Klik “Tambah tautan” untuk melampirkan Drive/Docs/Foto.")}
      namePlaceholder={t("Nama tautan di Super Link (mis. Proposal OV)")}
      nameHint={t("Kosongkan untuk memakai judul tugas. Mengubah/menghapus tautan ini juga memperbarui Super Link.")}
    />
  );
}
