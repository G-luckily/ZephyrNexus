import * as React from "react";
import { Sparkles, Loader2, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { onboardingApi } from "@/api/onboarding";
import { useNavigate } from "@/lib/router";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { useDialog } from "@/context/DialogContext";
import { SuccessTransition } from "./SuccessTransition";

interface TaskPreview {
  title: string;
  description: string;
}

interface LaunchResult {
  companyName: string;
  agentName: string;
}

export function OnboardingCard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { closeOnboarding, onboardingOpen } = useDialog();

  const [companyName, setCompanyName] = React.useState("");
  const [taskTitle, setTaskTitle] = React.useState("");
  const [previewTasks, setPreviewTasks] = React.useState<TaskPreview[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = React.useState(false);
  const [launchResult, setLaunchResult] = React.useState<LaunchResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Conditional check AFTER all hooks - this is the key fix
  if (!onboardingOpen) {
    return null;
  }

  // Show success transition when launch is complete
  if (launchResult) {
    return (
      <SuccessTransition
        companyName={launchResult.companyName}
        agentName={launchResult.agentName}
        taskTitle={taskTitle}
        onGoToDashboard={() => {
          closeOnboarding();
          navigate("/");
        }}
      />
    );
  }

  const handlePreview = React.useCallback(async () => {
    if (!companyName.trim()) {
      setError("Company name is required");
      return;
    }

    setError(null);
    setIsPreviewLoading(true);

    try {
      const response = await onboardingApi.quickstart({
        companyName: companyName.trim(),
      });

      if (response.suggestedTasks && response.suggestedTasks.length > 0) {
        setPreviewTasks(
          response.suggestedTasks.map((task) => ({
            title: task.title,
            description: task.description,
          }))
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch preview");
    } finally {
      setIsPreviewLoading(false);
    }
  }, [companyName]);

  const handleLaunch = React.useCallback(async () => {
    if (!companyName.trim()) {
      setError("Company name is required");
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const response = await onboardingApi.quickstart({
        companyName: companyName.trim(),
        taskTitle: taskTitle.trim() || undefined,
      });

      setLaunchResult({
        companyName: response.companyName ?? companyName.trim(),
        agentName: response.agentName ?? "CEO Agent",
      });

      // Invalidate companies query to refresh the list
      queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start");
    } finally {
      setIsLoading(false);
    }
  }, [companyName, taskTitle, queryClient]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4">
        <div className="rounded-2xl border border-border-subtle bg-surface-glass p-8 shadow-xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent/10 mb-4">
              <Sparkles className="w-6 h-6 text-accent" />
            </div>
            <h1 className="text-2xl font-semibold text-foreground">
              What should we call this?
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Your company / team name
            </p>
          </div>

          {/* Form */}
          <div className="space-y-4">
            <div>
              <Input
                type="text"
                placeholder="Acme Corp"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handlePreview();
                  }
                }}
                autoFocus
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">
                First task for your CEO (optional)
              </label>
              <Input
                type="text"
                placeholder="Leave empty for AI to decide"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                className="mt-1.5"
              />
            </div>

            {/* Error message */}
            {error && (
              <p className="mt-4 text-sm text-destructive">{error}</p>
            )}

            {/* Preview section */}
            {previewTasks.length > 0 && (
              <div className="mt-6 p-4 rounded-lg bg-surface-overlay border border-border-subtle">
                <h3 className="text-sm font-medium text-foreground mb-3">
                  What your CEO will do
                </h3>
                <div className="space-y-3">
                  {previewTasks.map((task, index) => (
                    <div key={index} className="space-y-1.5">
                      <div className="text-sm font-medium px-1">{task.title}</div>
                      <p className="text-xs text-muted-foreground line-clamp-2 px-1">
                        {task.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={handlePreview}
                disabled={isPreviewLoading || !companyName.trim()}
                className="flex-1"
              >
                {isPreviewLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  "Preview tasks"
                )}
              </Button>
              <Button
                onClick={handleLaunch}
                disabled={isLoading || !companyName.trim()}
                className="flex-1"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Rocket className="w-4 h-4" />
                    Start
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Footer */}
          <p className="mt-6 text-center text-xs text-muted-foreground">
            No account needed.
          </p>
        </div>
      </div>
    </div>
  );
}