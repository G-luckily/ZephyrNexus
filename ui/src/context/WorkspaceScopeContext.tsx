import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useSearchParams } from "@/lib/router";
import { useCompany } from "./CompanyContext";

export type ScopeView = "company" | "project" | "department";

type ScopeState = {
  view: ScopeView;
  projectId: string;
  department: string;
};

interface WorkspaceScopeContextValue {
  scopeView: ScopeView;
  projectFilter: string;
  departmentFilter: string;
  showHighCostAgents: boolean;
  setScopeView: (view: ScopeView) => void;
  setProjectFilter: (projectId: string) => void;
  setDepartmentFilter: (department: string) => void;
  setShowHighCostAgents: (show: boolean) => void;
  resetScope: () => void;
}

const STORAGE_KEY = "paperclip.workspaceScope";
const DEFAULT_STATE: ScopeState = {
  view: "company",
  projectId: "all",
  department: "all",
};

const WorkspaceScopeContext = createContext<WorkspaceScopeContextValue | null>(
  null
);

function readStorage(companyId: string | null): ScopeState {
  if (!companyId) return DEFAULT_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Record<string, ScopeState>;
    return parsed[companyId] ?? DEFAULT_STATE;
  } catch {
    return DEFAULT_STATE;
  }
}

function writeStorage(companyId: string | null, state: ScopeState) {
  if (!companyId) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, ScopeState>) : {};
    parsed[companyId] = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // ignore storage failure
  }
}

export function WorkspaceScopeProvider({ children }: { children: ReactNode }) {
  const { selectedCompanyId } = useCompany();
  const [searchParams, setSearchParams] = useSearchParams();
  const [state, setState] = useState<ScopeState>(() =>
    readStorage(selectedCompanyId)
  );

  const showHighCostAgents = searchParams.get("showHighCostAgents") === "true";

  useEffect(() => {
    setState(readStorage(selectedCompanyId));
  }, [selectedCompanyId]);

  const updateState = useCallback(
    (patch: Partial<ScopeState>) => {
      setState((prev) => {
        const next = { ...prev, ...patch };
        writeStorage(selectedCompanyId, next);
        return next;
      });
    },
    [selectedCompanyId]
  );

  const setScopeView = useCallback(
    (view: ScopeView) => updateState({ view }),
    [updateState]
  );
  const setProjectFilter = useCallback(
    (projectId: string) => updateState({ projectId }),
    [updateState]
  );
  const setDepartmentFilter = useCallback(
    (department: string) => updateState({ department }),
    [updateState]
  );
  const setShowHighCostAgents = useCallback(
    (show: boolean) => {
      setSearchParams((prev) => {
        if (show) {
          prev.set("showHighCostAgents", "true");
        } else {
          prev.delete("showHighCostAgents");
        }
        return prev;
      }, { replace: true });
    },
    [setSearchParams]
  );
  const resetScope = useCallback(
    () => {
      updateState(DEFAULT_STATE);
      setShowHighCostAgents(false);
    },
    [updateState, setShowHighCostAgents]
  );

  const value = useMemo<WorkspaceScopeContextValue>(
    () => ({
      scopeView: state.view,
      projectFilter: state.projectId,
      departmentFilter: state.department,
      showHighCostAgents,
      setScopeView,
      setProjectFilter,
      setDepartmentFilter,
      setShowHighCostAgents,
      resetScope,
    }),
    [state, showHighCostAgents, setScopeView, setProjectFilter, setDepartmentFilter, setShowHighCostAgents, resetScope]
  );

  return (
    <WorkspaceScopeContext.Provider value={value}>
      {children}
    </WorkspaceScopeContext.Provider>
  );
}

export function useWorkspaceScope() {
  const ctx = useContext(WorkspaceScopeContext);
  if (!ctx) {
    throw new Error(
      "useWorkspaceScope must be used within WorkspaceScopeProvider"
    );
  }
  return ctx;
}
