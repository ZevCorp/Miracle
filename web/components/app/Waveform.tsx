// Onda de audio decorativa (CSS). `active` anima las barras.
const BARS = [
  0.3, 0.6, 0.45, 0.8, 0.55, 0.95, 0.4, 0.7, 0.5, 0.85, 0.35, 0.65, 0.9, 0.5,
  0.75, 0.4, 0.6, 0.3, 0.7, 0.5, 0.8, 0.45, 0.6, 0.35, 0.7, 0.55, 0.9, 0.4,
  0.65, 0.5,
];

export function Waveform({
  active = true,
  className = "",
}: {
  active?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`flex h-12 items-center gap-[3px] ${className}`}
      aria-hidden
    >
      {BARS.map((h, i) => (
        <span
          key={i}
          className="w-[3px] rounded-full bg-accent/70"
          style={{
            height: `${Math.round(h * 100)}%`,
            animation: active
              ? `wave 1.1s ease-in-out ${i * 0.045}s infinite alternate`
              : "none",
            opacity: active ? 1 : 0.4,
          }}
        />
      ))}
      <style>{`@keyframes wave { from { transform: scaleY(0.35); } to { transform: scaleY(1); } }`}</style>
    </div>
  );
}
