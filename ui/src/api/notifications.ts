import { api } from "./client";

export interface Notification {
  id: string;
  companyId: string;
  userId: string;
  title: string;
  body: string;
  type: string;
  relatedIssueId: string | null;
  readAt: string | null;
  createdAt: string;
}

export const notificationsApi = {
  list: (companyId: string) =>
    api.get<Notification[]>(`/companies/${companyId}/notifications`),

  markRead: (id: string) =>
    api.post<Notification>(`/notifications/${id}/read`, {}),
};
