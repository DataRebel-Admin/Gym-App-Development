import { cn } from "@/lib/cn";

/**
 * Compacte trend-lijn (inline SVG, server-compatibel — geen recharts-overhead).
 * Tekent een vloeiende lijn met een zachte accent-fill eronder. Bedoeld voor
 * mini-trends in kaarten (weekvolume, progressie).
 */
export function Sparkline({
  data,
  width = 120,
  height = 36,
  strokeWidth = 2,
  className,
  fill = true,
}: {
  data: number[];
  width?: number;
  height?: number;
  strokeWidth?: number;
  className?: string;
  fill?: boolean;
}) {
  if (data.length < 2) {
    return (
      <svg
        width={width}
        height={height}
        className={className}
        role="img"
        aria-hidden
      />
    );
  }

  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const pad = strokeWidth;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;

  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * innerW;
    const y = pad + innerH - ((v - min) / span) * innerH;
    return [x, y] as const;
  });

  const line = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${points[points.length - 1][0].toFixed(1)} ${height} L${points[0][0].toFixed(1)} ${height} Z`;
  const gid = `spark-${data.length}-${Math.round(max)}-${Math.round(min)}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("overflow-visible", className)}
      role="img"
      aria-hidden
    >
      {fill ? (
        <>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--tenant-accent)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--tenant-accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#${gid})`} stroke="none" />
        </>
      ) : null}
      <path
        d={line}
        fill="none"
        stroke="var(--tenant-accent)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
