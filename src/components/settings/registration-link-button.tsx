"use client";
import { useRef, useState } from "react";
import { Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShareRegistrationDialog } from "@/components/registrations/share-registration-dialog";

/** Opens the existing "Send registration link" dialog (the same one as Students → Add student). */
export function RegistrationLinkButton({ clubId, clubName, branches }: { clubId: string; clubName: string; branches: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const close = () => { setOpen(false); requestAnimationFrame(() => buttonRef.current?.focus()); };
  return (
    <>
      <Button ref={buttonRef} type="button" variant="outline" size="sm" onClick={() => setOpen(true)} aria-haspopup="dialog"><Link2 size={15} aria-hidden /> Send registration link</Button>
      {open && <ShareRegistrationDialog clubId={clubId} clubName={clubName} branches={branches} onClose={close} />}
    </>
  );
}
