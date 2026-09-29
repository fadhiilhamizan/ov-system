import { can } from "../permissions";
import type { AppUser } from "../types";
import type { ImportModule } from "./core";

/**
 * Who may import into which menu: exactly who may ADD a row there by hand.
 * An import is only a faster way to do the same inserts, so it borrows each
 * menu's own create permission rather than inventing a new level.
 */
export function canImport(user: AppUser, module: ImportModule): boolean {
  switch (module) {
    case "tasks": return can.manageTasks(user);
    case "prospects": return can.manageProspects(user);
    case "links": return can.createLink(user);
    case "budget": return can.manageBudget(user);
    case "rundown": return can.manageRundown(user);
    case "jobs": return can.manageJobs(user);
    case "members": return can.manageMembers(user);
    case "fgd":
    case "compare": return can.manageHimpunan(user);
  }
}
