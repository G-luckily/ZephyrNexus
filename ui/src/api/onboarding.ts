import type { QuickstartRequest, QuickstartResponse } from "@zephyr-nexus/shared";
import { api } from "./client";

export const onboardingApi = {
  quickstart: (data: QuickstartRequest) =>
    api.post<QuickstartResponse>("/onboarding/quickstart", data),
};
