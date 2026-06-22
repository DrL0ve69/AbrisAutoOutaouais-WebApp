/**
 * Conversion PURE et testable entre minutes-depuis-minuit (le format canonique stocké côté serveur,
 * en fuseau LOCAL — L-044) et la valeur `HH:mm` d'un `<input type="time">`. Aucun accès au DOM.
 */

/** Minutes depuis minuit (0–1439) → « HH:mm ». `null`/hors plage → chaîne vide (champ non rempli). */
export function minutesToHhmm(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return '';
  if (!Number.isInteger(minutes) || minutes < 0 || minutes >= 24 * 60) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** « HH:mm » → minutes depuis minuit. Vide/invalide → `null` (« non précisé »). */
export function hhmmToMinutes(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}
