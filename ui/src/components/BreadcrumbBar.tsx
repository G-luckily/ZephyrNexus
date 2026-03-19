import { Link } from "@/lib/router";
import { Menu } from "lucide-react";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useSidebar } from "../context/SidebarContext";
import { NotificationBell } from "./NotificationBell";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Fragment } from "react";

export function BreadcrumbBar() {
  const { breadcrumbs } = useBreadcrumbs();
  const { toggleSidebar, isMobile } = useSidebar();

  if (breadcrumbs.length === 0) return null;

  const menuButton = isMobile && (
    <Button
      variant="ghost"
      size="icon-sm"
      className="mr-2 shrink-0"
      onClick={toggleSidebar}
      aria-label="打开侧边栏"
    >
      <Menu className="h-5 w-5" />
    </Button>
  );

  // Single breadcrumb = page title (uppercase)
  if (breadcrumbs.length === 1) {
    return (
      <div className="relative flex h-14 shrink-0 items-center overflow-hidden border-b border-shell-border bg-background/70 px-4 md:px-6 backdrop-blur-sm">
        {menuButton}
        <h1 className="relative z-[1] truncate text-base font-semibold tracking-tight text-foreground">
          {breadcrumbs[0].label}
        </h1>
        <div className="relative z-[1] ml-auto hidden items-center gap-2 md:flex">
          <NotificationBell />
          <div className="flex items-center gap-2 rounded-full border border-shell-border bg-sidebar-accent px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            <span className="h-1.5 w-1.5 animate-subtle-pulse rounded-full bg-zephyr-blue" />
            Route Live
          </div>
        </div>
      </div>
    );
  }

  // Multiple breadcrumbs = breadcrumb trail
  return (
    <div className="relative flex h-14 shrink-0 items-center overflow-hidden border-b border-shell-border bg-background/70 px-4 md:px-6 backdrop-blur-sm">
      {menuButton}
      <Breadcrumb className="relative z-[1] min-w-0 overflow-hidden">
        <BreadcrumbList className="flex-nowrap">
          {breadcrumbs.map((crumb, i) => {
            const isLast = i === breadcrumbs.length - 1;
            return (
              <Fragment key={i}>
                {i > 0 && <BreadcrumbSeparator />}
                <BreadcrumbItem className={isLast ? "min-w-0" : "shrink-0"}>
                  {isLast || !crumb.href ? (
                    <BreadcrumbPage className="truncate">
                      {crumb.label}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link to={crumb.href}>{crumb.label}</Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
      <div className="relative z-[1] ml-auto hidden items-center gap-2 md:flex">
        <NotificationBell />
        <div className="flex items-center gap-2 rounded-full border border-shell-border bg-sidebar-accent px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          <span className="h-1.5 w-1.5 animate-subtle-pulse rounded-full bg-zephyr-blue" />
          Route Live
        </div>
      </div>
    </div>
  );
}
