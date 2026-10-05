import "server-only";
import { clubClient } from "@/lib/clubs";
import { monthGrid, type ClassSession } from "@/lib/classes-shared";

// The weekly pattern (if any) is embedded in the same request for the details view.
const SESSION_COLUMNS = "id, name, branch_id, session_date, start_time, end_time, instructor_name, notes, status, series_id, series:class_series!class_sessions_club_id_series_id_fkey(weekdays, start_date, end_date)";
/** Upper bound for one visible month grid (six weeks); far above a normal club schedule. */
const GRID_LIMIT = 1500;

/**
 * Class sessions for the visible month grid (Monday-first weeks, so leading/trailing days of the
 * neighbouring months are included), ordered by date and start time. Scoped to the club (and RLS)
 * and optionally to one branch. `branchId` must already be a validated uuid or "".
 */
export async function listClassSessions(clubId: string, month: string, branchId = "") {
  const { db } = await clubClient(clubId);
  const { start, end } = monthGrid(month);
  let query = db.from("class_sessions").select(SESSION_COLUMNS).eq("club_id", clubId).gte("session_date", start).lte("session_date", end)
    .order("session_date").order("start_time").order("name").limit(GRID_LIMIT + 1);
  if (branchId) query = query.eq("branch_id", branchId);
  const { data, error } = await query;
  if (error) throw new Error("Unable to load classes.");
  return { sessions: data.slice(0, GRID_LIMIT) satisfies ClassSession[], limited: data.length > GRID_LIMIT };
}
