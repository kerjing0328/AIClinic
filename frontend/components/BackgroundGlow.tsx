// components/BackgroundGlow.tsx
// Fixed background layer: grain texture + animated radial glows.
export default function BackgroundGlow() {
  return (
    <>
      <div className="glow glow-1" aria-hidden />
      <div className="glow glow-2" aria-hidden />
      <div className="glow glow-3" aria-hidden />
    </>
  );
}
