import type {
  QuickstartPreviewResponse,
  QuickstartRequest,
  QuickstartResponse,
} from "@zephyr-nexus/shared";
import { api } from "./client";

export const onboardingApi = {
  preview: (data: Pick<QuickstartRequest, "companyName">) =>
    api.post<QuickstartPreviewResponse>("/onboarding/preview", data),
  quickstart: (data: QuickstartRequest) =>
    api.post<QuickstartResponse>("/onboarding/quickstart", data),
};
