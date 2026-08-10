"use server";
import { revalidateEntities } from "./revalidate";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createFaq, updateFaq, deleteFaq, reorderFaqs } from "@/lib/data/repo";
import { faqSchema, idSchema, parse } from "./schemas";
import { errMsg } from "./lock";

type Result = { ok: true } | { ok: false; error: string };
const DENY: Result = { ok: false, error: "Kamu tidak punya akses untuk ini." };

export async function createFaqAction(input: { question: string; answer: string }): Promise<Result> {
  if (!can.manageFaq(await getCurrentUser())) return DENY;
  const v = parse(faqSchema, input);
  if (!v.ok) return v;
  await createFaq(v.data);
  revalidateEntities("faq");
  return { ok: true };
}

export async function updateFaqAction(id: string, patch: { question: string; answer: string }): Promise<Result> {
  if (!can.manageFaq(await getCurrentUser())) return DENY;
  const idv = parse(idSchema, id);
  if (!idv.ok) return idv;
  const v = parse(faqSchema, patch);
  if (!v.ok) return v;
  await updateFaq(idv.data, v.data);
  revalidateEntities("faq");
  return { ok: true };
}

export async function deleteFaqAction(id: string): Promise<Result> {
  if (!can.manageFaq(await getCurrentUser())) return DENY;
  const idv = parse(idSchema, id);
  if (!idv.ok) return idv;
  await deleteFaq(idv.data);
  revalidateEntities("faq");
  return { ok: true };
}

/** Persist a drag-and-drop reorder. FAQs are not edition-scoped, so there is no
 *  archive lock to check here — unlike the Hari-H reorder this mirrors. */
export async function reorderFaqsAction(orderedIds: string[]): Promise<Result> {
  if (!can.manageFaq(await getCurrentUser())) return DENY;
  const clean: string[] = [];
  for (const id of orderedIds) { const v = parse(idSchema, id); if (!v.ok) return v; clean.push(v.data); }
  try { await reorderFaqs(clean); } catch (e) { return errMsg(e); }
  revalidateEntities("faq");
  return { ok: true };
}
