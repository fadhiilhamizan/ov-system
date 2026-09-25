"use client";
import * as React from "react";
import { LinkListEditor, type DraftLink } from "@/components/ui/link-list-editor";
import { useT } from "@/lib/i18n/provider";
import { useLinkRefCounts } from "./task-links-context";

/**
 * The links a task produced. Every one of them is published to Super Link and
 * must carry a title (see `taskLinkSchema` for why), so this is the
 * `alwaysPublish` flavour of the shared editor.
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
  const counts = useLinkRefCounts();
  return (
    <LinkListEditor
      links={links}
      onChange={onChange}
      alwaysPublish
      refCountOf={(id) => counts[id] ?? 0}
      title={t("Tautan hasil")}
      addLabel={t("Tambah tautan")}
      emptyHint={t("Belum ada tautan. Klik “Tambah tautan” untuk melampirkan Drive/Docs/Foto.")}
      namePlaceholder={t("Judul dokumen (mis. Proposal Ormawa Visit)")}
      nameHint={t("Otomatis tampil di Super Link dengan judul ini. Mengubah/menghapus tautan ini juga memperbarui Super Link.")}
    />
  );
}
