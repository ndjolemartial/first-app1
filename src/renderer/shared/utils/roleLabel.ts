/**
 * Libellé affiché pour un rôle utilisateur. La valeur technique (base de
 * données, contrôles de permissions) reste READONLY — seul le texte montré
 * à l'écran est « WELCOME ».
 */
export function roleLabel(role: string | null | undefined): string {
  if (!role) return '';
  return role === 'READONLY' ? 'WELCOME' : role;
}
