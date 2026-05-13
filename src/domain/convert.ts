export function secondsToHours(seconds: number): number {
  return seconds / 3600;
}

export function hoursToDays(hours: number, hoursPerDay: number): number {
  if (hoursPerDay <= 0) {
    throw new Error(`hoursPerDay must be > 0, got ${hoursPerDay}`);
  }
  return Math.round((hours / hoursPerDay) * 100) / 100;
}
