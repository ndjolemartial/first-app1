/** Utilitaires d'arborescence et de formatage pour la GED. */

/** Formate une taille en octets de façon lisible (Ko, Mo, Go). */
export function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return '0 o';
  const units = ['o', 'Ko', 'Mo', 'Go', 'To'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Groupe lisible d'un type MIME, avec libellé et variante de badge. */
export function mimeGroup(mime: string): { key: string; label: string } {
  if (mime === 'application/pdf') return { key: 'PDF', label: 'PDF' };
  if (mime.startsWith('image/')) return { key: 'IMAGE', label: 'Image' };
  if (mime.startsWith('video/')) return { key: 'VIDEO', label: 'Vidéo' };
  if (mime.startsWith('audio/')) return { key: 'AUDIO', label: 'Audio' };
  if (/word|excel|spreadsheet|presentation|officedocument/.test(mime)) return { key: 'OFFICE', label: 'Bureautique' };
  return { key: 'AUTRE', label: 'Autre' };
}


export interface HierItem {
  id: number;
  name: string;
  parentId: number | null;
}

/**
 * Construit une liste d'options `<Select>` à plat, en indentant les
 * éléments enfants pour refléter la hiérarchie.
 */
export function hierOptions(
  flat: HierItem[],
  placeholder: string,
): { value: string; label: string }[] {
  const byParent = new Map<number, HierItem[]>();
  flat.forEach((x) => {
    const p = x.parentId ?? 0;
    if (!byParent.has(p)) byParent.set(p, []);
    byParent.get(p)!.push(x);
  });
  const out = [{ value: '', label: placeholder }];
  const walk = (parentId: number, depth: number) => {
    (byParent.get(parentId) ?? []).forEach((x) => {
      out.push({
        value: String(x.id),
        label: `${'   '.repeat(depth)}${depth ? '└ ' : ''}${x.name}`,
      });
      walk(x.id, depth + 1);
    });
  };
  walk(0, 0);
  return out;
}
