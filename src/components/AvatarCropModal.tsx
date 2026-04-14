import { useEffect, useMemo, useRef, useState } from "react";
import Modal from "@/components/Modal";

const PREVIEW_SIZE = 240;
const OUTPUT_SIZE = 512;

type Point = { x: number; y: number };
type ImageMeta = { width: number; height: number };

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function clampOffset(offset: Point, image: ImageMeta, scale: number): Point {
  const maxX = Math.max(0, (image.width * scale - PREVIEW_SIZE) / 2);
  const maxY = Math.max(0, (image.height * scale - PREVIEW_SIZE) / 2);

  return {
    x: clamp(offset.x, -maxX, maxX),
    y: clamp(offset.y, -maxY, maxY),
  };
}

interface Props {
  open: boolean;
  source: string | null;
  onCancel: () => void;
  onApply: (croppedDataUrl: string) => void;
}

export default function AvatarCropModal({ open, source, onCancel, onApply }: Props) {
  const [image, setImage] = useState<ImageMeta | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const dragStartRef = useRef<{ pointerId: number; x: number; y: number; offset: Point } | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!open || !source) {
      setImage(null);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setIsApplying(false);
      dragStartRef.current = null;
      return;
    }

    const img = new Image();
    img.onload = () => {
      setImage({ width: img.naturalWidth, height: img.naturalHeight });
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    };
    img.src = source;
  }, [open, source]);

  const baseScale = useMemo(() => {
    if (!image) return 1;
    return Math.max(PREVIEW_SIZE / image.width, PREVIEW_SIZE / image.height);
  }, [image]);

  const displayScale = baseScale * zoom;

  useEffect(() => {
    if (!image) return;
    setOffset((current) => clampOffset(current, image, displayScale));
  }, [displayScale, image]);

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!image) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartRef.current = {
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      offset,
    };
    setDragging(true);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const drag = dragStartRef.current;
    if (!drag || !image) return;

    const nextOffset = clampOffset(
      {
        x: drag.offset.x + (e.clientX - drag.x),
        y: drag.offset.y + (e.clientY - drag.y),
      },
      image,
      displayScale
    );
    setOffset(nextOffset);
  }

  function endDrag(e?: React.PointerEvent<HTMLDivElement>) {
    if (e && dragStartRef.current?.pointerId === e.pointerId) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    dragStartRef.current = null;
    setDragging(false);
  }

  async function handleApply() {
    if (!source || !image || !imageRef.current || isApplying) return;

    setIsApplying(true);

    const visibleSourceSize = PREVIEW_SIZE / displayScale;
    const sourceX = clamp(
      (image.width - visibleSourceSize) / 2 - offset.x / displayScale,
      0,
      Math.max(0, image.width - visibleSourceSize)
    );
    const sourceY = clamp(
      (image.height - visibleSourceSize) / 2 - offset.y / displayScale,
      0,
      Math.max(0, image.height - visibleSourceSize)
    );

    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;

    const context = canvas.getContext("2d");
    if (!context) {
      setIsApplying(false);
      return;
    }

    context.drawImage(
      imageRef.current,
      sourceX,
      sourceY,
      visibleSourceSize,
      visibleSourceSize,
      0,
      0,
      OUTPUT_SIZE,
      OUTPUT_SIZE
    );

    onApply(canvas.toDataURL("image/jpeg", 0.92));
    setIsApplying(false);
  }

  return (
    <Modal open={open} onClose={onCancel} title="Crop Profile Photo" size="sm">
      <div className="space-y-4">
        <div className="text-[11px] text-tx-4">
          Drag to frame your photo. Use zoom to tighten the crop.
        </div>

        <div
          className="mx-auto relative overflow-hidden rounded-[32px] border border-border-subtle bg-bg-hover touch-none select-none"
          style={{ width: PREVIEW_SIZE, height: PREVIEW_SIZE, cursor: dragging ? "grabbing" : "grab" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onPointerLeave={(e) => {
            if (dragStartRef.current?.pointerId === e.pointerId) {
              endDrag(e);
            }
          }}
        >
          {source && (
            <img
              ref={imageRef}
              src={source}
              alt="Profile crop preview"
              draggable={false}
              className="absolute max-w-none pointer-events-none"
              style={{
                width: image ? image.width * displayScale : PREVIEW_SIZE,
                height: image ? image.height * displayScale : PREVIEW_SIZE,
                left: "50%",
                top: "50%",
                transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)`,
                transformOrigin: "center center",
              }}
            />
          )}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              boxShadow: "inset 0 0 0 999px rgba(4,7,12,0.34)",
              borderRadius: 32,
            }}
          />
          <div
            className="absolute inset-[14px] rounded-[24px] pointer-events-none"
            style={{
              border: "1px solid rgba(var(--border-rgb),0.55)",
              boxShadow: "0 0 0 1px rgba(255,255,255,0.05)",
            }}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-[10px] font-semibold text-tx-3">
            <span>Zoom</span>
            <span>{zoom.toFixed(2)}x</span>
          </div>
          <input
            type="range"
            min="1"
            max="3"
            step="0.01"
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full accent-accent"
          />
        </div>

        <div className="flex gap-2 pt-1">
          <button className="btn-primary btn flex-1 disabled:opacity-60" onClick={handleApply} disabled={!image || isApplying}>
            {isApplying ? "Applying..." : "Apply Crop"}
          </button>
          <button className="btn-ghost btn" onClick={onCancel} disabled={isApplying}>
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
