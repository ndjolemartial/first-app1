# Pointage du personnel — application web autonome (PHP)

Petite application web **indépendante de l'application de bureau Afrikimmo**. Une
fois déposée sur le serveur web local de l'entreprise, le personnel peut pointer
son arrivée et son départ en scannant le QR Code, **même si l'application de
bureau n'est lancée sur aucun poste** — il suffit que le serveur web et la base
MariaDB soient actifs.

## Contenu

| Fichier        | Rôle                                                              |
|----------------|------------------------------------------------------------------|
| `index.php`    | Page de pointage (connexion → choix arrivée / départ)            |
| `api.php`      | API JSON : `login` et `mark` (écrit dans `AttendanceRecord`)     |
| `db.php`       | Connexion PDO à MariaDB + lecture des paramètres applicatifs     |
| `config.php`   | **À adapter** : identifiants de la base + seuils horaires        |
| `logo.png`     | *(optionnel)* logo affiché en haut de la page                    |

## Déploiement (XAMPP / WAMP / Apache + PHP)

1. Copiez le dossier `web/` dans le répertoire du serveur web (ex. `htdocs/pointage`
   pour XAMPP, `www/pointage` pour WAMP).
2. Éditez `config.php` et renseignez les identifiants de connexion à la base
   MariaDB de l'application (les mêmes que la variable `DATABASE_URL` :
   hôte, port, nom de base, utilisateur, mot de passe). Le serveur web doit
   pouvoir joindre le serveur MariaDB sur le réseau.
3. *(Optionnel)* Déposez votre logo sous le nom `logo.png` dans le dossier.
4. Vérifiez l'accès dans un navigateur : `http://<adresse-serveur>/pointage/`
   → le formulaire de connexion doit s'afficher.
5. Dans l'application : **Paramètres → Pointage QR**, renseignez cette URL
   (ex. `http://192.168.1.10/pointage/`) comme adresse du QR, choisissez les
   rôles autorisés à voir le QR au tableau de bord, puis enregistrez. Le QR Code
   du tableau de bord pointe alors vers cette page.

## Fonctionnement

- L'employé se connecte avec **son compte applicatif** (login/email + mot de passe).
- Son compte doit être **associé à un membre du personnel** (champ « Compte
  utilisateur lié » de la fiche personnel) ; sinon le message
  « Compte d'utilisateur non encore associé à un membre du personnel » s'affiche.
- **Un seul** pointage d'arrivée et **un seul** de départ par jour.
- Un **avertissement** s'affiche si l'arrivée dépasse le seuil (défaut 08:00)
  ou si le départ le précède (défaut 17:00). Ces seuils proviennent des
  paramètres de l'application (`attendance.expectedArrival` /
  `attendance.expectedDeparture`), avec repli sur les valeurs de `config.php`.

## Prérequis techniques

- PHP 7.1+ avec l'extension **PDO MySQL** activée (`pdo_mysql`).
- Accès réseau du serveur web vers la base MariaDB.
- Les mots de passe sont vérifiés via `password_verify` (compatible bcrypt) ;
  ils ne sont jamais stockés ni transmis en clair côté base.

## Sécurité

Usage interne sur réseau local. Pour une exposition au-delà du LAN, placez le
dossier derrière HTTPS (certificat sur le serveur web) et restreignez l'accès
réseau à la base de données.
