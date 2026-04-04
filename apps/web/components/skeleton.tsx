type SkeletonProps = {
  className?: string;
  width?: string;
  height?: string;
};

export function Skeleton({ className, width, height }: SkeletonProps) {
  return (
    <div
      className={`skeleton-shimmer rounded-sm ${className ?? ""}`}
      style={{ width: width ?? "100%", height: height ?? "1rem" }}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="border-2 border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <Skeleton height="1.25rem" width="60%" />
      <Skeleton height="0.875rem" width="40%" className="mt-3" />
      <Skeleton height="0.75rem" width="80%" className="mt-4" />
      <Skeleton height="0.75rem" width="70%" className="mt-2" />
    </div>
  );
}

export function SkeletonLine({ width = "100%" }: { width?: string }) {
  return <Skeleton height="0.875rem" width={width} />;
}
