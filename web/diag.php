<?php
/**
 * Diagnostic du pointage web (À SUPPRIMER après usage).
 * Ouvrir dans un navigateur : http://<serveur>/pointage/diag.php
 * Indique la version PHP, la présence de PDO MySQL et l'état de la connexion BD.
 */
// Affiche les erreurs réelles (au lieu de la 500 générique) pour le diagnostic.
ini_set('display_errors', '1');
ini_set('display_startup_errors', '1');
error_reporting(E_ALL);
header('Content-Type: text/plain; charset=utf-8');
$out = [
  'php_version'   => PHP_VERSION,
  'sapi'          => PHP_SAPI,
  'pdo_mysql'     => extension_loaded('pdo_mysql'),
  'config_exists' => file_exists(__DIR__ . '/config.php'),
  'db'            => null,
  'db_error'      => null,
  'visitObject_or_user' => null,
];
try {
  $cfg = require __DIR__ . '/config.php';
  $d = $cfg['db'];
  $out['db_target'] = $d['host'] . ':' . $d['port'] . '/' . $d['name'] . ' (user=' . $d['user'] . ')';
  $dsn = "mysql:host={$d['host']};port={$d['port']};dbname={$d['name']};charset=utf8mb4";
  $pdo = new PDO($dsn, $d['user'], $d['pass'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
  $out['db'] = 'OK';
  $n = $pdo->query('SELECT COUNT(*) AS n FROM `User`')->fetch(PDO::FETCH_ASSOC);
  $out['visitObject_or_user'] = 'User count = ' . $n['n'];
} catch (Throwable $e) {
  $out['db'] = 'ECHEC';
  $out['db_error'] = $e->getMessage();
}
echo json_encode($out, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
