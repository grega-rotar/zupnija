import type { Giving } from "@/lib/giving/donations";
import { FactList } from "@/components/ui/primitives";

/** The bank details as a fact list: /daruj and /kontakt show the same rows. */
export function BankDetails({ giving, className }: { giving: Giving; className?: string }) {
  return (
    <FactList
      className={className}
      items={[
        { label: "Prejemnik", value: giving.recipient },
        { label: "IBAN", value: <span className="tnum whitespace-nowrap font-semibold">{giving.ibanGrouped}</span> },
        { label: "BIC", value: giving.bic },
        { label: "Sklic", value: giving.reference },
        { label: "Namen", value: giving.purpose },
      ]}
    />
  );
}
