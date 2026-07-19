"use server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createFaq, updateFaq, deleteFaq } from "@/lib/data/repo";
import { faqSchema, idSchema, parse } from "./schemas";

type Result = { ok: true } | { ok: false; error: string };
const DENY: Result = { ok: false, error: "Kamu tidak punya akses untuk ini." };

export async function createFaqAction(input: { question: string; answer: string }): Promise<Result> {
  if (!can.manageFaq(await getCurrentUser())) return DENY;
  const v = parse(faqSchema, input);
  if (!v.ok) return v;
  await createFaq(v.data);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateFaqAction(id: string, patch: { question: string; answer: string }): Promise<Result> {
  if (!can.manageFaq(await getCurrentUser())) return DENY;
  const idv = parse(idSchema, id);
  if (!idv.ok) return idv;
  const v = parse(faqSchema, patch);
  if (!v.ok) return v;
  await updateFaq(idv.data, v.data);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteFaqAction(id: string): Promise<Result> {
  if (!can.manageFaq(await getCurrentUser())) return DENY;
  const idv = parse(idSchema, id);
  if (!idv.ok) return idv;
  await deleteFaq(idv.data);
  revalidatePath("/", "layout");
  return { ok: true };
}
