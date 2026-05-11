import * as React from "react";
import { useEffect, useState } from "react";
import { Building2, Bot, ListTodo, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "../lib/utils";

interface SuccessTransitionProps {
  companyName: string;
  agentName: string;
  taskTitle?: string;
  onGoToDashboard: () => void;
}

export function SuccessTransition({
  companyName,
  agentName,
  taskTitle,
  onGoToDashboard,
}: SuccessTransitionProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => {
      setIsVisible(true);
    });
  }, []);

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm transition-opacity duration-500",
        isVisible ? "opacity-100" : "opacity-0"
      )}
    >
      <div
        className={cn(
          "w-full max-w-md rounded-2xl border border-border-subtle bg-surface-glass p-8 shadow-xl transition-all duration-500",
          isVisible ? "scale-100 opacity-100" : "scale-95 opacity-0"
        )}
      >
        {/* Header */}
        <div className="text-center mb-6">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
            <Check className="h-6 w-6 text-emerald-500" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">
            You're all set!
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your company is ready. Here's what we've set up:
          </p>
        </div>

        {/* Summary Items */}
        <div className="space-y-3 mb-6">
          {/* Company */}
          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-3">
            <Building2 className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{companyName}</p>
              <p className="text-xs text-muted-foreground">Company</p>
            </div>
            <Check className="h-4 w-4 text-emerald-500 shrink-0" />
          </div>

          {/* CEO Agent */}
          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-3">
            <Bot className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{agentName}</p>
              <p className="text-xs text-muted-foreground">CEO Agent</p>
            </div>
            <Check className="h-4 w-4 text-emerald-500 shrink-0" />
          </div>

          {/* First Task */}
          {taskTitle && (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-3">
              <ListTodo className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{taskTitle}</p>
                <p className="text-xs text-muted-foreground">First Task</p>
              </div>
              <Check className="h-4 w-4 text-emerald-500 shrink-0" />
            </div>
          )}
        </div>

        {/* Button */}
        <Button onClick={onGoToDashboard} className="w-full">
          <span>Go to Dashboard</span>
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}