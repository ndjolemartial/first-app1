# Enregistrement des visiteurs — application web autonome (PHP)

Application web **publique** (sans connexion) permettant à un visiteur de
renseigner sa visite en scannant le QR Code Visiteurs. Indépendante de
l'application de bureau : elle fonctionne tant que le serveur web et la base
MariaDB sont actifs.

## Contenu

| Fichier      | Rôle                                                          |
|--------------|--------------------------------------------------------------|
| `index.php`  | Formulaire visiteur (nom, prénoms, entreprise, contacts, email, objet, détails) |
| `api.php`    | API JSON : `submit` (insère dans `Visitor`)                  |
| `db.php`     | Connexion PDO à MariaDB                                       |
| `config.php` | **À adapter** : identifiants de la base                      |
| `logo.png`   | *(optionnel)* logo affiché en haut du formulaire             |

## Déploiement (XAMPP / WAMP / Apache + PHP)

1. Copiez le dossier `web-visiteurs/` dans le répertoire du serveur web
   (ex. `htdocs/visiteurs`).
2. Éditez `config.php` avec les identifiants de la base MariaDB de l'application
   (mêmes que `DATABASE_URL`).
3. *(Optionnel)* déposez votre logo sous le nom `logo.png`.
4. Vérifiez dans un navigateur : `http://<adresse-serveur>/visiteurs/`.
5. Dans l'application : **Paramètres → QR Visiteurs**, renseignez cette URL,
   choisissez les rôles autorisés à voir le QR au tableau de bord, puis
   enregistrez.

## Fonctionnement

- Le visiteur remplit le formulaire (Nom et Prénoms, Entreprise, Contacts,
  Adresse mail, Objet de visite, Détails) et valide.
- Le **jour et l'heure** sont enregistrés automatiquement (`visitedAt`).
- L'enregistrement apparaît dans le module **Gestion des visiteurs** de
  l'application (source « QR Code »).
- Un champ piège anti-spam (honeypot) est inclus.

## Prérequis

- PHP 7.1+ avec l'extension **PDO MySQL** (`pdo_mysql`).
- Accès réseau du serveur web vers la base MariaDB.

## Sécurité

Formulaire **public** (par nature, les visiteurs n'ont pas de compte). Pour
limiter les abus : usage sur réseau local, honeypot anti-bot inclus. Pour une
exposition au-delà du LAN, placez le dossier derrière HTTPS et envisagez une
limitation de débit côté serveur web.
