<?php
/**
 * Pixel de suivi d'ouverture des emails.
 *
 * Déposé avec l'app web `web/` sur le serveur (Apache / XAMPP / WAMP), connecté
 * à la même base MariaDB. Le corps HTML des emails sortants contient une balise
 * <img> pointant vers ce script avec l'identifiant du message (?c=<id>). Quand le
 * destinataire ouvre l'email et que l'image se charge, on horodate la première
 * ouverture (`Communication.openedAt`) puis on renvoie un GIF transparent 1×1.
 *
 * URL à renseigner dans l'application : Paramètres/Communication → « URL de suivi
 * d'ouverture » = http://<serveur>/<dossier-web>/track.php
 */

require __DIR__ . '/db.php';

// Enregistre l'ouverture (première fois seulement) — silencieux en cas d'erreur.
$id = isset($_GET['c']) ? (int) $_GET['c'] : 0;
if ($id > 0) {
  try {
    $st = db()->prepare(
      'UPDATE `Communication` SET `openedAt` = NOW(3) '
      . "WHERE `id` = ? AND `channel` = 'EMAIL' AND `openedAt` IS NULL"
    );
    $st->execute([$id]);
  } catch (Throwable $e) {
    // On n'interrompt jamais le rendu du pixel pour une erreur de suivi.
  }
}

// GIF transparent 1×1 — en-têtes anti-cache pour capter chaque ouverture.
header('Content-Type: image/gif');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Content-Length: 43');
echo base64_decode('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');
