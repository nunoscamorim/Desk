const timeFormatter = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
const timeWithSecondsFormatter = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

export function formatTime(value: string) {
  return timeFormatter.format(new Date(value));
}

export function formatTimeWithSeconds(value: string) {
  return timeWithSecondsFormatter.format(new Date(value));
}

export function formatDuration(milliseconds: number) {
  const seconds = Math.floor(milliseconds / 1_000);
  if (seconds >= 60 * 60) {
    const hours = Math.floor(seconds / (60 * 60));
    const minutes = Math.floor((seconds % (60 * 60)) / 60);
    return `${hours}h${String(minutes).padStart(2, "0")}m`;
  }
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
