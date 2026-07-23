"use client";
import * as React from "react";
import type { Member, Team } from "@/lib/types";

// Provides the (event-scoped) member roster + team structure to deeply-nested
// client dialogs (task PIC, job PIC, …) without threading it through every
// intermediate component. Pages that render those dialogs wrap their view in
// <MembersProvider>.
interface Ctx {
  members: Member[];
  teams: Team[];
}
const MembersContext = React.createContext<Ctx>({ members: [], teams: [] });

export function MembersProvider({
  members,
  teams = [],
  children,
}: {
  members: Member[];
  teams?: Team[];
  children: React.ReactNode;
}) {
  const value = React.useMemo(() => ({ members, teams }), [members, teams]);
  return <MembersContext.Provider value={value}>{children}</MembersContext.Provider>;
}

export function useMembers(): Member[] {
  return React.useContext(MembersContext).members;
}

export function useTeams(): Team[] {
  return React.useContext(MembersContext).teams;
}
