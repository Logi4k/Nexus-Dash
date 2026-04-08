import { useEffect, useRef, useCallback, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
}

const panelVariants = {
  hidden: { opacity: 0, y: 14, scale: 0.97 },
  visible: {
    opacity: 1, y: 0, scale: 1,
    transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] },
  },
  exit: {
    opacity: 0, y: 8, scale: 0.98,
    transition: { duration: 0.18, ease: [0.4, 0, 1, 1] },
  },
};

const sheetVariants = {
  hidden: { y: "100%" },
  visible: {
    y: 0,
    transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] },
  },
  exit: {
    y: "100%",
    transition: { duration: 0.24, ease: [0.4, 0, 1, 1] },
  },
};

const FOCUSABLE = 'button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
const OPEN_GUARD_MS = 800;

export default function Modal({ open, onClose, title, children, size = "md" }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const openedAtRef = useRef(0);
  useEffect(() => { onCloseRef.current = onClose; });

  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 768);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Swipe-to-dismiss state
  const touchStartYRef = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartYRef.current = e.touches[0].clientY;
    setIsDragging(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartYRef.current === null) return;
    const delta = e.touches[0].clientY - touchStartYRef.current;
    if (delta > 0) {
      setDragY(delta);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    if (dragY > 80) {
      onCloseRef.current();
      setDragY(0);
    } else {
      setDragY(0);
    }
    touchStartYRef.current = null;
  }, [dragY]);

  // Reset drag state when modal closes
  useEffect(() => {
    if (!open) {
      setDragY(0);
      setIsDragging(false);
      touchStartYRef.current = null;
      openedAtRef.current = 0;
      return;
    }
    openedAtRef.current = Date.now();
  }, [open]);

  const handleBackdropClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // When a sheet is opened from a FAB on mobile, the originating tap can land
    // on the freshly-mounted backdrop and dismiss the modal immediately.
    if (Date.now() - openedAtRef.current < OPEN_GUARD_MS) {
      e.stopPropagation();
      return;
    }
    onCloseRef.current();
  }, []);

  // Focus trap + keyboard navigation
  useEffect(() => {
    if (!open) return;
    prevFocusRef.current = document.activeElement as HTMLElement;
    const panel = panelRef.current;
    if (panel) {
      const focusable = panel.querySelectorAll<HTMLElement>(FOCUSABLE);
      (focusable[0] ?? panel).focus();
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") { onCloseRef.current(); return; }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      prevFocusRef.current?.focus();
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const sizeClass = {
    sm: "max-w-sm",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
    full: "inset-0 m-0 rounded-none",
  }[size ?? "md"];

  if (isMobile) {
    return createPortal(
      <AnimatePresence>
        {open && (
          <motion.div
            className="modal-backdrop"
            onClick={handleBackdropClick}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.2 } }}
            exit={{ opacity: 0, transition: { duration: 0.18 } }}
          >
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={title ? "modal-title" : undefined}
              tabIndex={-1}
              className={cn(
                "absolute bottom-0 left-0 right-0 w-full",
                "bg-bg-card border border-border border-b-0",
                "rounded-t-[30px]",
                "max-h-[88svh] flex flex-col shadow-modal",
                "pb-[env(safe-area-inset-bottom)]"
              )}
              style={{
                transform: `translateY(${dragY}px)`,
                transition: isDragging ? "none" : "transform 0.2s ease",
                overscrollBehavior: "contain",
              }}
              variants={sheetVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={(e) => e.stopPropagation()}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1 flex-shrink-0 cursor-grab active:cursor-grabbing">
                <div className="w-10 h-1 rounded-full bg-border-strong" />
              </div>

              {title && (
                <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle flex-shrink-0">
                  <h2 id="modal-title" className="font-semibold text-tx-1">{title}</h2>
                  <button
                    onClick={onClose}
                    aria-label="Close"
                    className="p-1.5 rounded-lg text-tx-3 hover:text-tx-1 hover:bg-bg-hover transition-all"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}

              <div className="px-5 py-5 overflow-y-auto flex-1 min-h-0" style={{ overscrollBehavior: "contain" }}>{children}</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
    );
  }

  // Desktop: centered dialog (unchanged)
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-backdrop"
          onClick={handleBackdropClick}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.2 } }}
          exit={{ opacity: 0, transition: { duration: 0.18 } }}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? "modal-title" : undefined}
            className={cn(
              size === "full"
                ? "relative w-full bg-bg-card border border-border flex flex-col shadow-modal inset-0 m-0 rounded-none h-[92vh] md:h-auto md:max-h-[85vh]"
                : "relative w-full mx-4 bg-bg-card border border-border rounded-2xl max-h-[85vh] flex flex-col shadow-modal",
              sizeClass
            )}
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top accent line */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border-strong to-transparent" />

            {title && (
              <div className="flex items-center justify-between p-5 border-b border-border-subtle flex-shrink-0">
                <h2 id="modal-title" className="font-semibold text-tx-1">{title}</h2>
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="p-1.5 rounded-lg text-tx-3 hover:text-tx-1 hover:bg-bg-hover transition-all"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            <div className="p-5 overflow-y-auto flex-1 min-h-0">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
