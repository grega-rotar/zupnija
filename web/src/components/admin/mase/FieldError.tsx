/** Validation messages the actions return for a form field (shown under it instead of as a toast). */
const FIELD_MESSAGES = ["Vpišite, za koga je namen.", "Največ 200 znakov."];

export const fieldOf = (error: string) => FIELD_MESSAGES.includes(error);

/** The message under a `.field` control, in the alert colour. */
export function FieldError({ id, text }: { id?: string; text?: string }) {
  if (!text) return null;
  return (
    <small id={id} role="alert" style={{ color: "var(--alert)", fontWeight: 600 }}>
      {text}
    </small>
  );
}
