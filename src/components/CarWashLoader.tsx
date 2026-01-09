import { cn } from "@/lib/utils";

interface CarWashLoaderProps {
  className?: string;
  text?: string;
}

export function CarWashLoader({ className, text = "Loading..." }: CarWashLoaderProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12", className)}>
      <svg
        viewBox="0 0 200 150"
        className="w-48 h-36"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Garage Background */}
        <rect x="10" y="30" width="180" height="110" rx="8" fill="hsl(var(--muted))" />
        <rect x="10" y="30" width="180" height="20" fill="hsl(var(--foreground))" opacity="0.1" />
        
        {/* Garage Door Lines */}
        <line x1="10" y1="50" x2="190" y2="50" stroke="hsl(var(--border))" strokeWidth="1" />
        <line x1="10" y1="70" x2="190" y2="70" stroke="hsl(var(--border))" strokeWidth="1" />
        <line x1="10" y1="90" x2="190" y2="90" stroke="hsl(var(--border))" strokeWidth="1" />
        
        {/* Car Body */}
        <g className="animate-pulse">
          {/* Car base */}
          <path
            d="M45 110 L50 95 L70 80 L130 80 L150 95 L155 110 L45 110"
            fill="hsl(var(--primary))"
          />
          {/* Car roof */}
          <path
            d="M65 80 L75 65 L125 65 L135 80"
            fill="hsl(var(--primary))"
          />
          {/* Windows */}
          <path
            d="M70 78 L78 67 L95 67 L95 78"
            fill="hsl(var(--primary-foreground))"
            opacity="0.5"
          />
          <path
            d="M100 78 L100 67 L122 67 L130 78"
            fill="hsl(var(--primary-foreground))"
            opacity="0.5"
          />
          {/* Wheels */}
          <circle cx="70" cy="115" r="12" fill="hsl(var(--foreground))" />
          <circle cx="70" cy="115" r="6" fill="hsl(var(--muted))" />
          <circle cx="130" cy="115" r="12" fill="hsl(var(--foreground))" />
          <circle cx="130" cy="115" r="6" fill="hsl(var(--muted))" />
          {/* Headlights */}
          <rect x="145" y="97" width="8" height="6" rx="2" fill="hsl(var(--primary-foreground))" />
          <rect x="47" y="97" width="8" height="6" rx="2" fill="hsl(var(--destructive))" opacity="0.7" />
        </g>

        {/* Water Spray Left */}
        <g className="water-spray-left">
          <circle cx="35" cy="70" r="3" fill="hsl(var(--primary))" opacity="0.7">
            <animate
              attributeName="cy"
              values="70;100;70"
              dur="0.8s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.7;0.3;0.7"
              dur="0.8s"
              repeatCount="indefinite"
            />
          </circle>
          <circle cx="30" cy="80" r="2.5" fill="hsl(var(--primary))" opacity="0.6">
            <animate
              attributeName="cy"
              values="80;105;80"
              dur="0.7s"
              repeatCount="indefinite"
            />
          </circle>
          <circle cx="38" cy="75" r="2" fill="hsl(var(--primary))" opacity="0.5">
            <animate
              attributeName="cy"
              values="75;110;75"
              dur="0.9s"
              repeatCount="indefinite"
            />
          </circle>
        </g>

        {/* Water Spray Right */}
        <g className="water-spray-right">
          <circle cx="165" cy="70" r="3" fill="hsl(var(--primary))" opacity="0.7">
            <animate
              attributeName="cy"
              values="70;100;70"
              dur="0.75s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.7;0.3;0.7"
              dur="0.75s"
              repeatCount="indefinite"
            />
          </circle>
          <circle cx="170" cy="80" r="2.5" fill="hsl(var(--primary))" opacity="0.6">
            <animate
              attributeName="cy"
              values="80;105;80"
              dur="0.65s"
              repeatCount="indefinite"
            />
          </circle>
          <circle cx="162" cy="75" r="2" fill="hsl(var(--primary))" opacity="0.5">
            <animate
              attributeName="cy"
              values="75;110;75"
              dur="0.85s"
              repeatCount="indefinite"
            />
          </circle>
        </g>

        {/* Bubbles */}
        <g className="bubbles">
          {[...Array(8)].map((_, i) => (
            <circle
              key={i}
              cx={60 + i * 12}
              cy={60}
              r={3 + (i % 3)}
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="1"
              opacity="0.6"
            >
              <animate
                attributeName="cy"
                values={`${60 + (i % 4) * 5};${45 + (i % 3) * 3};${60 + (i % 4) * 5}`}
                dur={`${1 + i * 0.15}s`}
                repeatCount="indefinite"
              />
              <animate
                attributeName="r"
                values={`${3 + (i % 3)};${4 + (i % 3)};${3 + (i % 3)}`}
                dur={`${1.2 + i * 0.1}s`}
                repeatCount="indefinite"
              />
            </circle>
          ))}
        </g>

        {/* Water Drops Falling */}
        <g className="water-drops">
          {[...Array(5)].map((_, i) => (
            <ellipse
              key={i}
              cx={55 + i * 25}
              cy={40}
              rx="2"
              ry="4"
              fill="hsl(var(--primary))"
              opacity="0.6"
            >
              <animate
                attributeName="cy"
                values="40;130;40"
                dur={`${0.8 + i * 0.2}s`}
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0.6;0.2;0.6"
                dur={`${0.8 + i * 0.2}s`}
                repeatCount="indefinite"
              />
            </ellipse>
          ))}
        </g>

        {/* Shine Effect */}
        <ellipse
          cx="100"
          cy="72"
          rx="20"
          ry="4"
          fill="white"
          opacity="0.3"
        >
          <animate
            attributeName="opacity"
            values="0.3;0.6;0.3"
            dur="1.5s"
            repeatCount="indefinite"
          />
        </ellipse>
      </svg>
      
      <p className="mt-4 text-muted-foreground animate-pulse">{text}</p>
    </div>
  );
}

export default CarWashLoader;
