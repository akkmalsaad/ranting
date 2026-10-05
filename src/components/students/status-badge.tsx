import { Archive, CircleCheck, CircleMinus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/** Student status with an icon and text, never colour alone. Used by the list and the profile. */
export function StatusBadge({ status, archived }: { status: string; archived: boolean }) {
  if (archived) return <Badge icon={Archive}>Archived</Badge>;
  return status === "active" ? <Badge tone="success" icon={CircleCheck}>Active</Badge> : <Badge tone="warning" icon={CircleMinus}>Inactive</Badge>;
}
