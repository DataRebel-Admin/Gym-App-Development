"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { LifeBuoy } from "@/components/ui/icons";
import {
  ContactSupportModal,
  type SupportInitial,
} from "@/components/support/contact-support-modal";

/** Knop die de "Contact opnemen"-modal opent (o.a. op de instellingenpagina). */
export function ContactSupportButton({ initial }: { initial: SupportInitial }) {
  const t = useTranslations("owner.support");
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" onClick={() => setOpen(true)} className="self-start">
        <LifeBuoy size={16} /> {t("openButton")}
      </Button>
      <ContactSupportModal
        open={open}
        onClose={() => setOpen(false)}
        initial={initial}
      />
    </>
  );
}
