<?php
/**
 * API d'enregistrement web des visiteurs (JSON).
 *  - POST api.php?action=submit  { firstName, lastName, company, phone, email, objet, details, website }
 *
 * Public (aucune authentification) : un visiteur renseigne directement sa visite.
 * Insère dans `Visitor` avec source='QR', date/heure automatiques.
 */

// N'affiche jamais les warnings/notices PHP dans la réponse (sinon le JSON est
// corrompu → « Serveur injoignable » côté client). Les erreurs restent journalisées.
ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
require __DIR__ . '/db.php';

$action = $_GET['action'] ?? '';
$body   = json_decode(file_get_contents('php://input'), true) ?: [];

function out($arr) { echo json_encode($arr); exit; }

try {
  if ($action === 'submit') {
    // Anti-spam : champ piège « website » (rempli uniquement par des bots).
    if (!empty($body['website'])) out(['ok' => true]); // ignore silencieusement

    $firstName = trim((string)($body['firstName'] ?? ''));
    $lastName  = mb_strtoupper(trim((string)($body['lastName'] ?? '')), 'UTF-8');
    $company   = trim((string)($body['company'] ?? ''));
    $phone     = trim((string)($body['phone'] ?? ''));
    $email     = trim((string)($body['email'] ?? ''));
    $objet     = trim((string)($body['objet'] ?? ''));
    $details   = trim((string)($body['details'] ?? ''));

    if ($firstName === '' || $lastName === '' || $objet === '' || $phone === '') {
      out(['ok' => false, 'error' => 'Nom, prénoms, contacts et objet de visite sont obligatoires.']);
    }
    if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
      out(['ok' => false, 'error' => 'Adresse e-mail invalide.']);
    }

    $uuid = 'c' . bin2hex(random_bytes(12));
    $st = db()->prepare(
      'INSERT INTO `Visitor` (uuid, firstName, lastName, company, phone, email, objet, details, visitedAt, source, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(3), "QR", NOW(3), NOW(3))'
    );
    $st->execute([
      $uuid, $firstName, $lastName,
      $company !== '' ? $company : null,
      $phone   !== '' ? $phone   : null,
      $email   !== '' ? $email   : null,
      $objet,
      $details !== '' ? $details : null,
    ]);

    out(['ok' => true, 'message' => 'Votre visite a bien été enregistrée. Merci !']);
  }

  out(['ok' => false, 'error' => 'Action inconnue.']);
} catch (Throwable $e) {
  out(['ok' => false, 'error' => 'Erreur serveur.']);
}
