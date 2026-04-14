import { X } from "lucide-react";

export function PendingImageList({
  images,
  onRemove,
}: {
  images: { id: string; url: string }[];
  onRemove: (id: string) => void;
}) {
  return (
    <>
      {images.map((img) => (
        <div key={img.id} className="relative group/img flex-shrink-0">
          <img
            src={img.url}
            alt="Pending screenshot"
            className="h-14 w-20 object-cover rounded-lg border border-border"
          />
          <button
            onClick={() => onRemove(img.id)}
            className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-loss text-tx-1 flex items-center justify-center md:opacity-0 md:group-hover/img:opacity-100 transition-opacity z-[var(--z-base)]"
          >
            <X size={9} />
          </button>
        </div>
      ))}
    </>
  );
}
