import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type UIEvent,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Moon, Sun, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Outlet, useLocation, useNavigate, useParams } from "@/lib/router";
import { CompanyRail } from "./CompanyRail";
import { Sidebar } from "./Sidebar";
import { SidebarNavItem } from "./SidebarNavItem";
import { BreadcrumbBar } from "./BreadcrumbBar";
import { PropertiesPanel } from "./PropertiesPanel";
import { CommandPalette } from "./CommandPalette";
import { NewIssueDialog } from "./NewIssueDialog";
import { NewProjectDialog } from "./NewProjectDialog";
import { NewGoalDialog } from "./NewGoalDialog";
import { NewAgentDialog } from "./NewAgentDialog";
import { ToastViewport } from "./ToastViewport";
import { MobileBottomNav } from "./MobileBottomNav";
import { useDialog } from "../context/DialogContext";
import { usePanel } from "../context/PanelContext";
import { useCompany } from "../context/CompanyContext";
import { useSidebar } from "../context/SidebarContext";
import { useTheme } from "../context/ThemeContext";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { useCompanyPageMemory } from "../hooks/useCompanyPageMemory";
import { healthApi } from "../api/health";
import { queryKeys } from "../lib/queryKeys";
import { cn } from "../lib/utils";
import { NotFoundPage } from "../pages/NotFound";
import { Button } from "@/components/ui/button";

