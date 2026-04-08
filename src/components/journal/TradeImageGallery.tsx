import { useState, useEffect } from "react";
import { ZoomIn, X } from "lucide-react";
import { getImagesWithCloudFallback } from "@/lib/imageStore";

export function TradeImageGallery({
  imageIds,
  onDelete,
  onLightbox,
}: {
  imageIds: string[];
  onDelete: (id: string) => void;
  onLightbox: (images: string[], index: number) => void;
}) {
  const [images, setImages] = useState<Record<string, string>>({});

  useEffect(() => {
    if (imageIds.length === 0) return;
    getImagesWithCloudFallback(imageIds)
      .then(setImages)
      .catch((err) => {
        console.error("[journal] Failed to load trade images:", err);
        setImages({});
      });
  }, [imageIds]);

  if (imageIds.length === 0) return null;

  const resolvedImages = imageIds
    .map((id) => ({ id, url: images[id] }))
    .filter((image): image is { id: string; url: string } => !!image.url);

  return (
    <div className="flex flex-wrap gap-2 px-4 pb-3 pt-2 border-t" style={{ borderColor: "rgba(var(--border-rgb),0.07)" }}>
      {imageIds.map((id) =>
        images[id] ? (
          <div key={id} className="relative group/img flex-shrink-0">
            <img
              src={images[id]}
              alt="Trade screenshot"
              className="h-16 w-24 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
              style={{ border: "1px solid rgba(var(--border-rgb),0.15)" }}
              onClick={() =>
                onLightbox(
                  resolvedImages.map((image) => image.url),
                  Math.max(0, resolvedImages.findIndex((image) => image.id === id)),
                )
              }
            />
            <div className="absolute inset-0 rounded-lg flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity pointer-events-none">
              <ZoomIn size={14} className="text-tx-1 drop-shadow" />
            </div>
            <button
              onClick={() => onDelete(id)}
              className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-loss text-tx-1 flex items-center justify-center md:opacity-0 md:group-hover/img:opacity-100 transition-opacity z-10"
            >
              <X size={9} />
            </button>
          </div>
        ) : (
          // Skeleton while loading
          <div key={id} className="h-16 w-24 rounded-lg animate-pulse flex-shrink-0"
            style={{ background: "rgba(var(--surface-rgb),0.06)" }} />
        )
      )}
    </div>
  );
}
