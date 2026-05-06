export function todayKST(): string {
  const now = new Date(Date.now() + 9 * 3600 * 1000);
  return now.toISOString().slice(0, 10);
}

export function yesterdayKST(): string {
  const now = new Date(Date.now() + 9 * 3600 * 1000 - 86400 * 1000);
  return now.toISOString().slice(0, 10);
}
