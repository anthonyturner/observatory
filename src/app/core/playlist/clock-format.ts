/** A time on the bar, as "m:ss", or "h:mm:ss" from an hour: 0:07, 4:25, 1:02:09. */
export function clockOf(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const secs = String(whole % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${secs}` : `${minutes}:${secs}`;
}

/** The same time in words, for a screen reader: "1 hour 2 minutes 9 seconds". */
export function spokenClockOf(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const parts = [
    [Math.floor(whole / 3600), 'hour'],
    [Math.floor((whole % 3600) / 60), 'minute'],
    [whole % 60, 'second'],
  ] as const;
  const said = parts
    .filter(([count]) => count > 0)
    .map(([count, unit]) => `${count} ${unit}${count === 1 ? '' : 's'}`);
  return said.length > 0 ? said.join(' ') : '0 seconds';
}
