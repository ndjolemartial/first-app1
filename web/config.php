<?php
/**
 * Configuration du pointage web autonome — À ADAPTER lors du déploiement.
 *
 * Déposez le dossier `web/` dans le répertoire de votre serveur web local
 * (htdocs pour XAMPP, www pour WAMP) puis renseignez ci-dessous les identifiants
 * de connexion à la base MariaDB de l'application (les mêmes que `DATABASE_URL`).
 */
return [
  // Connexion à la base MariaDB de l'application.
  'db' => [
    'host' => '127.0.0.1',
    'port' => 3306,
    'name' => 'afrikimmo_app',
    'user' => 'afrikimmo_user',
    'pass' => 'password',
  ],

  // Seuils horaires de secours (utilisés seulement s'ils ne sont pas définis
  // dans l'application via Paramètres → Pointage QR).
  'expectedArrival'   => '08:00',
  'expectedDeparture' => '17:00',

  // Logo : déposez un fichier image nommé `logo.png` dans ce dossier `web/`
  // pour qu'il apparaisse en haut de la page de pointage (optionnel).
];
