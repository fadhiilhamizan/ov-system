"use client";
import * as React from "react";
import type { Member } from "@/lib/types";

// Provides the (event-scoped) member roster to deeply-nested client dialogs
// (task PIC, job PIC, …) without threading it through every intermediate
// component. Pages that render those dialogs wrap their view in <MembersProvider>.
const MembersContext = React.createContext<Member[]>([]);

export function MembersProvider({ members, children }: { members: Member[]; children: React.ReactNode }) {
  return <MembersContext.Provider value={members}>{children}</MembersContext.Provider>;
}

export function useMembers(): Member[] {
  return React.useContext(MembersContext);
}
