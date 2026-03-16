import { useState, useEffect } from "react";

export interface InboxBadgeSettings {
  showFailedRuns: boolean;
  showStaleIssues: boolean;
  showApprovals: boolean;
  showAlerts: boolean;
  showJoinRequests: boolean;
}

const DEFAULT_SETTINGS: InboxBadgeSettings = {
  showFailedRuns: true,
  showStaleIssues: true,
  showApprovals: true,
  showAlerts: true,
  showJoinRequests: true,
};

export function useInboxSettings(companyId: string | null) {
  const [settings, setSettings] = useState<InboxBadgeSettings>(DEFAULT_SETTINGS);
  const [lastDismissedCount, setLastDismissedCount] = useState<number>(0);

  useEffect(() => {
    if (!companyId) return;
    const key = `inbox_settings_${companyId}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        setSettings(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse inbox settings", e);
      }
    }

    const dismissKey = `inbox_dismissed_count_${companyId}`;
    const dismissed = localStorage.getItem(dismissKey);
    if (dismissed) {
      setLastDismissedCount(Number(dismissed));
    }
  }, [companyId]);

  const updateSettings = (newSettings: Partial<InboxBadgeSettings>) => {
    if (!companyId) return;
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    localStorage.setItem(`inbox_settings_${companyId}`, JSON.stringify(updated));
  };

  const markAllRead = (currentTotal: number) => {
    if (!companyId) return;
    setLastDismissedCount(currentTotal);
    localStorage.setItem(`inbox_dismissed_count_${companyId}`, String(currentTotal));
  };

  return { settings, updateSettings, lastDismissedCount, markAllRead };
}
