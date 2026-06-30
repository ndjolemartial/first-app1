<?php
/**
 * Configuration de l'enregistrement web des visiteurs — À ADAPTER au déploiement.
 *
 * Déposez le dossier `web-visiteurs/` dans le répertoire de votre serveur web
 * local (htdocs pour XAMPP, www pour WAMP) puis renseignez les identifiants de
 * connexion à la base MariaDB de l'application (les mêmes que `DATABASE_URL`).
 */
return [
  'db' => [
    'host' => '127.0.0.1',
    'port' => 3306,
    'name' => 'afrikimmo_app',
    'user' => 'afrikimmo_user',
    'pass' => 'password',
  ],
  // Logo : déposez un fichier image nommé `logo.png` dans ce dossier (optionnel).
];
