<?php
/** Connexion PDO partagée à la base MariaDB + lecture des paramètres applicatifs. */

function db() {
  static $pdo = null;
  if ($pdo === null) {
    $cfg = require __DIR__ . '/config.php';
    $d = $cfg['db'];
    $dsn = "mysql:host={$d['host']};port={$d['port']};dbname={$d['name']};charset=utf8mb4";
    $pdo = new PDO($dsn, $d['user'], $d['pass'], [
      PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
      PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
  }
  return $pdo;
}

/** Lit une valeur de la table AppSetting (clé réservée → backticks). */
function appSetting($key, $default = null) {
  $st = db()->prepare('SELECT `value` FROM `AppSetting` WHERE `key` = ?');
  $st->execute([$key]);
  $row = $st->fetch();
  return $row ? $row['value'] : $default;
}

/** Convertit 'HH:MM' en minutes depuis minuit. */
function hhmmToMin($s) {
  $p = explode(':', $s);
  return ((int)($p[0] ?? 0)) * 60 + (int)($p[1] ?? 0);
}
