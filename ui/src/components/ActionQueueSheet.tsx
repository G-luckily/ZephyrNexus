import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { issuesApi } from "../api/issues";
import { useCompany } from "../context/CompanyContext";
import { queryKeys } from "../lib/queryKeys";
import { StatusIcon } from "./StatusIcon";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Zap, AlertCircle, PlayCircle, Loader2, Sparkles } from "lucide-react";
import { cn } from "../lib/utils";
import type { ActionQueueItem } from "@zephyr-nexus/shared";

function QueueCard({ item, type }: { item: ActionQueueItem; type: "attention" | "ready" }) {
  const { issue, reason } = item;
  
  return (
    <Link
      to={`/issues/${issue.identifier ?? issue.id}`}
      className="block bg-card rounded-lg border border-border p-3 transition-all hover:border-primary/50 hover:shadow-sm group relative overflow-hidden"
    >
      {type === "attention" && (
        <div className="absolute top-0 right-0 w-1 h-full bg-destructive/80" />
      )}
      {type === "ready" && (
        <div className="absolute top-0 right-0 w-1 h-full bg-emerald-500/80" />
      )}
      
      <div className="flex items-start justify-between gap-2 mb-2 pr-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <StatusIcon status={issue.status} />
          <span className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
            {issue.title}
          </span>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground shrink-0 mt-0.5">
          {issue.identifier ?? issue.id.slice(0, 8)}
        </span>
      </div>
      
      <div className="flex items-center gap-2 mt-3">
        <Badge
          variant="secondary"
          className={cn(
            "text-[10px] font-medium px-2 py-0.5 h-auto items-center flex gap-1.5",
            type === "attention" 
              ? "bg-destructive/10 text-destructive border-destructive/20" 
              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
          )}
        >
          {type === "attention" ? <AlertCircle className="w-3 h-3" /> : <PlayCircle className="w-3 h-3" />}
          {reason}
        </Badge>
        
        {issue.assigneeAgentId && (
          <div className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
            <Sparkles className="w-3 h-3" />
            <span>Agent Assigned</span>
          </div>
        )}
      </div>
    </Link>
  );
}

export function ActionQueueSheet({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { selectedCompanyId } = useCompany();

  const { data: queue, isLoading } = useQuery({
    queryKey: [...queryKeys.issues.list(selectedCompanyId!), "action-queue"],
    queryFn: () => issuesApi.getActionQueue(selectedCompanyId!),
    enabled: !!selectedCompanyId && open,
  });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {children}
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[500px] flex flex-col p-0 border-l border-border/50 shadow-2xl bg-background/95 backdrop-blur-xl">
        <SheetHeader className="px-6 py-5 border-b border-border/50 shrink-0 flex flex-row items-center gap-3 space-y-0 bg-accent/30">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 text-primary shadow-inner border border-primary/20">
            <Zap className="h-4 w-4 drop-shadow-sm" />
          </div>
          <div className="flex flex-col gap-0.5">
            <SheetTitle className="text-base font-semibold leading-none tracking-tight">Action Queue</SheetTitle>
            <p className="text-[11px] text-muted-foreground">Smart rollup of issues needing focus.</p>
          </div>
        </SheetHeader>
        
        <ScrollArea className="flex-1">
          <div className="p-6 space-y-8">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center p-12 text-muted-foreground gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-primary/50" />
                <span className="text-[11px] tracking-widest uppercase">Analyzing Priorities...</span>
              </div>
            ) : queue ? (
              <>
                {queue.attention.length === 0 && queue.ready.length === 0 && (
                  <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground space-y-3 rounded-xl bg-accent/20 border border-dashed border-border/50">
                    <div className="w-12 h-12 rounded-full bg-primary/5 flex items-center justify-center">
                      <Zap className="w-5 h-5 text-primary/30" />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-foreground">Zero Inbox</h4>
                      <p className="text-xs mt-1 text-muted-foreground/80 max-w-[200px]">No issues currently match the priority flow patterns.</p>
                    </div>
                  </div>
                )}
                
                {queue.attention.length > 0 && (
                  <div className="space-y-3.5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-destructive uppercase tracking-wider px-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Needs Attention
                      <span className="bg-destructive/10 text-destructive text-[10px] px-1.5 py-0.5 rounded-full ml-1">
                        {queue.attention.length}
                      </span>
                    </div>
                    <div className="grid gap-2.5">
                      {queue.attention.map((item) => (
                        <div key={item.issue.id} onClick={() => setOpen(false)}>
                          <QueueCard item={item} type="attention" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {queue.ready.length > 0 && (
                  <div className="space-y-3.5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider px-1">
                      <PlayCircle className="w-3.5 h-3.5" />
                      Ready to Go
                      <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] px-1.5 py-0.5 rounded-full ml-1">
                        {queue.ready.length}
                      </span>
                    </div>
                    <div className="grid gap-2.5">
                      {queue.ready.map((item) => (
                        <div key={item.issue.id} onClick={() => setOpen(false)}>
                          <QueueCard item={item} type="ready" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
