import { Plus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  message: string;
  action?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon: Icon,
  message,
  action,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="glass-surface p-6 mb-6 rounded-[var(--radius-card)] shadow-xl animate-celestial-float">
        <Icon className="h-12 w-12 text-accent/60" />
      </div>
      <p className="text-lg font-medium text-foreground mb-6 max-w-md">{message}</p>
      {action && onAction && (
        <Button 
          onClick={onAction}
          className="rounded-full px-8 py-6 text-base font-semibold hover-lift shadow-lg"
        >
          <Plus className="h-5 w-5 mr-2" />
          {action}
        </Button>
      )}
    </div>
  );
}
