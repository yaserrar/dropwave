/**
 * Grid lines fading out from the top, plus the aurora glow rising behind the main
 * content. The glow is wider than a phone, so pages clip it with `overflow-clip`:
 * `overflow-hidden` would make the page a scroll container that focusing a field
 * can scroll sideways, with no way back.
 */
export function PageBackground() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      <div className="bg-grid-lines absolute inset-0 opacity-70 mask-[radial-gradient(ellipse_60%_50%_at_50%_20%,black,transparent_75%)]" />
      <div className="animate-aurora-rise absolute top-75 left-1/2 h-115 w-[min(1000px,150%)]">
        <div className="aurora animate-aurora-drift size-full rounded-full" />
      </div>
    </div>
  );
}
