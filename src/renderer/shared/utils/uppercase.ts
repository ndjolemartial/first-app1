import type { UseFormRegisterReturn } from 'react-hook-form';

/**
 * Force la saisie en majuscules pour un champ React Hook Form (nom, prénom,
 * raison sociale…). À utiliser à la place de `{...register('field')}` :
 *
 *   <Input label="Nom" {...upperField(register('lastName'))} />
 *
 * - met la valeur **stockée** en majuscules à chaque frappe (la donnée
 *   enregistrée en base est donc bien en capitales) ;
 * - affiche le champ en capitales via la classe utilitaire Tailwind
 *   `uppercase` (cohérence visuelle pendant la saisie).
 */
export function upperField(
  field: UseFormRegisterReturn,
): UseFormRegisterReturn & { className: string } {
  return {
    ...field,
    className: 'uppercase',
    onChange: (event) => {
      event.target.value = String(event.target.value ?? '').toUpperCase();
      return field.onChange(event);
    },
  };
}
