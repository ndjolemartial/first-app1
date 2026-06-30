<?php
/**
 * API du pointage web autonome (JSON).
 *  - POST api.php?action=login  { identifier, password }  → ouvre une session
 *  - POST api.php?action=mark   { type: 'arrival'|'departure' } → enregistre le pointage
 *
 * Authentifie les comptes applicatifs (bcrypt) et écrit dans `AttendanceRecord`,
 * en appliquant les mêmes règles que l'application. La session est portée par un
 * cookie PHP (même origine que index.php).
 */

// N'affiche jamais les warnings/notices PHP dans la réponse (sinon le JSON est
// corrompu → « Serveur injoignable » côté client). Les erreurs restent journalisées.
ini_set('display_errors', '0');
session_start();
header('Content-Type: application/json; charset=utf-8');
require __DIR__ . '/db.php';

$cfg    = require __DIR__ . '/config.php';
$action = $_GET['action'] ?? '';
$body   = json_decode(file_get_contents('php://input'), true) ?: [];

function out($arr) { echo json_encode($arr); exit; }

/** Récupère le membre du personnel associé à un compte utilisateur. */
function employeeForUser($uid) {
  $st = db()->prepare('SELECT id, firstName, lastName FROM `Employee` WHERE userId = ? AND deletedAt IS NULL LIMIT 1');
  $st->execute([$uid]);
  $emp = $st->fetch();
  return $emp ?: null;
}

try {
  if ($action === 'login') {
    $identifier = trim((string)($body['identifier'] ?? ''));
    $password   = (string)($body['password'] ?? '');
    if ($identifier === '' || $password === '') out(['ok' => false, 'error' => 'Identifiants requis.']);

    $st = db()->prepare('SELECT id, password, isActive FROM `User` WHERE deletedAt IS NULL AND (email = ? OR login = ?) LIMIT 1');
    $st->execute([$identifier, $identifier]);
    $user = $st->fetch();
    if (!$user || !$user['isActive'] || !password_verify($password, $user['password'])) {
      out(['ok' => false, 'error' => 'Identifiants invalides ou compte inactif']);
    }

    $employee = employeeForUser((int)$user['id']);
    if (!$employee) out(['ok' => false, 'error' => 'Compte d’utilisateur non encore associé à un membre du personnel']);

    session_regenerate_id(true);
    $_SESSION['uid'] = (int)$user['id'];
    out(['ok' => true, 'employeeName' => trim($employee['lastName'] . ' ' . $employee['firstName'])]);
  }

  if ($action === 'mark') {
    $uid = $_SESSION['uid'] ?? null;
    if (!$uid) out(['ok' => false, 'error' => 'Session expirée, reconnectez-vous.']);

    $raw  = $body['type'] ?? '';
    $type = $raw === 'departure' ? 'departure' : ($raw === 'arrival' ? 'arrival' : '');
    if ($type === '') out(['ok' => false, 'error' => 'Type de pointage invalide.']);

    $employee = employeeForUser((int)$uid);
    if (!$employee) out(['ok' => false, 'error' => 'Compte d’utilisateur non encore associé à un membre du personnel']);
    $employeeId = (int)$employee['id'];

    $today = date('Y-m-d');
    $now   = date('Y-m-d H:i:s');

    $st = db()->prepare('SELECT id, arrivalTime, departureTime, hoursWorked FROM `AttendanceRecord` WHERE employeeId = ? AND `date` = ? LIMIT 1');
    $st->execute([$employeeId, $today]);
    $rec = $st->fetch();

    if ($type === 'arrival'   && $rec && $rec['arrivalTime'])   out(['ok' => false, 'error' => 'Heure d’arrivée déjà enregistrée aujourd’hui']);
    if ($type === 'departure' && $rec && $rec['departureTime']) out(['ok' => false, 'error' => 'Heure de départ déjà enregistrée aujourd’hui']);

    $arrival   = $type === 'arrival'   ? $now : ($rec['arrivalTime']   ?? null);
    $departure = $type === 'departure' ? $now : ($rec['departureTime'] ?? null);

    // Heures travaillées si arrivée ET départ connus (différence positive).
    $hours = $rec ? (float)$rec['hoursWorked'] : 0;
    if ($arrival && $departure) {
      $diff  = (strtotime($departure) - strtotime($arrival)) / 3600;
      $hours = $diff > 0 ? round($diff, 2) : 0;
    }

    if ($rec) {
      $u = db()->prepare('UPDATE `AttendanceRecord` SET status = "PRESENT", arrivalTime = ?, departureTime = ?, hoursWorked = ?, updatedAt = ? WHERE id = ?');
      $u->execute([$arrival, $departure, $hours, $now, $rec['id']]);
    } else {
      $uuid = 'c' . bin2hex(random_bytes(12)); // identifiant unique (colonne uuid)
      $i = db()->prepare('INSERT INTO `AttendanceRecord` (uuid, employeeId, `date`, status, hoursWorked, overtimeHours, arrivalTime, departureTime, createdAt, updatedAt)
                          VALUES (?, ?, ?, "PRESENT", ?, 0, ?, ?, ?, ?)');
      $i->execute([$uuid, $employeeId, $today, $hours, $arrival, $departure, $now, $now]);
    }

    // Avertissement de retard / départ anticipé (seuils AppSetting prioritaires).
    $expA = appSetting('attendance.expectedArrival', $cfg['expectedArrival']) ?: '08:00';
    $expD = appSetting('attendance.expectedDeparture', $cfg['expectedDeparture']) ?: '17:00';
    $nowMin = (int)date('H') * 60 + (int)date('i');
    $warning = null;
    if ($type === 'arrival'   && $nowMin > hhmmToMin($expA)) $warning = "Arrivée en retard (après $expA).";
    if ($type === 'departure' && $nowMin < hhmmToMin($expD)) $warning = "Départ avant l’heure limite ($expD).";

    $label = $type === 'arrival' ? 'Arrivée enregistrée à ' : 'Départ enregistré à ';
    out(['ok' => true, 'message' => $label . date('H:i') . '.', 'warning' => $warning]);
  }

  out(['ok' => false, 'error' => 'Action inconnue.']);
} catch (Throwable $e) {
  out(['ok' => false, 'error' => 'Erreur serveur.']);
}
