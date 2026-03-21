import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { issuesApi } from "../api/issues";
import { useCompany } from "../context/CompanyContext";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CopyPlus, Loader2, GitBranch, Lightbulb, FileText, FileBox, RefreshCcw, Lock, Briefcase } from "lucide-react";
import type { WorkflowTemplate, WorkflowTemplateTask } from "@zephyr-nexus/shared";

function BlueprintPreview({ template }: { template: WorkflowTemplate }) {
  // Start-state & Unlock-path calculation
  const totalTasks = template.tasks.length;
  
  // 1. Initial State
  const readyKeys = new Set(template.tasks.filter(t => !t.dependsOnKeys || t.dependsOnKeys.length === 0).map(t => t.key));
  const readyTasksCount = readyKeys.size;
  const initialBlockedCount = totalTasks - readyTasksCount;

  // 2. Next Unlock Path Deduction
  const nextUnlockKeys = new Set<string>();
  const stillBlockedKeys = new Set<string>();
  let nextUnlockCount = 0;
  let stillBlockedCount = 0;

  template.tasks.forEach(t => {
    if (t.dependsOnKeys && t.dependsOnKeys.length > 0) {
      // Unlocks if ALL dependencies are satisfied by wave 1 ready keys
      const willUnlockNext = t.dependsOnKeys.every(dep => readyKeys.has(dep));
      if (willUnlockNext) {
        nextUnlockCount++;
        nextUnlockKeys.add(t.key);
      } else {
        stillBlockedCount++;
        stillBlockedKeys.add(t.key);
      }
    }
  });

  const heavyTasksCount = template.tasks.filter(t => t.outputContract?.requiresSummary || (t.outputContract?.minFileDeliverables || 0) > 0).length;

  return (
    <div className="h-full flex flex-col pt-1">
      <div className="mb-4">
        <h3 className="font-semibold text-sm text-foreground mb-1.5 flex items-center">
          <Lightbulb className="w-4 h-4 mr-1.5 text-amber-500" />
          模板适用场景
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {template.useCase || "该模板定义了一套通用的连贯协作节点。"}
        </p>
      </div>
      
      {template.maybeExpectedOutcome && (
        <div className="mb-4 bg-primary/5 rounded-md p-2.5 border border-primary/10">
          <h4 className="text-[11px] font-bold text-primary uppercase tracking-wider mb-1">预期最终产出</h4>
          <p className="text-xs text-muted-foreground">{template.maybeExpectedOutcome}</p>
        </div>
      )}

      {/* Start-state Simulation Summary Bar */}
      <div className="mb-5 flex flex-wrap gap-2">
        <div className="flex items-center gap-1.5 bg-accent/40 rounded px-2 py-1 border border-border/80 text-[11px] text-muted-foreground font-medium">
          <Briefcase className="w-3.5 h-3.5" /> 共 {totalTasks} 节点
        </div>
        <div className="flex items-center gap-1.5 bg-emerald-500/10 rounded px-2 py-1 border border-emerald-500/20 text-[11px] text-emerald-600 font-medium">
          <RefreshCcw className="w-3.5 h-3.5" /> 初始就绪: {readyTasksCount}
        </div>
        <div className="flex items-center gap-1.5 bg-amber-500/10 rounded px-2 py-1 border border-amber-500/20 text-[11px] text-amber-600 font-medium">
          <Lock className="w-3.5 h-3.5" /> 初始挂起: {initialBlockedCount}
        </div>
        {nextUnlockCount > 0 && (
          <div className="flex items-center gap-1.5 bg-indigo-500/10 rounded px-2 py-1 border border-indigo-500/20 text-[11px] text-indigo-600 font-medium">
            <RefreshCcw className="w-3.5 h-3.5" /> 首波解锁推演: {nextUnlockCount}
          </div>
        )}
        {heavyTasksCount > 0 && (
          <div className="flex items-center gap-1.5 bg-blue-500/10 rounded px-2 py-1 border border-blue-500/20 text-[11px] text-blue-600 font-medium">
            <FileBox className="w-3.5 h-3.5" /> 核心强契约: {heavyTasksCount}
          </div>
        )}
      </div>

      <h3 className="font-semibold text-sm text-foreground mb-3 flex items-center">
        <GitBranch className="w-4 h-4 mr-1.5 text-primary" />
        将生成的任务拓扑
      </h3>
      
      <div className="flex-1 overflow-y-auto pr-2 -mr-2">
        <div className="relative pl-3 border-l-2 border-muted space-y-5 ml-2">
          {template.tasks.map((task: WorkflowTemplateTask, idx: number) => {
            const isReady = readyKeys.has(task.key);
            const isNextUnlock = nextUnlockKeys.has(task.key);
            const isStillBlocked = stillBlockedKeys.has(task.key);
            const requiresSummary = task.outputContract?.requiresSummary;
            const minFiles = task.outputContract?.minFileDeliverables || 0;
            const isHeavy = requiresSummary || minFiles > 0;
            
            const depNames = task.dependsOnKeys?.map(k => {
              const matched = template.tasks.find(x => x.key === k);
              return matched ? matched.title : k;
            });

            return (
              <div key={task.key} className="relative">
                <div className={`absolute -left-[17px] top-1 w-2.5 h-2.5 rounded-full border-2 bg-background ${isReady ? 'border-emerald-500' : isNextUnlock ? 'border-indigo-400' : 'border-amber-500'}`} />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-foreground">{idx + 1}. {task.title}</span>
                    {isReady && (
                       <span className="flex items-center text-[10px] bg-emerald-500/10 text-emerald-600 px-1.5 py-0.5 rounded-sm border border-emerald-500/20 font-medium whitespace-nowrap">
                         <RefreshCcw className="w-3 h-3 mr-1" />
                         起手执行 (Ready)
                       </span>
                    )}
                    {isNextUnlock && (
                       <span className="flex items-center text-[10px] bg-indigo-500/10 text-indigo-600 px-1.5 py-0.5 rounded-sm border border-indigo-500/20 font-medium whitespace-nowrap">
                         <RefreshCcw className="w-3 h-3 mr-1" />
                         下步解锁推演 (Next Unlock)
                       </span>
                    )}
                    {isStillBlocked && (
                       <span className="flex items-center text-[10px] bg-amber-500/10 text-amber-600 px-1.5 py-0.5 rounded-sm border border-amber-500/20 font-medium whitespace-nowrap">
                         <Lock className="w-3 h-3 mr-1" />
                         深层受阻 (Still Blocked)
                       </span>
                    )}
                  </div>

                  {depNames && depNames.length > 0 && (
                     <div className="text-[11px] text-muted-foreground flex items-center">
                       <span className="inline-block w-4 border-t border-muted-foreground/30 mr-1.5"></span>
                       需前置完成: {depNames.join(", ")}
                     </div>
                  )}
                  
                  {isHeavy && (
                    <div className="flex items-center gap-2 pt-1.5">
                      {requiresSummary && (
                        <div className="flex items-center text-[11px] text-muted-foreground bg-accent/50 px-1.5 py-0.5 rounded border border-border/50">
                          <FileText className="w-3 h-3 mr-1" /> 需验收汇报
                        </div>
                      )}
                      {minFiles > 0 && (
                        <div className="flex items-center text-[11px] text-muted-foreground bg-accent/50 px-1.5 py-0.5 rounded border border-border/50">
                          <FileBox className="w-3 h-3 mr-1" /> 强约束产物 (≥{minFiles})
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function IssuesTemplateMenu({ projectId }: { projectId?: string }) {
  const [open, setOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [baseTitle, setBaseTitle] = useState("");
  
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();

  const { data: templates } = useQuery({
    queryKey: ["issues-templates", selectedCompanyId],
    queryFn: () => issuesApi.getTemplates(selectedCompanyId!),
    enabled: !!selectedCompanyId && open,
  });

  const instantiate = useMutation({
    mutationFn: (data: { templateId: string; baseTitle: string }) =>
      issuesApi.instantiateTemplate(selectedCompanyId!, data.templateId, {
        baseTitle: data.baseTitle,
        projectId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.issues.list(selectedCompanyId!),
      });
      setOpen(false);
      setBaseTitle("");
      setSelectedTemplateId(null);
    },
  });

  const handleCreate = () => {
    if (!selectedTemplateId || !baseTitle.trim()) return;
    instantiate.mutate({ templateId: selectedTemplateId, baseTitle: baseTitle.trim() });
  };

  const selectedTemplate = templates?.find(t => t.id === selectedTemplateId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="text-muted-foreground hover:text-cyan-600 dark:hover:text-cyan-400">
          <CopyPlus className="h-4 w-4 sm:mr-1" />
          <span className="hidden sm:inline">工作流模板</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[850px] p-0 overflow-hidden gap-0">
        <div className="flex flex-col md:flex-row h-full max-h-[85vh]">
          {/* Left Panel: Configuration */}
          <div className="flex flex-col flex-1 p-6 z-10 bg-card">
            <DialogHeader className="mb-5">
              <DialogTitle className="flex items-center gap-2">
                <GitBranch className="h-5 w-5 text-primary" />
                实例化工作流模板
              </DialogTitle>
              <DialogDescription className="mt-1.5 text-xs">
                选择一个预定义的协作能力结构。一旦指定 Epic 前缀，平台将立即部署一条完整的任务生命线，包含交付契约与锁机制。
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex-1 flex flex-col gap-6 overflow-y-auto">
              {/* Template List */}
              <div className="space-y-2 relative">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">选择协作架构图</label>
                <div className="grid gap-2.5 outline-none">
                  {templates ? templates.map(t => (
                    <div 
                      key={t.id} 
                      onClick={() => setSelectedTemplateId(t.id)}
                      className={`border rounded-lg p-3 cursor-pointer transition-all w-full text-left ${
                        selectedTemplateId === t.id 
                          ? 'border-primary ring-1 ring-primary/20 bg-primary/5 shadow-sm' 
                          : 'border-border bg-card hover:border-foreground/30 hover:bg-accent/30'
                      }`}
                    >
                      <div className="font-semibold text-sm text-foreground mb-1">{t.name}</div>
                      <div className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {t.description}
                      </div>
                    </div>
                  )) : (
                    <div className="flex justify-center p-8 bg-accent/20 rounded-lg border border-dashed">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                  )}
                </div>
              </div>

              {/* Input Zone */}
              <div className="space-y-2 mt-auto">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">主题根节点名称 (Epic / Feature 名字)</label>
                <Input 
                  autoFocus
                  placeholder="例如: OAuth 第三方登录模块" 
                  value={baseTitle}
                  className="font-medium"
                  onChange={(e) => setBaseTitle(e.target.value)}
                  onKeyDown={(e) => {
                     if (e.key === "Enter" && selectedTemplateId && baseTitle.trim() && !instantiate.isPending) {
                       handleCreate();
                     }
                  }}
                />
              </div>
            </div>

            <DialogFooter className="mt-6 pt-4 border-t">
              <Button variant="ghost" onClick={() => setOpen(false)}>取消</Button>
              <Button 
                onClick={handleCreate} 
                disabled={!selectedTemplateId || !baseTitle.trim() || instantiate.isPending}
                className="min-w-[120px]"
              >
                {instantiate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CopyPlus className="mr-2 h-4 w-4" />}
                {instantiate.isPending ? "生成图谱中..." : "实例化并置入看板"}
              </Button>
            </DialogFooter>
          </div>

          {/* Right Panel: Template Preview Explainability */}
          <div className="w-full md:w-[350px] lg:w-[400px] border-l bg-accent/20 flex flex-col p-6">
            <h2 className="text-sm font-bold text-foreground mb-4 uppercase tracking-wider opacity-80">
              Template Blueprint
            </h2>
            <div className="flex-1 min-h-[300px] rounded-xl bg-card border shadow-sm p-4 overflow-hidden">
               {selectedTemplate ? (
                 <BlueprintPreview template={selectedTemplate} />
               ) : (
                 <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
                   <Lightbulb className="w-8 h-8 mb-3 opacity-20" />
                   <p className="text-sm">在左侧选中一个模板</p>
                   <p className="text-xs mt-1 opacity-70">在此处可洞悉其节点构造与交付契约预览</p>
                 </div>
               )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
