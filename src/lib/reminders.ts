import type { Reminder } from '@/types/workout'

const WEEK_MS = 7 * 86_400_000

export function isReminderActive(r: Reminder, now: number): boolean {
  return !r.completed && now >= Math.max(r.dueAt, r.snoozedUntil ?? 0)
}

// When the reminder next shows up (or showed up, if it's active)
export function reminderShowsAt(r: Reminder): number {
  return Math.max(r.dueAt, r.snoozedUntil ?? 0)
}

// Occurrence the schedule is on at `now`: the start if it's still ahead (or a one-off),
// otherwise the latest repeat that has already passed, so it shows right away
export function currentOccurrence(startAt: number, repeatWeeks: number | undefined, now: number): number {
  if (!repeatWeeks || startAt > now) return startAt
  const interval = repeatWeeks * WEEK_MS
  return startAt + Math.floor((now - startAt) / interval) * interval
}

// "Done": repeating reminders jump to their next future occurrence, one-offs are finished
export function completeReminder(r: Reminder, now: number): Partial<Reminder> {
  if (!r.repeatWeeks) return { completed: true, snoozedUntil: undefined }
  const interval = r.repeatWeeks * WEEK_MS
  const k = Math.floor((now - r.startAt) / interval) + 1
  return { dueAt: r.startAt + Math.max(1, k) * interval, snoozedUntil: undefined }
}

// "Snooze 1 week": only delays this occurrence; the repeat schedule stays anchored to startAt
export function snoozeReminder(now: number): Partial<Reminder> {
  return { snoozedUntil: now + WEEK_MS }
}

// <input type="datetime-local"> works in local time without a timezone suffix
export function toLocalInput(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function fromLocalInput(value: string): number | null {
  const ms = new Date(value).getTime()
  return isNaN(ms) ? null : ms
}

export function formatReminderDate(ms: number): string {
  return new Date(ms).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}
