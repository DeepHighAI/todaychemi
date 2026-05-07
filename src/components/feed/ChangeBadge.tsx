interface ChangeBadgeProps {
  significant: boolean;
  changeScore: number;
}

export function ChangeBadge({ significant, changeScore }: ChangeBadgeProps) {
  if (!significant) return null;

  const formatted = changeScore > 0 ? `+${changeScore}` : `${changeScore}`;

  return (
    <span
      data-testid="change-badge"
      className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800"
    >
      변화 큰 {formatted}
    </span>
  );
}
