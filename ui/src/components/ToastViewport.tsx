import { useEffect, useState } from "react";
import { Link } from "@/lib/router";
import { X } from "lucide-react";
import {
  useToast,
  type ToastItem,
  type ToastTone,
} from "../context/ToastContext";
import { cn } from "../lib/utils";

const toneClasses: Record<ToastTone, string> = {
  info: "border-[#BFDBFE] bg-white text-[#1E3A8A]",
  success: "border-[#A7F3D0] bg-white text-[#065F46]",
  warn: "border-[#FDE68A] bg-white text-[#92400E]",
  error: "border-[#FECACA] bg-white text-[#991B1B]",
};

const toneDotClasses: Record<ToastTone, string> = {
  info: "bg-[#2563EB]",
  success: "bg-[#10B981]",
  warn: "bg-[#F59E0B]",
  error: "bg-[#EF4444]",
};

function AnimatedToast({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <li
      className={cn(
        "pointer-events-auto rounded-[14px] border shadow-[0_12px_28px_rgba(15,23,42,0.16)] transition-[transform,opacity] duration-200 ease-out",
        visible ? "translate-x-0 opacity-100" : "translate-x-6 opacity-0",
        toneClasses[toast.tone]
      )}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <span
          className={cn(
            "mt-1 h-2.5 w-2.5 shrink-0 rounded-full",
            toneDotClasses[toast.tone]
          )}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-5">{toast.title}</p>
          {toast.body && (
            <p className="mt-1 text-xs leading-4 text-[#475569]">
              {toast.body}
            </p>
          )}
          {toast.action && (
            <Link
              to={toast.action.href}
              onClick={() => onDismiss(toast.id)}
              className="mt-2 inline-flex text-xs font-medium text-[#2563EB] underline underline-offset-4 hover:opacity-90"
            >
              {toast.action.label}
            </Link>
          )}
        </div>
        <button
          type="button"
          aria-label="关闭通知"
          onClick={() => onDismiss(toast.id)}
          className="mt-0.5 shrink-0 rounded p-1 text-[#64748B] hover:bg-[#F1F5F9]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );
}

export function ToastViewport() {
  const { toasts, dismissToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <aside
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed right-4 top-4 z-[120] w-full max-w-sm"
    >
      <ol className="flex w-full flex-col gap-2">
        {toasts.slice(0, 3).map((toast) => (
          <AnimatedToast
            key={toast.id}
            toast={toast}
            onDismiss={dismissToast}
          />
        ))}
      </ol>
    </aside>
  );
}
