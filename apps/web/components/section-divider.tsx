type SectionDividerProps = {
  className?: string;
};

export function SectionDivider({ className }: SectionDividerProps) {
  return (
    <div
      className={`halftone-band my-12 ${className ?? ""}`}
      role="separator"
      aria-hidden="true"
    />
  );
}