export function Layout() {
  const { sidebarOpen, setSidebarOpen, toggleSidebar, isMobile, sidebarCollapsed, toggleSidebarCollapse } = useSidebar();
  const { openNewIssue, openOnboarding } = useDialog();
  const { togglePanelVisible } = usePanel();
  const {
    companies,
    loading: companiesLoading,
    selectedCompany,
    selectedCompanyId,
    setSelectedCompanyId,
  } = useCompany();
  const { theme, toggleTheme } = useTheme();
  const { companyPrefix } = useParams<{ companyPrefix: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const onboardingTriggered = useRef(false);
  const lastMainScrollTop = useRef(0);
  const [mobileNavVisible, setMobileNavVisible] = useState(true);
  const nextTheme = theme === "dark" ? "light" : "dark";
  const matchedCompany = useMemo(() => {
    if (!companyPrefix) return null;
    const requestedPrefix = companyPrefix.toUpperCase();
    return (
      companies.find(
        (company) => company.issuePrefix.toUpperCase() === requestedPrefix
      ) ?? null
    );
  }, [companies, companyPrefix]);
  const hasUnknownCompanyPrefix =
    Boolean(companyPrefix) &&
    !companiesLoading &&
    companies.length > 0 &&
    !matchedCompany;
  const { data: health } = useQuery({
    queryKey: queryKeys.health,
    queryFn: () => healthApi.get(),
    retry: false,
  });

  useEffect(() => {
    if (companiesLoading || onboardingTriggered.current) return;
    if (health?.deploymentMode === "authenticated") return;
    if (companies.length === 0) {
      onboardingTriggered.current = true;
      openOnboarding();
    }
  }, [companies, companiesLoading, openOnboarding, health?.deploymentMode]);

  useEffect(() => {
    if (!companyPrefix || companiesLoading || companies.length === 0) return;

    if (!matchedCompany) {
      const fallback =
        (selectedCompanyId
          ? companies.find((company) => company.id === selectedCompanyId)
          : null) ??
        companies[0] ??
        null;
      if (fallback && selectedCompanyId !== fallback.id) {
        setSelectedCompanyId(fallback.id, { source: "route_sync" });
      }
      return;
    }

    if (companyPrefix !== matchedCompany.issuePrefix) {
      const suffix = location.pathname.replace(/^\/[^/]+/, "");
      navigate(`/${matchedCompany.issuePrefix}${suffix}${location.search}`, {
        replace: true,
      });
      return;
    }

    if (selectedCompanyId !== matchedCompany.id) {
      setSelectedCompanyId(matchedCompany.id, { source: "route_sync" });
    }
  }, [
    companyPrefix,
    companies,
    companiesLoading,
    matchedCompany,
    location.pathname,
    location.search,
    navigate,
    selectedCompanyId,
    setSelectedCompanyId,
  ]);

  const togglePanel = togglePanelVisible;

  // Cmd+1..9 to switch companies
  const switchCompany = useCallback(
    (index: number) => {
      if (index < companies.length) {
        setSelectedCompanyId(companies[index]!.id);
      }
    },
    [companies, setSelectedCompanyId]
  );

  useCompanyPageMemory();

  useKeyboardShortcuts({
    onNewIssue: () => openNewIssue(),
    onToggleSidebar: toggleSidebar,
    onTogglePanel: togglePanel,
    onSwitchCompany: switchCompany,
  });

  useEffect(() => {
    if (!isMobile) {
      setMobileNavVisible(true);
      return;
    }
    lastMainScrollTop.current = 0;
    setMobileNavVisible(true);
  }, [isMobile]);

  // Swipe gesture to open/close sidebar on mobile
  useEffect(() => {
    if (!isMobile) return;

    const EDGE_ZONE = 30; // px from left edge to start open-swipe
    const MIN_DISTANCE = 50; // minimum horizontal swipe distance
    const MAX_VERTICAL = 75; // max vertical drift before we ignore

    let startX = 0;
    let startY = 0;

    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0]!;
      startX = t.clientX;
      startY = t.clientY;
    };

    const onTouchEnd = (e: TouchEvent) => {
      const t = e.changedTouches[0]!;
      const dx = t.clientX - startX;
      const dy = Math.abs(t.clientY - startY);

      if (dy > MAX_VERTICAL) return; // vertical scroll, ignore

      // Swipe right from left edge → open
      if (!sidebarOpen && startX < EDGE_ZONE && dx > MIN_DISTANCE) {
        setSidebarOpen(true);
        return;
      }

      // Swipe left when open → close
      if (sidebarOpen && dx < -MIN_DISTANCE) {
        setSidebarOpen(false);
      }
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [isMobile, sidebarOpen, setSidebarOpen]);

  const handleMainScroll = useCallback(
    (event: UIEvent<HTMLElement>) => {
      if (!isMobile) return;

      const currentTop = event.currentTarget.scrollTop;
      const delta = currentTop - lastMainScrollTop.current;

      if (currentTop <= 24) {
        setMobileNavVisible(true);
      } else if (delta > 8) {
        setMobileNavVisible(false);
      } else if (delta < -8) {
        setMobileNavVisible(true);
      }

      lastMainScrollTop.current = currentTop;
    },
    [isMobile]
  );

  return (
    <div className="relative flex h-dvh overflow-hidden bg-shell-page text-foreground pt-[env(safe-area-inset-top)]">
      {/* ── Deep Space Atmospheric Orbs ── */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <style>{`
          @keyframes orb-float-1 {
            0%, 100% { transform: translate(0px, 0px) scale(1); }
            50%       { transform: translate(18px, -12px) scale(1.03); }
          }
          @keyframes orb-float-2 {
            0%, 100% { transform: translate(0px, 0px) scale(1); }
            50%       { transform: translate(-14px, 10px) scale(0.98); }
          }
          @keyframes orb-float-3 {
            0%, 100% { transform: translate(0px, 0px) scale(1); }
            50%       { transform: translate(10px, 14px) scale(1.02); }
          }
          @media (prefers-reduced-motion: reduce) {
            .orb-float { animation: none !important; }
          }
        `}</style>

        {/* Orb 1 — top-left cold silver-blue */}
        <div
          className="orb-float absolute rounded-full"
          style={{
            left: "var(--orb-1-x)",
            top: "var(--orb-1-y)",
            width: "var(--orb-1-size)",
            aspectRatio: "1 / 1",
            background: "radial-gradient(circle, var(--orb-1-color) 0%, transparent 70%)",
            opacity: "var(--orb-1-opacity)",
            filter: "blur(60px)",
            animation: "orb-float-1 18s ease-in-out infinite",
            willChange: "transform",
          }}
        />

        {/* Orb 2 — bottom-right violet */}
        <div
          className="orb-float absolute rounded-full"
          style={{
            left: "var(--orb-2-x)",
            top: "var(--orb-2-y)",
            width: "var(--orb-2-size)",
            aspectRatio: "1 / 1",
            background: "radial-gradient(circle, var(--orb-2-color) 0%, transparent 70%)",
            opacity: "var(--orb-2-opacity)",
            filter: "blur(70px)",
            animation: "orb-float-2 22s ease-in-out infinite",
            willChange: "transform",
          }}
        />

        {/* Orb 3 — center-right zephyr-blue */}
        <div
          className="orb-float absolute rounded-full"
          style={{
            left: "var(--orb-3-x)",
            top: "var(--orb-3-y)",
            width: "var(--orb-3-size)",
            aspectRatio: "1 / 1",
            background: "radial-gradient(circle, var(--orb-3-color) 0%, transparent 70%)",
            opacity: "var(--orb-3-opacity)",
            filter: "blur(80px)",
            animation: "orb-float-3 26s ease-in-out infinite",
            willChange: "transform",
          }}
        />
      </div>

      {/* Subtle radial base — removes flat void */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 120% 80% at 50% -10%, rgba(56, 121, 234, 0.06) 0%, transparent 60%)",
        }}
      />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[200] focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        跳转到主内容
      </a>
      {/* Mobile backdrop */}
      {isMobile && sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 backdrop-blur-[1px] dark:backdrop-blur-sm"
          style={{
            background:
              "color-mix(in oklab, var(--background) 45%, transparent)",
          }}
          onClick={() => setSidebarOpen(false)}
          aria-label="关闭侧边栏"
        />
      )}

      {/* Combined sidebar area: company rail + inner sidebar + docs bar */}
      {isMobile ? (
        <div
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex flex-col overflow-hidden pt-[env(safe-area-inset-top)] transition-transform duration-100 ease-out",
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex flex-1 min-h-0 overflow-hidden">
            <CompanyRail />
            <Sidebar />
          </div>
          <div className="border-t border-white/[0.04] bg-sidebar px-3 py-2">
            <div className="flex items-center gap-1">
              <SidebarNavItem
                to="/docs"
                label="文档"
                icon={BookOpen}
                className="flex-1 min-w-0"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="shrink-0 text-muted-foreground hover:bg-surface-overlay hover:text-sidebar-foreground"
                onClick={toggleTheme}
                aria-label={
                  theme === "dark" ? "切换到浅色模式" : "切换到深色模式"
                }
                title={theme === "dark" ? "切换到浅色模式" : "切换到深色模式"}
              >
                {theme === "dark" ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative z-[1] flex h-full shrink-0 flex-col">
          <div className="flex flex-1 min-h-0">
            <CompanyRail />
            <div
              className={cn(
                "overflow-hidden transition-[width] duration-100 ease-out",
                sidebarOpen
                  ? sidebarCollapsed
                    ? "w-[var(--sidebar-collapsed-width)]"
                    : "w-72"
                  : "w-0"
              )}
            >
              <Sidebar />
            </div>
          </div>
          <div className="border-t border-white/[0.04] bg-sidebar px-3 py-2">
            <div
              className={cn(
                "flex items-center gap-1",
                sidebarCollapsed && "justify-center"
              )}
            >
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="shrink-0 text-muted-foreground hover:bg-surface-overlay hover:text-sidebar-foreground"
                onClick={toggleSidebarCollapse}
                aria-label={sidebarCollapsed ? "展开侧边栏" : "折叠侧边栏"}
                title={sidebarCollapsed ? "展开侧边栏" : "折叠侧边栏"}
              >
                {sidebarCollapsed ? (
                  <PanelLeftOpen className="h-4 w-4" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )}
              </Button>
              {!sidebarCollapsed && (
                <SidebarNavItem
                  to="/docs"
                  label="文档"
                  icon={BookOpen}
                  className="flex-1 min-w-0"
                />
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="shrink-0 text-muted-foreground hover:bg-surface-overlay hover:text-sidebar-foreground"
                onClick={toggleTheme}
                aria-label={
                  theme === "dark" ? "切换到浅色模式" : "切换到深色模式"
                }
                title={theme === "dark" ? "切换到浅色模式" : "切换到深色模式"}
              >
                {theme === "dark" ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="relative z-[1] flex h-full min-w-0 flex-1 flex-col">
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-0 w-px"
          style={{
            background:
              "linear-gradient(180deg, transparent 0%, var(--shell-border) 16%, var(--shell-border) 84%, transparent 100%)",
          }}
        />
        <BreadcrumbBar />
        <div className="flex flex-1 min-h-0">
          <main
            id="main-content"
            tabIndex={-1}
            className={cn(
              "relative z-[1] flex-1 overflow-auto",
              isMobile && "pb-[calc(5rem+env(safe-area-inset-bottom))]"
            )}
            style={{
              padding: "var(--page-padding-y) var(--page-padding-x)",
            }}
            onScroll={handleMainScroll}
          >
            {hasUnknownCompanyPrefix ? (
              <NotFoundPage
                scope="invalid_company_prefix"
                requestedPrefix={companyPrefix ?? selectedCompany?.issuePrefix}
              />
            ) : (
              <Outlet />
            )}
          </main>
          <PropertiesPanel />
        </div>
      </div>
      {isMobile && <MobileBottomNav visible={mobileNavVisible} />}
      <CommandPalette />
      <NewIssueDialog />
      <NewProjectDialog />
      <NewGoalDialog />
      <NewAgentDialog />
      <ToastViewport />
    </div>
  );
}
