interface RecordCountProps {
  count: number;
  total?: number;
  label?: string;
  isFiltered?: boolean;
}

export default function RecordCount({
  count,
  total,
  label = "record",
  isFiltered = false,
}: RecordCountProps) {
  const word = count !== 1 ? `${label}s` : label;
  return (
    <p className="text-xs text-[var(--color-text-muted)]">
      {count} {word}
      {isFiltered && total !== undefined && total !== count
        ? ` found (of ${total} total)`
        : ""}
    </p>
  );
}
