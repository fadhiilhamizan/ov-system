"use client";
import * as React from "react";
import { Scale, Table2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FgdPanel } from "./fgd-panel";
import { ComparePanel } from "./compare-panel";
import { useT } from "@/lib/i18n/provider";
import type { CompareEntry, CompareSubject, FgdPlan, FgdRow, Prospect } from "@/lib/types";

export function HimpunanView({
  eventId, plans, rows, subjects, compare, accepted, canManage,
}: {
  eventId: string;
  plans: FgdPlan[];
  rows: Record<string, FgdRow[]>;
  /** The associations chosen for comparison (created from the button). */
  subjects: CompareSubject[];
  compare: CompareEntry[];
  /** Prospects whose `their_response` is DITERIMA (see lib/himpunan.ts). */
  accepted: Prospect[];
  canManage: boolean;
}) {
  const t = useT();
  return (
    <Tabs defaultValue="fgd">
      <TabsList>
        <TabsTrigger value="fgd"><Table2 /> {t("Focus Group Discussion")}</TabsTrigger>
        <TabsTrigger value="compare"><Scale /> Compare</TabsTrigger>
      </TabsList>

      <TabsContent value="fgd">
        <FgdPanel eventId={eventId} plans={plans} rows={rows} canManage={canManage} />
      </TabsContent>
      <TabsContent value="compare">
        <ComparePanel
          eventId={eventId}
          subjects={subjects}
          entries={compare}
          accepted={accepted}
          canManage={canManage}
        />
      </TabsContent>
    </Tabs>
  );
}
