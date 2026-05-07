import React from 'react';

export const RESOLVE360_LOGO_URL =
  'https://d64gsuwffb70l.cloudfront.net/69ea8e4f017d5fa031c408bb_1778018044232_1483823c.png';

interface LogoProps {
  /** Pixel size of the square logo image. */
  size?: number;
  /** Show the "Resolve360" wordmark next to the mark. The supplied logo
   *  already includes the wordmark, so by default we only render the image. */
  showWordmark?: boolean;
  className?: string;
  /** When true, the logo image fills its container and respects the parent's
   *  width/height instead of using the `size` prop. Useful for hero sections. */
  fill?: boolean;
  alt?: string;
}

/**
 * Official Resolve360 logo. The PNG ships on a black background and already
 * contains the brand wordmark, so we render it as a single image and avoid
 * stacking another text wordmark next to it (which previously made the header
 * read "<logo> Resolve360"). Pages that want the standalone monogram can pass
 * `showWordmark={false}` (default) — the optional wordmark below is kept for
 * places where we want larger visual weight without the image background.
 */
const Logo: React.FC<LogoProps> = ({
  size = 40,
  showWordmark = false,
  className = '',
  fill = false,
  alt = 'Resolve360 — Investigate. Resolve. Elevate.',
}) => {
  const imgStyle: React.CSSProperties = fill
    ? { width: '100%', height: '100%' }
    : { width: size, height: size };

  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <img
        src={RESOLVE360_LOGO_URL}
        alt={alt}
        style={imgStyle}
        className="object-contain rounded-md bg-black select-none"
        draggable={false}
      />
      {showWordmark && (
        <span className="text-xl font-semibold text-[#F5EFE0] tracking-tight leading-none">
          Resolve<span className="text-[#D4AF37]">360</span>
        </span>
      )}
    </span>
  );
};

export default Logo;
