"use client";
import { SelectField, TextField } from "@/components/field";
import { LogoField } from "@/components/clubs/logo-field";
import { malaysianStates } from "@/lib/validation";
import type { Club } from "@/lib/clubs";

type Profile = Partial<Pick<Club, "ros_number" | "sports_commissioner_number" | "ssm_number" | "association" | "address_line1" | "address_line2" | "postcode" | "city" | "state" | "phone" | "email" | "year_founded">>;
const Legend = ({ children }: { children: React.ReactNode }) => <legend className="form-legend">{children}</legend>;

/** Optional club profile fields, shared by onboarding step 2 and Club Settings. */
export function ClubProfileFields({ club, logoSrc }: { club?: Profile; logoSrc?: string | null }) {
  return (
    <>
      <fieldset className="form-section grid gap-5 sm:grid-cols-2">
        <Legend>Registration</Legend>
        <TextField name="ros_number" label="ROS registration no." defaultValue={club?.ros_number} maxLength={50} autoComplete="off" hint="Registrar of Societies" />
        <TextField name="sports_commissioner_number" label="Sports Commissioner registration no." defaultValue={club?.sports_commissioner_number} maxLength={50} autoComplete="off" />
        <TextField name="ssm_number" label="SSM registration no." defaultValue={club?.ssm_number} maxLength={50} autoComplete="off" />
        <TextField name="year_founded" label="Year founded" defaultValue={club?.year_founded?.toString()} inputMode="numeric" pattern="\d{4}" maxLength={4} placeholder="e.g. 1998" />
        <div className="sm:col-span-2"><TextField name="association" label="Parent association / affiliation" defaultValue={club?.association} maxLength={120} /></div>
      </fieldset>
      <fieldset className="form-section grid gap-5 sm:grid-cols-2">
        <Legend>Address</Legend>
        <div className="sm:col-span-2"><TextField name="address_line1" label="Address line 1" defaultValue={club?.address_line1} maxLength={200} autoComplete="address-line1" /></div>
        <div className="sm:col-span-2"><TextField name="address_line2" label="Address line 2" defaultValue={club?.address_line2} maxLength={200} autoComplete="address-line2" /></div>
        <TextField name="postcode" label="Postcode" defaultValue={club?.postcode} inputMode="numeric" pattern="\d{5}" maxLength={5} autoComplete="postal-code" />
        <TextField name="city" label="City" defaultValue={club?.city} maxLength={100} autoComplete="address-level2" />
        <div className="sm:col-span-2"><SelectField name="state" label="State" defaultValue={club?.state} options={[{ value: "", label: "Select a state or federal territory" }, ...malaysianStates]} /></div>
      </fieldset>
      <fieldset className="form-section grid gap-5 sm:grid-cols-2">
        <Legend>Contact</Legend>
        <TextField name="phone" label="Phone" type="tel" defaultValue={club?.phone} maxLength={20} autoComplete="tel" hint="e.g. 03-2161 2345 or 012-345 6789" />
        <TextField name="email" label="Email" type="email" defaultValue={club?.email} maxLength={254} autoComplete="email" />
      </fieldset>
      <fieldset className="form-section">
        <Legend>Logo</Legend>
        <LogoField currentSrc={logoSrc} />
      </fieldset>
    </>
  );
}
