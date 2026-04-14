import { useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export function Lightbox({
  images,
  index,
  onClose,
  onNavigate,
}: {
  images: string[];
  index: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}) {
  const currentImage = images[index];
  const canNavigate = images.length > 1;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && canNavigate) {
        onNavigate((index + 1) % images.length);
      }
      if (e.key === "ArrowLeft" && canNavigate) {
        onNavigate((index - 1 + images.length) % images.length);
      }
    }
    window.addEventListener("keydown", onKey);
    const body = document.body;
    const html = document.documentElement;
    const scrollY = window.scrollY;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevBodyPosition = body.style.position;
    const prevBodyTop = body.style.top;
    const prevBodyLeft = body.style.left;
    const prevBodyRight = body.style.right;
    const prevBodyWidth = body.style.width;
    const prevBodyTouchAction = body.style.touchAction;

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.touchAction = "none";

    return () => {
      window.removeEventListener("keydown", onKey);
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      body.style.position = prevBodyPosition;
      body.style.top = prevBodyTop;
      body.style.left = prevBodyLeft;
      body.style.right = prevBodyRight;
      body.style.width = prevBodyWidth;
      body.style.touchAction = prevBodyTouchAction;
      window.scrollTo(0, scrollY);
    };
  }, [canNavigate, images.length, index, onClose, onNavigate]);

  if (typeof document === "undefined" || !currentImage) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[var(--z-lightbox)] bg-black/85 backdrop-blur-md"
      onClick={onClose}
      style={{
        height: "100dvh",
        overflow: "hidden",
        overscrollBehavior: "contain",
        touchAction: "none",
      }}
    >
      <div
        className="relative flex h-full w-full items-center justify-center px-4 py-4 md:px-8"
        style={{
          paddingTop: "calc(env(safe-area-inset-top) + 1rem)",
          paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)",
          overflow: "hidden",
        }}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-[var(--z-base)] flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-tx-1 transition-colors hover:bg-white/20 md:right-6 md:top-6"
          style={{
            top: "calc(env(safe-area-inset-top) + 0.75rem)",
            right: "max(1rem, env(safe-area-inset-right))",
          }}
        >
          <X size={18} />
        </button>
        {canNavigate && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onNavigate((index - 1 + images.length) % images.length);
              }}
              className="absolute left-4 top-1/2 z-[var(--z-base)] flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-tx-1 transition-colors hover:bg-white/20 md:left-6"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onNavigate((index + 1) % images.length);
              }}
              className="absolute right-4 top-1/2 z-[var(--z-base)] flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-tx-1 transition-colors hover:bg-white/20 md:right-6"
              style={{ right: "max(1rem, env(safe-area-inset-right))" }}
            >
              <ChevronRight size={18} />
            </button>
          </>
        )}
        {canNavigate && (
          <div
            className="absolute left-1/2 top-4 z-[var(--z-base)] -translate-x-1/2 rounded-full bg-black/35 px-3 py-1 text-[11px] font-semibold text-white/90"
            style={{ top: "calc(env(safe-area-inset-top) + 0.85rem)" }}
          >
            {index + 1} / {images.length}
          </div>
        )}
        <div
          className="flex h-full w-full items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          <img
            src={currentImage}
            alt="Trade screenshot"
            className="block max-h-full max-w-full object-contain shadow-2xl"
            style={{
              maxHeight: "calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 2rem)",
              borderRadius: "min(1.25rem, 4vw)",
            }}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}
