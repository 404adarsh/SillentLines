import { X } from "lucide-react";

export default function DiaryMediaPreview({ content = "", onRemove }) {
  const imageItems = Array.isArray(content)
    ? content.map((image) => ({ id: image.id || image.dataUrl, name: image.name || "Diary image", dataUrl: image.dataUrl }))
    : [...String(content).matchAll(/!\[([^\]]*)\]\((data:image\/[^)]+)\)/g)];
  const images = Array.isArray(content)
    ? imageItems.slice(0, 6)
    : imageItems
        .filter((match) => match?.[2])
        .map((match) => ({ id: match[2], name: match[1] || "Diary image", dataUrl: match[2] }))
        .slice(0, 6);
  if (!images.length) return null;

  return (
    <div className="border-t border-white/10 bg-black/20 p-4">
      <p className="mb-3 text-xs font-black uppercase tracking-widest text-white/60">Inserted Images</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {images.map((match, index) => (
          <figure key={`${match.id || match.dataUrl.slice(0, 42)}-${index}`} className="relative overflow-hidden rounded-lg border border-white/15 bg-white/10">
            {onRemove && (
              <button
                onClick={() => onRemove(index)}
                className="absolute right-2 top-2 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-black/70 text-white shadow-lg"
                aria-label={`Remove ${match.name || "inserted image"}`}
                title="Remove image"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <img src={match.dataUrl} alt={match.name || "Diary inserted image"} className="max-h-72 w-full object-contain" />
            {match.name && <figcaption className="px-3 py-2 text-xs font-semibold text-white/70">{match.name}</figcaption>}
          </figure>
        ))}
      </div>
    </div>
  );
}
