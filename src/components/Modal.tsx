import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg";
}

export default function Modal({ open, onClose, title, children, size = "md" }: Props) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handler);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handler);
    };
  }, [open, onClose]);

  if (!open) return null;

  const sizeClass = {
    sm: "max-w-sm",
    md: "max-w-lg",
    lg: "max-w-2xl",
  }[size];

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className={cn(
          "relative w-full mx-4 bg-bg-card border border-white/[0.10] rounded-2xl animate-fade-up max-h-[85vh] flex flex-col shadow-modal",
          sizeClass
        )}
        style={{ animationDuration: "0.25s" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top accent line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.1] to-transparent" />

        {title && (
          <div className="flex items-center justify-between p-5 border-b border-white/[0.06] flex-shrink-0">
            <h2 className="font-semibold text-tx-1">{title}</h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-tx-3 hover:text-tx-1 hover:bg-white/[0.06] transition-all"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body
  );
}
