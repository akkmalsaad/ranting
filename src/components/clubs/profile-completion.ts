import type { Club } from "@/lib/clubs";

/** Optional club-profile checklist (Dashboard banner and Settings summary use the same items). */
export function profileChecklist(club: Club) {
  return [
    { label: "Registration", done: !!(club.ros_number || club.sports_commissioner_number || club.ssm_number) },
    { label: "Affiliation", done: !!club.association },
    { label: "Address", done: !!(club.address_line1 && club.postcode && club.city && club.state) },
    { label: "Contact", done: !!(club.phone || club.email) },
    { label: "Year founded", done: !!club.year_founded },
    { label: "Logo", done: !!club.logo_path },
  ];
}
