/**
 * A file picked outside the upload page (the Oznanila list, Domov) is handed
 * to /oznanila/nalozi in memory: the picker needs the user's click, so it
 * opens where the button is, and the upload page takes the file on mount.
 */
let picked: File | null = null;

export function handOff(file: File): void {
  picked = file;
}

export function takeHandedOff(): File | null {
  const f = picked;
  picked = null;
  return f;
}

/** The pickers' accept lists (FR-15). */
export const ACCEPT_ANY = "image/jpeg,image/png,image/heic,image/heif,image/webp,application/pdf,.jpg,.jpeg,.png,.heic,.webp,.pdf,.xlsx,.csv,.ods";
export const ACCEPT_PHOTO = "image/*";
