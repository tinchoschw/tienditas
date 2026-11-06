import React from 'react';
import { isVideoMedia, getEmbedVideoUrl, getYouTubeThumbnail, useResolvedMediaUrl } from '../utils/mediaStorage';

interface MediaThumbnailProps {
  src: string;
  alt?: string;
  className?: string;
  showPlayBadge?: boolean;
}

export const MediaThumbnail: React.FC<MediaThumbnailProps> = ({
  src,
  alt = 'Media',
  className = 'w-full h-full object-cover',
  showPlayBadge = true
}) => {
  const resolved = useResolvedMediaUrl(src);
  const isVideo = isVideoMedia(src);
  const ytThumb = isVideo ? getYouTubeThumbnail(src) : null;

  return (
    <div className="relative w-full h-full overflow-hidden bg-neutral-900 flex items-center justify-center">
      {isVideo ? (
        ytThumb ? (
          <img src={ytThumb} alt={alt} className={className} />
        ) : (
          <video
            src={resolved ? `${resolved}#t=0.5` : undefined}
            preload="metadata"
            muted
            playsInline
            className={`${className} pointer-events-none opacity-90`}
          />
        )
      ) : (
        <img src={resolved || src} alt={alt} className={className} />
      )}

      {isVideo && showPlayBadge && (
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center pointer-events-none">
          <div className="w-6 h-6 rounded-full bg-white/90 text-black flex items-center justify-center shadow-xs">
            <span className="material-symbols-outlined text-[16px] ml-0.5">play_arrow</span>
          </div>
        </div>
      )}
    </div>
  );
};

interface MediaViewerProps {
  src: string;
  alt?: string;
  className?: string;
  autoPlay?: boolean;
  controls?: boolean;
}

export const MediaViewer: React.FC<MediaViewerProps> = ({
  src,
  alt = 'Media',
  className = 'w-full h-full object-cover',
  autoPlay = false,
  controls = true
}) => {
  const resolved = useResolvedMediaUrl(src);
  const isVideo = isVideoMedia(src);
  const embedUrl = isVideo ? getEmbedVideoUrl(src) : null;

  if (embedUrl) {
    return (
      <iframe
        src={embedUrl}
        title={alt}
        className="w-full h-full rounded-xl border-0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }

  if (isVideo) {
    return (
      <video
        src={resolved || undefined}
        controls={controls}
        playsInline
        preload="metadata"
        autoPlay={autoPlay}
        className={`${className} bg-black`}
      />
    );
  }

  return (
    <img
      src={resolved || src}
      alt={alt}
      className={className}
    />
  );
};
