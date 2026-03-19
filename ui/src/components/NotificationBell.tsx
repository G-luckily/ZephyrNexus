import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import { notificationsApi } from "../api/notifications";
import { useCompany } from "../context/CompanyContext";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Link } from "@/lib/router";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/timeAgo";

export function NotificationBell() {
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: notifications } = useQuery({
    queryKey: ["notifications", selectedCompanyId],
    queryFn: () => notificationsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 30000,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", selectedCompanyId] });
    },
  });

  const unreadCount = notifications?.filter(n => !n.readAt).length ?? 0;

  const getIcon = (type: string) => {
    switch(type) {
      case "dependency_unblocked": return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "dependency_blocked": return <AlertCircle className="h-4 w-4 text-amber-500" />;
      case "output_contract_failed": return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <Bell className="h-4 w-4 text-blue-500" />;
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative p-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors focus:outline-none">
          <Bell className="h-5 w-5 text-muted-foreground" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end" collisionPadding={16}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h4 className="font-semibold text-sm">Notifications</h4>
          {unreadCount > 0 && (
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
              {unreadCount} new
            </span>
          )}
        </div>
        <div className="max-h-[350px] overflow-y-auto overscroll-contain">
          {!notifications || notifications.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No notifications yet.
            </div>
          ) : (
            <div className="flex flex-col">
              {notifications.map((n) => (
                <div 
                  key={n.id}
                  className={cn(
                    "flex gap-3 px-4 py-3 border-b border-border last:border-0 transition-colors",
                    !n.readAt ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/50"
                  )}
                >
                  <div className="shrink-0 mt-0.5">
                    {getIcon(n.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className={cn("text-xs font-semibold leading-none", !n.readAt ? "text-foreground" : "text-muted-foreground")}>
                        {n.title}
                      </p>
                      <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                        {timeAgo(n.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {n.body}
                    </p>
                    {n.relatedIssueId && (
                      <Link 
                        to={`/issues/${n.relatedIssueId}`}
                        className="inline-block mt-2 text-xs font-medium text-primary hover:underline"
                        onClick={() => {
                          if (!n.readAt) markRead.mutate(n.id);
                          setOpen(false);
                        }}
                      >
                        View Issue &rarr;
                      </Link>
                    )}
                  </div>
                  {!n.readAt && !n.relatedIssueId && (
                     <button 
                       className="shrink-0 self-center px-2 py-1 flex items-center justify-center rounded-md hover:bg-primary/20 text-[10px] text-primary transition-colors focus:outline-none"
                       onClick={() => markRead.mutate(n.id)}
                     >
                       Mark read
                     </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
