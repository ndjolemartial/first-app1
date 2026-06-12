"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedDefaultAttestationTemplate = seedDefaultAttestationTemplate;
const db_service_1 = require("./db.service");
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Modèle d'attestation de SOLDE par défaut.
 *
 * Conçu pour fonctionner à la fois pour :
 *   - une attestation liée à une convention de souscription ;
 *   - une attestation de solde « héritée » (échéances sans convention,
 *     rattachées directement au client + terrain).
 *
 * Les mentions propres à la convention sont placées dans des blocs
 * conditionnels `{{#si convention.reference}}…{{sinon}}…{{/si}}` afin que le
 * même modèle reste correct lorsque la convention est absente (cas hérité).
 *
 * Contrainte du moteur de conditions : les blocs `{{#si}}` ne s'imbriquent pas
 * (une seule profondeur) — ce corps n'en imbrique aucun.
 */
const DEFAULT_SOLDE_BODY = `
<h1 style="text-align:center;">ATTESTATION DE SOLDE</h1>
<p style="text-align:right;">Référence : {{attestation.reference}}</p>

<p>Je soussigné(e), agissant pour le compte de la société, atteste par la présente que :</p>

<p><strong>{{client.civilite}} {{client.nomComplet}}</strong>{{#si client.pieceIdentite}}, titulaire de la pièce d'identité {{client.typePieceIdentite}} n° {{client.pieceIdentite}}{{/si}}{{#si client.adresse}}, demeurant à {{client.adresse}}{{/si}}{{#si client.ville}} — {{client.ville}}{{/si}} ({{client.pays}}),</p>

<p>a intégralement réglé le montant de la souscription portant sur la parcelle de terrain ci-après désignée :</p>

<ul>
  <li>Référence du terrain : {{terrain.reference}}</li>
  <li>Îlot {{terrain.ilot}} — Parcelle {{terrain.parcelle}}</li>
  <li>Superficie : {{terrain.superficie}} m² ({{terrain.superficie.enLettres}} mètres carrés)</li>
  <li>Lotissement : {{lotissement.nom}}{{#si lotissement.commune}}, {{lotissement.commune}}{{/si}} — {{lotissement.ville}}</li>
  {{#si terrain.titreFoncier}}<li>Titre foncier : {{terrain.titreFoncier}}</li>{{/si}}
  {{#si lotissement.natureTitre}}<li>Nature du titre : {{lotissement.natureTitre}}</li>{{/si}}
  {{#si lotissement.numeroTitre}}<li>Numéro du titre : {{lotissement.numeroTitre}}</li>{{/si}}
</ul>

<p>Montant total réglé : <strong>{{attestation.montant}}</strong> ({{attestation.montant.enLettres}}).</p>

{{#si convention.reference}}<p>Cette souscription fait l'objet de la convention <strong>{{convention.reference}}</strong>.</p>{{sinon}}<p>Le présent solde résulte des versements échelonnés enregistrés au profit du bénéficiaire (souscription antérieure, sans convention signée).</p>{{/si}}

<p>En conséquence, {{client.civilite}} {{client.nomComplet}} est à jour de l'intégralité de ses obligations financières relatives à ladite parcelle. La présente attestation est délivrée pour servir et valoir ce que de droit.</p>

{{#si attestation.notes}}<p>{{attestation.notes}}</p>{{/si}}

<p style="margin-top:24px;">Fait à {{lotissement.ville}}, le {{attestation.dateEmission}}.</p>
<p style="margin-top:40px;">{{agent.nomComplet}}</p>
`.trim();
/**
 * Crée le modèle d'attestation de SOLDE par défaut s'il n'en existe AUCUN.
 * Idempotent et non destructif : si un modèle SOLDE existe déjà (même
 * personnalisé), on ne touche à rien — l'utilisateur reste maître de ses
 * modèles. Exécuté au démarrage (fire-and-forget).
 */
async function seedDefaultAttestationTemplate() {
    const db = (0, db_service_1.getDb)();
    const existing = await db.attestationTemplate.findFirst({
        where: { type: 'SOLDE', deletedAt: null },
        select: { id: true },
    });
    if (existing)
        return; // un modèle SOLDE existe déjà → on ne modifie rien
    await db.attestationTemplate.create({
        data: {
            name: 'Attestation de solde (par défaut)',
            type: 'SOLDE',
            body: DEFAULT_SOLDE_BODY,
            isActive: true,
            isDefault: true,
        },
    });
    logger_1.default.info('Default SOLDE attestation template created');
}
