import React, { useMemo } from "react";
import { cn } from "../../lib/utils";

interface ConstellationWindFieldProps {
  className?: string;
}

type NodeTier = "anchor" | "mid" | "faint";
interface StarNode {
  cx: number;
  cy: number;
  r: number;
  tier: NodeTier;
  delay: number;
  hue: "blue" | "violet" | "silver";
}

export const ConstellationWindField: React.FC<ConstellationWindFieldProps> = ({ className }) => {
  const windPaths = useMemo(
    () => [
      { d: "M120,146 Q340,78 520,162 T1080,148", delay: "-8s", dur: "38s" },
      { d: "M140,258 Q360,182 560,292 T1120,248", delay: "-2s", dur: "42s" },
      { d: "M150,368 Q410,286 620,396 T1140,352", delay: "-11s", dur: "44s" },
      { d: "M220,482 Q468,386 700,502 T1180,446", delay: "-18s", dur: "48s" },
      { d: "M260,108 Q500,224 740,126 T1160,214", delay: "-4s", dur: "41s" },
    ],
    []
  );

  const arcLines = useMemo(
    () => [
      { d: "M220,188 Q390,136 560,198 T860,170 T1120,202", w: 1.7 },
      { d: "M190,298 Q388,258 578,322 T872,286 T1136,322", w: 1.25, dashed: true },
      { d: "M240,424 Q448,380 628,444 T910,414 T1160,442", w: 1.1, dashed: true },
      { d: "M336,132 Q568,172 762,146 T1080,174", w: 1.15 },
      { d: "M380,514 Q616,402 826,466 T1128,410", w: 0.95, dashed: true },
    ],
    []
  );

  const nodes = useMemo(
    (): StarNode[] => [
      { cx: 560, cy: 202, r: 3.6, tier: "anchor", delay: 0.4, hue: "blue" },
      { cx: 770, cy: 172, r: 3.2, tier: "anchor", delay: 1.2, hue: "silver" },
      { cx: 922, cy: 244, r: 3.8, tier: "anchor", delay: 0.8, hue: "blue" },
      { cx: 1048, cy: 198, r: 3.4, tier: "anchor", delay: 1.8, hue: "violet" },
      { cx: 874, cy: 412, r: 3.1, tier: "anchor", delay: 1.5, hue: "silver" },

      { cx: 434, cy: 184, r: 2.1, tier: "mid", delay: 0.1, hue: "silver" },
      { cx: 626, cy: 318, r: 2.2, tier: "mid", delay: 1.1, hue: "blue" },
      { cx: 736, cy: 290, r: 2.0, tier: "mid", delay: 0.7, hue: "silver" },
      { cx: 860, cy: 298, r: 2.2, tier: "mid", delay: 1.6, hue: "violet" },
      { cx: 978, cy: 332, r: 2.1, tier: "mid", delay: 0.9, hue: "silver" },
      { cx: 1084, cy: 286, r: 2.0, tier: "mid", delay: 2.0, hue: "blue" },
      { cx: 748, cy: 430, r: 2.1, tier: "mid", delay: 2.2, hue: "violet" },
      { cx: 610, cy: 442, r: 1.9, tier: "mid", delay: 1.4, hue: "silver" },
      { cx: 520, cy: 138, r: 1.9, tier: "mid", delay: 0.5, hue: "blue" },

      { cx: 352, cy: 248, r: 1.2, tier: "faint", delay: 0.2, hue: "silver" },
      { cx: 392, cy: 106, r: 1.1, tier: "faint", delay: 1.3, hue: "violet" },
      { cx: 488, cy: 372, r: 1.1, tier: "faint", delay: 0.9, hue: "blue" },
      { cx: 566, cy: 520, r: 1.2, tier: "faint", delay: 1.8, hue: "silver" },
      { cx: 690, cy: 90, r: 1.1, tier: "faint", delay: 2.4, hue: "violet" },
      { cx: 806, cy: 520, r: 1.0, tier: "faint", delay: 2.0, hue: "silver" },
      { cx: 938, cy: 118, r: 1.1, tier: "faint", delay: 0.6, hue: "blue" },
      { cx: 1034, cy: 454, r: 1.2, tier: "faint", delay: 1.7, hue: "silver" },
      { cx: 1142, cy: 160, r: 1.1, tier: "faint", delay: 1.0, hue: "violet" },
      { cx: 1120, cy: 374, r: 1.0, tier: "faint", delay: 2.3, hue: "blue" },
    ],
    []
  );

  const toneColor = (hue: StarNode["hue"]) => {
    if (hue === "blue") return "var(--zephyr-blue)";
    if (hue === "violet") return "var(--violet-soft)";
    return "var(--periwinkle)";
  };

  const tierProps = (tier: NodeTier) => {
    if (tier === "anchor")
      return { opacity: 0.9, haloScale: 4.2, haloOpacity: 0.18, filter: "url(#windGlowStrong)" };
    if (tier === "mid")
      return { opacity: 0.66, haloScale: 2.7, haloOpacity: 0.1, filter: "url(#windGlowSoft)" };
    return { opacity: 0.34, haloScale: 0, haloOpacity: 0, filter: undefined };
  };

  return (
    <div
      className={cn("absolute inset-0 pointer-events-none overflow-hidden", className)}
      style={{
        maskImage:
          "linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,0.1) 16%, rgba(0,0,0,0.68) 32%, rgba(0,0,0,0.96) 50%, #000 100%)",
        WebkitMaskImage:
          "linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,0.1) 16%, rgba(0,0,0,0.68) 32%, rgba(0,0,0,0.96) 50%, #000 100%)",
      }}
    >
      <svg
        viewBox="0 0 1200 600"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        <defs>
          <filter id="windGlowStrong" x="-120%" y="-120%" width="340%" height="340%">
            <feGaussianBlur stdDeviation="4.6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="windGlowSoft" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="2.3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <linearGradient id="windArcTone" x1="220" y1="0" x2="1160" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="var(--periwinkle)" stopOpacity="0.45" />
            <stop offset="48%" stopColor="var(--zephyr-blue)" stopOpacity="0.62" />
            <stop offset="100%" stopColor="var(--violet-soft)" stopOpacity="0.55" />
          </linearGradient>
          <radialGradient id="windFieldAura" cx="62%" cy="44%" r="52%">
            <stop offset="0%" stopColor="var(--zephyr-blue-glow)" stopOpacity="0.55" />
            <stop offset="55%" stopColor="var(--violet-glow)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect x="220" y="56" width="980" height="500" fill="url(#windFieldAura)" opacity="0.34" />

        <g opacity={0.26}>
          {windPaths.map((p, i) => (
            <path
              key={`w${i}`}
              d={p.d}
              stroke="var(--periwinkle)"
              strokeWidth="1.12"
              style={{
                strokeDasharray: "2.2, 8",
                animation: `celestial-drift ${p.dur} linear infinite`,
                animationDelay: p.delay,
              }}
            />
          ))}
        </g>

        <g opacity={0.62}>
          {arcLines.map((a, i) => (
            <path
              key={`a${i}`}
              d={a.d}
              stroke="url(#windArcTone)"
              strokeWidth={a.w}
              style={a.dashed ? { strokeDasharray: "5, 11" } : undefined}
            />
          ))}
        </g>

        {nodes.map((n, i) => {
          const props = tierProps(n.tier);
          const color = toneColor(n.hue);
          return (
            <g
              key={`n${i}`}
              style={{
                animation: `dashboard-subtle-pulse ${n.tier === "anchor" ? 6.2 : n.tier === "mid" ? 7.4 : 9.2}s ease-in-out infinite`,
                animationDelay: `${n.delay.toFixed(2)}s`,
              }}
            >
              {props.haloScale > 0 && (
                <circle
                  cx={n.cx}
                  cy={n.cy}
                  r={n.r * props.haloScale}
                  fill={color}
                  opacity={props.haloOpacity}
                />
              )}
              <circle
                cx={n.cx}
                cy={n.cy}
                r={n.r}
                fill={color}
                filter={props.filter}
                style={{ opacity: props.opacity }}
              />
            </g>
          );
        })}
      </svg>

      <div
        className="absolute top-[8%] right-[6%] h-[58%] w-[56%] rounded-full blur-[120px]"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklab, var(--zephyr-blue-glow) 80%, transparent) 0%, transparent 68%)",
          opacity: 0.48,
        }}
      />
      <div
        className="absolute bottom-[2%] right-[16%] h-[52%] w-[44%] rounded-full blur-[96px]"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklab, var(--violet-glow) 72%, transparent) 0%, transparent 70%)",
          opacity: 0.34,
        }}
      />
      <div
        className="absolute top-[22%] right-[36%] h-[36%] w-[24%] rounded-full blur-[72px]"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklab, var(--periwinkle-dim) 80%, transparent) 0%, transparent 72%)",
          opacity: 0.32,
        }}
      />
    </div>
  );
};
