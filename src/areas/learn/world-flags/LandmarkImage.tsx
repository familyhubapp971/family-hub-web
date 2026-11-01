import { useEffect, useState } from 'react';
import { Landmark as LandmarkIcon, ImageOff } from 'lucide-react';

// Landmark photo fetched from the public Wikipedia REST summary API, keyed by
// the landmark name. Results are cached in a module-level Map so flipping
// between cards doesn't re-fetch. Falls back to a placeholder icon when the
// page has no image or the request fails.

const cache = new Map<string, string | null>();

export function LandmarkImage({ landmark }: { landmark: string }) {
  const [imageUrl, setImageUrl] = useState<string | null>(cache.get(landmark) ?? null);
  const [loading, setLoading] = useState(!cache.has(landmark));
  const [error, setError] = useState(false);

  useEffect(() => {
    if (cache.has(landmark)) {
      setImageUrl(cache.get(landmark) ?? null);
      setLoading(false);
      setError(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(false);
    const term = landmark.replace(/\s+/g, '_');

    fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(term)}`)
      .then((res) => {
        if (!res.ok) throw new Error('not found');
        return res.json();
      })
      .then((data: { originalimage?: { source?: string }; thumbnail?: { source?: string } }) => {
        if (cancelled) return;
        const url = data.originalimage?.source ?? data.thumbnail?.source ?? null;
        cache.set(landmark, url);
        setImageUrl(url);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        cache.set(landmark, null);
        setImageUrl(null);
        setError(true);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [landmark]);

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gray-100 motion-safe:animate-pulse">
        <LandmarkIcon className="h-6 w-6 text-gray-300" aria-hidden="true" />
      </div>
    );
  }

  if (!imageUrl || error) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gray-100">
        <ImageOff className="h-6 w-6 text-gray-300" aria-label={`No photo for ${landmark}`} />
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={landmark}
      loading="lazy"
      className="h-full w-full bg-gray-900 object-contain"
      onError={() => setError(true)}
    />
  );
}
