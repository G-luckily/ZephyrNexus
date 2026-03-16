import React from "react";
import { cn } from "../../lib/utils";

export const OrchestrationVisual: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={cn("relative w-full h-full flex items-center justify-center overflow-hidden", className)}>
      {/* Background Ambient Glows */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] hero-gradient rounded-full blur-3xl pointer-events-none" />
      
      <svg
        viewBox="0 0 800 600"
        className="relative w-full h-full max-w-[800px] drop-shadow-[0_0_30px_rgba(var(--accent),0.1)]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Connection Paths (Wind Paths) */}
        <g className="opacity-20 dark:opacity-30">
          <path
            d="M400 300C400 300 550 150 650 200"
            stroke="var(--celestial-1)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeDasharray="4 8"
            className="animate-celestial-drift"
          />
          <path
            d="M400 300C400 300 250 150 150 200"
            stroke="var(--celestial-2)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeDasharray="4 8"
            className="animate-celestial-drift"
            style={{ animationDirection: "reverse" }}
          />
          <path
            d="M400 300C400 300 550 450 650 400"
            stroke="var(--celestial-3)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeDasharray="4 8"
            className="animate-celestial-drift"
          />
          <path
            d="M400 300C400 300 250 450 150 400"
            stroke="var(--celestial-1)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeDasharray="4 8"
            className="animate-celestial-drift"
            style={{ animationDirection: "reverse" }}
          />
        </g>

        {/* Central Core (Zephyr Nexus) */}
        <g className="animate-celestial-float">
          <circle
            cx="400"
            cy="300"
            r="60"
            fill="url(#coreGradient)"
            className="opacity-80 dark:opacity-40"
          />
          <circle
            cx="400"
            cy="300"
            r="80"
            stroke="var(--accent)"
            strokeWidth="1"
            strokeDasharray="2 4"
            className="animate-spin"
            style={{ animationDuration: "20s" }}
          />
          <circle
            cx="400"
            cy="300"
            r="40"
            fill="var(--accent)"
            className="animate-celestial-pulse"
          />
        </g>

        {/* Distributed Nodes (Spirits) */}
        <g>
          {/* Top Right */}
          <g className="animate-celestial-float" style={{ animationDelay: "-1s" }}>
            <circle cx="650" cy="200" r="12" fill="var(--celestial-1)" className="opacity-60" />
            <circle cx="650" cy="200" r="20" stroke="var(--celestial-1)" strokeWidth="0.5" strokeDasharray="2 2" />
          </g>
          {/* Top Left */}
          <g className="animate-celestial-float" style={{ animationDelay: "-2.5s" }}>
            <circle cx="150" cy="200" r="10" fill="var(--celestial-2)" className="opacity-60" />
            <circle cx="150" cy="200" r="18" stroke="var(--celestial-2)" strokeWidth="0.5" strokeDasharray="2 2" />
          </g>
          {/* Bottom Right */}
          <g className="animate-celestial-float" style={{ animationDelay: "-4s" }}>
            <circle cx="650" cy="400" r="14" fill="var(--celestial-3)" className="opacity-60" />
            <circle cx="650" cy="400" r="22" stroke="var(--celestial-3)" strokeWidth="0.5" strokeDasharray="2 2" />
          </g>
          {/* Bottom Left */}
          <g className="animate-celestial-float" style={{ animationDelay: "-1.8s" }}>
            <circle cx="150" cy="400" r="8" fill="var(--celestial-1)" className="opacity-60" />
            <circle cx="150" cy="400" r="16" stroke="var(--celestial-1)" strokeWidth="0.5" strokeDasharray="2 2" />
          </g>
        </g>

        <defs>
          <radialGradient id="coreGradient" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(400 300) rotate(90) scale(60)">
            <stop stopColor="var(--accent)" />
            <stop offset="1" stopColor="var(--celestial-2)" stopOpacity="0" />
          </radialGradient>
        </defs>
      </svg>
      
      {/* Floating Particles */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute h-1 w-1 rounded-full bg-accent/40 animate-celestial-pulse"
            style={{
              top: `${20 + Math.random() * 60}%`,
              left: `${20 + Math.random() * 60}%`,
              animationDelay: `${i * 0.8}s`,
              animationDuration: `${3 + Math.random() * 3}s`
            }}
          />
        ))}
      </div>
    </div>
  );
};
