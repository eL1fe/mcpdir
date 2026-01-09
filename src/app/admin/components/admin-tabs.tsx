"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from "@/components/ui/glass-card";
import { ListTodo, History, BarChart3, Upload, Flag } from "lucide-react";
import { ValidationQueue } from "./validation-queue";
import { ValidationHistory } from "./validation-history";
import { ValidationStats } from "./validation-stats";
import { SubmissionsQueue } from "./submissions-queue";
import { ReportsQueue } from "./reports-queue";

export function AdminTabs() {
  return (
    <Tabs defaultValue="queue" className="space-y-6">
      <TabsList className="bg-[var(--glass)] border border-[var(--glass-border)]">
        <TabsTrigger value="queue" className="gap-2 data-[state=active]:bg-cyan/10 data-[state=active]:text-cyan">
          <ListTodo className="w-4 h-4" />
          Queue
        </TabsTrigger>
        <TabsTrigger value="history" className="gap-2 data-[state=active]:bg-cyan/10 data-[state=active]:text-cyan">
          <History className="w-4 h-4" />
          History
        </TabsTrigger>
        <TabsTrigger value="stats" className="gap-2 data-[state=active]:bg-cyan/10 data-[state=active]:text-cyan">
          <BarChart3 className="w-4 h-4" />
          Stats
        </TabsTrigger>
        <TabsTrigger value="submissions" className="gap-2 data-[state=active]:bg-cyan/10 data-[state=active]:text-cyan">
          <Upload className="w-4 h-4" />
          Submissions
        </TabsTrigger>
        <TabsTrigger value="reports" className="gap-2 data-[state=active]:bg-cyan/10 data-[state=active]:text-cyan">
          <Flag className="w-4 h-4" />
          Reports
        </TabsTrigger>
      </TabsList>

      <TabsContent value="queue">
        <GlassCard hover={false}>
          <GlassCardHeader>
            <GlassCardTitle>Validation Queue</GlassCardTitle>
          </GlassCardHeader>
          <GlassCardContent>
            <ValidationQueue />
          </GlassCardContent>
        </GlassCard>
      </TabsContent>

      <TabsContent value="history">
        <GlassCard hover={false}>
          <GlassCardHeader>
            <GlassCardTitle>Validation History</GlassCardTitle>
          </GlassCardHeader>
          <GlassCardContent>
            <ValidationHistory />
          </GlassCardContent>
        </GlassCard>
      </TabsContent>

      <TabsContent value="stats">
        <ValidationStats />
      </TabsContent>

      <TabsContent value="submissions">
        <GlassCard hover={false}>
          <GlassCardHeader>
            <GlassCardTitle>Server Submissions</GlassCardTitle>
          </GlassCardHeader>
          <GlassCardContent>
            <SubmissionsQueue />
          </GlassCardContent>
        </GlassCard>
      </TabsContent>

      <TabsContent value="reports">
        <GlassCard hover={false}>
          <GlassCardHeader>
            <GlassCardTitle>Issue Reports</GlassCardTitle>
          </GlassCardHeader>
          <GlassCardContent>
            <ReportsQueue />
          </GlassCardContent>
        </GlassCard>
      </TabsContent>
    </Tabs>
  );
}
