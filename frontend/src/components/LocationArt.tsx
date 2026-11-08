export function LocationArt({ name }: { name: string }) {
  return (
    <div className="location-art-placeholder" aria-hidden="true" data-location={name}>
      <span>✦</span>
    </div>
  );
}
