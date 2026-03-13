import { createMemo } from "solid-js";

interface Props {
  date: string | null;
}

export default function ExpirationBadge(props: Props) {
  const status = createMemo(() => {
    if (!props.date) return null;
    // Compare date-only (strip time) to avoid timezone/hour issues
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exp = new Date(props.date + "T00:00:00");
    exp.setHours(0, 0, 0, 0);
    const days = Math.round((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    // She works Mon/Wed/Fri. On each work day, flag items expiring before the next work day as urgent.
    // Mon(1)->next Wed: Tue(1d). Wed(3)->next Fri: Thu(1d). Fri(5)->next Mon: Sat/Sun(1-2d).
    const dow = today.getDay();
    const urgentDays = dow === 1 ? 1 : dow === 3 ? 1 : dow === 5 ? 2 : 0;
    const isUrgent = days >= 0 && days <= urgentDays;
    if (days < 0) return { label: "Expired", color: "bg-danger text-white" };
    if (days === 0 || isUrgent) return { label: days === 0 ? "Expires today" : `${days}d left`, color: "bg-danger-light text-danger" };
    if (days <= 2) return { label: `${days}d left`, color: "bg-danger-light text-danger" };
    if (days <= 5) return { label: `${days}d left`, color: "bg-warning-light text-warning" };
    return { label: `${days}d left`, color: "bg-success-light text-success" };
  });

  return (
    <>
      {status() && (
        <span
          class={`text-xs px-2.5 py-1 rounded-full font-semibold ${status()!.color}`}
          role="status"
          aria-label={`Expiration status: ${status()!.label}`}
        >
          {status()!.label}
        </span>
      )}
    </>
  );
}
