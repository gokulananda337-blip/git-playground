// Car wash themed SVG decorations

export const CarSVG = ({ className = "w-8 h-8" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M52 28H12L16 16H48L52 28Z" fill="currentColor" opacity="0.2"/>
    <path d="M8 28V44H12V48H20V44H44V48H52V44H56V28H8Z" fill="currentColor" opacity="0.3"/>
    <circle cx="16" cy="44" r="6" fill="currentColor"/>
    <circle cx="48" cy="44" r="6" fill="currentColor"/>
    <path d="M48 16L52 28H12L16 16H48Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M8 28H56V40H8V28Z" stroke="currentColor" strokeWidth="2"/>
    <path d="M20 28V20H44V28" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

export const WaterDropSVG = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path 
      d="M12 2C12 2 6 9 6 14C6 17.3137 8.68629 20 12 20C15.3137 20 18 17.3137 18 14C18 9 12 2 12 2Z" 
      fill="currentColor" 
      opacity="0.3"
    />
    <path 
      d="M12 2C12 2 6 9 6 14C6 17.3137 8.68629 20 12 20C15.3137 20 18 17.3137 18 14C18 9 12 2 12 2Z" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
    <ellipse cx="10" cy="13" rx="1.5" ry="2" fill="currentColor" opacity="0.5"/>
  </svg>
);

export const BubblesSVG = ({ className = "w-24 h-24" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="20" cy="30" r="8" fill="currentColor" opacity="0.15"/>
    <circle cx="50" cy="20" r="12" fill="currentColor" opacity="0.1"/>
    <circle cx="80" cy="35" r="6" fill="currentColor" opacity="0.2"/>
    <circle cx="35" cy="60" r="10" fill="currentColor" opacity="0.12"/>
    <circle cx="70" cy="70" r="14" fill="currentColor" opacity="0.08"/>
    <circle cx="25" cy="85" r="5" fill="currentColor" opacity="0.18"/>
    <circle cx="85" cy="80" r="7" fill="currentColor" opacity="0.14"/>
    <circle cx="55" cy="50" r="4" fill="currentColor" opacity="0.2"/>
  </svg>
);

export const SpraySVG = ({ className = "w-8 h-8" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="10" y="12" width="12" height="16" rx="2" fill="currentColor" opacity="0.3"/>
    <rect x="12" y="4" width="8" height="8" rx="1" fill="currentColor" opacity="0.2"/>
    <path d="M16 4V2M12 6H6M20 6H26" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="6" cy="6" r="1.5" fill="currentColor"/>
    <circle cx="26" cy="6" r="1.5" fill="currentColor"/>
    <circle cx="4" cy="10" r="1" fill="currentColor" opacity="0.5"/>
    <circle cx="28" cy="10" r="1" fill="currentColor" opacity="0.5"/>
  </svg>
);

export const ShineSVG = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L14 8L20 10L14 12L12 18L10 12L4 10L10 8L12 2Z" fill="currentColor"/>
    <path d="M19 14L20 17L23 18L20 19L19 22L18 19L15 18L18 17L19 14Z" fill="currentColor" opacity="0.5"/>
    <path d="M5 14L6 16L8 17L6 18L5 20L4 18L2 17L4 16L5 14Z" fill="currentColor" opacity="0.5"/>
  </svg>
);

export const WashBrushSVG = ({ className = "w-8 h-8" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="14" y="4" width="4" height="12" rx="1" fill="currentColor" opacity="0.3"/>
    <path d="M8 16H24V20C24 22 22 24 20 26H12C10 24 8 22 8 20V16Z" fill="currentColor" opacity="0.2"/>
    <path d="M10 26V30M14 26V30M18 26V30M22 26V30" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <rect x="8" y="16" width="16" height="4" rx="1" stroke="currentColor" strokeWidth="2"/>
  </svg>
);
