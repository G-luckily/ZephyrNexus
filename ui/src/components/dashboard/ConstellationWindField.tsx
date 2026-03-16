import React, { useMemo } from "react";
import { cn } from "../../lib/utils";

interface ConstellationWindFieldProps {
  className?: string;
}

export const ConstellationWindField: React.FC<ConstellationWindFieldProps> = ({ className }) => {
  // Generate stable random paths and points for the constellation
  const paths = useMemo(() => [
    { d: "M-50,300 Q200,50 450,250 T950,200", delay: "0s", duration: "25s" },
    { d: "M-50,400 Q300,150 600,450 T1050,300", delay: "-5s", duration: "30s" },
    { d: "M-50,200 Q150,450 400,150 T850,250", delay: "-10s", duration: "28s" }
  ], []);

  const nodes = useMemo(() => [
    { cx: 380, cy: 180, r: 2.5, glow: true },
    { cx: 450, cy: 250, r: 1.5, glow: false },
    { cx: 520, cy: 220, r: 3, glow: true },
    { cx: 600, cy: 300, r: 2, glow: false },
    { cx: 680, cy: 260, r: 2.5, glow: true },
    { cx: 750, cy: 340, r: 1.5, glow: false },
    { cx: 820, cy: 280, r: 2, glow: true },
    { cx: 400, cy: 350, r: 1.5, glow: false },
    { cx: 320, cy: 280, r: 2, glow: true },
  ], []);

  return (
    <div className={cn("absolute inset-0 pointer-events-none overflow-hidden", className)}>
      <svg
        viewBox="0 0 1000 600"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        <defs>
          <filter id="nodeGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Layer 1: Faint Wind Curves */}
        <g className="opacity-10 dark:opacity-20">
          {paths.map((path, i) => (
            <path
              key={`wind-${i}`}
              d={path.d}
              stroke="currentColor"
              strokeWidth="1"
              className="text-accent/30 dark:text-accent/40"
              style={{
                strokeDasharray: "1, 4",
                animation: `celestial-drift ${path.duration} linear infinite`,
                animationDelay: path.delay,
              }}
            />
          ))}
        </g>

        {/* Layer 2: Constellation Arcs */}
        <g className="opacity-25 dark:opacity-40">
          <path
            d="M380,180 Q450,210 520,220 T680,260 T820,280"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-accent/40 dark:text-accent/60"
          />
          <path
            d="M320,280 Q400,310 450,250 T600,300 T750,340"
            stroke="currentColor"
            strokeWidth="1"
            className="text-accent/30 dark:text-accent/50"
            style={{ strokeDasharray: "4, 8" }}
          />
        </g>

        {/* Layer 3: Star Nodes */}
        <g>
          {nodes.map((node, i) => (
            <g key={`node-${i}`} className="animate-subtle-pulse" style={{ animationDelay: `${i * 0.5}s` }}>
              <circle
                cx={node.cx}
                cy={node.cy}
                r={node.r}
                fill="currentColor"
                className="text-accent dark:text-accent-foreground"
                filter={node.glow ? "url(#nodeGlow)" : undefined}
                style={{ opacity: node.glow ? 0.95 : 0.75 }}
              />
              {node.glow && (
                <circle
                  cx={node.cx}
                  cy={node.cy}
                  r={node.r * 2.5}
                  fill="currentColor"
                  className="text-accent/20 dark:text-accent/30"
                />
              )}
            </g>
          ))}
        </g>
      </svg>
      
      {/* Background Ambient Glows */}
      <div className="absolute top-1/4 right-0 w-[50%] h-[50%] bg-accent/5 blur-[120px] rounded-full mix-blend-screen opacity-50 dark:opacity-30" />
      <div className="absolute bottom-1/4 right-1/4 w-[30%] h-[30%] bg-celestial-2/5 blur-[100px] rounded-full mix-blend-screen opacity-50 dark:opacity-20" />
    </div>
  );
};
