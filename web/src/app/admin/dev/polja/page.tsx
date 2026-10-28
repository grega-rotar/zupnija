/** Development only: the rich text, image and file fields of "Vsebina strani", side by side with their values. */
import { notFound } from "next/navigation";
import { FieldsDemo } from "./FieldsDemo";

export const dynamic = "force-dynamic";

export default function DevFieldsPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <FieldsDemo />;
}
