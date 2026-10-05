import { AlertTriangle, Ban, CalendarClock, CircleCheck, CircleDashed, Clock } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { dueState, type DueState } from "@/lib/fees/display";

const LOOK: Record<DueState["kind"], [typeof Ban, BadgeTone]> = {
  late: [AlertTriangle, "danger"],
  today: [Clock, "warning"],
  partial: [CircleDashed, "warning"],
  upcoming: [CalendarClock, "neutral"],
  paid: [CircleCheck, "success"],
  voided: [Ban, "neutral"],
};

/**
 * Fee status with relative due detail ("4 days late", "Due today", "Partly paid", "Due in 3 days",
 * "Paid", "Voided"): an icon plus text, never colour alone. `today` is the Malaysia date.
 */
export function FeeStatusPill({ fee, today, className }: { fee: { status: string; balance_sen: number; due_date: string }; today: string; className?: string }) {
  const state = dueState(fee, today);
  const [icon, tone] = LOOK[state.kind];
  return <Badge tone={tone} icon={icon} className={className}>{state.label}</Badge>;
}
