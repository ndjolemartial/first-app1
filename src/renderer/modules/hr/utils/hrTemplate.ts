// Variables insérables dans les modèles de contrats de travail (corps éditable).
// Doivent correspondre aux tokens fournis par contract-template.service.ts.

interface TemplateVariable { token: string; label: string }
interface VariableGroup { group: string; items: TemplateVariable[] }

export const CONTRACT_VARIABLE_GROUPS: VariableGroup[] = [
  {
    group: 'Entreprise',
    items: [
      { token: 'entreprise.nom', label: 'Nom de l\'entreprise' },
      { token: 'entreprise.rccm', label: 'RCCM' },
      { token: 'entreprise.contribuable', label: 'Compte contribuable' },
      { token: 'entreprise.adresse', label: 'Adresse' },
      { token: 'entreprise.telephone', label: 'Téléphone' },
    ],
  },
  {
    group: 'Employé',
    items: [
      { token: 'employe.civilite', label: 'Civilité' },
      { token: 'employe.nomComplet', label: 'Nom complet' },
      { token: 'employe.nom', label: 'Nom' },
      { token: 'employe.prenoms', label: 'Prénoms' },
      { token: 'employe.dateNaissance', label: 'Date de naissance' },
      { token: 'employe.lieuNaissance', label: 'Lieu de naissance' },
      { token: 'employe.nationalite', label: 'Nationalité' },
      { token: 'employe.adresse', label: 'Adresse' },
      { token: 'employe.pieceIdentite', label: 'Pièce d\'identité' },
      { token: 'employe.cnps', label: 'N° CNPS' },
      { token: 'employe.matricule', label: 'Matricule' },
    ],
  },
  {
    group: 'Contrat',
    items: [
      { token: 'contrat.reference', label: 'Référence' },
      { token: 'contrat.typeLibelle', label: 'Type de contrat' },
      { token: 'contrat.poste', label: 'Poste' },
      { token: 'contrat.categorie', label: 'Catégorie' },
      { token: 'contrat.dateDebut', label: 'Date de début' },
      { token: 'contrat.dateFin', label: 'Date de fin' },
      { token: 'contrat.finEssai', label: 'Fin de période d\'essai' },
      { token: 'contrat.heuresHebdo', label: 'Heures hebdomadaires' },
      { token: 'contrat.salaireBase', label: 'Salaire de base' },
    ],
  },
  {
    group: 'Divers',
    items: [
      { token: 'lieu', label: 'Lieu (ville)' },
      { token: 'date.aujourdhui', label: 'Date du jour' },
    ],
  },
];
