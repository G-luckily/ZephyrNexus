import { useQuery } from "@tanstack/react-query";
import { authApi } from "../api/auth";
import { useCompany } from "../context/CompanyContext";

export function usePermissions() {
  const { selectedCompanyId: companyId } = useCompany();
  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: () => authApi.getSession(),
    staleTime: 60000,
  });

  const isSuperAdmin = session?.user.isInstanceAdmin ?? false;
  
  const currentRole = session?.memberships.find(m => m.companyId === companyId)?.role ?? "member";

  return {
    isSuperAdmin,
    currentRole,
    canManageAgents: isSuperAdmin || currentRole === "org_admin",
    canDeleteTemplates: isSuperAdmin || currentRole === "org_admin",
    canEditProjects: isSuperAdmin || currentRole === "org_admin" || currentRole === "project_manager",
    canDeleteProjects: isSuperAdmin || currentRole === "org_admin" || currentRole === "project_manager",
  };
}
