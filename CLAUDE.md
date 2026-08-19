# CLAUDE.md — Application de Gestion Immobilière

> Fichier de configuration pour Claude Code.

---

## 🏢 Vue d'ensemble du projet

**Nom du projet :** Afrikimmo-App  
**Type :** Application de bureau (Desktop) multiplateforme  
**Stack principale :** Electron + React + TypeScript + MariaDB  
**Objectif :** Système de gestion immobilière complet couvrant la relation client, les biens, les conventions, la comptabilité et la communication.

---

## 🏗️ Architecture technique

### Stack technologique

```
Frontend (UI)        : React 18 + TypeScript + TailwindCSS
Desktop Runtime      : Electron 28+
ORM                  : Prisma (avec connecteur MySQL/MariaDB)
Base de données      : MariaDB 10.11+
State Management     : Zustand
Routing              : React Router v6
Formulaires          : React Hook Form + Zod (validation)
Tables/Grids         : TanStack Table v8
Graphiques           : Recharts
PDF Generation       : PDFKit ou React-PDF
Email                : Nodemailer (SMTP)
SMS                  : Twilio SDK ou OVH SMS API
Tests                : Vitest + React Testing Library + Playwright (E2E)
Build Tool           : Vite (renderer) + electron-builder (packaging)
Linter               : ESLint + Prettier
```

### Structure des répertoires

```
afrikimmo_app/
├── CLAUDE.md                        ← Ce fichier
├── package.json
├── electron.config.js
├── vite.config.ts
├── prisma/
│   ├── schema.prisma                ← Schéma de la base de données
│   └── migrations/                  ← Migrations MariaDB
├── src/
│   ├── main/                        ← Processus principal Electron (Node.js)
│   │   ├── index.ts                 ← Point d'entrée Electron
│   │   ├── ipc/                     ← Handlers IPC (communication main↔renderer)
│   │   │   ├── users.ipc.ts
│   │   │   ├── prospects.ipc.ts
│   │   │   ├── clients.ipc.ts
│   │   │   ├── owners.ipc.ts
│   │   │   ├── properties.ipc.ts
│   │   │   ├── lotissements.ipc.ts
│   │   │   ├── terrains.ipc.ts
│   │   │   ├── conventions.ipc.ts
│   │   │   ├── accounting.ipc.ts
│   │   │   ├── communication.ipc.ts
│   │   │   ├── crm.ipc.ts
│   │   │   ├── documents.ipc.ts
│   │   │   └── archiving.ipc.ts
│   │   ├── services/                ← Logique métier côté main
│   │   │   ├── db.service.ts        ← Client Prisma singleton
│   │   │   ├── auth.service.ts
│   │   │   ├── email.service.ts
│   │   │   ├── sms.service.ts
│   │   │   ├── pdf.service.ts
│   │   │   ├── backup.service.ts
│   │   │   └── archiving.service.ts ← Archivage automatique et politiques de rétention
│   │   └── utils/
│   │       ├── logger.ts
│   │       └── crypto.ts            ← Hachage mots de passe (bcrypt)
│   ├── renderer/                    ← Processus renderer (React)
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── router.tsx               ← Configuration des routes
│   │   ├── modules/                 ← Un dossier par module métier
│   │   │   ├── users/
│   │   │   ├── prospects/
│   │   │   ├── clients/
│   │   │   ├── owners/
│   │   │   ├── properties/          ← Biens (hors terrains)
│   │   │   ├── lotissements/        ← Module lotissements
│   │   │   ├── terrains/            ← Module terrains (issu d'un lotissement)
│   │   │   ├── conventions/
│   │   │   ├── accounting/
│   │   │   ├── dashboard/
│   │   │   ├── communication/
│   │   │   ├── crm/
│   │   │   └── archiving/
│   │   ├── shared/
│   │   │   ├── components/          ← Composants UI réutilisables
│   │   │   │   ├── ui/              ← Primitives (Button, Input, Modal…)
│   │   │   │   ├── layout/          ← Sidebar, TopBar, PageLayout
│   │   │   │   └── forms/           ← FormField, DatePicker, Select…
│   │   │   ├── hooks/               ← Custom hooks React
│   │   │   ├── stores/              ← Stores Zustand globaux
│   │   │   ├── types/               ← Types TypeScript partagés
│   │   │   └── utils/               ← Helpers (formatDate, formatCurrency…)
│   │   └── styles/
│   │       └── globals.css
│   └── preload/
│       └── index.ts                 ← Bridge sécurisé Electron (contextBridge)
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── scripts/
│   ├── seed.ts                      ← Données de test
│   └── backup.ts
└── docs/
    ├── architecture.md
    ├── database-schema.md
    └── api-ipc.md
```

### Structure d'un module (convention obligatoire)

Chaque module dans `src/renderer/modules/<module>/` doit suivre cette structure :

```
<module>/
├── index.tsx                  ← Export principal + route de base
├── pages/
│   ├── <Module>ListPage.tsx   ← Page liste/tableau
│   ├── <Module>DetailPage.tsx ← Page fiche détail
│   └── <Module>FormPage.tsx   ← Formulaire création/édition
├── components/
│   └── <Module>Card.tsx       ← Composants spécifiques au module
├── hooks/
│   └── use<Module>.ts         ← Hook React pour ce module (appels IPC)
├── store/
│   └── <module>.store.ts      ← Store Zustand local au module
├── types/
│   └── <module>.types.ts      ← Interfaces TypeScript du module
└── utils/
    └── <module>.utils.ts      ← Fonctions utilitaires du module
```

---

## 🗄️ Base de données (MariaDB via Prisma)

### Règles générales

- **TOUJOURS** utiliser Prisma pour toutes les interactions avec la base de données. Jamais de requêtes SQL brutes sauf si absolument nécessaire (et documenter pourquoi).
- Les migrations Prisma sont **obligatoires** pour tout changement de schéma. Ne jamais modifier la base directement.
- Tous les champs de date sont stockés en `DateTime` UTC.
- Les montants financiers sont stockés en `Decimal(15,2)` pour éviter les erreurs d'arrondi flottant.
- Toutes les tables ont : `id` (Int auto-increment ou CUID), `createdAt`, `updatedAt`, `deletedAt` (soft delete).
- Utiliser le **soft delete** systématiquement (`deletedAt IS NULL` dans les requêtes).

### Schéma Prisma principal (`prisma/schema.prisma`)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

// ── UTILISATEURS ──────────────────────────────────────────────
model User {
  id          Int       @id @default(autoincrement())
  uuid        String    @unique @default(cuid())
  matricule   String
  firstName   String
  lastName    String
  email       String    @unique
  password    String    // bcrypt hash
  role        UserRole  @default(AGENT)
  isActive    Boolean   @default(true)
  avatar      String?
  phone       String?
  mobile      String?
  lastLoginAt DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  deletedAt   DateTime?

  // Relations
  activities  CrmActivity[]
  conventions Convention[]  @relation("AgentConventions")
  notes       Note[]
}

enum UserRole {
  SUPER_ADMIN
  ADMIN
  MANAGER
  ACCOUNTANT
  ASSISTANTE_DIRECTION
  AGENT
  AGENT_TECHNIQUE
  RH                    // Ressources humaines / paie (module RH/Paie)
  READONLY
}

// ── PROSPECTS ─────────────────────────────────────────────────
model Prospect {
  id           Int            @id @default(autoincrement())
  uuid         String         @unique @default(cuid())
  firstName    String
  lastName     String
  email        String?
  phone        String?
  mobile       String?
  source       ProspectSource @default(PROSPECTION)
  status       ProspectStatus @default(NOUVEAU)
  budget       Decimal?       @db.Decimal(15, 2)
  notes        String?        @db.Text
  assignedToId Int?
  convertedAt  DateTime?
  clientId     Int?           @unique
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt
  deletedAt    DateTime?

  client       Client?        @relation(fields: [clientId], references: [id])
  activities   CrmActivity[]
  tags         ProspectTag[]
}

enum ProspectSource {
  SITE_WEB_AFRIKIMMO
  RECOMMENDATION
  TELEPHONE
  RESEAUX_SOCIAUX
  EMAIL
  CONTACT_PERSONNEL
  PROSPECTION
  AUTRE
}

enum ProspectStatus {
  NOUVEAU
  CONTACTE
  QUALIFIE
  ENVOI_PROPOSITION
  NEGOCIATION_EN_COURS
  CONVERTI
  PERDU
}

// ── CLIENTS ───────────────────────────────────────────────────
model Client {
  id              Int          @id @default(autoincrement())
  uuid            String       @unique @default(cuid())
  type            ClientType   @default(INDIVIDUEL)
  // Personnes physiques
  firstName       String?
  lastName        String?
  civilite        civiliteType   @default(MONSIEUR)
  statutconjugal          statutConjugalType    @default(CELIBATAIRE)
  // Personnes morales
  entreprise     String?
  registre_de_commerce           String?
  compte_contribuable       String?
  // Commun
  email           String?
  phone           String?
  mobile          String?
  address         String?
  city            String?
  postalCode      String?
  country         String       @default("CI")
  nationality     String?
  birthDate       DateTime?
  idNumber        String?      // Numéro pièce d'identité
  notes           String?      @db.Text
  isActive        Boolean      @default(true)
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
  deletedAt       DateTime?

  prospect        Prospect?
  conventions     Convention[]
  documents       Document[]
  activities      CrmActivity[]
  invoices        Invoice[]
}

enum ClientType {
  INDIVIDUEL
  ENTREPRISE
}

enum CiviliteType {
  MONSIEUR
  MADAME
  MADEMOISELLE
}

enum StatutConjugalType {
  CELIBATAIRE
  MARIE(E)
  CONCUBINAGE
}

// ── PROPRIÉTAIRES ─────────────────────────────────────────────
model Owner {
  id                  Int        @id @default(autoincrement())
  uuid                String     @unique @default(cuid())
  type                ClientType @default(INDIVIDUEL)
  // Particulier
  firstName           String?
  lastName            String?
  idNumber            String?    // Numéro pièce d'identité (particulier)
  // Entreprise
  companyName         String?
  registreCommerce    String?    // Numéro registre de commerce
  legalRepFirstName   String?    // Prénom représentant légal
  legalRepLastName    String?    // Nom représentant légal
  legalRepPhone       String?    // Contact représentant légal
  legalRepIdNumber    String?    // Numéro pièce d'identité représentant légal
  // Commun
  email               String?
  phone               String?
  mobile              String?
  address             String?
  city                String?
  postalCode          String?
  country             String     @default("CI")
  bankIban            String?
  bankBic             String?
  compte_contribuable String?
  notes               String?    @db.Text
  isActive            Boolean    @default(true)
  createdAt           DateTime   @default(now())
  updatedAt           DateTime   @updatedAt
  deletedAt           DateTime?

  properties Property[]
  terrains   Terrain[]
  documents  Document[]
  activities CrmActivity[]
}

// ── LOTISSEMENTS ───────────────────────────────────────────────
model Lotissement {
  id              Int               @id @default(autoincrement())
  uuid            String            @unique @default(cuid())
  reference       String            @unique  // Ex: LOT-2024-0001
  nom             String
  commune         String?
  quartier        String?
  ville           String
  pays            String            @default("CI")
  surface         Decimal?          @db.Decimal(12, 2)
  nombreParcelles Int?
  promoteur       String?
  statut          LotissementStatus @default(EN_COURS)
  description     String?           @db.Text
  latitude        Float?
  longitude       Float?
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt
  deletedAt       DateTime?

  terrains   Terrain[]
  documents  Document[]
  activities CrmActivity[]
}

enum LotissementStatus {
  EN_COURS
  OUVERT
  PARTIELLEMENT_VENDU
  COMPLET
  FERME
}

// ── TERRAINS ───────────────────────────────────────────────────
model Terrain {
  id             Int           @id @default(autoincrement())
  uuid           String        @unique @default(cuid())
  reference      String        @unique  // Ex: TER-2024-0001
  lotissementId  Int           // Lotissement d'origine — obligatoire
  ownerId        Int?
  numeroIlot     String?
  numeroParcelle String?
  statut         TerrainStatus @default(DISPONIBLE)
  surface        Decimal       @db.Decimal(12, 2)
  prixVente      Decimal?      @db.Decimal(15, 2)
  viabilise      Boolean       @default(false)
  titreFoncier   String?
  description    String?       @db.Text
  latitude       Float?
  longitude      Float?
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt
  deletedAt      DateTime?

  lotissement Lotissement   @relation(fields: [lotissementId], references: [id])
  owner       Owner?        @relation(fields: [ownerId], references: [id])
  documents   Document[]
  photos      TerrainPhoto[]
  activities  CrmActivity[]
}

enum TerrainStatus {
  DISPONIBLE
  RESERVE
  VENDU
  SOUS_OPTION
}

model TerrainPhoto {
  id        Int      @id @default(autoincrement())
  terrainId Int
  path      String
  caption   String?
  isPrimary Boolean  @default(false)
  order     Int      @default(0)
  createdAt DateTime @default(now())

  terrain Terrain @relation(fields: [terrainId], references: [id])
}

// ── BIENS IMMOBILIERS ─────────────────────────────────────────
model Property {
  id              Int              @id @default(autoincrement())
  uuid            String           @unique @default(cuid())
  reference       String           @unique  // Ex: BN-2024-0042
  type            PropertyType
  status          PropertyStatus   @default(DISPONIBLE)
  ownerId         Int
  // Localisation
  address         String
  addressLine2    String?
  city            String
  postalCode      String
  country         String           @default("CI")
  latitude        Float?
  longitude       Float?
  // Caractéristiques
  surface         Decimal          @db.Decimal(10, 2)   // m²
  surfaceCarrez   Decimal?         @db.Decimal(10, 2)
  rooms           Int?
  bedrooms        Int?
  bathrooms       Int?
  floor           Int?
  totalFloors     Int?
  buildYear       Int?
  condition       PropertyCondition?
  // Financier
  rentPrice       Decimal?         @db.Decimal(15, 2)
  salePrice       Decimal?         @db.Decimal(15, 2)
  charges         Decimal?         @db.Decimal(15, 2)
  taxeFonciere    Decimal?         @db.Decimal(15, 2)
  // Diagnostics
  // dpeRating       String?          // A à G  // PAS NECESSAIRE
  // dpeCo2          String?                    // PAS NECESSAIRE
  // Description
  description     String?          @db.Text
  amenities       Json?            // ["parking", "cave", "balcon"…]
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt
  deletedAt       DateTime?

  owner           Owner            @relation(fields: [ownerId], references: [id])
  conventions     Convention[]
  documents       Document[]
  photos          PropertyPhoto[]
  activities      CrmActivity[]
}

enum PropertyType {
  // TERRAIN retiré — géré par le module dédié Terrains/Lotissements
  APARTEMENT
  DUPLEX
  VILLA
  STUDIO
  BUREAU
  PARKING
  AUTRE
}

enum PropertyStatus {
  DISPONIBLE
  INDISPONIBLE
  EN_LOCATION
  SOLDE
  SOUS_OPTION
  EN_RENOVATION
}

enum PropertyCondition {
  NOUVEAU
  EXCELLENT
  BON
  MOYEN
  MAUVAIS
}

model PropertyPhoto {
  id          Int       @id @default(autoincrement())
  propertyId  Int
  path        String
  caption     String?
  isPrimary   Boolean   @default(false)
  order       Int       @default(0)
  createdAt   DateTime  @default(now())

  property    Property  @relation(fields: [propertyId], references: [id])
}

// ── CONVENTIONS ───────────────────────────────────────────────
model Convention {
  id              Int                @id @default(autoincrement())
  uuid            String             @unique @default(cuid())
  reference       String             @unique  // Ex: CV-2026-0007
  type            ConventionType
  status          ConventionStatus   @default(DRAFT)
  propertyId      Int
  clientId        Int
  agentId         Int?
  // Dates
  startDate       DateTime
  endDate         DateTime?
  signedAt        DateTime?
  // Financier
  rentAmount           Decimal?         @db.Decimal(15, 2)
  saleAmount           Decimal?         @db.Decimal(15, 2)  // Prix total de vente
  deposit              Decimal?         @db.Decimal(15, 2)
  agencyFees           Decimal?         @db.Decimal(15, 2)
  charges              Decimal?         @db.Decimal(15, 2)
  paymentDay           Int?             // Jour du mois pour le loyer
  paymentMethod        PaymentMethod    @default(ESPECE)
  paymentModalites     PaymentModalites @default(CASH)
  // Vente par échéances
  installmentCount     Int?             // Nombre total d'échéances (ex: 12, 36, ou valeur libre si SUR_PLUS_60_MOIS)
  installmentAmount    Decimal?         @db.Decimal(15, 2)  // Montant par échéance (saleAmount / installmentCount)
  firstInstallmentDate DateTime?        // Date de la première échéance
  lastInstallmentDate  DateTime?        // Date de la dernière échéance (calculée)
  // Révision
  indexType            String?          // IRL, ILC…
  lastRevisionAt       DateTime?
  notes           String?          @db.Text
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt
  deletedAt       DateTime?

  property        Property         @relation(fields: [propertyId], references: [id])
  client          Client           @relation(fields: [clientId], references: [id])
  agent           User?            @relation("AgentConventions", fields: [agentId], references: [id])
  invoices        Invoice[]
  documents       Document[]
  activities      CrmActivity[]
  installments    SaleInstallment[]
}

enum ConventionType {
  RENTAL_UNFURNISHED
  RENTAL_FURNISHED
  SALE
  MANAGEMENT
  COMMERCIAL_LEASE
}

enum ConventionStatus {
  BROUILLON
  ACTIVE
  EXPIRE
  TERMINER
  ANNULE
  ATTENTE_SIGNATURE
}

enum PaymentMethod {
  ESPECE
  CHEQUE
  TRANSFERT
  VIREMENT
  MOBILE_MONEY
}

enum PaymentModalites {
  CASH          // Paiement intégral comptant
  SUR_3_MOIS
  SUR_6_MOIS
  SUR_9_MOIS
  SUR_12_MOIS
  SUR_24_MOIS
  SUR_36_MOIS
  SUR_48_MOIS
  SUR_60_MOIS
  SUR_PLUS_60_MOIS  // Durée libre > 60 mois, précisée dans installmentCount
}

// ── COMPTABILITÉ ──────────────────────────────────────────────
model Invoice {
  id              Int             @id @default(autoincrement())
  uuid            String          @unique @default(cuid())
  reference       String          @unique  // Ex: FAC-2024-0001
  type            InvoiceType
  status          InvoiceStatus   @default(DRAFT)
  clientId        Int?
  conventionId    Int?
  // Montants
  subtotal        Decimal         @db.Decimal(15, 2)
  taxRate         Decimal         @db.Decimal(5, 2)  @default(0)
  taxAmount       Decimal         @db.Decimal(15, 2)
  total           Decimal         @db.Decimal(15, 2)
  // Dates
  issueDate       DateTime        @default(now())
  dueDate         DateTime
  paidAt          DateTime?
  // Infos
  notes           String?         @db.Text
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
  deletedAt       DateTime?

  client          Client?         @relation(fields: [clientId], references: [id])
  convention      Convention?     @relation(fields: [conventionId], references: [id])
  items           InvoiceItem[]
  payments        Payment[]
  installments    SaleInstallment[]
}

enum InvoiceType {
  VENTE              // Vente comptant (CASH)
  ECHEANCE_VENTE     // Appel de fonds pour une échéance de vente
  FRAIS_AGENCE
  FRAIS_DE_GESTION
  AVANCE
  CAUTION
  OTHER
}

enum InvoiceStatus {
  BROUILLON
  ENVOYEE
  PAYEE
  PARTIEL
  EN_RETARD
  ANNULEE
}

model InvoiceItem {
  id          Int       @id @default(autoincrement())
  invoiceId   Int
  description String
  quantity    Decimal   @db.Decimal(10, 2)
  unitPrice   Decimal   @db.Decimal(15, 2)
  total       Decimal   @db.Decimal(15, 2)

  invoice     Invoice   @relation(fields: [invoiceId], references: [id])
}

model Payment {
  id          Int           @id @default(autoincrement())
  invoiceId   Int
  amount      Decimal       @db.Decimal(15, 2)
  method      PaymentMethod
  paidAt      DateTime      @default(now())
  reference   String?       // Référence virement/chèque
  notes       String?

  invoice     Invoice       @relation(fields: [invoiceId], references: [id])
}

// ── ÉCHÉANCES DE VENTE ────────────────────────────────────────
model SaleInstallment {
  id                 Int                 @id @default(autoincrement())
  conventionId       Int
  installmentNumber  Int                 // Numéro de l'échéance (1, 2, 3…)
  dueDate            DateTime            // Date d'échéance prévue
  amount             Decimal             @db.Decimal(15, 2)
  status             InstallmentStatus   @default(EN_ATTENTE)
  paidAt             DateTime?           // Date de paiement effectif
  paymentMethod      PaymentMethod?
  paymentRef         String?             // Référence du règlement (chèque, virement…)
  invoiceId          Int?                // Facture associée à cette échéance
  notes              String?
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  convention         Convention          @relation(fields: [conventionId], references: [id])
  invoice            Invoice?            @relation(fields: [invoiceId], references: [id])
}

enum InstallmentStatus {
  EN_ATTENTE       // Pas encore due
  A_REGLER         // Due et non réglée
  PAYE             // Réglée
  EN_RETARD        // Dépassée et non réglée
  ANNULE           // Échéance annulée (ex: remboursement anticipé)
}

// ── CRM & COMMUNICATION ───────────────────────────────────────
model CrmActivity {
  id            Int               @id @default(autoincrement())
  type          ActivityType
  subject       String
  description   String?           @db.Text
  status        ActivityStatus    @default(EN_ATTENTE)
  dueDate       DateTime?
  completedAt   DateTime?
  userId        Int?
  prospectId    Int?
  clientId      Int?
  ownerId       Int?
  propertyId    Int?
  conventionId  Int?
  createdAt     DateTime          @default(now())
  updatedAt     DateTime          @updatedAt

  user          User?             @relation(fields: [userId], references: [id])
  prospect      Prospect?         @relation(fields: [prospectId], references: [id])
  client        Client?           @relation(fields: [clientId], references: [id])
  owner         Owner?            @relation(fields: [ownerId], references: [id])
  property      Property?         @relation(fields: [propertyId], references: [id])
  convention    Convention?       @relation(fields: [conventionId], references: [id])
}

enum ActivityType {
  NOTIFICATION
  APPEL
  EMAIL
  SMS
  REUNION
  VISITE
  TASK
  RAPPEL
  DOCUMENT
}

enum ActivityStatus {
  EN_ATTENTE
  EN_TRAITEMENT
  TRAITE
  ANNULE
}

model Communication {
  id          Int               @id @default(autoincrement())
  channel     CommChannel
  direction   CommDirection     @default(SORTANT)
  to          String
  subject     String?
  body        String            @db.Text
  status      CommStatus        @default(EN_ATTENTE)
  sentAt      DateTime?
  errorMsg    String?
  templateId  Int?
  metadata    Json?
  createdAt   DateTime          @default(now())

  template    CommTemplate?     @relation(fields: [templateId], references: [id])
}

model CommTemplate {
  id          Int               @id @default(autoincrement())
  name        String
  channel     CommChannel
  subject     String?
  body        String            @db.Text
  variables   Json?             // ["{{firstName}}", "{{dueDate}}"…]
  isActive    Boolean           @default(true)
  createdAt   DateTime          @default(now())
  updatedAt   DateTime          @updatedAt

  communications Communication[]
}

enum CommChannel {
  EMAIL
  SMS
}

enum CommDirection {
  ENTRANT
  SORTANT
}

enum CommStatus {
  EN_ATTENTE
  ENVOYE
  RECU
  ECHEC
  REFUSE
}

// ── DOCUMENTS ─────────────────────────────────────────────────
model Document {
  id          Int       @id @default(autoincrement())
  name        String
  type        String    // MIME type
  path        String    // Chemin local relatif
  size        Int       // Bytes
  category     String?   // "convention", "diagnostic", "identité", "documents sur biens immobiliers"…
  clientId     Int?
  ownerId      Int?
  propertyId   Int?
  conventionId Int?
  uploadedAt   DateTime  @default(now())

  client       Client?     @relation(fields: [clientId], references: [id])
  owner        Owner?      @relation(fields: [ownerId], references: [id])
  property     Property?   @relation(fields: [propertyId], references: [id])
  convention   Convention? @relation(fields: [conventionId], references: [id])
}

model Note {
  id        Int      @id @default(autoincrement())
  content   String   @db.Text
  entityType String  // "client" | "owner" | "property"…
  entityId  Int
  userId    Int?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user      User?    @relation(fields: [userId], references: [id])
}

model Tag {
  id    Int           @id @default(autoincrement())
  name  String        @unique
  color String?

  prospects ProspectTag[]
}

model ProspectTag {
  prospectId  Int
  tagId       Int

  prospect    Prospect @relation(fields: [prospectId], references: [id])
  tag         Tag      @relation(fields: [tagId], references: [id])

  @@id([prospectId, tagId])
}

model AppSetting {
  key       String    @id
  value     String    @db.Text
  updatedAt DateTime  @updatedAt
}

// ── ARCHIVAGE ─────────────────────────────────────────────────
model ArchiveRecord {
  id            Int               @id @default(autoincrement())
  uuid          String            @unique @default(cuid())
  entityType    ArchiveEntityType
  entityId      Int
  entityRef     String            // Référence lisible (ex: CV-2026-0007, CLI-00042)
  snapshot      Json              // Copie complète de l'entité au moment de l'archivage
  reason        ArchiveReason     @default(MANUEL)
  reasonDetail  String?           @db.Text
  archivedById  Int?
  archivedAt    DateTime          @default(now())
  restoredById  Int?
  restoredAt    DateTime?
  status        ArchiveStatus     @default(ARCHIVE)
  retentionDate DateTime?         // Date limite de conservation (null = illimitée)
  notes         String?           @db.Text

  archivedBy    User?             @relation("ArchivedBy", fields: [archivedById], references: [id])
  restoredBy    User?             @relation("RestoredBy", fields: [restoredById], references: [id])
}

enum ArchiveEntityType {
  CLIENT
  PROSPECT
  OWNER
  PROPERTY
  CONVENTION
  INVOICE
  DOCUMENT
}

enum ArchiveStatus {
  ARCHIVE
  RESTAURE
  SUPPRIME_DEFINITIVEMENT
}

enum ArchiveReason {
  MANUEL
  CONVENTION_TERMINEE
  CLIENT_INACTIF
  BIEN_VENDU
  POLITIQUE_AUTOMATIQUE
  DEMANDE_RGPD
  AUTRE
}

model ArchivePolicy {
  id               Int               @id @default(autoincrement())
  name             String
  description      String?           @db.Text
  entityType       ArchiveEntityType
  triggerCondition Json              // Ex: { "status": "TERMINE", "olderThanDays": 365 }
  retentionDays    Int?              // Durée de conservation en jours (null = illimitée)
  isActive         Boolean           @default(true)
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt
}

```

---

## 🔐 Sécurité & Authentification

### Règles obligatoires

- Les mots de passe sont **toujours** hachés avec `bcrypt` (salt rounds: 12). Ne jamais stocker un mot de passe en clair.
- Les tokens de session sont générés avec `crypto.randomBytes(32)` et stockés en mémoire (Electron keychain ou `safeStorage`).
- Le `contextBridge` Electron **doit** whitelister explicitement chaque méthode IPC exposée au renderer. Ne jamais exposer `ipcRenderer` directement.
- Vérifier les permissions de l'utilisateur connecté dans **chaque handler IPC** côté `main`.
- Toutes les entrées utilisateur sont validées avec **Zod** avant insertion en base.

### Matrice des permissions par rôle

| Action                  | SUPER_ADMIN | ADMIN | MANAGER | AGENT | ACCOUNTANT | READONLY |
|-------------------------|:-----------:|:-----:|:-------:|:-----:|:----------:|:--------:|
| Gérer utilisateurs      | ✅          | ✅    | ❌      | ❌    | ❌         | ❌       |
| CRUD Prospects          | ✅          | ✅    | ✅      | ✅    | ✅         | ✅**     |
| CRUD Clients            | ✅          | ✅    | ✅      | 👁️    | ✅         | 👁️       |
| CRUD Propriétaires      | ✅          | ✅    | ✅      | ✅    | ✅         | 👁️       |
| CRUD Biens              | ✅          | ✅    | ✅      | 👁️    | ✅         | 👁️       |
| CRUD Terrains           | ✅          | ✅    | ✅      | 👁️    | ✅         | 👁️       |
| CRUD Conventions        | ✅          | ✅    | ✅      | 👁️*   | ✅         | 👁️       |
| CRUD Attestations       | ✅          | ✅    | ✅      | 👁️*   | ✅         | 👁️       |
| Comptabilité (lecture)  | ✅          | ✅    | ✅      | ❌    | ✅         | 👁️       |
| Comptabilité (écriture) | ✅          | ✅    | ✅     | ❌    | ✅         | ❌       |
| Envoyer emails/SMS      | ✅          | ✅    | ✅      | ✅    | ✅         | ❌       |
| Archiver une entité     | ✅          | ✅    | ✅      | ❌    | ✅         | ❌       |
| Restaurer une archive   | ✅          | ✅    | ❌      | ❌    | ❌         | ❌       |
| Suppr. définitive arch. | ✅          | ❌    | ❌      | ❌    | ❌         | ❌       |
| Gérer politiques arch.  | ✅          | ✅    | ❌      | ❌    | ❌         | ❌       |
| Consulter les archives  | ✅          | ✅    | ✅      | 👁️    | ✅         | ❌       |
| Tableau de bord         | ✅          | ✅    | ✅      | ✅    | ✅         | ✅       |
| Paramètres app          | ✅          | ✅    | ❌      | ❌    | ❌         | ❌       |
| Module RH & Paie        | ✅          | ✅    | ❌      | ❌    | ❌         | ❌       |
| Performances (gestion)  | ✅          | ✅    | ✅†     | ❌    | ❌         | ❌       |
| Performances (config)   | ✅          | ✅    | ❌      | ❌    | ❌         | ❌       |
| Réseaux Sociaux & Web   | ✅          | ✅    | ✅      | ❌    | ❌         | ❌       |

> **Réseaux Sociaux & Plateformes Web (Module 15)** — **Tableau de bord** et **Plateformes** : SUPER_ADMIN, ADMIN, MANAGER (ACCOUNTANT et ASSISTANTE_DIRECTION héritent des droits MANAGER via l'équivalence `checkRole`). **Publications & articles** : **tous les rôles à l'exception de READONLY** (constante `PUBLICATION_ROLES` dans `social-media.ipc.ts`), en plein accès (lecture + écriture). **Abonnés** : SUPER_ADMIN, ADMIN, MANAGER, ACCOUNTANT, ASSISTANTE_DIRECTION **+ AGENT_TECHNIQUE** (constante `SNAPSHOT_ROLES`), plein accès. READONLY n'a donc accès à aucun sous-onglet de ce module.
>
> **Performances (Module 14)** — gestion opérationnelle (objectifs, évaluations, plans, classements) : SUPER_ADMIN, ADMIN, RH et **MANAGER** (†ce dernier **limité à son équipe** — employés dont `Employee.managerId` = sa fiche). Le **tableau de bord de performance** et la **configuration** (catalogue KPI, pondérations par poste) : SUPER_ADMIN, ADMIN, RH **uniquement** — le **MANAGER en est exclu** (menu masqué, routes fermées par `RoleGuard`, handler `performance:dashboard` en `PERF_ADMIN_ROLES`). Signature « Direction » (3ᵉ niveau) : SUPER_ADMIN, ADMIN. Signature « collaborateur » : l'employé concerné via « Mon espace RH ». Le rôle **RH** accède aux performances mais reste par ailleurs cantonné à son module (aucune équivalence `checkRole`).
>
> **Exception Évaluations — MANAGER** : sur le sous-module **Évaluations** uniquement (liste, « Nouvelle évaluation », détail, calcul des KPI, soumission, refus), le MANAGER accède à **tous les employés** (pas seulement son équipe), à l'exception de ceux dont le **compte utilisateur rattaché** a le rôle **SUPER_ADMIN ou ADMIN**. Périmètre appliqué côté IPC via `accessibleEmployeeIdsForEvaluations` / `assertEmployeeAccessibleEval` / `scopeEmployeeWhereEval` (distincts de `accessibleEmployeeIds` utilisé par les Objectifs et les Plans de progrès, restés limités à l'équipe). Le sélecteur d'employés du formulaire « Nouvelle évaluation » (`performance:employees:list` avec `scope: 'evaluations'`) reflète ce périmètre élargi.

> **RH (Ressources Humaines / Paie)** — rôle **dédié** au module RH & Paie (personnel, contrats, bulletins de paie, congés, pointage). Il accède **uniquement** au module RH/Paie et au tableau de bord ; les autres modules lui sont **refusés au niveau IPC**. Le rôle RH **n'hérite d'aucun autre droit** (aucune équivalence dans `checkRole`).
>
> **CONFORMITE (chargé de conformité LBC/FT/FP)** — rôle **dédié** au Module 19 (« Conformité LBC/FT/FP »), même principe que RH : accède **uniquement** à ce module et au tableau de bord général ; les autres modules (Clients, Propriétaires, Conventions…) lui sont **refusés au niveau IPC**, sans aucune équivalence dans `checkRole`. Voir le Module 19 pour le détail (badges de risque non bloquants sur les fiches Client/Owner/Convention, confidentialité stricte des déclarations de soupçon).
>
> **Accès RH plein (SUPER_ADMIN, ADMIN, RH)** — accès complet au module RH/Paie, y compris la **configuration** (modèles de contrats/bulletins/fiches de poste, taux de paie, catégories d'essai, fonctions) et l'**enregistrement du pointage** (constantes `HR_ADMIN_ROLES` / `HR_WRITE_ROLES` dans `hr.ipc.ts`).
>
> **Accès RH restreint (MANAGER, ASSISTANTE_DIRECTION)** — accès **opérationnel** au module RH (personnel, contrats, bulletins, congés : consulter + gérer ; **pointage : consultation seule**), **limité aux employés dont le « contrat en cours » n'est PAS un CDI** (contrat ACTIF le plus récent, à défaut le plus récent ; employé sans contrat = accessible). Dès qu'un employé passe en CDI, il leur est **masqué**. Filtrage appliqué **côté IPC** via `hrExcludedEmployeeIds` / `assertEmployeeAccessible` / `hrScopeWhere` (rôles `HR_SCOPED_ROLES`, écritures opérationnelles `HR_OPERATIONAL_ROLES`). Ils **n'accèdent pas** à la configuration (modèles, taux, paramètres de paie). Le contrôle RH utilise un test de rôle **exact** (`checkHrRole`) afin que **ACCOUNTANT** (équivalent MANAGER) **n'obtienne pas** cet accès. Côté UI : `RoleGuard` distinct pour les routes opérationnelles (`/hr/employees`, `/hr/payslips`, `/hr/leave`, `/hr/attendance`, documents) vs configuration (`/hr/templates`, `/hr/payroll-settings`, éditeurs de modèles).
>
> **Exception Pointage & Congés — MANAGER & ASSISTANTE_DIRECTION** : sur ces deux modules uniquement, ces rôles accèdent à **tous les employés (y compris CDI)**, **sauf** ceux dont le **compte utilisateur rattaché** a un rôle privilégié : **ASSISTANTE_DIRECTION** exclut les comptes **admin (SUPER_ADMIN/ADMIN) et MANAGER** ; **MANAGER** exclut uniquement les comptes **admin (SUPER_ADMIN/ADMIN)**. Périmètre appliqué côté IPC via `hrExcludedAttendanceLeave` / `assertEmployeeAccessibleAL` / `hrScopeWhereAL` (handlers `hr:attendance:*`, `hr:leave*`, `hr:leaveRequests:*`) et via `employees:list` avec `context = 'attendanceLeave'` (sélecteurs d'employés des pages Pointage / Congés). En dehors de Pointage & Congés, le module RH (personnel, contrats, bulletins) reste **non-CDI** pour ces deux rôles.
>
> **AGENT_TECHNIQUE (Agent Technique)** — **hérite de tous les droits d'un AGENT** (via l'équivalence `AGENT_TECHNIQUE → AGENT` dans `checkRole`), **plus** la gestion **limitée des utilisateurs** : il peut **créer et modifier** (y compris activer/désactiver et réinitialiser le mot de passe) uniquement les comptes de rôle **AGENT, AGENT_TECHNIQUE ou READONLY**. Il ne peut ni gérer les autres rôles, ni supprimer un compte (réservé au SUPER_ADMIN). Restriction appliquée par `userMgmtScope` dans `users.ipc.ts` et reflétée dans le formulaire (liste de rôles filtrée).
>
> **\* AGENT — Conventions / Attestations (lecture restreinte)** — un AGENT ne voit que les **conventions au statut BROUILLON** et les **attestations** des **clients dont il est le référent** (`client.assignedToId`). Il **ne peut ni créer**, ni modifier, ni **changer le statut** d'une convention. Filtrage appliqué côté IPC (`agentScopeWhere` dans `conventions.ipc.ts` / `attestations.ipc.ts`) et boutons d'écriture masqués côté UI ; les routes de création/édition lui sont fermées par `RoleGuard`.
>
> **\*\* READONLY — Prospects (mêmes droits qu'AGENT)** — exception ciblée au principe « lecture seule » de ce rôle : READONLY peut **créer et modifier** des prospects (et changer leur statut), exactement comme AGENT — création/modification auto-affectées à lui-même, aucun droit d'affectation à un tiers ni de suppression (réservée à SUPER_ADMIN/ADMIN/MANAGER), aucune vue globale (ne voit que les prospects qui lui sont affectés). Rôle ajouté explicitement à la constante `WRITE_ROLES` de `prospects.ipc.ts` (plutôt qu'une équivalence globale dans `checkRole`, qui aurait élargi ce droit à d'autres modules) ; aucun changement côté UI, le bouton « Nouveau prospect » et le formulaire n'étaient déjà filtrés par rôle nulle part.
>
> **Équivalence de rôles** — les utilisateurs **ACCOUNTANT (Comptable)** disposent des **mêmes droits d'accès que les MANAGER** : la colonne ACCOUNTANT ci-dessus est identique à la colonne MANAGER. Cette équivalence est appliquée de manière centralisée dans `checkRole` (`src/main/services/auth.service.ts`) — ACCOUNTANT n'obtient toutefois aucun droit réservé aux rôles ADMIN / SUPER_ADMIN. **ASSISTANTE_DIRECTION** hérite également des droits MANAGER via `checkRole`, **sauf** pour la modification des **Clients, Biens et Terrains** : sur ces trois modules, les rôles **AGENT, ASSISTANTE_DIRECTION et READONLY sont en lecture seule** (écriture refusée par `checkClientWriteRole` / `checkWriteRole` dans les handlers IPC correspondants, et boutons masqués côté UI).
>
> **Fiche KYC — accès individuel (AGENT, AGENT_TECHNIQUE, ASSISTANTE_DIRECTION, READONLY)** — les boutons **« Fiche KYC »** et **« Fiche KYC non renseignée »** (Clients, Propriétaires, Apporteurs d'affaire) sont, par défaut, **masqués** pour ces 4 rôles ; **tous les autres rôles** (SUPER_ADMIN, ADMIN, MANAGER, ACCOUNTANT…) y ont un accès complet, sans restriction. Un administrateur peut accorder l'accès **individuellement** à un utilisateur de l'un de ces 4 rôles depuis *Paramètres → « Fiche KYC — accès »* (`KycAccessSettingsTab.tsx`, onglet réservé SUPER_ADMIN/ADMIN, `AppSetting` `kyc.authorizedUserIds`, IPC `settings:getKycAuthorizedUsers`/`updateKycAuthorizedUsers`). Test de rôle **exact** (pas d'équivalence `checkRole`) — même mécanisme que les utilisateurs désignés pour les « Modèles de messages » manuels. Handler `settings:myKycAccess` (accessible à tout utilisateur authentifié) résout la visibilité du bouton côté renderer via le hook partagé `useKycAccess()` (`src/renderer/shared/hooks/useKycAccess.ts`), utilisé dans `ClientDetailPage`/`ClientsListPage`, `OwnerDetailPage`/`OwnersListPage` et `ReferrerDetailPage`/`ReferrersListPage`. Purement une restriction d'usage du bouton d'export/impression — les champs KYC eux-mêmes restent visibles sur la fiche pour les rôles ayant déjà un droit de lecture sur l'entité (inchangé).

---

## 📋 Modules — Spécifications détaillées

### Module 1 — Gestion des utilisateurs

**Route :** `/users`  
**Fonctionnalités :**
- Liste des utilisateurs avec filtres (rôle, statut actif/inactif, nom et/ou prenoms)
- Création / modification / désactivation d'un compte (jamais de suppression définitive)
- Réinitialisation de mot de passe par l'admin
- Gestion de mot de passe oublié par utilisateurs actifs
- Journal des dernières connexions
- Gestion fine des rôles via la matrice de permissions

### Module 2 — Gestion des prospects

**Route :** `/prospects`  
**Fonctionnalités :**
- Pipeline Kanban par statut (`NOUVEAU → CONTACTE → QUALIFIE → ENVOI_PROPOSITION → CONVERTI/PERDU`)
- Tableau liste avec recherche fulltext, filtres multi-critères, tri par colonnes
- Fiche prospect : coordonnées, source, budget, historique des activités CRM
- Conversion prospect → client (lier à un `Client` existant ou en créer un nouveau)
- Tags colorés pour catégorisation rapide
- Import CSV de prospects en lot
- Export csv et PDF de listes de prospects par filtre 
- Relances automatiques (configurable via le module Communication)

### Module 3 — Gestion des clients

**Route :** `/clients`  
**Fonctionnalités :**
- Fiche client complète : infos personnelles, documents KYC, conventions liées, historique paiements
- Support personnes physiques et morales
- Timeline des activités (appels, emails, visites, notes)
- Alerte documents expirés (pièce d'identité, etc.)
- Fiche de solvabilité / scoring interne (champ notes structurées)
- Export csv et PDF de listes de clients par filtre 

### Module 4 — Gestion des propriétaires

**Route :** `/owners`  
**Fonctionnalités :**
- Similaire au module clients avec champs spécifiques (IBAN, données fiscales)
- Vue "portefeuille" : tous les biens d'un propriétaire avec synthèse loyers
- Génération des comptes rendus de gestion (PDF mensuel)
- Gestion des mandats de gestion

### Module 5a — Gestion des lotissements

**Route :** `/lotissements`  
**Fonctionnalités :**
- Référencement automatique (`LOT-YYYY-NNNN`)
- Fiche lotissement : nom, commune, quartier, ville, promoteur, surface totale, nombre de parcelles
- Statuts : EN_COURS → OUVERT → PARTIELLEMENT_VENDU → COMPLET / FERME
- Vue des parcelles (terrains) avec synthèse (disponibles, vendues)
- Lien direct vers la création d'un terrain depuis la fiche lotissement
- Documents associés (plan de lotissement, permis d'aménager…)
- CRUD complet avec soft delete

### Module 5b — Gestion des terrains

**Route :** `/terrains`  
**Fonctionnalités :**
- **Tout terrain doit être rattaché à un lotissement** — `lotissementId` obligatoire
- Référencement automatique (`TER-YYYY-NNNN`)
- Fiche terrain : numéro d'îlot, numéro de parcelle, surface, prix de vente, titre foncier
- Indicateur de viabilisation (oui/non)
- Statuts : DISPONIBLE → RESERVE / SOUS_OPTION → VENDU
- Changement de statut rapide depuis la fiche détail
- Assignation optionnelle d'un propriétaire (`ownerId`)
- Galerie photos (TerrainPhoto)
- Documents associés
- Filtres par lotissement, statut, viabilisation
- Navigation bidirectionnelle lotissement ↔ terrain
- Création pré-remplie depuis la fiche lotissement (`?lotissementId=X`)

### Module 5c — Gestion des biens immobiliers

**Route :** `/properties`  
**Fonctionnalités :**
- Référencement automatique (format configurable : `BN-YYYY-NNNN`)
- **Ne concerne plus les terrains** (retrait de TERRAIN de PropertyType — voir module 5b)
- **Origine du bien** : un bien provient soit d'un propriétaire, soit d'un programme immobilier (voir module 5d) — rattachement exclusif et optionnel (`ownerId` / `programmeId`)
- Fiche bien complète : photos (galerie avec drag-and-drop), caractéristiques, diagnostics DPE
- Carte interactive (si géocodage disponible)
- Historique des locations/ventes (cash ou par échéances)
- Gestion des documents associés (diagnostics, actes…)
- Statut en temps réel (disponible, loué, vendu, sous option…)
- Indicateur du mode de paiement appliqué (cash ou modalité d'échéances)
- Export fiche bien en PDF (pour publication)
- Export csv et PDF de listes de biens par filtre 

### Module 5d — Gestion des programmes immobiliers

**Route :** `/programmes`  
**Fonctionnalités :**
- Référencement automatique (`PROG-YYYY-NNNN`)
- Fiche programme : nom, type (résidentiel / commercial / mixte), promoteur, localisation, surface, nombre de logements
- Dates clés : date de démarrage et date de livraison prévisionnelle
- Statuts : `EN_PROJET → EN_CONSTRUCTION → EN_COMMERCIALISATION → LIVRE → CLOTURE`
- Vue des biens et terrains rattachés au programme (avec synthèse)
- Création pré-remplie d'un bien ou d'un terrain depuis la fiche programme (`?programmeId=X`)
- Un bien (`Property`) et un terrain (`Terrain`) peuvent être rattachés optionnellement à un programme
- Pour un bien : origine **exclusive** — soit un propriétaire, soit un programme immobilier
- Export CSV et PDF de la liste des programmes par filtre
- CRUD complet avec soft delete

> **Parallèle avec les lotissements** — un programme immobilier regroupe des biens, comme un lotissement regroupe des terrains. Les deux conteneurs coexistent : un terrain reste obligatoirement rattaché à un lotissement et peut, en plus, l'être à un programme.

### Module 6 — Gestion des conventions

**Route :** `/conventions`  
**Fonctionnalités :**
- Génération de conventions PDF (baux meublés/non meublés, compromis de vente, avenants de prolongation de délai, avenants de changement de site …)
- **Attestation de solde sur convention héritée** : une attestation de type `SOLDE` (ou `TRANSFERT_PROPRIETE`) peut être émise/imprimée pour une **convention héritée** (`priorConventionDate` renseignée ou type `AVENANT_*_HERITE`) dès que le **solde de ses échéances est ≤ 0**. Le solde héritée = montant restant dû sur ses échéances non annulées (`amount − paidAmount`) si elle en a, sinon le **solde antérieur importé** (`priorSolde`) ; s'il n'y a ni échéance ni solde antérieur, l'émission est refusée (solde indéterminé). Contrôle appliqué côté IPC (`assertConventionEligibleForAttestation` / `heritedBalance` dans `attestations.ipc.ts`) et côté formulaire (`computeSubscriptionBalance` dans `AttestationFormPage`).
- **Attestation de solde sur échéances héritées** (souscription héritée = échéances **sans convention**) : émission possible dès que le **solde net est ≤ 0** (`total souscrit − total réglé`, sans plafond bas — le trop-perçu est accepté). Le **terrain de souscription est obligatoire** (il figure sur l'attestation ; **sélection multiple** possible, plusieurs terrains d'un même lotissement — cf. ci-dessous), mais le **solde est vérifié sur les échéances héritées du client rattachées à l'un de ces terrains** : si aucun des terrains choisis n'a d'échéance rattachée (fréquent, les échéances importées n'étant pas toujours liées à un terrain), le contrôle **retombe automatiquement sur l'ensemble des échéances héritées du client** (repli dans `assertLegacySubscriptionSettled` / `attestations:getLegacyBalance`). Bouton **« Attestation de solde »** dans *Comptabilité → Échéances → onglet « Échéances héritées »* (route `/accounting/installments`) → ouvre `/conventions/attestations/new?legacy=1&type=SOLDE&clientId=…[&terrainId=…]`. Rôles : SUPER_ADMIN, ADMIN, MANAGER, ACCOUNTANT. Le formulaire propose (mode hérité) un champ **« Prix Total du bien »** (`Attestation.prixTotalBien`, migration `20260707280000_attestation_prix_total_bien`) affiché sur le document via les variables `{{attestation.prixTotalBien}}` / `{{attestation.prixTotalBien.enLettres}}`.
- **Sélection multiple de terrains/biens** : le formulaire « Nouvelle attestation » permet de rattacher **plusieurs terrains d'un même lotissement**, ou **plusieurs biens immobiliers d'un même programme immobilier** (contrainte assouplie : un bien sans programme n'impose aucune contrainte) — aussi bien sur le champ **« Bien concerné »** (ATTRIBUTION et CESSION) que sur le **terrain de la souscription héritée** (SOLDE hérité). Persisté via les tables de liaison `AttestationTerrain` / `AttestationProperty` (migration `20260710100000_attestation_multi_terrain_property`), avec `Attestation.terrainId` / `propertyId` conservés en scalaires pour compatibilité (alignés sur le 1ᵉʳ élément de la sélection). Validation du regroupement côté IPC (`assertSingleLotissement` / `assertSingleProgramme` dans `attestations.ipc.ts`, appliquée aussi en mode hérité) et côté formulaire (verrouillage des options + message d'alerte). Le document/modèle d'attestation expose de nouvelles variables `{{terrains.liste}}` / `{{terrain.nombre}}` et `{{biens.liste}}` / `{{bien.nombre}}` (les tokens singuliers `terrain.*`/`bien.*` existants continuent de résoudre sur le premier élément, pour compatibilité avec les modèles existants).
- Workflow de signature (statut `ATTENTE_DE_SIGNATURE → ACTIVE`)
- Alerte renouvellement / échéance (J-90, J-30, J-0)
- Révision annuelle du loyer (indice IRL/ILC)
- Gestion des états des lieux (entrée/sortie)
- Calcul automatique des quittances de loyer
- **Vente comptant (CASH)** : encaissement du montant total à la signature
- **Vente par échéances** : choix parmi 3, 6, 9, 12, 24, 36, 48, 60 mois ou durée libre (> 60 mois)
  - Génération automatique du tableau d'amortissement (calendrier des échéances)
  - Montant par échéance calculé automatiquement (`saleAmount / installmentCount`)
  - Suivi du statut de chaque échéance (EN_ATTENTE → A_REGLER → PAYE / EN_RETARD)
  - Génération automatique d'une facture (`ECHEANCE_VENTE`) à chaque appel de fonds
  - Alertes d'échéances à venir (J-15, J-7, J-0) via le module Communication
  - Alerte de retard de paiement dès le lendemain de la date d'échéance
  - Remboursement anticipé : annulation des échéances restantes et clôture de la convention
  - Export PDF du tableau d'échéances pour le client
- **Convention pour un prospect** — les rôles ayant le droit de créer des conventions (SUPER_ADMIN/ADMIN/MANAGER/ACCOUNTANT) peuvent, à la création, rattacher la convention à un **prospect** plutôt qu'à un client (bascule « Client »/« Prospect » sur le formulaire) : `Convention.clientId` est désormais optionnel, nouveau champ **`prospectId`** (optionnel, même principe dual-FK que `ConstructionProject`/`PermitProject` — `client`/`prospect`, jamais les deux). Trois restrictions strictes, appliquées côté IPC (`conventions.ipc.ts`) et reflétées côté formulaire : **type Souscription ou Vente uniquement**, **statut Brouillon uniquement à la création**, et **le statut ne peut plus évoluer tant que le prospect n'est pas converti en client** (message d'erreur explicite sur toute tentative). Aucune facture n'est générée automatiquement à la création tant que `clientId` est vide (un prospect n'est pas un tiers facturable) — les frais d'ouverture/apport initial saisis restent sur la convention et pourront être facturés manuellement après conversion. Dès que le prospect est **converti en client** (`prospects:convertToClient`), `clientId` est **automatiquement rattaché** sur la ou les conventions issues de ce prospect (`prospectId` n'est jamais effacé, pour la traçabilité) — la convention redevient alors une convention normale, sans aucune restriction supplémentaire. Limite assumée : une convention **Vente sur un terrain** exige un terrain déjà attribué au client (règle métier existante), ce qui n'est jamais possible pour un prospect — seules **Souscription (terrain)** et **Vente (bien immobilier)** sont donc utilisables pour un prospect en pratique.

### Module 7 — Comptabilité

**Route :** `/accounting`  
**Fonctionnalités :**
- Génération et envoi des factures (loyers, honoraires, charges)
- Suivi des paiements (encaissements, impayés)
- **Suivi des ventes par échéances** :
  - Vue globale des conventions de vente en cours (cash vs échéances)
  - Tableau de bord par convention : montant total, encaissé, restant dû, nombre d'échéances réglées / restantes
  - Liste des échéances à venir sur les 30/60/90 prochains jours
  - Liste des échéances en retard avec relance automatique (J+1, J+7, J+15, J+30)
  - Encaissement d'une échéance : saisie du mode de paiement et référence, génération de reçu PDF
- Tableau de bord financier : encours, impayés, chiffre d'affaires mensuel
- Gestion des relances de paiement (J+5, J+15, J+30) via le module Communication
- Export comptable (format CSV/Excel pour logiciels tiers : Ciel, Sage, QuickBooks)
- Clôture mensuelle et rapport comptable PDF
- TVA : calcul et rapport (paramétrable selon régime fiscal)

### Module 8 — Tableau de bord & Reporting

**Route :** `/dashboard`  
**Fonctionnalités :**
- KPIs en temps réel : taux d'occupation, loyers encaissés/impayés, prospects actifs
- Graphiques : évolution CA (12 mois), pipeline prospects, répartition biens par type
- Alertes actives : conventions expirant, loyers en retard, documents manquants
- Rapports exportables en PDF et Excel :
  - Rapport mensuel de gestion
  - Bilan des impayés
  - Synthèse du portefeuille
  - Performance commerciale par agent
- Widgets configurables par l'utilisateur (drag-and-drop)

### Module 9 — Communication (Emails & SMS)

**Route :** `/communication`  
**Fonctionnalités :**
- Bibliothèque de templates (emails et SMS) avec variables dynamiques `{{firstName}}`, `{{dueDate}}`, etc.
- Envoi manuel depuis n'importe quelle fiche (client, convention, prospect)
- **Campagnes de relance automatiques** — *Paramètres → Politique de relance* (SUPER_ADMIN/ADMIN/MANAGER) : politique générale (activation, heures d'envoi, jours bloqués) et **règles** (`ReminderRule`) modifiables et créables librement — une règle associe un **type de déclenchement** (échéances à venir / en retard, expiration de convention — les 3 seuls cas gérés par le moteur `applyReminderRules`, `reminders.service.ts`), un **décalage en jours** (signe libre, négatif = avant/préventif, positif = après/relance), un **canal** et un **modèle**. Le moteur boucle génériquement sur **toutes** les règles actives d'un type donné : ajouter une nouvelle règle (ex. une relance SMS à J-3, en plus des règles email J-15/J-7/J-0 déjà seedées) ne demande aucun changement de code, juste une ligne en base créée depuis l'écran (`reminders:createRule`). Seul le type de déclenchement est figé après création (le nom, la description, le décalage, le canal et le modèle restent modifiables, `reminders:updateRule`). Suppression **définitive** possible (`reminders:deleteRule`) — irréversible, contrairement à la simple désactivation (`isActive`) ; `ReminderRule` ne porte pas de `deletedAt` (règle de configuration, pas une entité métier), l'historique des relances déjà envoyées (`Communication`) n'est pas affecté (aucune FK vers `ReminderRule`). Le code de la règle supprimée est mémorisé (`AppSetting` `reminders.deletedSeedCodes`, `markRuleCodeDeleted`) pour empêcher `seedDefaultRemindersConfig` — exécutée à **chaque démarrage de l'application** — de la recréer silencieusement si elle fait partie des 12 règles seedées par défaut. **Liste d'exclusion relances** (même écran, carte « Liste d'exclusion relances ») : un client ajouté à cette liste ne reçoit plus jamais aucune relance automatique, quel que soit le canal (email, SMS, WhatsApp) ni le type de déclenchement (échéances à venir/en retard/héritées, expiration de convention) — l'envoi manuel de messages depuis sa fiche reste inchangé. Réutilise les champs existants `Client.smsOptOut`/`emailOptOut` (« Refus de relances automatiques par canal », déjà lus par `processCandidate` dans `reminders.service.ts` pour les 3 cas mais jusque-là sans aucune interface pour les renseigner) : l'ajout/retrait pose les **deux** drapeaux ensemble (`reminders:setClientOptOut`, `smsOptOut`/`emailOptOut` à `true`/`true` ou `false`/`false`) — les relances WhatsApp partageant l'opt-out SMS faute de champ dédié, l'exclusion est donc bien « tous canaux ». Recherche et ajout d'un client via `reminders:listOptedOutClients` (liste des clients actuellement exclus) et le sélecteur de recherche déjà utilisé dans « Envoyer un message »/« Rattacher ce message reçu ».
- Historique de toutes les communications par entité
- Configuration SMTP (email) et API SMS (Twilio / OVH / Brevo)
- File d'attente d'envoi avec retry en cas d'échec
- Prévisualisation avant envoi
- **Réception des réponses par email (IMAP)** — interroge périodiquement, par IMAP, les boîtes enregistrées dans `MailAccount` (`mailbox-poller.service.ts`) : une **boîte système partagée** (Paramètres → Email, réservée SUPER_ADMIN/ADMIN) pour les réponses aux rappels/relances automatiques, et une **boîte personnelle facultative par utilisateur** (self-service, « Mon profil ») pour les réponses aux emails envoyés « en tant que soi-même » (mode Particulier, qui met `From:` = l'email personnel de l'utilisateur mais relaie via le SMTP partagé — sans boîte personnelle connectée, ces réponses n'atterrissent que dans la vraie boîte mail de l'utilisateur, hors de l'app). Rattachement automatique d'une réponse à l'échange d'origine via les en-têtes `In-Reply-To`/`References` (comparés au `Communication.messageId` capturé à l'envoi), avec repli sur une recherche de l'adresse expéditrice parmi les contacts connus (Client/Prospect/Owner/BusinessReferrer) ; à défaut, rattachement manuel possible depuis l'historique (`communication:linkInbound`). Polling in-process (10 min, tant que l'app est ouverte) **et** script autonome `run-mailbox-poll-once.ts` (`npm run mail:poll`) planifiable hors Electron (Tâche planifiée Windows / NAS), même principe que la politique de relance (`run-reminders-once.ts`). Mots de passe IMAP chiffrés (primitive portable AES-256-GCM partagée, `src/main/utils/secretCrypto.ts`, extraite de `settings.service.ts`). Aucune authentification OAuth2 (Gmail/Outlook modernes) dans cette phase — mot de passe applicatif classique uniquement.

### Module 10 — CRM

**Route :** `/crm` — libellé dans l'interface (menu, titre) : **« Activités & CRM »**.  
**Fonctionnalités :**
- Agenda partagé : rendez-vous, visites, rappels (vue jour/semaine/mois)
- Activités : notes, appels, tâches, tous rattachables à n'importe quelle entité
- Tableau des tâches à faire (style kanban ou liste)
- Alertes et rappels (notification système Electron)
- Rapport d'activité par agent (appels passés, visites réalisées, conversions)
- Scoring des prospects basé sur l'activité CRM
- **Pièces jointes d'activité** : depuis le formulaire « Nouvelle activité » (et en édition), possibilité de **joindre un ou plusieurs documents** (PDF, Word, Excel, images, audio, vidéo) — accessible à **tous les rôles sauf READONLY** (aligné sur le droit de création d'activité). Les fichiers sont archivés dans la GED et rattachés à l'activité via `Document.crmActivityId` (relation `ActivityAttachments`, distincte du lien `documentId` qui pointe une archive unique). Le téléversement réutilise `documents:import` (chemin disque via `webUtils.getPathForFile`). La liste affiche un indicateur trombone avec le nombre de pièces jointes.
- **Vue détail d'une activité** : depuis la liste, un clic sur le sujet ou le bouton « Voir » ouvre un panneau (modal `ActivityDetailModal`) présentant type, statut, description, dates (prévue / terminée / créée), assigné à, **créé par**, **entités rattachées** (puces cliquables vers chaque fiche) et **pièces jointes**, chacune avec un bouton **« Voir »** (aperçu intégré — images, PDF, audio, vidéo, réutilise `DocumentPreview` du module Archivage via `AttachmentViewerModal`, même principe que `ValidatePhaseModal` du module Innovations IT) et un bouton **« Ouvrir »** (`documents:open`, application externe). Alimenté par `crm:getActivity` (qui inclut `createdBy` et `attachments`).
- **Activité liée à un objectif de performance** : à la création d'une activité, **quel que soit son type**, le collaborateur connecté peut **optionnellement la lier à l'un de ses objectifs** — à Mesure « Manuelle » **ou** « Auto », **personnel** (`employeeId`) **ou par poste** (`poste` = son poste) — doté d'une cible chiffrée (`CrmActivity.objectiveId`, sélecteur alimenté par `performance:me:objectives` — mêmes critères que « Mes objectifs » en self-service : `OR [{ employeeId }, { poste }]`). L'activité porte une **quantité réalisée** (`CrmActivity.objectiveRealized`) ; la vue détail affiche le **taux d'avancement** (réalisé / cible) et permet de la renseigner. **Seuls les objectifs à Mesure « Manuelle »** conditionnent le passage au statut « Traité » : celui-ci n'est autorisé qu'à **100 %** de la cible (garde côté IPC : `crm:createActivity` / `updateActivity` / `completeActivity`, via `assertLinkableObjective` qui accepte les objectifs personnels et par poste et retourne aussi le `measureType`) — un objectif « Auto » lié n'empêche jamais de marquer l'activité « Traité ». L'avancement de l'objectif lié est recalculé (quantité réalisée cumulée des activités liées / cible) à chaque modification, quel que soit son type de mesure. **Exclusion permanente** (quel que soit l'utilisateur connecté) : les objectifs liés aux KPI `CRM_ACTIVITIES_DONE` (Activités CRM traitées), `ABSENCE_DAYS` (Jours d'absence) et `ATTENDANCE_RATE` (Taux de présence) ne sont jamais proposés dans le sélecteur ni acceptés à la liaison (constante `LINKABLE_EXCLUDED_METRICS` dans `performance.ipc.ts`, réutilisée par `assertLinkableObjective` dans `crm.ipc.ts`).
- **Visibilité des activités par rôle** — **SUPER_ADMIN, ADMIN, MANAGER** voient l'ensemble des activités CRM (« vue complète »). **Tous les autres rôles** (dont **ACCOUNTANT**, **AGENT**, AGENT_TECHNIQUE, ASSISTANTE_DIRECTION, RH, READONLY) ne voient que **leurs propres activités** : celles qui leur sont assignées (`userId`), qu'ils ont créées (`createdById`), ou rattachées à un client/prospect/convention dont ils sont le référent (`assignedToId` / `agentId`). Constante `FULL_VIEW_ROLES` (`crm.ipc.ts`, réutilisée par `buildVisibilityWhere` — liste, détail, statistiques et filtre « Utilisateur » de `crm:listAssignees` ; même constante côté UI dans `CrmPage.tsx` pour l'affichage du filtre « Utilisateur »). **Exception AGENT_TECHNIQUE** : en plus de ses propres activités, ce rôle voit **toutes** les activités de type **« Créas / Publications / Articles »** (`CREATION_PUBLICATION`) de **tous les utilisateurs**, quel que soit l'assigné/créateur/référent — seule exception à sa vue restreinte, ajoutée dans `buildVisibilityWhere` (`{ OR: [...vue propre, { type: 'CREATION_PUBLICATION' }] }`). L'exception s'étend aux **pièces jointes** de ces activités : `documents:open`/`documents:getFileData` (`documents.ipc.ts`) contournent pour ce rôle le contrôle de dossier GED habituel (`canReadDocumentFolder`, qui bloquerait sinon l'accès à un document déposé hors de son propre espace personnel) dès lors que le document est rattaché (`Document.crmActivityId`) à une activité `CREATION_PUBLICATION` — même principe de contournement ciblé que la confidentialité des pièces jointes de déclaration de soupçon (Module 19).

### Module 11 — Archivage

**Route :** `/archiving`  
**Fonctionnalités :**
- Vue centralisée de toutes les entités archivées avec filtres par type (client, convention, bien, prospect…)
- Archivage manuel depuis n'importe quelle fiche avec saisie obligatoire du motif
- Snapshot JSON complet de l'entité au moment de l'archivage (traçabilité immuable)
- Restauration d'un élément archivé vers son module d'origine (avec vérification des conflits)
- Suppression définitive après expiration de la durée de rétention (SUPER_ADMIN uniquement)
- Recherche fulltext dans les archives (référence, nom, notes)
- Politiques d'archivage automatique configurables (ex : conventions terminées depuis > 365 jours)
- Tableau de bord des archives : volume par type, archives en attente de suppression, historique
- Export des archives en CSV et PDF (avec horodatage et identité de l'archiveur)
- Journal d'audit complet : qui a archivé/restauré/supprimé, quand et pourquoi
- Alertes de rétention : notification avant suppression définitive automatique (J-30, J-7)
- Conformité RGPD : suppression définitive à la demande (droit à l'oubli)

#### Module 11b — GED (Gestion Électronique de Documents)

**Routes :** `/archiving/ged` (documents), `/archiving/ged/dashboard`, `/archiving/ged/settings`, `/archiving/ged/:id`

Volet documentaire du module Archivage, coexistant avec l'archivage d'entités. S'appuie sur le modèle `Document` enrichi (`numeroArchive` auto `ARC-AAAA-NNNN`, `categoryId`, `folderId`, `tags`, `ocrText`, emplacement physique, `uploadedById`, soft delete) et les modèles `DocumentCategory`, `DocumentFolder`, `DocumentTag`, `DocumentAuditLog`.

**Phase 1 livrée :**
- Import multi-formats (PDF, Word, Excel, images, vidéos, audios) par glisser-déposer ou sélecteur — copie de fichier via chemin (`webUtils.getPathForFile`)
- Classement : catégories / sous-catégories, dossiers / arborescence, étiquettes, numérotation automatique
- Consultation : liste filtrable + fiche document avec prévisualisation intégrée (image, PDF, audio, vidéo)
- Recherche et filtres multiples (nom, numéro, description, catégorie, dossier, type)
- Journal des actions (import, consultation, modification, suppression) — traçabilité
- Tableau de bord : nombre de documents, récents, espace disque, répartition par type/catégorie, alertes

**Phases suivantes :** OCR plein texte (Tesseract), archivage physique + QR codes, scan via scanner matériel, sauvegarde automatique. Le chiffrement des fichiers est reporté.

### Module 12 — RH & Paie

**Routes :** `/hr/employees`, `/hr/payslips`, `/hr/leave`, `/hr/attendance`, `/hr/payroll-settings`, `/hr/templates`
**Accès :** rôles **SUPER_ADMIN, ADMIN, RH** uniquement (RoleGuard + contrôle IPC).

Module complet de gestion des ressources humaines et de la paie, **conforme au contexte ivoirien** (Code du travail Loi n°2015-532, CNPS, ITS, CMU, FDFP). Livré en 4 phases.

**Phase 1 — Personnel & contrats**
- Dossiers du personnel (`Employee`) : état civil, coordonnées, identité, n° CNPS / CMU, RIB, poste, statut (ACTIF / SUSPENDU / CONGE / SORTI). Matricule auto `EMP-AAAA-NNNN`.
- **Rattachement à un compte utilisateur** (`Employee.userId`, relation 1-1 `@unique` vers `User`) : depuis le formulaire personnel, l'admin/RH peut lier un membre du personnel à un compte de connexion de l'application. Le sélecteur ne propose que les comptes **actifs non déjà rattachés** à un autre employé (`hr:employees:linkableUsers`, avec conservation du compte de l'employé édité) ; l'unicité est contrôlée côté IPC (création & modification) et le compte lié est affiché sur la fiche détail. **Le matricule du compte utilisateur lié est automatiquement synchronisé sur celui de l'employé** à chaque création/modification (`hr:employees:create` / `update`, `User.matricule = Employee.matricule` dès que `userId` est renseigné) — le matricule ne se saisit donc plus manuellement côté compte une fois le lien établi.
- Contrats de travail (`EmploymentContract`) : type (CDI, CDD, Stage, Intérim, Consultant, Apprentissage, **Essai**, **Avenant CDD**, **Lettre de renouvellement ESSAI**), salaire de base, dates, période d'essai. Référence auto `CTR-AAAA-NNNN`.
- **Avenant CDD** (`type = AVENANT_CDD`) : avenant de prolongation **toujours rattaché à un contrat CDD initial** du même employé (`EmploymentContract.parentContractId`, self-relation). Un CDD peut avoir plusieurs avenants ; le **délai cumulé** (du début du CDD initial à la date de fin de l'avenant) **ne peut excéder 2 ans** — règle validée et **bloquée côté IPC** (`hr:contracts:create` / `update`). Variables `{{contratParent.*}}` disponibles dans le modèle.
- **Lettre de renouvellement ESSAI** (`type = RENOUVELLEMENT_ESSAI`) : **toujours rattachée à un contrat ESSAI initial** (même `parentContractId`). Sa **durée est égale** à celle de l'essai initial — date de fin **auto-calculée et verrouillée**, début pré-rempli au lendemain de la fin de l'essai. Égalité de durée validée côté IPC.
- **Délais d'essai par catégorie socio-professionnelle** (`EssaiCategory` : libellé + durée + unité JOURS/MOIS) — paramétrables dans *Paramètres → « Délais d'essai (catégories) »* (SUPER_ADMIN / ADMIN / RH ; IPC `hr:essaiCategories:*`). Pré-rempli avec les catégories ivoiriennes usuelles. Le champ « Catégorie » du contrat est un sélecteur (avec saisie libre) ; pour un contrat ESSAI, choisir la catégorie **pré-remplit la date de fin** selon le délai paramétré.
- **Modèles de contrats éditables** par type (`ContractTemplate`) — édités depuis *Paramètres → Modèles d'imprimés → « Modèles de contrats de travail »* (sous-onglets **Modèles / Fonctions / Fiches de poste** ; accessible SUPER_ADMIN / ADMIN / RH). Mêmes capacités que les modèles de convention : zones **En-tête / Corps / Fin du document / Pied de page** (largeur %, hauteur px, couleur de fond), catalogue de **variables** `{{…}}` (employé, contrat, rémunération, montants en lettres, **CMU**, **représentant légal**, **autorité responsable**, **fonction**…), **import des zones depuis un modèle de convention**, **modèle par défaut par type**. 6 modèles ivoiriens par défaut (auto-migrés vers le système de zones). Le document est rendu côté renderer (`ContractDocumentPage`, données via `hr:contracts:getRenderData`) et exporté **PDF / Word / Impression** via `documentExport`.
- **Rémunération du contrat** : champ **CMU** (part salariale) ; le **total des retenues** est calculé automatiquement (ITS + CNPS + CMU), affiché et modifiable.
- **Représentant légal de l'entreprise** : employé sélectionné dans *Paramètres → Entreprise* (`company.legalRepEmployeeId`) → variables `{{entreprise.representant.*}}`. **Autorité responsable** : employé choisi par contrat (`EmploymentContract.responsibleAuthorityId`) → variables `{{autorite.*}}`. **Fonction de l'employé** (`ContractFunction` : titre + contenu en liste) sélectionnable sur le contrat → variables `{{contrat.fonction.titre / contenu}}` (IPC `hr:contractFunctions:*`).
- **Fiches de poste** (`JobDescriptionTemplate`, mêmes zones que les contrats) : modèles éditables dans *Paramètres → Modèles de contrats de travail → Fiches de poste* ; génération/impression par contrat (`ContractDocumentPage` / `JobDescriptionDocumentPage`, bouton sur chaque contrat de la fiche employé).
- **Contrats signés** (`EmployeeSignedContract`) : téléversement de fichiers signés rattachés à un employé (fiche employé → « Contrats signés » ; fichiers dans `storage/employees/<id>/signed-contracts/`, IPC `hr:signedContracts:*`). Consultables en lecture seule par le salarié dans « Mon espace RH ».
- **Dénomination sociale** : *Paramètres → Entreprise* distingue le **Nom (Sigle)** (`company.name`) et la **Dénomination sociale** (`company.denomination`, variable `{{entreprise.denomination}}`).

**Mon espace RH & Paie (self-service, lecture seule)**
- Menu **« Mon espace RH »** accessible à **tout utilisateur connecté** (route `/my-hr`), strictement limité à l'employé lié à son compte (`Employee.userId`). Onglets : **Profil & contrats** (infos + contrats + documents + contrats signés), **Bulletins** (aperçu/impression), **Congés & absences** (solde + demandes), **Pointage** (grille mensuelle), **Règlement intérieur**. Handlers `hr:me:*` (indépendants du rôle, jamais un autre employé). Additif : ne modifie pas les droits RH existants.
- **Règlement intérieur** : l'admin cible un document déjà archivé dans la GED (*Paramètres → « Règlement intérieur »*, `hr.reglementInterieur.documentId`) ; tout le personnel le consulte/imprime dans « Mon espace RH » (`hr:me:reglementInterieur` / `…Print`).

> **Accès RH restreint (MANAGER, ASSISTANTE_DIRECTION)** — accès opérationnel au module RH (personnel, contrats, bulletins, congés : consulter + gérer ; **pointage : consultation seule**) **limité aux employés dont le contrat en cours n'est pas un CDI** (cf. section permissions). La configuration (modèles, taux, catégories) reste réservée à SUPER_ADMIN / ADMIN / RH.

**Phase 2 — Paie & bulletins**
- Génération de bulletins (`Payslip` + `PayslipLine`, réf. `BUL-AAAA-NNNN`) avec moteur de calcul `payroll.service.ts` : CNPS (retraite salarié/employeur, prestations familiales, accident du travail, plafonds), **ITS** (barème progressif), CMU, FDFP, charges patronales et coût total employeur.
- Taux et barème **paramétrables** (AppSetting `payroll.rates`) — écran `/hr/payroll-settings`. ⚠️ Valeurs par défaut **à vérifier** au regard de la réglementation.
- **3 modèles de bulletins éditables** (`PayslipTemplate` : MODELE_1/2/3, en-tête/pied/couleur).
- Statuts bulletin : BROUILLON → VALIDE → PAYE / ANNULE. **Aperçu/impression PDF** et **export Excel/PDF** (liste via `ExportMenu` / `exceljs`).

**Phase 3 — Congés & absences**
- `LeaveType` (7 types par défaut : congé payé, maladie, maternité, paternité, exceptionnel, sans solde, absence) et `LeaveRequest` (réf. `CGE-AAAA-NNNN`).
- Calcul des jours ouvrés, **solde de congés payés** (acquisition `leave.accrualPerMonth` = 2,2 j/mois − jours pris approuvés), workflow d'approbation (EN_ATTENTE → APPROUVE / REFUSE / ANNULE).

**Phase 4 — Pointage / heures**
- `AttendanceRecord` (1 par employé/jour) : statut (PRESENT/ABSENT/CONGE/REPOS/FERIE/MALADIE), heures travaillées, heures supplémentaires, **heures d'arrivée / de départ** (`arrivalTime` / `departureTime`). Grille mensuelle éditable avec colonnes Arrivée / Départ (alimentées par le pointage QR).
- Valorisation des **heures supplémentaires** (`attendance.monthlyHours` = 173,33 ; `attendance.overtimeMajoration` = 15 %) **injectée automatiquement dans la paie** (ligne « Heures supplémentaires » du bulletin).

**Retards & Départs précipités** (`/hr/lateness`, onglet « Retards & Départs précipités » de *Gestion du personnel*)
**Accès :** page accessible à **tout utilisateur authentifié** (route hors `RoleGuard`, même principe que « Mon espace RH »). **SUPER_ADMIN, ADMIN, MANAGER** conservent la **vue complète** (tous les collaborateurs éligibles, filtre « Collaborateur », actions « Justifier »/« Retirer ») — contrôle de rôle **exact**, `LATENESS_ROLES` / `checkHrRole` dans `hr.ipc.ts`, comme le reste du module RH ; le MANAGER suit le même périmètre que Pointage/Congés (n'accède pas aux employés dont le compte utilisateur rattaché est SUPER_ADMIN/ADMIN). **Tous les autres rôles** (RH, ACCOUNTANT, ASSISTANTE_DIRECTION, AGENT, AGENT_TECHNIQUE, READONLY…) accèdent à la même page en **auto-consultation seule** : uniquement les journées de l'employé lié à leur propre compte (`Employee.userId`), **sans le filtre « Collaborateur »** ni les boutons « Justifier »/« Retirer » (colonne Actions masquée) — l'éligibilité par pondération de poste (`latenessEligibleEmployeeIds`) est **contournée** pour l'auto-consultation, un utilisateur devant toujours voir ses propres données quel que soit le profil de pondération de son poste. Distinction appliquée côté IPC dans `hr:lateness:list` (branche `LATENESS_ROLES` vs auto-consultation par `session.userId`) et côté UI dans `LatenessPage.tsx` (`isFullAccess`). Les handlers d'écriture (`justify`/`unjustify`) restent réservés à `LATENESS_ROLES`.
- Affiche, pour les collaborateurs dont le poste a une **pondération non nulle sur les KPI `ABSENCE_DAYS` et `ATTENDANCE_RATE`** (`latenessEligibleEmployeeIds`, repli sur un poids de 1 si aucun profil de pondération n'existe pour le poste — mêmes conventions que `weightsForPoste`), les **journées de retard d'arrivée ou de départ anticipé** au regard des seuils du pointage QR (`attendance.expectedArrival` / `expectedDeparture`, défaut 08:00/17:00).
- **Exclusion par défaut des comptes de direction** — les employés liés à un compte utilisateur **SUPER_ADMIN, ADMIN ou MANAGER** sont, par défaut, **ni calculés ni affichés** dans « Retards & Départs précipités » : ni dans la liste (admin/manager comme auto-consultation), ni dans le KPI de performance associé (`LATE_EARLY_DEPARTURE_HOURS`, qui retourne alors « non mesurable » comme un KPI sans compte utilisateur rattaché). Un commutateur *Paramètres → « Retards & Départs précipités »* (`LatenessSettingsTab.tsx`, réservé SUPER_ADMIN/ADMIN) permet de **réintégrer** ces employés (`AppSetting` `hr.lateness.includeManagementRoles`, `'true'`/`'false'`, défaut `false`). Logique centralisée dans `latenessIncludesManagementRoles()` / `managementLinkedEmployeeIds()` (`performance.service.ts`), appliquée dans `latenessEligibleEmployeeIds` (liste) et dans le calcul du KPI `LATE_EARLY_DEPARTURE_HOURS`.
- Chaque journée en écart peut être **liée** par un administrateur/manager à une **demande de congé approuvée couvrant ce jour**, ou à une **activité CRM de type « Visite chantier / Sortie en clientèle / Courses » (`VISITE`) marquée Traité**, à condition qu'elle n'ait **jamais déjà servi à justifier une autre journée** (`AttendanceDelayJustification.crmActivityId` unique). La liaison **marque immédiatement la journée « justifiée »** (`justified`, `justifiedById`, `justifiedAt`) ; un bouton « Retirer » permet d'annuler cette justification.
- **Statut « Tolérée »** — indépendamment de la justification, `LATENESS_ROLES` (SUPER_ADMIN/ADMIN/MANAGER) peuvent marquer une journée comme **Tolérée** (`tolerated`, `toleratedById`, `toleratedAt`) : marquage manuel **sans** congé ni activité liée, autorisé **uniquement si** le temps de la journée (`totalMinutes` = retard + départ anticipé) **n'excède pas** une limite paramétrable (*Paramètres → « Retards & Départs précipités » → « Limite de tolérance »*, `AppSetting` `hr.lateness.toleranceMinutes`, défaut 15 min ; contrôlée serveur dans `hr:lateness:tolerate`, lisible par `LATENESS_ROLES` via `settings:getLatenessSettings` bien que l'onglet Paramètres reste masqué au MANAGER). `justified` et `tolerated` sont **mutuellement exclusifs** sur une même journée (poser l'un efface l'autre). La barre de synthèse affiche un troisième cumul **« Cumul toléré sur la période »**, à côté des cumuls non justifié/justifié. Boutons « Justifier »/« Tolérer » (ce dernier désactivé si le temps dépasse la limite) puis « Retirer » selon l'état. Handlers `hr:lateness:tolerate` / `untolerate` (réservés à `LATENESS_ROLES`, même garde que `justify`/`unjustify`).
- **Impact sur le KPI** — le cumul utilisé par le KPI `LATE_EARLY_DEPARTURE_HOURS` (`computeUnjustifiedLatenessMinutes`) est **exactement** le « Cumul non justifié » affiché à l'écran : il exclut aussi bien les journées **justifiées** que les journées **tolérées**.
- Modèle Prisma `AttendanceDelayJustification` (unique par `employeeId` + `date`). Handlers `hr:lateness:list` / `linkableLeaveRequests` / `linkableActivities` / `justify` / `unjustify` / `tolerate` / `untolerate`. Logique de calcul (lignes de retard, cumul non justifié, éligibilité par pondération) centralisée dans `performance.service.ts` (`computeLatenessLinesForEmployee`, `computeUnjustifiedLatenessMinutes`, `latenessEligibleEmployeeIds`), réutilisée par le KPI `LATE_EARLY_DEPARTURE_HOURS` du Module 14.

**Pointage par QR Code (application web autonome — dossier `web/`)**
- Le pointage est servi par une **application web autonome en PHP** (dossier `web/` à la racine du dépôt : `index.php`, `api.php`, `db.php`, `config.php`, `README.md`), **déposée sur le serveur web local de l'entreprise** (Apache / XAMPP / WAMP). Elle est **indépendante de l'application de bureau** : le personnel peut pointer tant que le serveur web et MariaDB sont actifs, même si l'app Electron n'est lancée sur aucun poste. *(L'ancien serveur HTTP embarqué dans le process principal a été retiré.)*
- L'app web se connecte **directement à la même base MariaDB** (PDO, identifiants dans `config.php`). Le **QR Code encode l'URL de l'app web déployée** (ex. `http://192.168.1.10/pointage/`), configurable par l'admin.
- Parcours : l'employé scanne le QR → page web → **connexion** (login/mot de passe du compte applicatif, vérifié par `password_verify` compatible bcrypt) → choix **arrivée / départ** → écriture dans `AttendanceRecord`.
- Règles (implémentées dans `web/api.php`) : si le compte n'est pas lié à un membre du personnel (`Employee.userId`), message **« Compte d'utilisateur non encore associé à un membre du personnel »** ; **un seul** pointage d'arrivée et **un seul** de départ par jour ; **avertissement** si l'arrivée dépasse le seuil (défaut 08:00) ou si le départ le précède (défaut 17:00). Seuils lus depuis `AppSetting` (`attendance.expectedArrival` / `attendance.expectedDeparture`), repli sur `config.php`.
- **Paramètres** (`/settings` → onglet *Pointage QR*, SUPER_ADMIN/ADMIN) : activation (affichage du QR), **URL de l'app web** déployée (avec détection des IP locales), seuils horaires, **rôles autorisés** à voir le QR au tableau de bord (mécanisme calqué sur le slideshow), **aperçu du QR modifiable**.
- **Tableau de bord** : les rôles autorisés voient un widget QR **téléchargeable et imprimable** (composant `QrCodeBox`, rendu canvas via lib `qrcode`), comme le slide. Clés : `attendance.qr.enabled` / `attendance.qr.baseUrl` / `attendance.qr.allowedRoles` / `attendance.qr.model`.
- **3 modèles de QR** sélectionnables (`attendance.qr.model` = `1`/`2`/`3`) : (1) classique noir & blanc, (2) logo au centre, (3) couleur + logo. Les modèles « avec logo » insèrent le **logo de l'entreprise au centre** du QR (correction d'erreur niveau H pour rester scannable).
- Sécurité : usage interne sur réseau local ; mots de passe vérifiés par bcrypt, jamais stockés ni transmis en clair.

> **Calcul de la paie — avertissement.** Les taux (CNPS/ITS/CMU/FDFP), plafonds et le barème ITS sont des **valeurs de référence paramétrables** ; ils doivent être validés selon la réglementation en vigueur avant exploitation en production. Toute la logique est centralisée dans `payroll.service.ts`, `leave.service.ts` et `attendance.service.ts`.

---

### Module 13 — Gestion des visiteurs

**Route :** `/visitors`
**Accès (interface interne) :** rôles **SUPER_ADMIN, ADMIN, ASSISTANTE_DIRECTION** (accueil / secrétariat), via `RoleGuard` + contrôle IPC (`VISITOR_ROLES` dans `visitors.ipc.ts`). Configuration du QR : SUPER_ADMIN / ADMIN uniquement.

Module d'enregistrement des visiteurs. Modèle Prisma `Visitor` : `firstName` (Prénoms), `lastName` (Nom), `company` (Entreprise), `phone` (Contacts), `email`, `objet` (Objet de visite), `details`, `visitedAt` (**jour + heure automatiques**), `source` (`QR` | `INTERNE`), `createdById`.

- **Double saisie** : (1) **interface dédiée** dans l'application (liste + formulaire `/visitors/new`, source `INTERNE`) ; (2) **auto-enregistrement par le visiteur** via le **QR Code Visiteurs** (source `QR`).
- **Objets de visite paramétrables** : modèle `VisitObject` (libellés actifs/inactifs) géré depuis l'**onglet « Objets de visite »** du module (`/visitors/objects`, barre d'onglets `VisitorsTabs`). Le champ « Objet de visite » devient un **sélecteur avec recherche** (`FormSearchSelect`) alimenté par cette liste — côté app **et** côté formulaire web public (`<datalist>` peuplé depuis `VisitObject`). IPC : `visitors:listObjects` / `createObject` / `updateObject` / `deleteObject`.
- **QR Visiteurs** — même principe que le pointage QR : une **application web autonome PHP** (dossier `web-visiteurs/`) déposée sur le serveur web local, **publique (sans connexion)** car les visiteurs n'ont pas de compte. Elle se connecte directement à MariaDB (`web-visiteurs/api.php` → insert `Visitor` source `QR`, date/heure auto, honeypot anti-spam).
- **Paramétrage** identique au pointage (`/settings` → onglet *QR Visiteurs*, admin) : activation, **URL de l'app web déployée**, **rôles autorisés** à voir le QR au tableau de bord, **3 modèles de QR**. Clés : `visitors.qr.enabled` / `visitors.qr.baseUrl` / `visitors.qr.allowedRoles` / `visitors.qr.model`.
- **Tableau de bord** : widget QR Visiteurs (téléchargeable / imprimable, légende « VISITEURS ») pour les rôles autorisés. La liste affiche des compteurs (aujourd'hui / mois / total).

---

### Module 14 — Évaluation & gestion des performances du personnel

**Routes :** `/performance/dashboard`, `/performance/objectives`, `/performance/evaluations`, `/performance/evaluations/:id`, `/performance/rankings`, `/performance/settings`
**Accès :** gestion opérationnelle **SUPER_ADMIN, ADMIN, RH, MANAGER** ; configuration (catalogue KPI, pondérations) **SUPER_ADMIN, ADMIN, RH** ; signature « Direction » **SUPER_ADMIN, ADMIN**. Contrôle de rôle **exact** côté IPC (`checkExact`, sans équivalence `checkRole`) dans `performance.ipc.ts`. Un **MANAGER** ne voit/gère **que son équipe** (employés dont `Employee.managerId` = sa propre fiche employé) — périmètre appliqué côté IPC (`accessibleEmployeeIds` / `assertEmployeeAccessible` / `scopeEmployeeWhere`).

Système complet de gestion de la performance. Modèles Prisma : `KpiDefinition`, `PerformanceWeightProfile` + `PerformanceWeightLine`, `PerformanceObjective`, `PerformanceEvaluation` + `PerformanceEvaluationLine`, `ProgressPlan`, `PerformanceRankingSnapshot` + `PerformanceRankingEntry`. Le champ **`Employee.managerId`** (self-relation `EmployeeManager`) désigne le responsable hiérarchique (sélectionnable sur la fiche employé).

- **Objectifs (annuels / trimestriels)** par **collaborateur ou par poste** (`PerformanceObjective` : cible exclusive `employeeId` **XOR** `poste` ; cycle ANNUEL/TRIMESTRIEL, année, trimestre, pondération, cible, KPI mesuré optionnel, avancement, statut). Un objectif **par poste** s'applique à tous les employés occupant ce poste et apparaît dans leur « Mes objectifs » (self-service).
- **KPI configurables** (`KpiDefinition`) **calculés automatiquement** depuis les données de l'entreprise via `performance.service.ts` (`computeMetricValue`). Attribution par utilisateur (`Employee.userId`) : ventes/conventions (`Convention.agentId`), **conventions résiliées** (`Convention.type` = RESILIATION / AVENANT_RESILIATION_HERITE, LOWER_BETTER), commissions (`Commission.userId`), encaissements (`Payment` sur factures de l'agent), activités CRM (`CrmActivity.userId`), **taux de conversion prospects → clients** (`Prospect.assignedToId` — part des prospects assignés créés sur la période désormais convertis) ; attribution directe (`Employee.id`) : assiduité/pointage (`AttendanceRecord`), congés (`LeaveRequest`), **retards d'arrivée / départs anticipés non justifiés** (`LATE_EARLY_DEPARTURE_HOURS`, cumul en heures, LOWER_BETTER — cf. « Retards & Départs précipités » du Module 12). Sources : `SALES / COMMISSIONS / ACCOUNTING / CRM / PROSPECTS / ATTENDANCE / LEAVE / PROJECT / MANUAL`. *(Pas de module « tickets d'assistance » → KPI `MANUAL`. `Project` n'a pas d'attribution par utilisateur → KPI `PROJECT` au niveau service ou manuel.)* Un employé **non lié à un compte utilisateur** n'a que des KPI manuels.
- **Pondération configurable par poste** (`PerformanceWeightProfile` + lignes) : chaque poste valorise différemment les KPI ; poids relatifs ramenés à 100 % au calcul du score. Un KPI **non renseigné** dans le profil retombe sur un **poids par défaut de 1** (`weights.get(kpi.id) ?? 1`, cf. `weightsForPoste`) — pour **exclure explicitement** un KPI d'un poste (poids nul), il faut enregistrer une ligne à **0**, distincte de « non renseigné ». Le formulaire (`PerformanceSettingsPage.tsx`) persiste désormais les poids à 0 saisis (auparavant filtrés/supprimés avant envoi, ce qui les rendait indiscernables d'un KPI jamais configuré).
- **Évaluations avec validation électronique à 3 niveaux** (`PerformanceEvaluation`, réf. `EVA-AAAA-NNNN`) : circuit `BROUILLON → SOUMISE → VALIDEE_RESPONSABLE → VALIDEE_COLLABORATEUR → VALIDEE_DIRECTION` (ou `REFUSEE`). Signatures horodatées (`managerSignedById/At`, `employeeSignedById/At`, `directionSignedById/At`). Bouton **« Calculer les KPI »** (`performance:evaluations:computeKpis`) qui injecte les valeurs réelles et la note globale ; lignes KPI/objectifs éditables (`PerformanceEvaluationLine`).
- **Historique des évaluations et plans de progrès** (`ProgressPlan` : actions, **besoins de formation**, échéance, statut) — rattachés à une évaluation, persistés (soft delete).
- **Classements multi-périodes** (`performance:rankings:get`) hebdo/mensuel/trimestriel/semestriel/annuel. **Base mixte** : score **KPI pondéré** normalisé relativement à la cohorte pour les périodes courtes (SEMAINE/MOIS), **note d'évaluation validée** pour les périodes de revue (TRIMESTRE/SEMESTRE/ANNEE), avec repli KPI. Archivage d'un classement figé (`PerformanceRankingSnapshot` + `…Entry`, `performance:rankings:snapshot` / `history` / `getSnapshot`).
- **Tableau de bord RH de performance** (`performance:dashboard`) : performances par service (département), tendance des notes validées (12 mois), top performers du mois, besoins de formation agrégés, compteurs.
- **Self-service « Mes performances »** : onglet dans « Mon espace RH » (`performance:me:overview` / `evaluation` / `ranking`), avec **signature collaborateur** (`performance:me:sign`, réservée à l'employé concerné via `Employee.userId`).

---

### Module 15 — Réseaux Sociaux & Plateformes Web

**Routes :** `/social-media/dashboard`, `/social-media/publications`, `/social-media/followers`, `/social-media/platforms`
**Accès :** Tableau de bord et Plateformes : **SUPER_ADMIN, ADMIN, MANAGER uniquement** — liste **explicite** contrôlée par rôle exact (`checkExactRole` dans `social-media.ipc.ts`, sans l'équivalence MANAGER de `checkRole`) : **ni ACCOUNTANT, ni ASSISTANTE_DIRECTION n'y ont accès** (routes fermées par `RoleGuard`, sous-menus masqués dans `Sidebar.tsx`, handlers IPC refusés). Publications & articles : **tous les rôles sauf READONLY** (dont ACCOUNTANT et ASSISTANTE_DIRECTION), avec périmètre par auteur (voir ci-dessous). Abonnés : **SUPER_ADMIN, ADMIN, MANAGER, ASSISTANTE_DIRECTION, AGENT_TECHNIQUE** (liste explicite, rôle exact également) — **ACCOUNTANT n'y a pas accès**, avec périmètre par plateforme responsable (voir ci-dessous).

> **Plateformes — périmètre AGENT_TECHNIQUE.** SUPER_ADMIN, ADMIN et MANAGER voient toutes les plateformes. L'AGENT_TECHNIQUE (seul rôle restreint ayant accès à une lecture des plateformes, pour alimenter les sélecteurs de « Abonnés » et « Publications & articles ») ne voit et ne peut agir **que sur les plateformes dont il est le responsable** (`SocialPlatform.responsibleId`) : liste filtrée (`platformScopeWhere`), relevés d'abonnés (lecture, création, suppression) et création de publication refusés sur une plateforme dont il n'est pas responsable (`assertPlatformAccessible`). Il ne peut pas gérer les plateformes elles-mêmes (create/update/delete restent réservés à `WRITE_ROLES`). Constantes `PLATFORM_READ_ROLES` / `PLATFORM_FULL_VIEW_ROLES` / `hasPlatformFullView` dans `social-media.ipc.ts`.

> **Publications & articles — périmètre par auteur.** SUPER_ADMIN, ADMIN et MANAGER voient et gèrent toutes les publications. Les autres rôles autorisés (ACCOUNTANT, ASSISTANTE_DIRECTION, AGENT, AGENT_TECHNIQUE, RH) ne voient et ne gèrent **que les publications dont ils sont l'auteur** (`SocialPublication.authorId`) : liste filtrée côté IPC (`publicationScopeWhere`), modification/suppression refusées si l'auteur diffère, création avec auteur forcé à soi-même (impossible d'attribuer une publication à un tiers). Constantes `PUBLICATION_FULL_VIEW_ROLES` / `hasPublicationFullView` dans `social-media.ipc.ts`. Côté formulaire, le champ « Auteur » est verrouillé sur soi-même pour ces rôles.

> **Barre d'onglets — n'affiche que les volets accessibles au rôle connecté.** La barre commune aux 4 pages du module (`SocialMediaTabs.tsx`) filtre ses onglets selon le rôle de l'utilisateur connecté (mêmes listes que les `RoleGuard` de `router.tsx` / `Sidebar.tsx`) : un **AGENT**, par exemple, ne voit que l'onglet **« Publications & articles »** — « Tableau de bord », « Abonnés » et « Plateformes » sont masqués plutôt que menant à un onglet inaccessible.

Suivi manuel de l'activité digitale de l'entreprise : comptes réseaux sociaux (Facebook, Instagram, LinkedIn, TikTok, X, YouTube) et site web. Modèles Prisma : `SocialPlatform` (compte suivi, responsable optionnel), `SocialPublication` (publication ou article : plateforme, auteur, date, vues, interactions), `SocialFollowerSnapshot` (relevé ponctuel du nombre d'abonnés par plateforme, unique par jour).

- **Plateformes** (`/social-media/platforms`) : CRUD (soft delete), type, URL, responsable (compte utilisateur), actif/inactif.
- **Publications & articles** (`/social-media/publications`) : saisie d'une publication (titre, type, date, URL, vues, interactions, auteur). Alimente le classement CRM au type d'activité **« Créas / Publications / Articles »** (`ActivityType.CREATION_PUBLICATION`, formulaire « Nouvelle activité »). **Pièces jointes** (visuels, brouillons, justificatifs) via `Document.socialPublicationId` (relation `SocialPublicationAttachments`, même principe que les pièces jointes d'activité CRM) — téléversement par `documents:import`, indicateur trombone avec compteur dans la liste.
- **Abonnés** (`/social-media/followers`) : relevés ponctuels du nombre d'abonnés par plateforme (un relevé par plateforme et par jour, upsert), avec évolution affichée par rapport au relevé précédent.
- **Tableau de bord** (`/social-media/dashboard`) : compteurs (plateformes actives, publications, vues, interactions, abonnés cumulés), courbes d'évolution sur 12 mois glissants (publications/vues/interactions, abonnés reconstitués à partir des relevés), répartition par plateforme.
- **Catalogue KPI (source `SOCIAL`)** : `SOCIAL_PUBLICATIONS_COUNT`, `SOCIAL_VIEWS`, `SOCIAL_INTERACTIONS` (attribution par `SocialPublication.authorId`), `SOCIAL_FOLLOWERS_GROWTH` (croissance nette d'abonnés sur la période, cumulée sur les plateformes dont l'employé est `responsibleId`). Objectifs par poste par défaut créés pour **INFOGRAPHE & COMMUNITY MANAGER** (les 4 KPI ci-dessus, année 2026, cibles indicatives à ajuster dans *Performances → Objectifs*).

---

### Module 16 — Innovations IT

**Routes :** `/innovations`, `/innovations/:id`
**Accès :** création et gestion des fiches — **SUPER_ADMIN, ADMIN, MANAGER, RH, AGENT_TECHNIQUE** (liste explicite, rôle exact via `checkExactRole` dans `it-innovations.ipc.ts`, sans l'équivalence MANAGER de `checkRole`). Validation des phases (valider/rejeter) et suppression — **SUPER_ADMIN, ADMIN, MANAGER uniquement**.

Module de suivi des innovations IT portées par un employé, alimentant le KPI de performance **« Nombre d'innovations IT mises en œuvre »** (`IT_INNOVATIONS_IMPLEMENTED`, source `IT_INNOVATION`, Module 14). Modèle Prisma `ItInnovation` (référence auto `INNOV-AAAA-NNNN`), rattaché à un `Employee` (porteur).

- **Périmètre** : SUPER_ADMIN/ADMIN/MANAGER/RH (`FULL_VIEW_ROLES`) voient et gèrent toutes les innovations, et choisissent librement le porteur à la création. **AGENT_TECHNIQUE** ne voit et ne peut agir **que sur ses propres innovations** (porteur = employé lié à son compte via `Employee.userId`) — auto-affecté à la création (`resolveOwnEmployeeId`), sans sélecteur de porteur côté formulaire ; périmètre appliqué côté IPC via `innovationScopeWhere` / `assertOwnership`.
- **Workflow en 3 phases**, chacune soumise par le porteur puis validée ou rejetée par un validateur (SUPER_ADMIN/ADMIN/MANAGER) :
  1. **Phase 1 — Énoncé et description** (saisie à la création) → validée : **+15%** de progression, passe en Phase 2.
  2. **Phase 2 — Démonstration et validation de test** → validée : **+35%** (cumulé **50%**), passe en Phase 3.
  3. **Phase 3 — Validation finale et intégration** → validée : **+50%** (cumulé **100%**) → statut **Validée**, l'innovation est « mise en œuvre » et comptée par le KPI.
- **Rejet non définitif** : un rejet de phase (motif obligatoire) renvoie l'innovation en révision (statut `PHASEn_REJETEE`) — le porteur corrige le contenu de la phase, ce qui la resoumet automatiquement pour validation (`status` repasse à `PHASEn_EN_ATTENTE`). La progression n'est pas perdue lors d'un rejet ultérieur.
- **Statuts** (`ItInnovationStatus`) : `PHASE1_EN_ATTENTE` → (`PHASE1_REJETEE` ↺) → `PHASE2_EN_COURS` → `PHASE2_EN_ATTENTE` → (`PHASE2_REJETEE` ↺) → `PHASE3_EN_COURS` → `PHASE3_EN_ATTENTE` → (`PHASE3_REJETEE` ↺) → `VALIDEE`.
- **KPI `IT_INNOVATIONS_IMPLEMENTED`** (catalogue Performance, Module 14) : nombre d'innovations au statut `VALIDEE` sur la période, attribuées à l'employé (`Employee.id`, attribution directe comme `ATTENDANCE`/`LEAVE`, sans exiger de compte utilisateur), datées par la validation de la Phase 3 (`phase3ValidatedAt`). Calcul dans `computeMetricValue` (`performance.service.ts`).
- **Pièces jointes par phase** : chaque phase peut porter des documents justificatifs (spécifications, captures, vidéo de démonstration, preuve d'intégration…) via `Document.itInnovationId` (relation `ItInnovationAttachments`) + `Document.itInnovationPhase` (1, 2 ou 3) — même mécanisme que les pièces jointes d'activité CRM, téléversées par `documents:import`. Ajout possible dès la création (formulaire « Nouvelle innovation IT », phase 1) ou depuis la fiche détail pour toute phase déjà atteinte (composant `PhaseAttachments`, glisser-déposer ou sélecteur). **Aperçu intégré lors de la validation par étape** : `ValidatePhaseModal` affiche le contenu soumis et les pièces jointes de la phase (réutilise `DocumentPreview` du module Archivage — images, PDF, audio, vidéo — avec repli « Ouvrir » pour les formats non prévisualisables), afin que le validateur (SUPER_ADMIN/ADMIN/MANAGER) dispose de tous les justificatifs avant de valider ou rejeter. Indicateur trombone avec compteur dans la liste (`_count.attachments`).

---

### Module 17 — Moteur de devis de construction

**Routes :** `/construction`, `/construction/projects/new`, `/construction/projects/:id`, `/construction/projects/:id/edit`, `/construction/estimates/:id`
**Accès :** création de projet, génération d'estimation (Niveau 1/2) et conversion en devis commercial — **SUPER_ADMIN, ADMIN, MANAGER, ACCOUNTANT** (`WRITE_ROLES`/`FULL_ACCESS` dans `construction-projects.ipc.ts`, rôle **exact**, sans les équivalences de `checkRole`). Suppression d'un projet/d'une estimation — **SUPER_ADMIN, ADMIN, MANAGER** (`DELETE_ROLES`, ACCOUNTANT exclu). Les autres rôles (**AGENT, AGENT_TECHNIQUE, ASSISTANTE_DIRECTION, READONLY**) sont en **lecture seule**, limitée aux projets rattachés à un **client ou un prospect dont ils sont le référent commercial** (`Client.assignedToId` / `Prospect.assignedToId` — périmètre par référent, et non par créateur du projet ; fonctions `scopeWhere`/`canAccess` dans `construction-projects.ipc.ts`) ; les boutons d'écriture (Nouveau projet, Modifier, Générer une estimation, Créer le devis) leur sont masqués côté UI et les routes de création/édition fermées par `RoleGuard`. Gestion de la bibliothèque technique (lots, bordereau de prix, ouvrages, catalogue et profils de coefficients, localités) — *Paramètres → « Moteur de devis construction »* (7 onglets : Lots de travaux, Bordereau des prix, Bibliothèque d'ouvrages, Catalogue des coefficients, Profils de coefficients, Localités, **Formules de calcul** — ce dernier une référence en lecture seule des 57 formules du registre `construction-formulas.ts`, `ConstructionFormulasSettingsTab.tsx`) — rôle **exact**, sans les équivalences de `checkRole`. **Lots de travaux, Bordereau des prix et Localités** : écriture ouverte à **SUPER_ADMIN, ADMIN, MANAGER, ACCOUNTANT** (`checkLibExtendedWrite`/`LIB_EXTENDED_WRITE_ROLES`). **Bibliothèque d'ouvrages, Catalogue des coefficients et Profils de coefficients** : réservés à **SUPER_ADMIN, ADMIN uniquement** (`checkLibWrite`/`LIB_ADMIN_ROLES`, dans `construction-library.ipc.ts`) ; boutons d'écriture masqués côté composant pour les rôles non autorisés, en plus du blocage IPC.

Génère un **devis quantitatif et estimatif de construction** à partir d'une vingtaine de caractéristiques d'un projet (type de bâtiment, standing, surfaces, nombre de pièces/chambres/SDE/SDB/WC, toiture, menuiserie, revêtement de sol, climatisation, terrain, localisation, clôture, piscine, aménagements extérieurs, assainissement…) — **pas un simple prix au m²**, mais une correspondance entre ces caractéristiques et une **bibliothèque d'ouvrages** (recettes de ressources), regroupés en **22 lots de travaux**, via un **moteur de coefficients** paramétrable par (type de bâtiment × standing). Méthode de prix BTP : **déboursé sec → frais de chantier → frais généraux → marge = prix de vente HT** (mode `CASCADE` par défaut : chaque majoration s'applique au sous-total courant, cf. `ConstructionEstimate.markupMode` — `ADDITIF` disponible en alternative).

- **Bordereau de prix centralisé** (`ConstructionResource`, ~55 ressources seedées — ciments, agrégats, aciers HA, agglos, revêtements, électricité, plomberie, 10 taux horaires de main d'œuvre…) : le prix courant d'une ressource est **lu à chaud** à chaque génération — modifier le prix du ciment (*Paramètres → « Bordereau des prix »* → « Mettre à jour le prix », qui écrit un `ConstructionResourcePriceHistory`) répercute automatiquement le nouveau coût sur **tous** les ouvrages qui en dépendent, dès la prochaine génération. Les estimations déjà générées restent **figées** (`ConstructionEstimateLine`/`ConstructionEstimateResourceLine` sont des snapshots). Prix par ville : coefficient générique (`ConstructionLocality.priceCoefficient`, 8 localités seedées) + dérogation ponctuelle par ressource (`ConstructionResourcePriceVariant`) quand le prix réel est connu.
- **Bibliothèque d'ouvrages** (`ConstructionWorkItem` + `ConstructionWorkItemComponent`, la « recette ») : chaque ouvrage (ex. « Mur en agglos de 15 ») consomme des ressources en quantité par unité + un taux de pertes ; le **déboursé sec** est la somme pondérée par le prix courant. La quantité d'un ouvrage pour un projet donné est calculée soit par une **formule paramétrique** (`formulaCode`, registre TypeScript `src/main/services/construction-formulas.ts`), soit **fixe**, soit en **% du total des autres lignes** (`percentOfTotalPct`, utilisé pour les lots « Installation de chantier » et « Nettoyage & réception »). Une règle d'applicabilité déclarative (`applicabilityRule`, JSON) permet d'inclure/exclure un ouvrage selon les caractéristiques du projet (ex. toiture, menuiserie, climatisation, standing de cuisine, présence d'une piscine/clôture/aménagements). **Bibliothèque seedée sur l'ensemble des 22 lots** (~71 ouvrages) : les 10 lots « de fond » (Terrassements, Fondations, Béton armé, Maçonnerie, Électricité, Plomberie, Revêtements, Peinture, Installation/Nettoyage forfaitaires) portent des ouvrages **inconditionnels** (une ligne à chaque génération) ; les **12 lots complémentaires** (charpente/couverture, menuiserie alu/bois, climatisation, faux plafond, appareils sanitaires, cuisine, assainissement, VRD, clôture, aménagements extérieurs, piscine) portent des ouvrages **conditionnels** (`applicabilityRule` sur `roofType`/`joineryType`/`acType`/`hasFalseCeiling`/`kitchenType`/`sanitationType`/`fenceLength`/`gateCount`/`exteriorPavedSurface`/`hasLandscaping`/`hasPool`) — une ligne n'apparaît sur le devis que si le projet a effectivement la caractéristique correspondante (ex. pas de piscine ⇒ pas de ligne piscine, aucun avertissement). L'indicateur `coveragePct` d'une estimation reflète donc la part des lots **pertinents pour ce projet précis** qui ont produit une ligne (un projet sans piscine ni faux plafond ni aménagements extérieurs plafonne légitimement en dessous de 100 %, ce qui n'est pas une lacune de bibliothèque) ; `warnings[]` ne signale plus que les projets aux options les plus complètes atteignent 100 % de couverture.
- **Moteur de coefficients** (`ConstructionRatioDefinition`, catalogue de ~64 coefficients — calque du catalogue KPI ; `ConstructionRatioProfile` + `ConstructionRatioValue`, un profil = un jeu de coefficients pour un couple **(type de bâtiment × standing)**, calque de `PerformanceWeightProfile`) : le standing agit sur de **vraies différences de quantité/qualité** (ex. `PRISES_PAR_CHAMBRE` 2 en économique → 6 en luxe, hauteur sous plafond, coefficient de revêtement…), pas sur un multiplicateur arbitraire appliqué au prix. **Les 45 profils possibles sont seedés** (les 9 types de bâtiment × les 5 standings). Pour les 5 typologies résidentielles (Villa basse/duplex/triplex, Maison économique, Immeuble R+2 et plus), la progression de coefficients par standing est **partagée** — la différenciation entre types vient des caractéristiques du projet (niveaux, pièces, surface) traversant les mêmes formules, pas d'un jeu de coefficients distinct : un duplex/triplex n'a donc pas besoin de coefficients propres, le nombre de niveaux (`levels`) suffit à faire varier les quantités (murs, semelles, escaliers…). Pour les 4 typologies **non résidentielles** (Bureau, Commerce, Entrepôt/hangar, Autre), le registre de formules actuel — bâti autour de chambres/séjour/cuisine/SDE-SDB — n'a pas de notion de bureaux, surface de vente ou quai de chargement : les mêmes coefficients résidentiels y sont repris **à titre indicatif** (mieux qu'une absence totale de profil), avec un avertissement explicite dans la `description` de chacun de ces 20 profils, à corriger si ces typologies doivent être exploitées commercialement. Nouveau coefficient = une ligne de catalogue + une entrée dans le registre de formules — jamais une migration.
- **Niveau 1 — Estimation rapide** (`construction:quickEstimate`, non persistée) : **même moteur** que le Niveau 2, restitué agrégé (budget min/max ± tolérance, prix moyen/m², ventilation par phase — gros œuvre/second œuvre/électricité/plomberie/finitions/VRD/aménagements) — garantit que l'estimation rapide ne contredit jamais le devis détaillé. Appelée en direct (debounce) depuis le formulaire « Nouveau projet » (`QuickEstimatePanel`).
- **Niveau 2 — Devis détaillé** (`construction:generateEstimate`, persisté dans `ConstructionEstimate` + `ConstructionEstimateLine` + `ConstructionEstimateResourceLine`, versionné par projet) : dizaines de lignes lot → ouvrage → unité → quantité → PU → montant, chacune tracée (`formulaTrace`, ex. « 180,00 m² × 1,10 (COEF_REVETEMENT_SOL) = 198,00 m² »). Peut créer **directement un devis** du module Devis existant (`Quote` + `QuoteItem`, `createQuote: true` ou action séparée `construction:estimates:toQuote`) : chaque lot devient une `QuoteItem.category`, déclenchant le regroupement/sous-total déjà géré par `groupItemsByCategory` (`quoteTemplate.ts`) — **aucune duplication** de cette logique, export PDF/DOCX du devis via les canaux génériques `documents:*` déjà partagés.
- **Quantitatif des matériaux** et **besoin en main d'œuvre** (`construction:estimates:materials`/`labor`) : agrégation de `ConstructionEstimateResourceLine` (un seul modèle, filtré par `resourceType`), auto-cohérent avec le déboursé sec total (Σ montants ressources ≈ `totalDeboursSec`, hors ouvrages forfaitaires en `percentOfTotalPct`, qui n'ont pas de recette).
- **Marge prévisionnelle** (`construction:estimates:summary`) : cascade déboursé sec → coût de réalisation → prix de revient → prix de vente, avec taux de marge affiché.
- **5 documents PDF exportables par estimation** (écran « Devis détaillé », `src/renderer/modules/construction/utils/estimateDocument.ts`, générés côté renderer via les canaux génériques `documents:exportDocumentPdf` — aucun nouvel IPC) : les 22 lots sont regroupés en **3 corps de métier classiques du BTP** à partir de `ConstructionEstimateLine.lotPhase` (7 valeurs déjà calculées pour le Niveau 1, sans nouvelle donnée en base) — **Gros œuvre** (phase `GROS_OEUVRE`), **Second œuvre** (`SECOND_OEUVRE` + `ELECTRICITE` + `PLOMBERIE` + `VRD`), **Finitions** (`FINITIONS` + `AMENAGEMENTS`) — chacun exporté en document séparé (ouvrages groupés par lot avec sous-total, comme le tableau à l'écran). **Main d'œuvre** : la main d'œuvre de chaque ouvrage est intégrée à son prix unitaire (déboursé sec = matériaux + main d'œuvre + transport) et n'apparaît donc jamais comme une ligne séparée sur le devis détaillé ou sur les 3 documents par corps de métier — ce document dédié l'isole et la chiffre à part, par corps de métier, à partir de `ConstructionEstimateResourceLine` filtré `resourceType = MAIN_OEUVRE` (même source que l'onglet « Besoin main d'œuvre », total vérifié cohérent avec `totalDeboursMainOeuvre` de l'estimation). **DQE Complet** : cumul des 22 lots (toutes les lignes) + cascade de prix complète (déboursé sec → frais de chantier → frais généraux → marge → HT → TVA → TTC).
- **Main d'œuvre par lot sur le devis commercial** (option « Détailler la main d'œuvre par lot » de « Créer le devis commercial » / « Créer aussi le devis commercial », `ConvertToQuoteModal.tsx` / `GenerateEstimateModal.tsx`, payload `splitLaborByLot`) : par défaut, la conversion estimation → `Quote` reprend chaque ouvrage tel quel (prix unitaire fusionné, comportement historique inchangé). Cochée, `buildQuoteItems` (`construction-projects.ipc.ts`) retire de chaque ligne d'ouvrage la part main d'œuvre (`ConstructionEstimateLine.deboursMainOeuvre`, déjà connue par ouvrage) au **même ratio de marquage** que le reste de la ligne (`prixUnitaireHT / deboursSecUnitaire`, facteur multiplicatif constant quel que soit le déboursé dans la cascade CASCADE/ADDITIF), et ajoute **une ligne récapitulative « Main d'œuvre — <Lot> » en fin de chaque lot**. La ligne main d'œuvre est calculée **par complément** (`montant lot − matériaux`), jamais par un recalcul indépendant, pour garantir que chaque sous-total de lot — et le total du devis — reste **strictement identique au centime près**, avec ou sans l'option (vérifié par script direct sur une estimation réelle : même total à 54 124 383,05 FCFA, 52 lignes → 69 avec l'option, tous les sous-totaux de lot inchangés). `groupItemsByCategory` (`quoteTemplate.ts`) préservant l'ordre d'insertion au sein d'un groupe, les lignes main d'œuvre — ajoutées en fin de tableau — atterrissent automatiquement en dernière ligne de leur lot sans logique d'interclassement dédiée.
- **Niveau 3 — DQE avec métrés réels** : **reporté** — le schéma réserve les champs nécessaires à une reprise manuelle des quantités par ouvrage (`ConstructionEstimateLine.overriddenQuantity`/`isOverridden`/`overrideNote`) mais aucune UI n'y est câblée dans cette phase. **Planning prévisionnel** et **courbe de décaissement** (également listés dans la demande d'origine) : non implémentés dans cette phase.
- ⚠️ **Les prix, ratios et compositions d'ouvrages livrés par défaut sont des valeurs de référence indicatives** (marché ivoirien, ordre de grandeur, script `scripts/seed-construction.mjs`) — à vérifier et ajuster avant toute exploitation commerciale (même convention que les taux de paie du Module 12).

---

### Module 18 — Moteur de devis de permis de construire

**Routes :** `/permits`, `/permits/projects/new`, `/permits/projects/:id`, `/permits/projects/:id/edit`, `/permits/estimates/:id`
**Accès :** création de projet, génération d'estimation et conversion en devis commercial — **SUPER_ADMIN, ADMIN, MANAGER, ACCOUNTANT** (`WRITE_ROLES`/`FULL_ACCESS` dans `permit-projects.ipc.ts`, rôle **exact**). Suppression d'un projet/d'une estimation — **SUPER_ADMIN, ADMIN, MANAGER** (`DELETE_ROLES`). Les autres rôles (**AGENT, AGENT_TECHNIQUE, ASSISTANTE_DIRECTION, READONLY**) sont en **lecture seule**, limitée aux projets rattachés à un **client ou un prospect dont ils sont le référent commercial** — mêmes fonctions `scopeWhere`/`canAccess` que le Module 17. Gestion de la bibliothèque technique (communes, catalogue de prestations/frais/taxes, surcharges de taux, tranches de surface) — *Paramètres → « Moteur de devis permis de construire »* (2 onglets : **Communes**, **Catalogue de prestations** — ce dernier donnant accès, par prestation, aux fenêtres **« Surcharges de taux »** et **« Tranches de surface »**) — écriture ouverte à **SUPER_ADMIN, ADMIN, MANAGER, ACCOUNTANT** (`checkLibExtendedWrite`/`LIB_EXTENDED_WRITE_ROLES` dans `permit-library.ipc.ts`, rôle exact — **mêmes règles d'accès que le module Devis construction** ; le module Permis n'ayant pas d'équivalent de la « Bibliothèque d'ouvrages » du Module 17, réservée SUPER_ADMIN/ADMIN, l'ensemble de sa bibliothèque technique est traité au niveau le plus permissif de la matrice Construction, y compris pour les 2 onglets `TABS` de `SettingsPage.tsx`, désormais visibles à MANAGER/ACCOUNTANT).

Chiffre les **prestations intellectuelles, administratives et réglementaires** liées à l'obtention d'un permis de construire, à partir d'une quinzaine de caractéristiques d'un projet (nature, standing, commune, superficie du terrain, surface bâtie, niveaux, nombre de bâtiments, coût prévisionnel des travaux, sous-sol, piscine, ascenseur, groupe électrogène, forage, clôture, voirie intérieure, niveau de prestation/mission) — mêmes principes de conception que le Module 17 : catalogue de prestations à taux lus à chaud, lignes d'estimation figées (snapshot), rôles calqués sur le module Devis/Construction.

- **Catalogue unifié de prestations, frais et taxes** (`PermitFeeItem`, un seul modèle discriminé par `category` — **honoraires Architecte/BET/Géomètre, Études, Frais administratifs et Taxes partagent la même table**, pas deux tables séparées comme suggéré initialement : une taxe communale et un frais de dossier obéissent au même mécanisme de calcul/surcharge, seule la catégorie d'affichage diffère). `calcMode` détermine l'interprétation de `defaultValue` : **% du coût prévisionnel des travaux**, **forfait** (FCFA), **FCFA/m² de terrain**, **FCFA/m² bâti**, ou **barème par tranche de surface** (`PermitFeeSurfaceBracket` — tranche du terrain pour la catégorie Géomètre, de la surface bâtie pour les autres, ex. le montant du permis de construire lui-même). Les **honoraires Architecte** portent en plus un `missionPhase` optionnel (Esquisse/APS/APD/Plans d'exécution/Suivi de chantier/Réception) : une ligne n'apparaît que si cette phase est cochée dans le « Niveau de prestation » du projet.
- **Automatisation intelligente** (règles métier du cahier des charges — « si R+4 ou plus, ajouter étude structure approfondie, étude incendie, contrôle technique » ; « si terrain > 5 000 m², ajouter levé topographique complet, étude hydraulique » ; « si piscine, plans spécifiques + étude hydraulique » ; « si forage, étude hydrogéologique » ; « si immeuble collectif, étude VRD/assainissement/circulation ») : **implémentée en réutilisant tel quel le moteur de règle d'applicabilité déclaratif partagé avec le Module 17** (`src/main/services/applicability-rule.ts`, extrait du registre de formules de construction pour être générique), posé directement sur `PermitFeeItem.applicabilityRule` — plutôt qu'un second système de « règles métier » dédié. Un item conditionnel (ex. « Contrôle technique ») est un `PermitFeeItem` ordinaire dont la règle porte sur `levels`, `terrainSurface`, `hasPiscine`, `hasForage`, `nature`… Nouvelle règle = un item de catalogue avec sa règle JSON, jamais une migration.
- **Surcharges de taux** (`PermitFeeRateOverride`) : par prestation, un taux peut être surchargé selon une combinaison optionnelle **nature de projet × standing × commune** — la surcharge la plus spécifique (le plus de dimensions renseignées) l'emporte sur `defaultValue` (résolution dans `permit-engine.service.ts` → `resolveRate`). Permet par exemple une taxe communale plus élevée à Cocody/Plateau qu'à Yopougon/Abobo (démontré dans le seed).
- **Coût prévisionnel des travaux** — base des honoraires au pourcentage. Un projet de permis peut être **rattaché optionnellement à un `ConstructionProject`** existant (Module 17) : à la création, si le champ n'est pas renseigné manuellement, il se **déduit par défaut du dernier `ConstructionEstimate.totalHT`** de ce projet lié (simple valeur de départ copiée, pas un lien vivant — reste ensuite modifiable indépendamment).
- **TVA** — appliquée **uniquement aux prestations intellectuelles** (Architecte, BET, Géomètre, Études) ; les **frais administratifs et taxes en sont exclus** (débours versés à l'administration pour le compte du client, non assujettis — traitement fiscal standard pour ce type de prestation, distinct d'un devis de travaux classique). `PermitEstimate.totalHT` cumule toutes les lignes ; `totalTVA` ne porte que sur le sous-ensemble assujetti.
- **Génération d'une estimation** (`permits:generateEstimate`, persistée dans `PermitEstimate` + `PermitEstimateLine`, versionnée par projet, chaque ligne tracée via `trace`) → peut créer un **devis commercial** du module Devis existant (`permits:estimates:toQuote`, chaque prestation devient une `QuoteItem` avec pour catégorie le libellé FR de sa `PermitFeeCategory`, réutilisation de `resolveQuoteAmounts`/`nextReference` de `quotes.ipc.ts`, aucune duplication).
- **Prestations complémentaires** (impression des plans, reliure, copies, numérisation, déplacements, frais de mission — §1 du cahier des charges) : **volontairement absentes** du catalogue de prestations dédié — ce sont de simples lignes quantité × prix unitaire, déjà couvertes par le **Catalogue prestations/produits** générique existant (`CatalogItem`) au moment de la conversion en devis commercial (ajout manuel de lignes sur le devis, comme pour tout autre devis de l'application).
- **Base de données réglementaire paramétrable** — `PermitCommune` (communes/districts/région/zone urbaine ou rurale) et `PermitFeeItem`/`PermitFeeRateOverride`/`PermitFeeSurfaceBracket` (barèmes officiels, taxes et redevances). **Reportés** (non implémentés dans cette phase, cf. §4 du cahier des charges) : règles locales d'urbanisme, pièces exigées par type de projet (check-list personnalisée), délais de traitement, organismes concernés — aucune table dédiée pour l'instant, le schéma n'y ferme toutefois pas la porte (extension future du catalogue ou nouveaux modèles).
- **Niveau de prestation (mission)** — sélection multiple des phases (`PermitProject.missionPhases`, JSON) sur le formulaire « Nouveau projet », pilotant directement quelles lignes d'honoraires Architecte apparaissent sur l'estimation.
- ⚠️ **Les taux, forfaits et barèmes livrés par défaut sont des valeurs de référence INDICATIVES** (ordre de grandeur, pratique courante en Côte d'Ivoire — script `scripts/seed-permit.mjs`, 22 communes, 31 prestations, 2 barèmes par tranche de surface, 5 exemples de surcharge par commune) — à vérifier et ajuster (barèmes officiels des ordres professionnels, mairies, ministères concernés) avant toute exploitation commerciale, même convention que le Module 17.

---

### Module 19 — Conformité LBC/FT/FP

**Routes :** `/aml/dashboard`, `/aml/profiles`, `/aml/profiles/new`, `/aml/profiles/:id`, `/aml/profiles/:id/edit`, `/aml/reviews`, `/aml/reviews/:id`, `/aml/suspicious-reports`, `/aml/suspicious-reports/:id`, `/aml/training`, `/aml/watchlist`
**Accès :** module en **plein accès** pour **SUPER_ADMIN, ADMIN, CONFORMITE, MANAGER, ACCOUNTANT** (`RoleGuard` + contrôle IPC, rôle **exact** via `checkExactRole`, sans équivalence `checkRole`) — **MANAGER** puis **ACCOUNTANT (Comptable)** ont été ajoutés en plein accès, parité totale avec ADMIN, y compris les 3 actions les plus sensibles normalement réservées à SUPER_ADMIN/ADMIN seuls et refusées même à CONFORMITE (`AML_ADMIN_ONLY` : suppression d'un profil de vigilance, suppression d'une revue de transaction, modification des seuils de scoring). **AGENT, AGENT_TECHNIQUE, ASSISTANTE_DIRECTION et READONLY** ont un accès **restreint** aux deux seules interfaces **« Référentiel de vigilance »** et **« Formations »** — jamais Tableau de bord, Profils, Revues de transaction ou Déclarations de soupçon (`AML_RESTRICTED_ROLES` dans `aml.ipc.ts`, second `RoleGuard` disjoint sur `/aml/training` et `/aml/watchlist` dans `router.tsx`). Sur le **Référentiel de vigilance**, ces 4 rôles sont en **lecture seule**, à l'exception d'**AGENT_TECHNIQUE** qui peut créer/modifier/supprimer une entrée (`WATCHLIST_RESTRICTED_WRITE_ROLES`) — **READONLY n'écrit jamais**, conformément à son rôle. Sur les **Formations**, lecture seule pour les 4, **limitée aux formations dont ils sont participants** (`AmlTraining.userId = session.userId`, forcé côté serveur — `aml:training:list` ignore tout filtre `userId` transmis par le client pour ces rôles, `aml:training:getById` masque en « introuvable » toute formation d'un autre participant). Signalement interne d'un soupçon (« Signaler un soupçon LBC/FT ») : **tous les rôles sauf READONLY**, via un bouton dédié accessible depuis les fiches Client/Owner/Convention, sans accès au reste du module — **READONLY reste donc le seul rôle sans aucun moyen de signaler un soupçon**, y compris avec son accès restreint au Référentiel/Formations. Consultation/gestion du registre des déclarations de soupçon : strictement SUPER_ADMIN/ADMIN/CONFORMITE/MANAGER/ACCOUNTANT, **y compris pour le déclarant lui-même** une fois le signalement déposé (aucune exception « mes déclarations »).

> **CONFORMITE (chargé de conformité LBC/FT/FP)** — rôle **dédié** au Module 19, calqué sur le rôle RH du Module 12 : accède uniquement à ce module et au tableau de bord général ; les autres modules (Clients, Propriétaires, Conventions…) lui sont **refusés au niveau IPC**, aucune équivalence n'est ajoutée dans `checkRole`. Pour permettre la vigilance à l'égard de la clientèle (CDD) sans élargir cet accès, le module expose sa propre lecture, **volontairement étroite** (`resolveSubjectSummary` dans `aml.ipc.ts`, `select` limité à quelques champs), de l'identité du Client/Owner concerné — jamais un accès générique aux handlers `clients:*`/`owners:*`/`conventions:*`. **MANAGER et ACCOUNTANT**, à la différence de CONFORMITE, ne sont **pas** des rôles exclusifs à ce module — ils conservent tous leurs accès habituels (Clients, Conventions, Comptabilité, etc.) en plus du plein accès à la Conformité LBC/FT/FP. **AGENT, AGENT_TECHNIQUE, ASSISTANTE_DIRECTION et READONLY** ne sont pas non plus exclusifs, mais leur accès au module lui-même reste étroit (Référentiel de vigilance + Formations personnelles uniquement).

Module de conformité anti-blanchiment / financement du terrorisme et de la prolifération (LBC/FT/FP), transposant les obligations de la loi uniforme UEMOA (GAFI) applicables aux professionnels de l'immobilier — assujettis non financiers : vigilance à l'égard de la clientèle (`AmlProfile`), bénéficiaires effectifs (`AmlBeneficialOwner`), classification du risque par catalogue de facteurs pondérés (`AmlRiskFactorCatalog`, calque de `KpiDefinition`), criblage manuel contre un référentiel de vigilance interne (`AmlWatchlist`/`AmlWatchlistMatch` — **aucune connexion à une API externe**, aucun service fiable de criblage sanctions/PPE n'étant disponible localement), revues de transaction (`AmlTransactionReview`, rattachée à une Convention par référence scalaire découplée, même principe que `PermitEstimate`/`ConstructionEstimate.quoteId`) et déclarations de soupçon (`AmlSuspiciousReport`) transmises à la CENTIF-CI.

- **Profil LBC/FT/FP** (un par `Client` OU `Owner`, discriminateur `subjectType`/`subjectId` — même principe polymorphe que `EntityTimelineEvent`, pas de double FK nullable) : niveau/score de risque, type de vigilance (simplifiée/normale/renforcée — jugement du chargé de conformité, jamais auto-dérivé du score), statut PPE et fonction, origine des fonds/du patrimoine, statut de validation (en cours/validé/à revoir/refusé), prochaine date de revue. Référence auto `LBC-AAAA-NNNN`.
- **Bénéficiaires effectifs** (`AmlBeneficialOwner`), pertinents pour les sujets de type `ENTREPRISE` : identité, nationalité, quote-part de détention, rôle, statut PPE.
- **Score de risque** calculé par `src/main/services/aml-risk-engine.service.ts` (checklist × poids — volontairement simple, **pas** un moteur de règles déclaratif à la Construction/Permis) : `recomputeProfileRisk` fait la somme des poids des facteurs présents (`AmlProfileRiskFactor`), certains détectés **automatiquement** (`detectAutoFactors` : type entreprise, PPE, lien pays à risque, montant élevé, paiement en espèces, correspondance watchlist confirmée), d'autres **cochés manuellement** par le chargé de conformité (structure de propriété complexe, réticence documentaire, urgence inhabituelle, virements internationaux fréquents…) — les liens `AUTO` sont réécrits à chaque recalcul, les liens `MANUEL` n'y sont jamais touchés. Seuils de niveau (faible/moyen/élevé) et seuil de « montant élevé » **paramétrables** (*Paramètres → Conformité LBC/FT/FP → Seuils de scoring*, `AppSetting` `aml.riskThresholds`, lecture SUPER_ADMIN/ADMIN/CONFORMITE, écriture SUPER_ADMIN/ADMIN uniquement).
- **Non-bloquant par conception** — un profil non validé ou à risque élevé n'empêche **jamais** la signature/activation d'une convention : il se traduit uniquement par un badge sur les fiches Client/Owner (`AmlProfileLinkBadge`, via `aml:profiles:getBySubject`) et Convention (`AmlReviewBadge`, via `aml:reviews:getByConvention`) — lecture élargie aux mêmes rôles que `clients:read`/`owners:read` (`checkRole`, avec équivalences), contenu limité au niveau de risque/statut ; le détail complet reste réservé SUPER_ADMIN/ADMIN/CONFORMITE — et une entrée dans le tableau de bord/la file de revue.
- **Criblage watchlist** (`AmlWatchlist`/`AmlWatchlistMatch`, écran **`/aml/watchlist`** — sous-menu « Référentiel de vigilance » du groupe latéral « Conformité LBC/FT/FP », pas un onglet Paramètres) : référentiel manuel (ONU/UE/nationale/GIABA/autre), rapprochement par correspondance textuelle sur nom/alias (`aml:watchlist:screen`, recherche `contains` insensible à la casse), résultat à qualifier (à vérifier/confirmé/faux positif, `aml:watchlistMatches:review`) — une correspondance confirmée déclenche automatiquement un recalcul du score de risque. Chaque entrée porte une **fiche d'identité complète** (calquée sur le format usuel des désignations SFC/PPE) : nom et prénoms/raison sociale, alias, sexe, nationalité, date et lieu de naissance, identité des ascendants/descendants/conjoint(e)/parents ou proches, situation matrimoniale, langue parlée, pays de résidence habituel, adresse, numéro de téléphone utilisé, profession, motif de l'inscription — tous facultatifs (dépend de la richesse de la liste source), seul le rapprochement se base sur le nom/les alias (les autres champs sont documentaires, pour aider la qualification manuelle d'une correspondance). Écran filtrable (recherche par nom, type de liste, type de personne physique/morale — `aml:watchlist:list` accepte `search`/`listType`/`personType`).
- **Revues de transaction** (`AmlTransactionReview`, référence `RC-AAAA-NNNN`) — déclenchées sur les **encaissements effectifs**, jamais sur la seule Convention (un contrat signé n'est pas un mouvement d'argent) : quatre sources concrètes déjà modélisées ailleurs dans l'app, discriminées par `sourceType`/`sourceId` (scalaire sans FK, P5) — **paiements de facture** (`Payment`), **échéances de convention** (`SaleInstallment.conventionId` renseigné), **échéances héritées** (`SaleInstallment` sans convention, client rattaché via `SaleInstallment.clientId`) et **factures « Apport initial » / « Paiement comptant » réglées directement** (`Invoice.type ∈ {APPORT_INITIAL, VENTE}`, statut `PAYEE`, dont le montant n'est pas — ou pas entièrement — couvert par un `Payment` enregistré : cas de la facture basculée en « → Payée » via `accounting:updateInvoiceStatus` sans passer par « Enregistrer un paiement », seul chemin qui alimente le bucket `Payment` ci-dessus) ; une échéance ne compte que si elle est effectivement encaissée (`status ∈ {PARTIEL, PAYE}`), une échéance seulement due n'est pas un encaissement. `conventionId` reste un **contexte optionnel dérivé** (nul pour un paiement de facture sans convention ou une échéance héritée), conservé pour le badge de la fiche Convention (`aml:reviews:getByConvention`, inchangé) ; `sourceLabel` fige un libellé lisible au déclenchement (ex. « Paiement facture FAC-2026-0012 », « Échéance n°3 — CV-2026-0045 », « Échéance héritée — … », « Apport initial — facture FAC-2026-0031 »). File de candidats calculée **à la demande** (`aml:reviews:pendingCandidates`) — **seul critère de déclenchement automatique : le montant de l'encaissement dépasse le « Seuil de montant élevé (FCFA) »** paramétrable (*Paramètres → Conformité LBC/FT/FP → Seuils de scoring*, `AppSetting` `aml.riskThresholds`), sans encaissement déjà en revue ouverte — le mode de paiement espèces et le profil à risque élevé/PPE ne déclenchent plus seuls une candidature automatique (les valeurs `ESPECES`/`RISQUE_ELEVE`/`PEP` de `triggerReason` restent au catalogue mais aucune candidature n'y est plus rattachée automatiquement — pas d'écran de création manuelle en phase 1) — **pas de tâche planifiée** en phase 1, choix délibéré pour rester non-bloquant sans ajouter un service `setInterval` de plus.
- **Déclarations de soupçon** (`AmlSuspiciousReport`, référence `DS-AAAA-NNNN`) — **strictement confidentielles** (principe de non-divulgation / « tipping-off ») : signalement interne ouvert à tout rôle sauf READONLY (`declaredById` verrouillé sur `session.userId`, réponse limitée à `{id, reference}`, aucune relecture possible ensuite par le déclarant), mais **liste, détail et gestion réservés SUPER_ADMIN/ADMIN/CONFORMITE**. Circuit brouillon → validée en interne (prise en charge par un chargé de conformité) → transmise CENTIF (n° d'accusé de réception saisi manuellement) → ou classée sans suite (motif obligatoire). **Aucune suppression, ni douce ni définitive, n'est jamais exposée pour ce modèle** — la colonne `deletedAt` est conservée par convention de schéma mais aucun handler `delete`/`remove` n'est jamais enregistré (obligation réglementaire de non-altération d'une déclaration une fois créée).
- **Confidentialité des pièces jointes d'une déclaration** — les documents rattachés via `Document.amlSuspiciousReportId` bénéficient d'un filtre de confidentialité **spécifique**, en exception ciblée au comportement standard de la GED : `documents:list`/`getById`/`getFileData`/`open` (`documents.ipc.ts`) traitent ces documents comme introuvables pour tout rôle hors SUPER_ADMIN/ADMIN/CONFORMITE (jamais une erreur de permission explicite, pour ne pas révéler l'existence du document) ; `documents:import` n'autorise l'ajout d'une pièce à une déclaration que par son déclarant, tant qu'elle est encore `BROUILLON`. Les pièces jointes d'un profil ou d'une revue (`amlProfileId`/`amlTransactionReviewId`) restent sous le régime standard de la GED (`READ_ROLES` étendu à `CONFORMITE`, sans quoi ce rôle exclusif ne pourrait consulter aucun document, y compris les siens).
- **Suivi des formations du personnel** (`AmlTraining`, référence `FORM-AAAA-NNNN`, route `/aml/training`) : registre plat (participant — un `User`, pas un `Employee` du module RH, pour ne pas coupler ce module à la présence d'une fiche personnel —, date, sujet, organisme, durée, notes), gestion réservée `AML_ROLES` comme le reste du module. Pas de workflow de validation ni de suivi d'obligations de recyclage périodique dans ce lot. **Sélection multiple de participants à la création** (`AmlTrainingListPage.tsx`) : une session de formation peut être enregistrée pour plusieurs participants en une seule saisie — le registre reste **plat** (une ligne `AmlTraining` = un participant), `aml:training:create` accepte `userIds: number[]` et crée une ligne par participant (référence propre à chacune, création **séquentielle** — pas `Promise.all` — pour éviter toute collision de référence entre deux créations concurrentes de `nextReference()`), toutes partageant le même sujet/date/organisme/durée/notes. La modification (`aml:training:update`) reste au singulier : une ligne = un participant, modifiable individuellement. Justificatif (attestation de formation) via le pattern GED standard (`Document.amlTrainingId`) — **sans confidentialité particulière**, contrairement aux pièces jointes des déclarations de soupçon : une formation n'est pas un secret, ce champ ne rejoint donc pas le filtre `amlSuspiciousReportId` de `documents.ipc.ts`.
- ⚠️ **Le catalogue de facteurs de risque, leurs pondérations et les seuils de scoring livrés par défaut sont des valeurs de référence INDICATIVES** (script `scripts/seed-aml.mjs`, 12 facteurs) — à valider avec le chargé de conformité désigné avant toute exploitation. Le référentiel de vigilance (`AmlWatchlist`) est livré **vide** par conception (aucune liste réelle de sanctions/PPE n'étant disponible via une API locale fiable) et doit être alimenté manuellement à partir des listes publiées (ONU, UE, GIABA, liste nationale) par la personne en charge de la conformité.
- **Reporté à une phase ultérieure** (non traité dans ce périmètre, comme le Niveau 3 du Module 17) : tâche planifiée de déclenchement automatique des revues de transaction, référentiel structuré des pays à risque, toute intégration à une API de criblage externe.

---

## 📡 Communication IPC Electron

### Convention de nommage des canaux IPC

```
<module>:<action>
```

**Exemples :**
- `users:list` — Récupérer la liste des utilisateurs
- `users:create` — Créer un utilisateur
- `clients:getById` — Récupérer un client par ID
- `properties:update` — Mettre à jour un bien
- `accounting:getInvoices` — Récupérer les factures
- `communication:sendEmail` — Envoyer un email
- `archiving:archive` — Archiver une entité
- `archiving:list` — Liste des archives avec filtres
- `archiving:restore` — Restaurer une entité archivée
- `archiving:permanentDelete` — Suppression définitive (SUPER_ADMIN)
- `archiving:listPolicies` — Lister les politiques d'archivage automatique
- `archiving:createPolicy` — Créer une politique d'archivage
- `documents:list` — Liste paginée des documents de la GED (filtres : recherche, catégorie, dossier, type)
- `documents:getById` — Document GED avec relations et journal des actions
- `documents:import` — Importer un ou plusieurs fichiers dans la GED (rattachements optionnels, dont `crmActivityId` pour les pièces jointes d'activité CRM, `socialPublicationId` pour les pièces jointes de publication, et `itInnovationId` + `itInnovationPhase` pour les pièces jointes d'une phase d'innovation IT)
- `documents:update` — Mettre à jour les métadonnées d'un document
- `documents:remove` — Mettre un document à la corbeille (soft delete)
- `documents:open` — Ouvrir un document dans l'application externe
- `documents:getFileData` — Données du fichier pour la prévisualisation intégrée
- `documents:listCategories` / `createCategory` / `updateCategory` / `deleteCategory`
- `documents:listFolders` / `createFolder` / `updateFolder` / `deleteFolder`
- `documents:listTags` / `createTag` — Étiquettes documentaires
- `documents:gedDashboard` — Statistiques du tableau de bord GED
- `crm:listActivities` — Liste des activités CRM (inclut `_count.attachments` pour l'indicateur de pièces jointes)
- `crm:getActivity` — Détail d'une activité (inclut entités rattachées, `createdBy` et `attachments`) — alimente la vue détail
- `crm:createActivity` / `crm:updateActivity` — Créer / mettre à jour une activité (réservé aux rôles en écriture, hors READONLY)
- `conventions:generateInstallments` — Générer le tableau d'échéances d'une convention de vente
- `conventions:getInstallments` — Récupérer les échéances d'une convention
- `accounting:payInstallment` — Enregistrer le paiement d'une échéance
- `accounting:getOverdueInstallments` — Lister les échéances en retard
- `accounting:getUpcomingInstallments` — Lister les échéances à venir (filtre par jours)
- `programmes:list` — Liste des programmes immobiliers avec filtres
- `programmes:getById` — Récupérer un programme (avec biens et terrains rattachés)
- `programmes:create` — Créer un programme immobilier
- `programmes:update` — Mettre à jour un programme
- `programmes:delete` — Archiver (soft delete) un programme
- `hr:employees:list` / `getById` / `create` / `update` / `delete` / `stats` — Personnel
- `hr:employees:linkableUsers` — Comptes utilisateurs liables à un employé (actifs, non déjà rattachés ; `excludeEmployeeId` pour conserver le compte de l'employé édité)
- `hr:employees:careerProfiles` — Filières (profils de carrière actifs) sélectionnables sur la fiche employé (lecture ouverte à `HR_STAFF_READ_ROLES`, contrairement à `careerProfiles:list` réservé au paramétrage SUPER_ADMIN/ADMIN)
- `hr:contracts:create` / `update` / `delete` — Contrats de travail
- `hr:contracts:getRenderData` — Données de rendu d'un contrat (contrat + employé + entreprise) pour la génération du document côté renderer
- `hr:contractTemplates:list` / `create` / `update` / `delete` — Modèles de contrats éditables (zones En-tête/Corps/Fin/Pied, variables)
- `hr:payslips:list` / `getById` / `generate` / `duplicate` / `updateStatus` / `delete` / `print` — Bulletins de paie
- `wireTransfer:getTemplate` / `updateTemplate` / `print` / `exportPdf` / `exportExcel` — Ordre de virement (fiche bancaire des salaires nets à payer du mois), réservé SUPER_ADMIN/ADMIN
- `hr:payslipTemplates:list` / `update` — Modèles de bulletins (MODELE_1/2/3)
- `hr:payroll:getRates` / `setRates` — Taux et barème ITS de la paie
- `hr:leaveTypes:list`, `hr:leave:balance`, `hr:leaveRequests:list` / `create` / `decide` / `delete` — Congés & absences
- `hr:attendance:list` / `summary` / `bulkUpsert` — Pointage / heures (alimente la paie ; inclut heures d'arrivée/départ)
- `hr:lateness:list` / `linkableLeaveRequests` / `linkableActivities` / `justify` / `unjustify` / `tolerate` / `untolerate` — Retards & Départs précipités (`list` accessible à tout utilisateur, vue complète SUPER_ADMIN/ADMIN/MANAGER, auto-consultation pour les autres rôles ; les autres handlers, dont `tolerate`/`untolerate`, sont réservés à SUPER_ADMIN/ADMIN/MANAGER)
- `settings:getLatenessSettings` (lecture : SUPER_ADMIN/ADMIN/MANAGER) / `updateLatenessSettings` (écriture : admin uniquement) — Inclusion (désactivée par défaut) des employés liés à un compte SUPER_ADMIN/ADMIN/MANAGER, et limite de tolérance (minutes) pour le statut « Tolérée » des Retards & Départs précipités
- `settings:getAttendanceQr` / `updateAttendanceQr` — Config du pointage par QR (URL de l'app web déployée, seuils, rôles autorisés) ; admin uniquement
- *(le pointage lui-même est servi hors IPC par l'app web autonome `web/` — `index.php` / `api.php`, connectée directement à MariaDB)*
- `visitors:list` / `getById` / `create` / `update` / `delete` / `stats` — Gestion des visiteurs (rôles SUPER_ADMIN/ADMIN/ASSISTANTE_DIRECTION)
- `settings:getVisitorQr` / `updateVisitorQr` — Config du QR Visiteurs (URL de l'app web, rôles, modèle) ; admin uniquement
- *(le formulaire visiteur est servi hors IPC par l'app web autonome publique `web-visiteurs/` — `index.php` / `api.php`)*
- `settings:getImap` / `updateImap` / `testImap` — Configuration IMAP de la boîte système partagée des relances (réception des réponses aux rappels/relances automatiques) ; admin uniquement
- `mailAccount:get` / `upsert` / `test` / `delete` — Boîte email personnelle self-service (réception des réponses aux emails envoyés « en tant que soi-même ») ; scopé sur l'utilisateur connecté, aucune restriction de rôle
- `communication:linkInbound` — Rattachement manuel d'un message reçu (email entrant) non apparié automatiquement à un client/prospect/propriétaire/convention
- `performance:kpis:list` / `create` / `update` / `delete` — Catalogue des KPI configurables (config : SUPER_ADMIN/ADMIN/RH)
- `performance:weights:list` / `upsert` / `delete` — Profils de pondération par poste
- `performance:units:list` / `create` / `update` / `delete` — Référentiel des unités de KPI (sélecteur « Unité » du formulaire KPI, création à la volée ; amorcé depuis les unités usuelles + existantes)
- `hr:jobPositions:list` / `create` / `update` / `delete` — Référentiel des postes (sélecteur « Poste » de la fiche employé, création à la volée ; amorcé depuis les postes existants)
- `hr:departments:list` / `create` / `update` / `delete` — Référentiel des départements/services (sélecteur « Département / service » de la fiche employé, création à la volée ; amorcé depuis les départements existants)
- `performance:objectives:list` / `getById` / `create` / `update` / `delete` — Objectifs annuels/trimestriels **par collaborateur ou par poste** (cible exclusive `employeeId` XOR `poste` ; les objectifs par poste s'appliquent à tous les employés du poste et sont réservés à la config admins/RH)
- `performance:objectives:duplicate` — Duplique les objectifs d'une **période source** vers une **période cible** (intitulé/cible/pondération/KPI conservés, avancement remis à 0, statut « En cours » ; anti-doublon sur intitulé+cible ; respect du périmètre)
- `performance:evaluations:list` / `getById` / `create` / `update` / `delete` — Évaluations
- `performance:evaluations:computeKpis` — Calcul auto des KPI d'une évaluation (injecte valeurs + note globale)
- `performance:evaluations:submit` / `sign` (`level = MANAGER|EMPLOYEE|DIRECTION`) / `refuse` — Circuit de validation électronique
- `performance:plans:list` / `create` / `update` / `delete` — Plans de progrès (dont besoins de formation)
- `performance:rankings:get` / `snapshot` / `history` / `getSnapshot` — Classements multi-périodes (base KPI ou évaluation) et archivage
- `performance:dashboard` — Tableau de bord RH de performance (par service, tendances, top performers, formations)
- `performance:employees:list` — Sélecteur d'employés du périmètre accessible
- `performance:me:overview` / `evaluation` / `sign` / `ranking` — Self-service « Mes performances » (signature collaborateur)
- `socialMedia:listPlatforms` / `createPlatform` / `updatePlatform` / `deletePlatform` — Plateformes réseaux sociaux/web
- `socialMedia:listPublications` / `createPublication` / `updatePublication` / `deletePublication` — Publications & articles
- `socialMedia:listSnapshots` / `upsertSnapshot` / `deleteSnapshot` — Relevés d'abonnés (upsert par plateforme + jour)
- `socialMedia:dashboard` — Tableau de bord (compteurs, courbes d'évolution 12 mois, répartition par plateforme)
- `innovations:list` / `getById` / `create` / `update` / `submitPhase2` / `submitPhase3` / `validatePhase` / `delete` — Innovations IT (Module 16) : `create`/`update`/`submitPhase2`/`submitPhase3` réservés à `SUPER_ADMIN/ADMIN/MANAGER/RH/AGENT_TECHNIQUE` (AGENT_TECHNIQUE restreint à ses propres innovations) ; `validatePhase`/`delete` réservés à `SUPER_ADMIN/ADMIN/MANAGER`
- `innovations:employees` — Sélecteur du porteur à la création (réservé aux rôles en vue complète : SUPER_ADMIN/ADMIN/MANAGER/RH)
- `construction:lots:list/upsert/delete`, `construction:resourceFamilies:list/create/delete`, `construction:localities:list/upsert/delete`, `construction:resources:list/getById/create/update/updatePrice/priceHistory/whereUsed/delete`, `construction:workItems:list/getById/upsert/duplicate/delete`, `construction:ratioDefs:list/create/update/delete`, `construction:ratioProfiles:list/getById/upsert/duplicate/delete`, `construction:library:health` — Bibliothèque technique du moteur de devis de construction (Module 17), écriture réservée SUPER_ADMIN/ADMIN
- `construction:projects:list/getById/create/update/duplicate/delete` — Projets de construction (mêmes rôles/périmètre que `quotes:*`)
- `construction:quickEstimate` — Niveau 1, estimation rapide non persistée (projet enregistré ou caractéristiques brutes du formulaire)
- `construction:generateEstimate` — Génère et persiste une estimation (Niveau 1 ou 2) ; option `createQuote` pour créer directement un `Quote` du module Devis
- `construction:estimates:list/getById/summary/materials/labor/toQuote/setStatus/delete` — Estimations générées (DQE, quantitatif matériaux, besoin main d'œuvre, marge prévisionnelle, conversion en devis)
- `permits:communes:list/upsert/delete`, `permits:feeItems:list/getById/create/update/delete`, `permits:rateOverrides:list/upsert/delete`, `permits:surfaceBrackets:list/upsert/delete` — Bibliothèque technique du moteur de devis de permis de construire (Module 18), écriture réservée SUPER_ADMIN/ADMIN
- `permits:projects:list/getById/create/update/delete` — Projets de permis de construire (mêmes rôles/périmètre que `construction:projects:*`)
- `permits:quickEstimate` — Estimation rapide non persistée (projet enregistré ou caractéristiques brutes du formulaire)
- `permits:generateEstimate` — Génère et persiste une estimation
- `permits:estimates:list/getById/toQuote/setStatus/delete` — Estimations générées (conversion en devis commercial)
- `aml:profiles:list/getById/getBySubject/subjectsWithoutProfile/create/update/setRiskFactors/computeRisk/validate/markToReview/markRefused/delete` — Profils de vigilance LBC/FT/FP (`getBySubject` = badge non sensible, rôles élargis via `checkRole`)
- `aml:beneficialOwners:list/create/update/delete` — Bénéficiaires effectifs d'un profil
- `aml:riskFactors:list/create/update/delete` — Catalogue des facteurs de risque (config)
- `settings:getAmlRiskThresholds` / `settings:updateAmlRiskThresholds` — Seuils du moteur de scoring (lecture SUPER_ADMIN/ADMIN/CONFORMITE, écriture admin uniquement)
- `aml:watchlist:list/getById/create/update/delete/screen` — Référentiel de vigilance et rapprochement manuel/semi-assisté
- `aml:watchlistMatches:list/review` — Qualification d'une correspondance (à vérifier/confirmé/faux positif)
- `aml:reviews:list/getById/getByConvention/pendingCandidates/create/close/delete` — Revues de transaction (`getByConvention` = badge non sensible)
- `aml:suspiciousReports:create/list/getById/update/transmit/classify` — Déclarations de soupçon (**aucun `delete`** — cf. Module 19) ; `create` ouvert à tous les rôles sauf READONLY, le reste strictement SUPER_ADMIN/ADMIN/CONFORMITE
- `aml:training:list/getById/create/update/delete` — Registre des formations LBC/FT/FP du personnel
- `aml:dashboard:overview` — Tableau de bord de conformité (compteurs uniquement)
- *(rappel : `documents:import`/`list`/`getById`/`getFileData`/`open` portent un filtre de confidentialité spécifique pour les documents `amlSuspiciousReportId`, cf. Module 19)*

### Pattern handler IPC (main process)

```typescript
// src/main/ipc/clients.ipc.ts
import { ipcMain } from 'electron';
import { prisma } from '../services/db.service';
import { checkPermission } from '../services/auth.service';
import { createClientSchema } from '../../shared/schemas/client.schema';

export function registerClientsIPC() {
  ipcMain.handle('clients:list', async (event, { filters, page, limit }) => {
    await checkPermission(event, 'clients:read');
    try {
      const [data, total] = await prisma.$transaction([
        prisma.client.findMany({
          where: { deletedAt: null, ...buildFilters(filters) },
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.client.count({ where: { deletedAt: null, ...buildFilters(filters) } }),
      ]);
      return { success: true, data, total };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('clients:create', async (event, payload) => {
    await checkPermission(event, 'clients:write');
    const parsed = createClientSchema.safeParse(payload);
    if (!parsed.success) return { success: false, error: parsed.error.format() };
    const client = await prisma.client.create({ data: parsed.data });
    return { success: true, data: client };
  });
}
```

### Pattern hook React (renderer)

```typescript
// src/renderer/modules/clients/hooks/useClients.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const ipc = window.electron; // via contextBridge

export function useClients(filters = {}, page = 1, limit = 20) {
  return useQuery({
    queryKey: ['clients', filters, page],
    queryFn: () => ipc.invoke('clients:list', { filters, page, limit }),
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => ipc.invoke('clients:create', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  });
}
```

---

## 🎨 Design System & UI

### Thème général

- **Style :** Professionnel, sobre, modern — adapté à un usage immobilier B2B
- **Mode :** Clair par défaut, dark mode supporté via `data-theme` sur `<html>`
- **Police principale :** `Geist` ou `DM Sans` (headlines) + `DM Sans` (body)
- **Couleur primaire :** Bleu ardoise `#1E3A5F` avec accents `#2563EB`
- **Layout :** Sidebar fixe 240px + zone principale scrollable + topbar 64px

### Composants obligatoires

Tous les composants UI de base doivent être dans `src/renderer/shared/components/ui/` :

- `Button` — variantes : primary, secondary, danger, ghost, link
- `Input`, `Textarea`, `Select`, `DatePicker`, `NumberInput`
- `Modal` / `Dialog` (confirmation, formulaire)
- `Table` avec pagination, tri, filtres (wrapper TanStack Table)
- `Badge` (statuts colorés)
- `Card`
- `Alert` / `Toast` (notifications)
- `Skeleton` (loading states)
- `Avatar`
- `Breadcrumb`
- `EmptyState` (état vide illustré)
- `ConfirmDialog` (suppression, action destructive)

### Conventions CSS

- Utiliser **TailwindCSS** exclusivement (pas de CSS modules sauf exceptions justifiées)
- Tous les spacing, colors, radius via les tokens Tailwind configurés dans `tailwind.config.ts`
- Classes utilitaires complexes à extraire en composants React, pas en classes CSS nommées

---

## ⚙️ Variables d'environnement

Fichier `.env` (ne jamais committer, toujours dans `.gitignore`) :

```env
# Base de données
DATABASE_URL="mysql://afrikimmo_user:password@localhost:3306/afrikimmo-app"

# Application
APP_NAME="Afrikimmo-app"
APP_VERSION="1.0.0"
APP_SECRET_KEY="your-secret-key-here"

# Email (SMTP)
SMTP_HOST="smtp.afrikimmo.ci"
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER="noreply@example.com"
SMTP_PASS="smtp-password"
SMTP_FROM="Afrikimmo-app <noreply@example.com>"

# SMS
SMS_PROVIDER="twilio"        # twilio | ovh | brevo
TWILIO_ACCOUNT_SID="ACxxxx"
TWILIO_AUTH_TOKEN="xxxx"
TWILIO_FROM="+33xxxxxxxxx"

# Stockage fichiers
STORAGE_PATH="./data/storage"
MAX_FILE_SIZE_MB=10
```

---

## 🧪 Tests

### Stratégie de tests

| Niveau        | Outil                  | Cible                                    | Couverture visée |
|---------------|------------------------|------------------------------------------|:----------------:|
| Unitaire      | Vitest                 | Services, utils, stores, hooks           | 80%+             |
| Intégration   | Vitest + Prisma mock   | Handlers IPC, services BDD               | 60%+             |
| E2E           | Playwright             | Parcours critiques (connexion, convention…) | Parcours clés |

### Cas de test prioritaires

1. Authentification (connexion, permissions, session expirée)
2. Création d'un prospect → conversion en client
3. Création d'une convention de location complète
4. Génération et envoi d'une quittance de loyer
5. Calcul de révision de loyer (IRL)
6. Envoi d'email / SMS de relance
7. Export PDF d'une convention

---

## 📦 Scripts npm disponibles

```json
{
  "scripts": {
    "dev": "concurrently \"vite\" \"electron .\"",
    "build": "vite build && electron-builder",
    "build:win": "electron-builder --win",
    "build:mac": "electron-builder --mac",
    "build:linux": "electron-builder --linux",
    "db:migrate": "prisma migrate dev",
    "db:generate": "prisma generate",
    "db:studio": "prisma studio",
    "db:seed": "tsx scripts/seed.ts",
    "db:reset": "prisma migrate reset",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "test:coverage": "vitest run --coverage",
    "lint": "eslint src --ext .ts,.tsx",
    "format": "prettier --write src",
    "typecheck": "tsc --noEmit"
  }
}
```

---

## 🚀 Ordre de développement recommandé

Suivre cet ordre pour une livraison incrémentale et testable :

1. **Infrastructure** — Electron boilerplate, Prisma + MariaDB, contextBridge, router
2. **Auth & Users** — Connexion, sessions, gestion utilisateurs + permissions
3. **Design System** — Composants UI réutilisables, layout principal
4. **Biens immobiliers** — CRUD complet avec photos
5. **Propriétaires** — CRUD + lien avec biens + pièces d'identité / représentant légal
5a. **Lotissements** — CRUD + statuts ✅
5b. **Terrains** — CRUD + lien lotissement obligatoire + viabilisation ✅
6. **Prospects** — Pipeline Kanban + conversion
7. **Clients** — Fiche complète + timeline
8. **Conventions** — Création, workflow, génération PDF
9. **Comptabilité** — Factures, paiements, relances
10. **Communication** — Templates, envoi email/SMS
11. **CRM** — Agenda, activités, tâches
12. **Archivage** — Politiques, archivage manuel, restauration, conformité RGPD
13. **Dashboard** — KPIs, graphiques, exports
14. **RH & Paie** — Personnel & contrats, bulletins (conforme CI), congés, pointage ✅
14b. **Évaluation & performances** — Objectifs, KPI auto, pondération par poste, évaluations (validation 3 niveaux), plans de progrès, classements, tableau de bord RH ✅
15. **Tests & QA** — Couverture, parcours E2E
16. **Packaging** — Build distributable (Windows, Linux, macOS)

---

## 🛑 Règles impératives pour Claude Code

1. **Ne jamais modifier le schéma Prisma** sans créer une migration (`prisma migrate dev --name <description>`).
2. **Toujours utiliser TypeScript strict** — pas de `any`, pas de `@ts-ignore` sans commentaire explicatif.
3. **Chaque handler IPC doit retourner** `{ success: boolean, data?: T, error?: string }`.
4. **Soft delete obligatoire** — utiliser `deletedAt` sur toutes les entités, jamais de `DELETE` SQL direct.
5. **Validation Zod avant toute écriture** en base de données.
6. **Les mots de passe ne transitent jamais en clair** dans les canaux IPC.
7. **Logs structurés** via le logger central — pas de `console.log` en production.
8. **Gestion des erreurs** : tout bloc async doit avoir un try/catch, les erreurs doivent être loggées.
9. **Internationalisation** : préparer les chaînes de caractères pour i18n (utiliser `t()` même si une seule langue pour l'instant).
10. **Documenter** toute fonction publique exposée via IPC avec JSDoc.

---

## 📄 Liens de documentation utiles

- [Electron docs](https://www.electronjs.org/docs/latest)
- [Prisma docs](https://www.prisma.io/docs)
- [TanStack Table](https://tanstack.com/table/latest)
- [React Hook Form](https://react-hook-form.com/)
- [Zod](https://zod.dev/)
- [Zustand](https://docs.pmnd.rs/zustand/getting-started/introduction)
- [Recharts](https://recharts.org/)
- [Nodemailer](https://nodemailer.com/)
- [Twilio Node SDK](https://www.twilio.com/docs/libraries/node)

---

*Dernière mise à jour : 30 juin 2026 — Afrikimmo-app v1.0.1 (module RH & Paie complet, conforme Côte d'Ivoire : personnel & contrats, bulletins de paie CNPS/ITS/CMU/FDFP avec 3 modèles éditables et export Excel/PDF, congés & absences, pointage ; rôle dédié RH ; modèles de contrats éditables ; rattachement d'un membre du personnel à un compte utilisateur de l'application ; CRM (« Activités & CRM ») : pièces jointes d'activité et vue détail d'activité ; pointage du personnel par QR Code via une application web autonome PHP déposable sur le serveur local (arrivée/départ, modèles de QR avec logo) ; module Gestion des visiteurs avec objets de visite paramétrables et enregistrement par QR Code via app web publique ; build Windows signé v1.0.1)*

*Mise à jour 30 juin 2026 (contrats & self-service RH) — modèles de contrats de travail enrichis (zones en-tête/corps/fin/pied, variables, import depuis conventions, défaut par type) ; nouveaux types **Essai**, **Avenant CDD** (cumul ≤ 2 ans, rattaché au CDD), **Lettre de renouvellement ESSAI** (durée = essai initial) ; **délais d'essai par catégorie socio-professionnelle** ; champ **CMU** + total des retenues auto ; **représentant légal** (Paramètres) et **autorité responsable** (par contrat) ; **fonctions de l'employé** (titre + contenu en liste) ; **fiches de poste** éditables et imprimables par contrat ; **contrats signés** téléversables par employé ; **« Mon espace RH »** en lecture seule pour tout le personnel (profil, contrats, bulletins, congés, pointage, contrats signés, **règlement intérieur** ciblé par l'admin depuis la GED) ; accès RH **restreint** pour MANAGER / ASSISTANTE_DIRECTION (employés non-CDI ; pointage en lecture seule) ; QR pointage/visiteurs : normalisation de l'URL encodée (schéma http obligatoire) + avertissement pour les adresses IP nues.*

*Mise à jour 7 juillet 2026 (devis — colonne « Unité » optionnelle) — les lignes de devis peuvent porter une **unité de mesure optionnelle** (`QuoteItem.unit`, migration `20260707200000_quote_item_unit`). Le champ « Unité » de la ligne est un **sélecteur recherchable avec création à la volée**, alimenté par le **référentiel d'unités partagé** (`KpiUnit`, le même que « Nouvel objectif ») via des handlers `quotes:listUnits/createUnit/updateUnit/deleteUnit` (rôles Devis) et le composant `QuoteUnitModal`. Sur le document/aperçu du devis, la **colonne « Unité » ne s'affiche que si au moins une ligne porte une unité** (`hasItemUnits` dans `quoteTemplate.ts`, colspans de catégorie/sous-total ajustés ; même logique dans `QuoteDetailPage`).*

*Mise à jour 7 juillet 2026 (postes & objectifs par poste) — champs **« Poste »** et **« Département / service »** de la fiche employé transformés en **sélecteurs avec création à la volée** (référentiels `JobPosition` / `Department`, modèles `JobPositionModal` / `DepartmentModal` calqués sur les tiers de trésorerie ; amorcés depuis les valeurs déjà saisies ; IPC `hr:jobPositions:*` / `hr:departments:*` ; migration `20260707160000_department_reference`). Le module **Performances** permet désormais de définir des **objectifs par poste** (en plus des objectifs par collaborateur) : `PerformanceObjective.employeeId` rendu nullable + champ `poste` (cible exclusive) ; les objectifs par poste s'appliquent à tous les employés du poste et remontent dans « Mes performances ». Migration `20260707140000_job_position_and_poste_objectives`.*

*Mise à jour 7 juillet 2026 (Module 14 — Évaluation & gestion des performances) — champ **`Employee.managerId`** (responsable hiérarchique, self-relation) ; **objectifs** annuels/trimestriels par collaborateur ; **catalogue de KPI configurables** calculés automatiquement (ventes, commissions, encaissements, activités CRM, assiduité, congés) ; **pondération par poste** ; **évaluations** avec **validation électronique à 3 niveaux** (responsable → collaborateur → Direction), calcul auto des KPI et note globale ; **plans de progrès** & besoins de formation ; **classements** hebdo/mensuel/trimestriel/semestriel/annuel (base mixte KPI/évaluation) + archivage ; **tableau de bord RH de performance** (par service, tendances, top performers, formations) ; onglet **« Mes performances »** dans « Mon espace RH » (signature collaborateur). Accès : SUPER_ADMIN/ADMIN/RH/MANAGER (MANAGER limité à son équipe), config KPI/pondérations SUPER_ADMIN/ADMIN/RH, signature Direction SUPER_ADMIN/ADMIN. Services `performance.service.ts` (moteur KPI + classements) & IPC `performance.ipc.ts` (`performance:*`). Migration `20260707120000_performance_management`.*

*Mise à jour 9 juillet 2026 (KPI « Nouveaux Clients potentiels ») — nouveau KPI `NEW_POTENTIAL_PROSPECTS` (source `PROSPECTS`) : nombre de nouveaux prospects (créés sur la période, assignés à l'agent) dont le statut actuel est « Client potentiel » (`QUALIFIE`) ou « Négociation en cours » (`NEGOCIATION_EN_COURS`). Migration `20260709100000_kpi_new_potential_prospects`. Objectifs par poste par défaut créés pour COMERCIAL, ASSISTANT(E) COMMERCIAL, RESPONSABLE COMMERCIAL et DIRECTRICE MARKETING ET COMMERCIALE (année 2026, cible indicative 20, à ajuster dans *Performances → Objectifs*).*

*Mise à jour 9 juillet 2026 (Module 15 — Réseaux Sociaux & Plateformes Web) — nouveau module de suivi manuel de l'activité digitale (comptes réseaux sociaux + site web) : modèles `SocialPlatform` / `SocialPublication` / `SocialFollowerSnapshot`, IPC `social-media.ipc.ts` (`socialMedia:*`), tableau de bord avec courbes d'évolution 12 mois (publications, vues, interactions, abonnés). Nouveau type d'activité CRM **« Créas / Publications / Articles »** (`ActivityType.CREATION_PUBLICATION`). Catalogue KPI enrichi de la source **`SOCIAL`** et de 4 métriques (`SOCIAL_PUBLICATIONS_COUNT`, `SOCIAL_VIEWS`, `SOCIAL_INTERACTIONS`, `SOCIAL_FOLLOWERS_GROWTH`), avec objectifs par poste par défaut pour INFOGRAPHE & COMMUNITY MANAGER. Accès : SUPER_ADMIN/ADMIN/MANAGER (ACCOUNTANT/ASSISTANTE_DIRECTION inclus via équivalence). Migrations `20260709110000_social_media_module`, `20260709120000_crm_activity_type_creation`, `20260709130000_kpi_social_metrics`.*

*Mise à jour 9 juillet 2026 (Retards & Départs précipités + KPI associé) — nouvel écran **« Retards & Départs précipités »** (`/hr/lateness`, onglet de *Gestion du personnel*), réservé à **SUPER_ADMIN/ADMIN/MANAGER exclusivement** : affiche, pour les collaborateurs dont le poste a une pondération non nulle sur les KPI `ABSENCE_DAYS`/`ATTENDANCE_RATE`, les journées de retard d'arrivée ou de départ anticipé (seuils `attendance.expectedArrival`/`expectedDeparture`). Un administrateur/manager peut **lier** chaque journée à une **demande de congé approuvée couvrant ce jour** ou à une **activité « Visite chantier / Sortie en clientèle / Courses » traitée** (jamais utilisée pour justifier une autre journée), ce qui la **marque justifiée** ; un bouton « Retirer » permet d'annuler. Nouveau modèle `AttendanceDelayJustification` (unique par employé + jour) et nouveau KPI **`LATE_EARLY_DEPARTURE_HOURS`** (« Taux de retard ou de Départ précipité », source `ATTENDANCE`, LOWER_BETTER, cumul en heures des journées **non justifiées** sur la période) — exclu du sélecteur « Objectif lié » de « Nouvelle activité » comme les autres KPI d'assiduité. Logique centralisée dans `performance.service.ts` (`computeLatenessLinesForEmployee`, `computeUnjustifiedLatenessMinutes`, `latenessEligibleEmployeeIds`), IPC `hr:lateness:*` dans `hr.ipc.ts`. Migrations `20260709150000_attendance_delay_justification`, `20260709160000_kpi_late_early_departure`.*

*Mise à jour 9 juillet 2026 (synchronisation matricule employé ↔ utilisateur) — à chaque création ou modification d'un employé (`hr:employees:create` / `update`), si le membre du personnel est **lié à un compte utilisateur** (`Employee.userId`), le **matricule de ce compte est automatiquement aligné** sur celui de l'employé (`User.matricule = Employee.matricule`). Correction ponctuelle appliquée en base pour les comptes déjà liés dont le matricule différait.*

*Mise à jour 9 juillet 2026 (Catalogue prestations/produits — sélecteurs Catégorie & Unité) — sur le formulaire « Nouvel article » (*Paramètres → Catalogue prestations/produits*), les champs **« Catégorie (optionnel) »** et **« Unité (optionnel) »** deviennent des **sélecteurs recherchables avec création à la volée** (même modèle que le champ « Unité » de « Nouveau devis »), avec un bouton **« Gérer les catégories / unités »** ouvrant une fenêtre de gestion (`CatalogCategoryModal` / `CatalogUnitModal`). L'**unité** réutilise le **référentiel partagé `KpiUnit`** (le même que « Nouvel objectif » et les lignes de devis) via `catalog:listUnits/createUnit/updateUnit/deleteUnit`. La **catégorie** s'appuie sur un nouveau référentiel dédié `CatalogCategory` (migration `20260709170000_catalog_category_reference`) via `catalog:listCategories/createCategory/updateCategory/deleteCategory` (libellés normalisés en majuscules). Les valeurs déjà saisies sur les articles existants ont été amorcées dans ces référentiels lors de la migration.*

*Mise à jour 9 juillet 2026 (Catalogue prestations/produits — champ Référence) — ajout du champ **« Référence (optionnel) »** (`CatalogItem.reference`, libre, migration `20260709180000_catalog_item_reference`) sur le formulaire « Nouvel article ». Disposition finale : **Type / Prix unitaire** (même ligne), **Catégorie** (ligne dédiée), **Désignation** (ligne dédiée, pleine largeur), puis **Référence / Unité** à largeurs proportionnelles (même ligne, 1/2 - 1/2).*

*Mise à jour 9 juillet 2026 (Devis — colonne « Référence / LOT »)  — ajout du champ **« Référence / LOT »** (`QuoteItem.reference`, libre, migration `20260709190000_quote_item_reference`) sur les lignes de devis, positionné **avant la colonne Désignation**. Se pré-remplit avec la **référence de l'article du catalogue** choisi via `CatalogPicker` (`CatalogPick.reference`) mais reste **librement modifiable** par ligne, comme le champ Catégorie. Sur le document/aperçu/impression du devis (`QuoteFormPage`, `QuoteDetailPage`, `quoteTemplate.ts` → `hasItemReferences`), la **colonne « Référence / LOT » ne s'affiche que si au moins une ligne porte une référence renseignée** (même logique conditionnelle que la colonne « Unité » via `hasItemUnits`), colspans de catégorie/sous-total ajustés en conséquence.*

*Mise à jour 9 juillet 2026 (Devis — lignes de titre / sous-titre) — `QuoteItem.lineType` (enum `QuoteItemLineType` : `ARTICLE`/`TITLE`/`SUBTITLE`, défaut `ARTICLE`, migration `20260709200000_quote_item_line_type`) permet d'insérer, depuis « Nouveau/Modifier devis » (boutons **« Titre »** et **« Sous-titre »** de la barre d'outils « Lignes du devis »), des lignes de texte libre (portées par `designation`) sans quantité/prix. Une ligne de **titre** **découpe le devis en sections** : le texte s'affiche en évidence **au-dessus d'un tableau dédié** regroupant les articles qui suivent, jusqu'au titre suivant (`quoteTemplate.ts` → `splitIntoSections`/`hasSectionLines`). Une ligne de **sous-titre** découpe les articles d'une section (ou du devis entier s'il n'y a pas de titre) en **sous-blocs**, chacun affiché sous son propre repère pleine largeur (`splitBySubtitle`). **Le regroupement par catégorie (en-tête + sous-total) reste actif à l'intérieur de chaque sous-bloc**, exactement comme en l'absence de titre/sous-titre (`articleRowsBody` dans `quoteTemplate.ts`, réutilisé côté aperçu par `QuoteDetailPage` → `QuoteItemsTable`/`ArticleRowsBody`, et côté document imprimé/PDF par `buildItemsTable`) — titres/sous-titres et catégories se combinent donc sans se désactiver mutuellement, et le regroupement s'affiche dès qu'au moins une catégorie est renseignée (même comportement qu'en l'absence de titre/sous-titre). Quantité, prix, unité, référence et catégorie des lignes de titre/sous-titre sont **forcés à vide/zéro côté serveur** (`normalizeItem` dans `quotes.ipc.ts`) quoi que le client envoie, afin qu'elles n'impactent jamais les totaux.*

*Mise à jour 9 juillet 2026 (Devis — sous-total « AUTRES » masqué sur le document/imprimé) — sur le **Document** et l'**imprimé** du devis uniquement (`quoteTemplate.ts` → `articleRowsBody`, consommé via `mergeQuoteTemplate`/`buildItemsTable` par `QuoteDocumentPage` et l'impression), le groupe des articles **sans catégorie** (« AUTRES ») ne porte plus ni en-tête ni ligne « Sous-total » — ses lignes restent à plat, insérées parmi les groupes catégorisés qui, eux, conservent leur en-tête + sous-total normalement. La vue interne « Détail du devis » (`QuoteDetailPage`) n'est pas concernée par ce changement et continue d'afficher le groupe « AUTRES » comme les autres.*

*Mise à jour 9 juillet 2026 (Devis — unités gérées depuis le Catalogue) — le bouton **« Gérer les unités »** est retiré de « Nouveau/Modifier devis » : le référentiel d'unités (partagé `KpiUnit`) se gère désormais exclusivement depuis *Paramètres → Catalogue prestations/produits → « Nouvel article »* (`CatalogUnitModal`). Sur les lignes de devis, l'**unité d'un article ajouté depuis le catalogue** (`CatalogPicker`) est reprise telle que définie sur l'article (`CatalogItem.unit`) et affichée **en lecture seule** (icône cadenas) — non modifiable sur la ligne. Seules les **lignes créées vides** (bouton « Ligne vide ») conservent un sélecteur d'unité modifiable. Cette distinction (`Line.unitLocked` dans `QuoteFormPage.tsx`) est purement côté formulaire (non persistée) : à l'édition d'un devis existant, les lignes rechargées depuis la base restent modifiables (l'origine catalogue/manuelle n'étant pas mémorisée). Les handlers IPC `quotes:createUnit/updateUnit/deleteUnit` (devenus inutilisés) et le composant `QuoteUnitModal` ont été supprimés ; `quotes:listUnits` (lecture) est conservé pour alimenter le sélecteur des lignes vides.*

*Mise à jour 9 juillet 2026 (Devis — ergonomie du tableau des lignes) — les cellules du tableau des articles (référence, désignation, quantité, unité, prix, total, y compris les en-têtes de catégorie et sous-totaux) portent désormais un attribut `title` affichant leur valeur complète au survol, aussi bien sur « Détail du devis » (`QuoteDetailPage` → `ArticleRowsBody`) que sur le Document/imprimé (`quoteTemplate.ts` → `itemRow`). La colonne **Qté** est légèrement élargie (`w-24` → `w-28`) sur le formulaire « Nouveau/Modifier devis » pour bien afficher un nombre à 3 chiffres. La colonne **Unité** est **centrée horizontalement** (en-tête et valeurs) sur le formulaire, « Détail du devis » et le Document/imprimé.*

*Mise à jour 9 juillet 2026 (Devis — titre de colonne « Référence / LOT » modifiable) — le libellé de la colonne (par défaut « Référence / LOT ») est désormais **modifiable directement par devis** sur le formulaire « Nouveau/Modifier devis » : l'en-tête de colonne devient un champ de saisie en ligne (bordure visible seulement au survol/focus), permettant par exemple de le renommer en « LOT », « Réf. article »… Le libellé personnalisé est stocké dans `Quote.referenceColumnLabel` (nullable, migration `20260709210000_quote_reference_column_label`) et repris tel quel sur « Détail du devis » et le Document/imprimé (`DEFAULT_REFERENCE_COLUMN_LABEL` dans `quoteTemplate.ts` sert de repli si non personnalisé). Un libellé identique au défaut est stocké comme `null` (pas de personnalisation réelle).*

*Mise à jour 9 juillet 2026 (Devis — un même article ne peut être ajouté deux fois) — sur « Nouveau/Modifier devis », dès qu'un article du catalogue est ajouté à une ligne, il **disparaît du sélecteur** `CatalogPicker` (prop `excludeIds`) et ne peut donc plus être ré-ajouté en double dans le même devis. Traçabilité via `QuoteItem.catalogItemId` (scalaire sans FK, migration `20260709220000_quote_item_catalog_item_id`), renseigné à la sélection et **persisté** — à la réédition d'un devis existant, les articles déjà présents restent exclus du sélecteur. Supprimer une ligne libère à nouveau l'article correspondant dans la liste. Les lignes manuelles (« Ligne vide », titres/sous-titres) n'ont pas de `catalogItemId` et n'interfèrent pas avec cette règle.*

*Mise à jour 9 juillet 2026 (Devis — pas de ligne vide par défaut, sous-titre conditionné) — « Nouveau devis » **ne pré-remplit plus** le tableau des lignes avec une première ligne d'article vide : il démarre vide, l'utilisateur ajoute sa première ligne via « Ligne vide », le catalogue ou un « Titre ». Le bouton **« Sous-titre »** est **désactivé** (griffé, infobulle explicative) **tant qu'aucune ligne d'article renseignée** (`lineType = ARTICLE` avec désignation non vide) n'est présente — un sous-titre n'a de sens qu'en organisant des articles déjà saisis. Garde appliquée à la fois sur le bouton (`disabled`) et dans `addSubtitleLine` (double sécurité).*

*Mise à jour 9 juillet 2026 (Devis — retrait de la ligne « Sous-total » autonome des modèles de document) — la ligne **« Sous-total » / `{{devis.sousTotal}}`** du tableau des totaux (au-dessus de TOTAL) est retirée des **modèles de document de devis** (`quote-templates.service.ts` → `buildBody`) : elle faisait doublon avec TOTAL en l'absence de remise/TVA, à côté des sous-totaux **par catégorie** du tableau des lignes (ceux-ci, nommés — ex. « Sous-total CHARPENTE BOIS » — restent corrects et affichés). Les 3 modèles déjà enregistrés en base (Classique, Moderne, Compact) ont été mis à jour ponctuellement (le seed ne réécrit jamais un modèle existant). La variable `devis.sousTotal` reste disponible dans le catalogue de variables si un modèle personnalisé souhaite la réintégrer manuellement.*

*Mise à jour 9 juillet 2026 (Devis — espacement avant le tableau des totaux) — sur le **Document/imprimé** du devis, l'espace entre la fin du tableau des lignes (dernier sous-total par catégorie éventuel) et le tableau des totaux (Remise/TVA/TOTAL) est élargi (`margin-top` de la table des totaux : 8px → 24px, `quote-templates.service.ts` → `buildBody`). Les 3 modèles déjà enregistrés en base ont été mis à jour ponctuellement (le seed ne réécrit jamais un modèle existant).*

*Mise à jour 10 juillet 2026 (Mon espace RH & Paie — retrait de « Mon classement » des Performances) — la carte **« Mon classement »** (rang/score du mois, alimentée par `performance:me:ranking`) est retirée de l'onglet **Performances** de « Mon espace RH & Paie » (`MyHrPage.tsx` → `PerformancesTab`). L'onglet conserve « Mes objectifs » et les évaluations à signer. Le hook `useMyRanking` reste disponible ailleurs (ex. module Performances) mais n'est plus appelé depuis cette page.*

*Mise à jour 10 juillet 2026 (Attestations — sélection multiple de terrains/biens sur « Bien concerné ») — sur « Nouvelle/Modifier attestation » (types **Attribution** et **Cession** uniquement), le champ « Bien concerné » devient un **sélecteur multiple** (puces + recherche, `MultiAssetSelect` dans `AttestationFormPage.tsx`) : plusieurs **terrains d'un même lotissement**, ou plusieurs **biens immobiliers d'un même programme immobilier** (un bien sans programme n'impose aucune contrainte). Nouvelles tables de liaison `AttestationTerrain` / `AttestationProperty` (migration `20260710100000_attestation_multi_terrain_property`) ; `Attestation.terrainId`/`propertyId` restent en scalaires (alignés sur le 1ᵉʳ élément) pour compatibilité avec les modèles de document existants. Contrôle du regroupement lotissement/programme côté IPC (`assertSingleLotissement` / `assertSingleProgramme`) et côté formulaire (verrouillage des options dès le premier choix + message d'alerte en cas d'incohérence). Nouvelles variables de modèle `{{terrains.liste}}`/`{{terrain.nombre}}` et `{{biens.liste}}`/`{{bien.nombre}}` dans `attestationTemplate.ts` ; corrige au passage le pré-remplissage (jamais fonctionnel depuis la migration `20260523000000_convention_multi_biens_terrains`) du bien concerné lors de la création d'une attestation depuis la fiche d'une convention.*

*Mise à jour 10 juillet 2026 (Attestations — sélection multiple étendue au terrain de souscription héritée) — le champ **« Terrain de la souscription »** (mode SOLDE sur échéances héritées) devient lui aussi un **sélecteur multiple** (`terrainIds`, même composant `MultiAssetSelect` et même verrouillage « même lotissement » que « Bien concerné » — le state `terrainIds` est désormais partagé entre les deux cartes, mutuellement exclusives). Le calcul du solde (`assertLegacySubscriptionSettled`, `attestations:getLegacyBalance`) porte sur les échéances héritées du client rattachées à **l'un quelconque** des terrains choisis (`terrainId IN (...)` ou `terrainLinks.terrainId IN (...)`), avec le même repli sur l'ensemble des échéances du client si aucune n'y est rattachée. `useLegacyBalance` et `getLegacyBalance` (preload/IPC) prennent désormais un tableau `terrainIds` plutôt qu'un `terrainId` unique.*

*Mise à jour 10 juillet 2026 (Attestations — correction de {{convention.lotsSouscrits}} en sélection multiple) — le repli de la variable `{{convention.lotsSouscrits}}` (utilisé quand l'attestation n'a pas de convention liée, ex. souscription héritée) énumérait à tort uniquement le **premier** terrain de la sélection multiple (`a.terrain`, champ scalaire de compatibilité) au lieu de la liste complète. Corrigé dans `resolveAttestationVariables` (`attestationTemplate.ts`) pour retomber sur `terrainsList` (tous les terrains rattachés via `AttestationTerrain`), avec repli supplémentaire sur le terrain unique pour les attestations mono-bien antérieures à la sélection multiple.*

*Mise à jour 10 juillet 2026 (Retards & Départs précipités — ouverture en auto-consultation à tous les rôles) — la page **« Retards & Départs précipités »** (`/hr/lateness`), jusque-là réservée à SUPER_ADMIN/ADMIN/MANAGER, est désormais accessible à **tout utilisateur authentifié** (route sortie de son `RoleGuard` dans `router.tsx`, groupe « Gestion du personnel » du `Sidebar.tsx` ouvert à tous les rôles). SUPER_ADMIN/ADMIN/MANAGER conservent la vue complète (tous les collaborateurs éligibles, filtre « Collaborateur », actions « Justifier »/« Retirer »). Les **autres rôles** voient uniquement les journées de **l'employé lié à leur propre compte** (`hr:lateness:list` bascule sur `session.userId` au lieu de `LATENESS_ROLES`, en **ignorant le filtre d'éligibilité par pondération de poste** qui ne sert qu'à réduire le bruit de la vue admin), **sans le filtre « Collaborateur »** ni la colonne « Actions » (`LatenessPage.tsx` → `isFullAccess`). Les actions d'écriture (`justify`/`unjustify`) restent réservées à SUPER_ADMIN/ADMIN/MANAGER côté IPC.*

*Mise à jour 10 juillet 2026 (Retards & Départs précipités — exclusion par défaut des comptes de direction, paramétrable) — les employés liés à un compte utilisateur **SUPER_ADMIN, ADMIN ou MANAGER** ne sont désormais, **par défaut**, **ni calculés ni affichés** dans « Retards & Départs précipités » : ni dans la liste (vue admin/manager comme auto-consultation), ni dans le KPI de performance `LATE_EARLY_DEPARTURE_HOURS` (qui retourne « non mesurable », comme un KPI sans compte utilisateur rattaché). Nouveau commutateur *Paramètres → « Retards & Départs précipités »* (`LatenessSettingsTab.tsx`, onglet réservé SUPER_ADMIN/ADMIN, IPC `settings:getLatenessSettings`/`updateLatenessSettings`) permettant de **réintégrer** ces employés — `AppSetting` `hr.lateness.includeManagementRoles` (`'true'`/`'false'`, défaut `false`). Logique centralisée dans `performance.service.ts` (`latenessIncludesManagementRoles()`, `managementLinkedEmployeeIds()`), appliquée dans `latenessEligibleEmployeeIds` (liste, donc aussi la vue admin/manager) et dans le calcul du KPI `LATE_EARLY_DEPARTURE_HOURS`. N'affecte pas l'auto-consultation d'un rôle non-management (qui ne peut par construction pas être lié à un compte SUPER_ADMIN/ADMIN/MANAGER).*

*Mise à jour 10 juillet 2026 (Retards & Départs précipités — cumul justifié affiché) — la barre de synthèse de `LatenessPage.tsx` affiche désormais, à côté de « Cumul non justifié sur la période », un second indicateur **« Cumul justifié sur la période »**. Pour que ces deux cumuls restent exacts quel que soit l'état de la case « Afficher aussi les journées justifiées », `hr:lateness:list` est désormais toujours interrogé **sans** `onlyUnjustified` (toutes les journées, justifiées incluses) ; la case à cocher ne filtre plus que les **lignes affichées dans le tableau** (variable `filtered`), tandis que les cumuls sont calculés sur l'ensemble des journées correspondant aux filtres Collaborateur/Recherche (variable `matching`), indépendamment de cette case.*

*Mise à jour 10 juillet 2026 (Réseaux Sociaux & Plateformes Web — retrait de l'accès ASSISTANTE_DIRECTION au Tableau de bord et aux Plateformes) — le rôle **ASSISTANTE_DIRECTION** n'a désormais **plus accès** aux interfaces **« Tableau de bord »** (`/social-media/dashboard`) et **« Plateformes »** (`/social-media/platforms`) du module Réseaux Sociaux & Plateformes Web (sous-menus masqués dans `Sidebar.tsx`, routes fermées par `RoleGuard` dans `router.tsx`). Côté IPC, ces deux interfaces (`socialMedia:dashboard`, `socialMedia:listPlatforms`/`createPlatform`/`updatePlatform`/`deletePlatform`) sont désormais contrôlées par rôle **exact** (`checkExactRole`, nouvelle fonction locale à `social-media.ipc.ts`, sans l'équivalence MANAGER de `checkRole`) sur des listes **explicites** `READ_ROLES`/`WRITE_ROLES` = `['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT']` — ACCOUNTANT conserve cet accès (comportement inchangé), ASSISTANTE_DIRECTION en est exclu. Le périmètre de vue complète des plateformes (`hasPlatformFullView`) reste porté par une constante dédiée `PLATFORM_FULL_VIEW_ROLES` (inchangée) pour ne pas altérer le scoping existant d'ACCOUNTANT. **Publications & articles** et **Abonnés** restent accessibles à ASSISTANTE_DIRECTION, sans changement.*

*Mise à jour 10 juillet 2026 (Réseaux Sociaux & Plateformes Web — barre d'onglets filtrée par rôle) — la barre d'onglets commune aux 4 pages du module (`SocialMediaTabs.tsx`) n'affiche désormais que les onglets **accessibles au rôle de l'utilisateur connecté**, au lieu des 4 onglets systématiquement (même pour un rôle sans accès à certains d'entre eux). Chaque entrée de `TABS` porte un `roles?: string[]` optionnel (mêmes listes que les `RoleGuard` de `router.tsx`/`Sidebar.tsx` : Tableau de bord et Plateformes → `['SUPER_ADMIN','ADMIN','MANAGER','ACCOUNTANT']`, Abonnés → `[...+ 'ASSISTANTE_DIRECTION','AGENT_TECHNIQUE']`, Publications & articles → pas de restriction, ouvert à tous sauf READONLY) ; un onglet sans `roles` reste visible à tous. Un **AGENT**, par exemple, ne voit plus que « Publications & articles ». Même pattern que `VisitorsTabs.tsx`.*

*Mise à jour 10 juillet 2026 (Réseaux Sociaux & Plateformes Web — retrait de l'accès ACCOUNTANT au Tableau de bord, aux Abonnés et aux Plateformes) — le rôle **ACCOUNTANT (Comptable)** n'a désormais **plus accès** aux interfaces **« Tableau de bord »**, **« Abonnés »** et **« Plateformes »** du module Réseaux Sociaux & Plateformes Web (sous-menus masqués dans `Sidebar.tsx`, routes fermées par `RoleGuard` dans `router.tsx`, onglets filtrés dans `SocialMediaTabs.tsx`). Côté IPC : `READ_ROLES`/`WRITE_ROLES` (Tableau de bord + Plateformes, `social-media.ipc.ts`) reviennent à `['SUPER_ADMIN', 'ADMIN', 'MANAGER']` ; `SNAPSHOT_ROLES` (Abonnés) passe à une liste **explicite** `['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ASSISTANTE_DIRECTION', 'AGENT_TECHNIQUE']` contrôlée par **`checkExactRole`** (au lieu de `checkRole`, dont l'équivalence MANAGER aurait sinon réintégré ACCOUNTANT) — ASSISTANTE_DIRECTION conserve l'accès à Abonnés, ACCOUNTANT en est désormais exclu partout sauf **Publications & articles** (`PUBLICATION_ROLES`, inchangé). Seule exception à l'ancienne équivalence `checkRole` sur ce module : les trois listes de rôles (`READ_ROLES`/`WRITE_ROLES`/`SNAPSHOT_ROLES`) sont désormais toutes contrôlées par rôle exact.*

*Mise à jour 10 juillet 2026 (Trésorerie & Budgets — retrait de l'accès READONLY) — le rôle **READONLY** n'a désormais **plus accès** aux modules **Trésorerie** (`/treasury`) et **Budgets** (`/budgets`), y compris leurs tableaux de bord (jusque-là ouverts à READONLY en lecture seule). Sous-menus masqués dans `Sidebar.tsx`, routes fermées par `RoleGuard` dans `router.tsx`. Côté IPC, `READONLY` retiré des constantes `READ_ROLES` de `treasury.ipc.ts` et `budget.ipc.ts` (`checkTreasuryRole`/`checkBudgetRole`) — ASSISTANTE_DIRECTION restait déjà exclue de ces deux modules (décision produit antérieure, inchangée). Constante renderer `BUDGET_READ_ROLES` (`budget.utils.ts`, non utilisée ailleurs dans le code) mise à jour pour rester cohérente avec le nouveau périmètre.*

*Mise à jour 10 juillet 2026 (Devis — sélection multiple de terrains/biens + détails enrichis) — sur « Nouveau/Modifier devis », le champ **« Bien concerné »** devient, comme pour les Attestations, un **sélecteur multiple** (puces + recherche, `MultiAssetSelect` local à `QuoteFormPage.tsx`) : plusieurs **terrains d'un même lotissement**, ou plusieurs **biens immobiliers d'un même programme immobilier** (un bien sans programme n'impose aucune contrainte). Nouvelles tables de liaison `QuoteTerrain` / `QuoteProperty` (migration `20260710200000_quote_multi_terrain_property`, même principe que `AttestationTerrain`/`AttestationProperty`) ; `Quote.terrainId`/`propertyId` restent en scalaires (alignés sur le 1ᵉʳ élément de la sélection) pour compatibilité avec la conversion en convention/facture (`quotes:convert`, toujours mono-bien). Contrôle du regroupement lotissement/programme côté IPC (`assertSingleLotissement`/`assertSingleProgramme`, dupliqués localement dans `quotes.ipc.ts`) et côté formulaire (verrouillage des options dès le premier choix + message d'alerte en cas d'incohérence). **Détails enrichis dans le sélecteur** : les options « Terrain(s) » affichent désormais îlot, lot/parcelle et nom du lotissement (`{{reference}} — Îlot {{numeroIlot}}, Lot {{numeroParcelle}} ({{lotissement.nom}})`) ; les options « Bien(s) » affichent adresse, ville et nom du programme immobilier le cas échéant. Mêmes détails enrichis repris sur « Détail du devis » (`QuoteDetailPage.tsx`, énumération de tous les terrains/biens sélectionnés) et sur le document imprimé/PDF (`quoteTemplate.ts` → `objetDesignation`, corrigée pour énumérer l'ensemble de la sélection au lieu du seul 1ᵉʳ élément — même classe de bug que celui déjà corrigé pour `{{convention.lotsSouscrits}}` sur les attestations ; nouvelles variables de modèle `{{terrains.liste}}`/`{{terrain.nombre}}` et `{{biens.liste}}`/`{{bien.nombre}}`, variables singulières `terrain.*`/`bien.*` conservées pour compatibilité avec les modèles existants, alignées sur le 1ᵉʳ élément).*

*Mise à jour 10 juillet 2026 (Retards & Départs précipités — statut « Toléré » + limite paramétrable) — SUPER_ADMIN, ADMIN et MANAGER peuvent désormais marquer une journée de retard/départ précipité comme **« Tolérée »** (bouton « Tolérer », `LatenessPage.tsx`), en plus de la justification existante (congé/activité) : marquage manuel **sans** congé ni activité liée, autorisé uniquement si le temps de la journée n'excède pas une **limite paramétrable en minutes** (*Paramètres → « Retards & Départs précipités » → « Limite de tolérance »*, défaut 15 min, `AppSetting` `hr.lateness.toleranceMinutes`). Nouveaux champs `AttendanceDelayJustification.tolerated`/`toleratedById`/`toleratedAt` (migration `20260710300000_attendance_delay_tolerated`), **mutuellement exclusifs** avec `justified` sur une même journée (poser l'un efface l'autre côté IPC). Nouveaux handlers `hr:lateness:tolerate`/`untolerate` (réservés à `LATENESS_ROLES`, la limite étant vérifiée côté serveur). La barre de synthèse affiche un troisième indicateur **« Cumul toléré sur la période »**, à côté des cumuls non justifié/justifié — et **`computeUnjustifiedLatenessMinutes`** (donc le KPI `LATE_EARLY_DEPARTURE_HOURS`) exclut désormais aussi bien les journées tolérées que les journées justifiées : le KPI ne compte plus que le « Cumul non justifié » affiché à l'écran. Lecture de la limite de tolérance élargie à MANAGER (`settings:getLatenessSettings`, constante `LATENESS_SETTINGS_READ_ROLES` dans `settings.ipc.ts`) pour alimenter le bouton « Tolérer » (désactivé si la journée dépasse la limite), bien que l'onglet Paramètres reste réservé à SUPER_ADMIN/ADMIN (écriture via `settings:updateLatenessSettings`, inchangée).*

*Mise à jour 10 juillet 2026 (correctif — activités CRM sans « Utilisateur » invisibles pour la justification de retard) — le formulaire « Nouvelle activité » (`ActivityFormPage.tsx`) ne préremplissait pas le champ **« Utilisateur »** (assigné à, `CrmActivity.userId`) : une activité de type **VISITE** (« Visite chantier / Sortie en clientèle / Courses ») créée sans le renseigner explicitement restait `userId = null`, alors que `hr:lateness:linkableActivities` exige une correspondance stricte `userId = employee.userId` — l'activité n'apparaissait donc jamais dans la fenêtre « Justifier » de *Retards & Départs précipités* (et n'était comptée dans aucun KPI de performance CRM de son auteur). Le champ **« Utilisateur » est désormais présélectionné sur soi-même à la création** (modifiable), sans effet en édition. Correctif de données ponctuel appliqué à l'activité concrète signalée (id 79, « Course au plateau », 09/07/2026, `userId` réaligné sur `createdById`) ; les activités déjà orphelines plus anciennes ne sont pas affectées par ce commit et devront être corrigées au cas par cas (réassigner « Utilisateur » sur la fiche de l'activité) si elles doivent servir de justification ou compter dans un KPI.*

*Mise à jour 10 juillet 2026 (Activités & CRM — tri par récence, libellé VISITE harmonisé partout) — la liste des activités (`crm:listActivities`) est désormais triée **du plus récent au plus ancien** (`orderBy: { createdAt: 'desc' }`, au lieu de `dueDate` croissant puis `createdAt` décroissant). Le libellé du type **VISITE** est désormais **« Visite chantier / Sortie en clientèle / Courses »** partout où il est affiché (badge/colonne « Type » et export CSV/PDF de la liste `CrmPage.tsx`, vue détail `ActivityDetailModal.tsx`, récapitulatif CRM du tableau de bord `CrmRecapSection.tsx`, champ de filtre « Type » et résumé des filtres actifs) — même valeur d'énumération `ActivityType.VISITE` en base, seul le libellé affiché change (aucune migration de données).*

*Mise à jour 10 juillet 2026 (Activités & CRM — retrait de la vue complète pour ACCOUNTANT) — le rôle **ACCOUNTANT (Comptable)** ne voit désormais que **ses propres activités CRM** (assignées, créées par lui, ou rattachées à un client/prospect/convention dont il est le référent) — même périmètre restreint que **AGENT** — au lieu de la vue complète sur l'ensemble des activités dont il bénéficiait jusque-là. Constante `FULL_VIEW_ROLES` ramenée à `['SUPER_ADMIN', 'ADMIN', 'MANAGER']` dans `crm.ipc.ts` (source unique réutilisée par `buildVisibilityWhere`, donc appliquée uniformément à `crm:listActivities`/`getActivity`/`getStats`/`listAssignees`) et dans `CrmPage.tsx` (masque le filtre « Utilisateur », réservé aux rôles en vue complète). Sans effet sur les autres droits CRM d'ACCOUNTANT (création/modification/traitement d'activité, toujours ouverts).*

*Mise à jour 10 juillet 2026 (correctif — bulletins de paie : retrait de la ligne « Autres retenues », qui doublait le « Total des retenues ») — la ligne **« Autres retenues »** (saisie manuelle libre lors de la génération/modification d'un bulletin) est retirée du moteur de paie (`payroll.service.ts` → `PayrollInput`/`PayrollResult`, `Total des retenues` = CNPS salarié + ITS + CMU salarié uniquement) ainsi que des formulaires « Générer un bulletin » (`PayslipsListPage.tsx`) et « Modifier le bulletin » (`PayslipDetailPage.tsx`). Le champ était distinct — mais au libellé proche — du champ **« Total des retenues » du contrat** (`EmployeeDetailPage.tsx`, = ITS + CNPS + CMU, jamais lu par le moteur de paie) : en pratique, il était renseigné avec la même valeur que ce total contractuel, faisant compter deux fois CNPS + ITS + CMU dans le total du bulletin. La colonne `Payslip.otherDeductions` (Prisma, défaut 0) est conservée pour les bulletins historiques déjà générés, mais n'est plus alimentée pour les nouveaux bulletins (aucune migration nécessaire).*

*Mise à jour 10 juillet 2026 (bulletins de paie — ligne « Mois Année » sous le titre) — le document du bulletin (`renderPayslipHtml` dans `payroll.service.ts`, utilisé par l'aperçu/impression admin et par « Mon espace RH & Paie ») affiche désormais, en **gras**, une ligne « Mois Année » (ex. « Juillet 2026 ») entre le titre **BULLETIN DE PAIE** et la ligne de période détaillée (« Période du 01/07/2026 au 31/07/2026 »).*

*Mise à jour 10 juillet 2026 (bulletins de paie — duplication d'un bulletin) — un bouton **« Dupliquer »** (liste `PayslipsListPage.tsx` et détail `PayslipDetailPage.tsx`) ouvre `DuplicatePayslipModal.tsx` : choix d'un employé cible (préempli sur le même employé) et d'une période cible (préemplie sur le mois suivant). La duplication **reprend les entrées ajustables** du bulletin source (sursalaire, prime imposable, indemnité de transport, option heures supplémentaires) mais **recalcule intégralement** CNPS/ITS/CMU/charges pour la cible à partir du contrat et des taux en vigueur — jamais une copie brute des montants, qui seraient faux pour un autre employé/une autre période. Nouveau handler `hr:payslips:duplicate` (IPC), qui réutilise le même cœur de calcul que `hr:payslips:generate` — factorisé dans `generatePayslipCore()` (`hr.ipc.ts`). **Un seul bulletin par employé et par période** reste strictement appliqué (contrainte `@@unique([employeeId, periodYear, periodMonth])` en base + vérification applicative renvoyant une erreur explicite) — règle déjà existante pour `generate`, désormais garantie de la même façon pour `duplicate` puisque les deux passent par `generatePayslipCore()`.*

*Mise à jour 13 juillet 2026 (correctif — duplication de bulletin : sélection par défaut de l'employé source) — le champ « Employé » de `DuplicatePayslipModal.tsx` ne retenait pas toujours l'employé du bulletin source par défaut : la liste (`useEmployees({ status: 'ACTIF' }, …)`) excluait un employé non actif (congé/suspendu/sorti), et de toute façon le `<select>` non contrôlé de React Hook Form ne pouvait pas appliquer `defaultValues.employeeId` tant que les options — chargées de façon asynchrone — n'étaient pas encore montées (le navigateur retombait alors sur le premier élément de la liste). Corrigé en retirant le filtre de statut (l'employé source doit rester sélectionnable quel que soit son statut actuel) et en réappliquant `reset()` dès que les employés sont chargés.*

*Mise à jour 13 juillet 2026 (Réseaux Sociaux — Abonnés : relevé attribué d'office à l'utilisateur connecté pour les rôles restreints) — sur « Relevé du nombre d'abonnés » (`FollowerSnapshotModal.tsx`), le champ **« Relevé par »** n'est proposé en sélection libre (liste `crm:listAssignees`) qu'aux rôles en vue complète **SUPER_ADMIN/ADMIN/MANAGER** ; les autres rôles autorisés sur le module (ASSISTANTE_DIRECTION, AGENT_TECHNIQUE) se voient directement attribuer et afficher **leur propre compte** (champ lecture seule, présélectionné), sans appel à `crm:listAssignees` — cet endpoint est réservé à la vue complète CRM (cf. mise à jour du 10 juillet 2026 sur `crm.ipc.ts`) et aurait renvoyé une erreur de permission pour ces rôles.*

*Mise à jour 13 juillet 2026 (Réseaux Sociaux — Abonnés : modification d'un relevé existant) — **SUPER_ADMIN, ADMIN et MANAGER** disposent désormais d'un bouton **« Modifier »** (icône crayon) sur chaque ligne de `SocialFollowersPage.tsx` (les autres rôles autorisés sur le module — ASSISTANTE_DIRECTION, AGENT_TECHNIQUE — n'ont accès qu'à la création d'un nouveau relevé, pas à la modification d'un relevé existant). `FollowerSnapshotModal.tsx` accepte désormais une prop `snapshot` optionnelle activant un mode édition : **plateforme et date sont verrouillées** (champs désactivés, non modifiables) car l'enregistrement repose sur le même `socialMedia:upsertSnapshot` (upsert par plateforme + jour) — seuls le nombre d'abonnés, l'auteur du relevé et les notes sont modifiables. Correctif inclus au passage : le sélecteur de plateforme n'excluait que les plateformes inactives (`usePlatforms(true)` filtré côté client sur `isActive`) — en mode édition, la plateforme du relevé reste affichée même si elle a depuis été désactivée (même classe de bug que le correctif du 13 juillet sur `DuplicatePayslipModal.tsx`).*

*Mise à jour 21 juillet 2026 (nouveau module — Innovations IT + KPI « Nombre d'innovations IT mises en œuvre ») — nouveau **Module 16 — Innovations IT** (`/innovations`, `/innovations/:id`) : enregistrement et suivi des innovations IT portées par un employé, validées en **3 phases successives** par un validateur (SUPER_ADMIN/ADMIN/MANAGER) — Phase 1 « Énoncé et description » (+15%), Phase 2 « Démonstration et validation de test » (+35%, cumulé 50%), Phase 3 « Validation finale et intégration » (+50%, cumulé 100% = mise en œuvre). Un rejet de phase (motif obligatoire) n'est pas définitif : il renvoie l'innovation en révision, le porteur corrige et la resoumet automatiquement. Création/gestion réservées aux rôles techniques (**SUPER_ADMIN, ADMIN, MANAGER, RH, AGENT_TECHNIQUE**), ce dernier restreint à ses propres innovations (porteur = employé lié à son compte) ; validation des phases réservée à **SUPER_ADMIN, ADMIN, MANAGER**. Nouveau modèle Prisma `ItInnovation` (référence auto `INNOV-AAAA-NNNN`) et enum `ItInnovationStatus` ; nouvelles valeurs `IT_INNOVATION` (`KpiSource`) et `IT_INNOVATIONS_IMPLEMENTED` (`KpiMetric`) alimentant le catalogue KPI du Module 14 (nombre d'innovations validées à 100% sur la période, attribution directe par `Employee.id`, sans exigence de compte utilisateur — même principe que `ATTENDANCE`/`LEAVE`). IPC `it-innovations.ipc.ts` (`innovations:*`). Migration `20260721120000_it_innovation_module`.*

*Mise à jour 22 juillet 2026 (Innovations IT — pièces jointes par phase + fiche agrandie) — le formulaire **« Nouvelle innovation IT »** est agrandi (`size="xl"`) et permet désormais de joindre des **pièces justificatives dès la Phase 1** (documents, images, vidéos, audios). Chaque phase peut ensuite recevoir ses propres pièces jointes depuis la fiche détail (`PhaseAttachments`, glisser-déposer/sélecteur, tant que la phase est atteinte) via `Document.itInnovationId` (relation `ItInnovationAttachments`) + `Document.itInnovationPhase` (1/2/3) — même mécanisme que les pièces jointes d'activité CRM/publication, `documents:import` étendu en conséquence. **Interface de visualisation lors de la validation par étape** : `ValidatePhaseModal` affiche le contenu soumis et un **aperçu intégré** des pièces jointes de la phase (réutilise `DocumentPreview` du module Archivage — images, PDF, audio, vidéo, avec repli « Ouvrir » pour les autres formats), pour que le validateur dispose de tous les justificatifs avant de trancher. Indicateur trombone + compteur (`_count.attachments`) sur la liste des innovations. Migration `20260722100000_it_innovation_attachments`.*

*Mise à jour 22 juillet 2026 (Innovations IT — suppression d'une pièce jointe) — un bouton de suppression (icône corbeille, avec confirmation) est ajouté à côté de « Voir » sur chaque pièce jointe déjà téléversée (`PhaseAttachments.tsx`), pour les phases non verrouillées. Nouveau handler `innovations:removeAttachment` (`it-innovations.ipc.ts`) : soft delete du `Document` + suppression du fichier physique (chemins relatifs uniquement), même périmètre que les autres mutations du module (`WRITE_ROLES` + `assertOwnership`, AGENT_TECHNIQUE limité à ses propres innovations). Les fichiers sélectionnés mais pas encore envoyés (formulaire de création, avant que l'innovation existe) disposaient déjà d'un retrait local (bouton ✕ sur `pendingFiles`), inchangé.*

*Mise à jour 22 juillet 2026 (Performances — objectifs annuels 2026 pour le poste TECHNICIEN INFORMATIQUE) — à partir du profil de pondération déjà défini pour ce poste (`PerformanceWeightProfile` « TECHNICIEN INFORMATIQUE », 16 KPI pondérés, somme 100%, `PROSPECT_CONVERSION_RATE` à 0% donc exclu), création de **15 objectifs annuels 2026** par poste (un par KPI non nul du profil, cibles indicatives à ajuster dans *Performances → Objectifs*, poids repris directement du profil de pondération) : ventes/commissions/encaissement, activités et visites CRM, taux de présence et jours d'absence, conventions résiliées, les 4 KPI Réseaux sociaux, retards/départs précipités, et **Nombre d'innovations IT mises en œuvre** (cible indicative 2/an). Le profil de pondération de ce poste inclut des KPI commerciaux (ventes, commissions) en plus des KPI techniques/RH — configuration reprise telle quelle, à ajuster si non pertinente pour ce poste.*

*Mise à jour 22 juillet 2026 (nouveau KPI — Taux de recouvrement, pour les commerciaux et le comptable) — nouvelle métrique **`RECOVERY_RATE`** (catalogue Performance, Module 14, source `ACCOUNTING`, unité `%`, `HIGHER_BETTER`) : **chiffre global entreprise, sans attribution personnelle** (contrairement aux autres métriques `ACCOUNTING` qui sont attribuées par `Convention.agentId`) — sur les factures dont l'échéance (`dueDate`) tombe dans la période évaluée (hors `BROUILLON`/`ANNULEE`), part du montant dû effectivement réglée à ce jour (tous règlements confondus, même postérieurs à la période). Calculée dans `computeMetricValue` (`performance.service.ts`), avec une exception explicite au filtre `needsUser` (source `ACCOUNTING` normalement gatée par compte utilisateur) puisque ce KPI ne dépend d'aucune attribution personnelle. Ajoutée aux profils de pondération **COMMERCIAL** (poids 15%) et **COMPTABLE** (poids 20%, KPI central pour ce poste) — dilue proportionnellement les autres KPI de ces profils (pas de rééquilibrage à 100%, la normalisation relative se fait automatiquement au calcul du score). Migration `20260722110000_kpi_recovery_rate`.*

*Mise à jour 22 juillet 2026 (Performances — resynchronisation des objectifs COMPTABLE 2026 sur la pondération courante) — le profil de pondération COMPTABLE ayant été retouché depuis (poids `RECOVERY_RATE` ajusté à 15%, `ATTENDANCE_RATE`/`CRM_ACTIVITIES_DONE`/`ABSENCE_DAYS` réajustés, somme du profil = 95%), les **4 objectifs annuels 2026 déjà existants** (Chiffre d'affaire réalisé, Taux de présence, Activités CRM traitées, Jours d'absence) ont leur **poids resynchronisé** sur le profil actuel (leurs cibles réelles, fixées précédemment, ne sont pas modifiées) et **8 objectifs manquants** sont créés pour compléter la couverture des KPI non nuls du profil : ventes/montant des ventes/commissions, visites CRM, conventions résiliées, publications & articles, retards/départs précipités, et **Taux de recouvrement** (cible indicative 85%, à ajuster). Total : 12 objectifs COMPTABLE 2026, somme des poids = 95% (cohérent avec le profil de pondération).*

*Mise à jour 24 juillet 2026 (Profils de carrière — poste partageable entre plusieurs filières + duplication d'un profil) — **Paramètres → Profils de carrière** : un même poste peut désormais appartenir à **plusieurs profils de carrière** (filières transverses), alors qu'il ne pouvait auparavant relever que d'un seul ; la contrainte d'unicité passe d'un `poste` global (`CareerProfileStep.poste @unique`) à une unicité **par profil** (`@@unique([careerProfileId, poste])`, migration `20260724170000_career_profile_step_poste_per_profile`) — un même poste ne peut toujours pas apparaître deux fois **au sein d'un même profil** (contrôle applicatif `assertStepsInternallyConsistent` inchangé + contrainte DB). Le contrôle de conflit inter-profils (`assertPostesAvailable`) est supprimé de `careerProfiles:create`/`update`. Nouveau bouton **« Dupliquer »** (icône copie) sur chaque profil dans les Paramètres — nouveau handler `careerProfiles:duplicate` : copie intégrale du profil (nom suffixé « (copie) », description, statut actif, toutes les étapes) dans un nouveau profil indépendant.*

*Mise à jour 25 juillet 2026 (Profils de carrière — rattachement explicite d'un employé à une filière unique) — contrairement à un poste (qui peut désormais figurer dans plusieurs profils de carrière, cf. ci-dessus), **un employé n'appartient qu'à une seule filière à la fois**. La fiche employé (« Poste & emploi ») gagne un sélecteur **« Filière de carrière »** (`Employee.careerProfileId`, FK optionnelle vers `CareerProfile`, `onDelete: SetNull`, migration `20260725100000_employee_career_profile_link`), alimenté par un nouvel endpoint dédié `hr:employees:careerProfiles` (lecture ouverte à `HR_STAFF_READ_ROLES` — SUPER_ADMIN/ADMIN/RH/MANAGER —, contrairement à `careerProfiles:list` réservé au paramétrage SUPER_ADMIN/ADMIN). Le self-service **« Mon espace RH → Profil de carrière »** (`hr:me:careerProfile`) affiche désormais **une seule filière** (`{ profile, currentPoste }`, revenu sur une forme singulière) : priorité au rattachement explicite de la fiche employé ; à défaut (employé pas encore lié), repli sur la première filière dont une étape correspond à son poste actuel (comportement historique, arbitraire si plusieurs filières partagent ce poste — l'ambiguïté encourage à renseigner le rattachement explicite).*

*Mise à jour 25 juillet 2026 (Performances — objectifs annuels 2026 dupliqués du poste TECHNICIEN INFORMATIQUE vers INFORMATICIEN) — les **15 objectifs annuels 2026** déjà définis pour le poste **TECHNICIEN INFORMATIQUE** sont dupliqués à l'identique (intitulé, cible, poids, KPI, type de mesure) pour le poste **INFORMATICIEN** (`PerformanceObjective.poste`), avancement remis à 0 et statut « En cours » — même logique d'anti-doublon (intitulé + période + poste) que `performance:objectives:duplicate`, appliquée ici entre deux postes plutôt qu'entre deux périodes (opération ponctuelle, aucun profil de pondération `PerformanceWeightProfile` n'a été créé pour INFORMATICIEN — à faire séparément si ce poste doit aussi être noté par le calcul KPI automatique).*

*Mise à jour 25 juillet 2026 (correctif — « Modifier un utilisateur » : date d'embauche jamais prise en compte) — contrairement à tous les autres modules IPC, `users.ipc.ts` ne sérialisait jamais ses réponses (pas de helper `ser()`) : les champs `Date` Prisma (`hireDate`, `lastLoginAt`, `createdAt`, `updatedAt`) traversaient le pont `contextBridge` comme de véritables instances `Date` plutôt que des chaînes ISO. Or `UserFormPage.tsx` pré-remplit le champ via `String(u.hireDate).slice(0, 10)`, une conversion qui suppose une chaîne ISO (`"2026-01-15T00:00:00.000Z"` → `"2026-01-15"`) : appliquée à une instance `Date`, `String(...)` produit un format lisible (`"Wed Jan 15 2026…"`) dont les 10 premiers caractères (`"Wed Jan 15"`) ne sont pas une date valide pour un `<input type="date">`, qui l'affiche donc vide à chaque réouverture du formulaire — et un enregistrement sans y toucher renvoyait alors `hireDate: ''`, écrasant silencieusement la valeur en base par `null`. Corrigé en ajoutant le helper `ser()` (`JSON.parse(JSON.stringify(v))`, même pattern que tous les autres fichiers IPC) et en l'appliquant aux réponses de `users:list`, `users:getById`, `users:create` et `users:update`.*

*Mise à jour 28 juillet 2026 (Personnel — détail des coordonnées bancaires) — sur « Nouvel/Modifier employé », le bloc **« Identité & protection sociale »** est renommé **« Identité, protection sociale & référence bancaires »** et gagne 4 champs optionnels détaillant le RIB : **Code Banque**, **Code Guichet**, **Numéro compte**, **Clé RIB** (`Employee.bankCode` / `bankGuichetCode` / `bankAccountNumber` / `bankRibKey`, migration `20260728100000_employee_bank_details`), en complément du champ RIB/IBAN existant (`bankRib`, texte libre, conservé tel quel).*

*Mise à jour 28 juillet 2026 (Bulletins de paie — « Ordre de virement ») — sur « Bulletins de paie », un bouton **« Ordre de virement »** (icône banque, à côté du filtre « Statut », actif uniquement lorsqu'une **année ET un mois précis** sont sélectionnés) est réservé aux **seuls SUPER_ADMIN/ADMIN** (`checkRole` rôle exact, comme `career-profiles.ipc.ts` — aucune équivalence MANAGER/ACCOUNTANT). Il ouvre une fenêtre proposant **Aperçu/Imprimer**, **Export PDF** et **Export Excel** d'une fiche **paysage** à transmettre à la banque, listant les salaires nets à payer du mois pour tous les bulletins **VALIDE ou PAYE** de la période (bulletins BROUILLON/ANNULE exclus), triés par nom. La fiche comprend : un titre **« ORDRE DE VIREMENT »** avec le logo de l'entreprise en vis-à-vis ; un **bloc d'introduction** (4 lignes par défaut, HTML éditable — texte et mise en forme par ligne, nombre de lignes libre, variables `{{periode}}`/`{{nombreBeneficiaires}}`/`{{montantTotal}}`/`{{dateEdition}}`) ; un tableau titré **« LISTE DES BÉNÉFICIAIRES »** (titre modifiable) à **8 colonnes de largeurs éditables** — N°, Nom complet, Code Bancaire, Code Guichet, Numéro de compte, Clé RIB, Banque, Montant (FCFA) — avec une **ligne TOTAL** sur les nets à payer ; et un bloc de signature **« Fait à Abidjan, le {date} »** suivi d'un libellé de signataire éditable (par défaut « Le Directeur Général »). Modèle unique et éditable (`WireTransferTemplate`, migration `20260728110000_wire_transfer_template`, même principe singleton que `ListExportTemplate` — création automatique au premier accès) dans **Paramètres → Modèles d'imprimés → « Modèle d'ordre de virement »** (accès admin implicite, aucun `roles` déclaré sur l'onglet). Rendu HTML→PDF via `htmlToPdf({ landscape: true })` et export Excel via `exceljs`, tous deux dans `wire-transfer.service.ts` ; handlers `wire-transfer.ipc.ts` (`wireTransfer:getTemplate/updateTemplate/print/exportPdf/exportExcel`) suivant exactement le pattern d'aperçu/impression des bulletins (`hr:payslips:print`) et d'export à la demande (`export:generate`, boîte de dialogue d'enregistrement).*

*Mise à jour 28 juillet 2026 (Bulletins de paie — bouton « Ordre de virement » en rouge + validation directe depuis la liste) — le bouton **« Ordre de virement »** passe en fond rouge (`variant="danger"`). Chaque bulletin au statut **Brouillon** affiche désormais, dans la colonne Actions de la liste, un bouton **« Valider »** (coche verte), visible pour les mêmes rôles que les autres actions d'écriture (SUPER_ADMIN/ADMIN/RH/ACCOUNTANT/MANAGER) — passe le bulletin en statut **VALIDE** via `hr:payslips:updateStatus`, en reprenant exactement le comportement déjà présent sur la fiche détail du bulletin (sans plus devoir y naviguer).*

*Mise à jour 28 juillet 2026 (Ordre de virement — montant en lettres + nom du signataire) — la fiche « Ordre de virement » affiche désormais, **sous la ligne TOTAL** du tableau, le montant net total à virer **en toutes lettres** (« Arrêté le présent ordre de virement à la somme de : … », via `moneyToFrenchWords` — copie main-process dédiée dans `src/main/utils/numberToWords.ts`, le process main ne pouvant importer le module équivalent sous `src/renderer` : `tsconfig.main.json` restreint `rootDir`/`include` à `src/main`+`src/shared`). Le bloc de signature gagne un nouveau champ **« Nom du signataire »** (`WireTransferTemplate.signatureName`, migration `20260728120000_wire_transfer_signature_name`), affiché sous la fonction (ex. « Le Directeur Général » puis, en dessous, « M. Jean KOUASSI ») — configurable dans *Paramètres → Modèles d'imprimés → « Modèle d'ordre de virement »* (le champ « Libellé du signataire » est renommé **« Fonction du signataire »** pour plus de clarté). Absent du modèle par défaut (vide tant qu'un admin ne le renseigne pas) — la ligne n'est alors pas affichée.*

*Mise à jour 28 juillet 2026 (Ordre de virement — export Excel aligné sur le PDF, avec logo) — l'export Excel (`buildWireTransferXlsx`) affichait jusque-là un document appauvri par rapport au PDF : le **bloc d'introduction** n'était pas du tout rendu et le **logo** de l'entreprise n'était jamais intégré. Corrigé : le bloc d'introduction (variables `{{...}}` résolues comme en PDF) est désormais inséré en texte brut (une ligne par paragraphe — la mise en forme HTML par ligne n'a pas d'équivalent en cellule Excel), et le logo est intégré en image flottante en haut à droite (en vis-à-vis du titre, comme en PDF) via `workbook.addImage`/`worksheet.addImage` — décodage de la data-URI en base64 + extension (`parseImageDataUri`), limité aux formats gérés par ExcelJS (PNG/JPEG/GIF ; un logo SVG est alors simplement omis de l'export Excel, sans erreur). Le titre et la période passent en alignement gauche (au lieu de centré) pour laisser la place au logo à droite. La logique de résolution du bloc d'introduction (`resolveIntroHtml`) est désormais partagée entre le rendu HTML/PDF et l'export Excel, garantissant un contenu identique dans les deux formats.*

*Mise à jour 28 juillet 2026 (Ordre de virement — marges de page élargies) — les marges gauche/droite de la fiche sont légèrement augmentées pour aérer le tableau à 8 colonnes : PDF (aperçu/impression et export), 0,4 in → **0,6 in**, via un nouveau paramètre `margins` optionnel sur `htmlToPdf()` (`pdf.service.ts`, fusionné avec les marges par défaut — n'affecte aucun autre appelant existant) ; Excel, défaut 0,7 in → **0,9 in** (`pageSetup.margins` d'ExcelJS, marges haut/bas/en-tête/pied inchangées).*

*Mise à jour 28 juillet 2026 (Ordre de virement — tri par montant décroissant) — les bénéficiaires de la fiche « Ordre de virement » (PDF et Excel) sont désormais triés par **montant net à payer décroissant** (`loadBeneficiaries` dans `wire-transfer.ipc.ts`), au lieu d'un tri alphabétique par nom.*

*Mise à jour 28 juillet 2026 (correctif — Politique de relance étendue aux échéances héritées) — la passe de relance automatique (`applyReminderRules`, `reminders.service.ts`) ne scannait les règles **Échéance à venir/en retard** que sur les `SaleInstallment` **rattachées à une convention** : le filtre Prisma `convention: { deletedAt: null, status: { notIn: [...] } }` étant un filtre de relation, il exclut implicitement toute ligne à `conventionId = null` — les **échéances héritées** de l'ancienne application (souscription sans convention, client rattaché directement via `SaleInstallment.clientId`, cf. onglet « Échéances héritées » de *Comptabilité → Échéances*) n'étaient donc **jamais** relancées, quelle que soit la politique configurée. Corrigé par une seconde requête dans la même passe (`where: { conventionId: null, clientId: { not: null }, ... }`, `include: { client: true }`), réutilisant `processCandidate()` sans modification — le client est lu directement (`inst.client`) au lieu de `inst.convention.client`, et `{{conventionRef}}` se replie sur `SaleInstallment.detailsSouscription` (texte de souscription hérité) plutôt que la référence de convention. `Communication.dedupeKey` reste unique sans collision (clé basée sur `installmentId`, identifiant global de la table `SaleInstallment`, hérité ou non). Corrigé au passage le libellé des modèles de message par défaut (« Rappel — Échéance à venir », « Relance — Échéance dépassée », « Mise en demeure ») qui mentionnaient littéralement « votre convention {{conventionRef}} » — remplacé par « ({{conventionRef}}) », neutre pour les deux cas ; les modèles déjà enregistrés en base (non personnalisés dans leur formulation) ont été corrigés ponctuellement en base. Les modèles « Convention — Expiration » restent inchangés (ce déclencheur ne porte que sur `Convention`, jamais sur les échéances héritées).*

*Mise à jour 28 juillet 2026 (Politique de relance — exécution autonome hors application desktop) — jusqu'ici, `scheduleReminders()` (`setInterval` 1h, `src/main/index.ts:207-210`) ne tourne que dans le process principal Electron : si aucun poste n'a l'application ouverte, aucune relance n'est envoyée (contrairement au pointage/visiteurs QR, servis par des apps web PHP autonomes indépendantes de l'app desktop). Nouveau point d'entrée **autonome, sans dépendance Electron** : `src/main/scripts/run-reminders-once.ts` (compilé par `npm run build:main`, comme tout fichier sous `src/main`) exécute une passe unique de `applyReminderRules()` puis quitte — exécutable via `node dist/main/scripts/run-reminders-once.js` (ou `npm run reminders:run`), à planifier (ex. Planificateur de tâches Windows, toutes les heures) sur un poste/serveur allumé en continu. Résolution de `DATABASE_URL` sans Electron : variable d'environnement déjà définie, sinon `%APPDATA%/Afrikimmo-App/config.env` (même fichier que l'app packagée), sinon un `.env` à côté du script ou à la racine du dépôt (dev). Correctif de robustesse associé : `settings.service.ts` → `decryptLegacy()` accédait à `safeStorage.isEncryptionAvailable()` sans garde ; hors runtime Electron, `safeStorage` est `undefined` (`require('electron')` résout vers le chemin binaire, pas l'API) et l'appel plantait tout le script si un secret SMTP/SMS/WhatsApp existait encore au format legacy `enc:` (non migré vers le chiffrement portable `encp:`) — désormais détecté via `typeof safeStorage?.isEncryptionAvailable !== 'function'`, repli neutre (« indéchiffrable sur ce poste ») déjà prévu par le code existant. Aucune autre dépendance Electron dans la chaîne (`db.service`, `email.service`, `sms.service`, `whatsapp.service`, `templating.service` en sont exempts) — validé par une exécution réelle via `node` (hors `electron.exe`) sur la base de production, avec dédoublonnage `Communication.dedupeKey` inchangé (aucun risque de doublon si l'app desktop tourne aussi en parallèle).*

*Mise à jour 28 juillet 2026 (Politique de relance — anti-doublon robuste face à l'exécution concurrente) — `processCandidate()` (`reminders.service.ts`) vérifiait l'absence d'envoi préalable via `db.communication.findUnique({ where: { dedupeKey } })` avant de créer l'enregistrement `Communication`, mais **sans protection contre la fenêtre de course** entre ce contrôle et la création : si deux passes tournent au même instant (typiquement désormais l'app desktop ouverte sur un poste **et** le script planifié NAS `run-reminders-once.js` déclenché à quelques millisecondes d'écart), les deux pouvaient franchir le contrôle avant qu'aucune des deux n'ait encore créé la ligne, l'une des deux provoquant alors une erreur de contrainte unique (`P2002`) sur `Communication.dedupeKey`, non interceptée, qui remontait et interrompait le traitement des candidats restants de la règle pour cette passe (aucun envoi en double n'était possible — la contrainte unique l'en empêchait déjà au niveau base — mais d'autres relances légitimes de la même règle pouvaient être court-circuitées ce tour-ci). Désormais, la création est protégée par un `try/catch` dédié : une violation `P2002` est traitée comme un simple « déjà envoyé » (compteur `already_sent_race`, la boucle continue normalement pour les autres candidats), la contrainte unique en base restant l'autorité finale garantissant qu'un même message de relance n'est jamais transmis deux fois à la même personne, y compris en cas d'exécution strictement simultanée depuis deux sources différentes.*

*Mise à jour 28 juillet 2026 (correctifs — déploiement du script de relances sur NAS Synology DSM) — deux blocages rencontrés lors du premier déploiement réel (`run-reminders-once.js` sur un DS720+) : **(1)** `binaryTargets` du générateur Prisma (`schema.prisma`) ne couvrait pas `debian-openssl-1.1.x` — le paquet Node.js de DSM 7.x s'appuie sur OpenSSL 1.1.x (distinct du `debian-openssl-3.0.x` déjà présent, pensé pour un Debian récent) ; ajouté à la liste et client régénéré (le moteur `libquery_engine-debian-openssl-1.1.x.so.node` est désormais livré dans `node_modules/.prisma/client`, donc inclus dans tout futur transfert vers le NAS). **(2)** `electron-log` (`utils/logger.ts`) plantait dès le premier `logger.error(...)` hors runtime Electron avec *« can't determine the app name »* : sans `electron.app.name` ni `package.json` voisin (non copié sur le NAS, cf. liste de déploiement), il ne peut pas déduire le nom de l'app ni l'emplacement de son fichier de log — corrigé en fixant explicitement `log.transports.file.setAppName('Afrikimmo-App')` en tête de fichier (sans effet sur le runtime Electron normal, où ce nom correspond déjà à l'auto-détection).*

*Mise à jour 29 juillet 2026 (Envoyer un message — ciblage « Prospect ») — sur l'interface **« Envoyer un message »**, le volet **« Cibler une entité (optionnel) »** gagne un onglet **« Prospect »**, positionné juste après « Client », avec **exactement les mêmes règles** que ce dernier : visible par tous les rôles, liste (recherche + préchargement) via `prospects:list`, et — pour les rôles non privilégiés (hors `SUPER_ADMIN/ADMIN/MANAGER/ACCOUNTANT`) — restriction aux prospects dont l'utilisateur est le référent (`Prospect.assignedToId`). Nouveau rattachement optionnel `Communication.prospectId` (migration `20260729100000_communication_prospect_target`, sur le même modèle que `referrerId`) pour stamper la cible sur l'historique. Résolution ajoutée dans `communication:resolveTarget` (`communication.ipc.ts`, branche `PROSPECT` juste après `CLIENT`) : email/mobile/téléphone du prospect, variables `{{firstName}}`/`{{fullName}}`/etc. (toujours traité comme un particulier, `Prospect` n'ayant pas de champ `type`/`entreprise`). Réutilise le hook `useProspects` existant (même forme que `useClients`) et le composant `SearchSelect` déjà en place pour Client/Propriétaire/Convention/Apporteur.*

*Mise à jour 29 juillet 2026 (Envoyer un message — pièce jointe PDF de la convention ciblée) — sur « Envoyer un message », quand la cible est une **Convention** et l'envoi se fait par **Email**, le document PDF de la convention (même modèle par défaut et mêmes variables que « Conventions → Document ») est désormais **joint automatiquement**. Pour **WhatsApp**, l'envoi de document nécessiterait une URL publique accessible depuis Internet (Twilio/Infobip) — infrastructure absente aujourd'hui (le serveur web du pointage/visiteurs QR est en réseau local uniquement) : un message d'information non bloquant s'affiche à la place, le SMS/WhatsApp partant normalement sans pièce jointe.
Réalisé sans dupliquer la logique de fusion de modèle (risque élevé vu la complexité du document convention) : la génération reste **côté renderer**, réutilisant telle quelle `mergeTemplate`/`documentZones.ts` — factorisés dans un nouvel utilitaire partagé `conventionDocument.ts` (`filterDefaultConventionTemplates`, `buildConventionDocumentHtml`, `conventionExportFileName`), dont `ConventionDocumentPage.tsx` a aussi été refactorisée pour bénéficier de la même factorisation (comportement inchangé). Le PDF ainsi obtenu est envoyé en base64 à un nouveau canal IPC **`documents:renderDocumentPdf`** (variante sans boîte de dialogue ni fenêtre d'aperçu de `documents:exportDocumentPdf`/`printDocument`, renvoie directement les octets), puis transmis dans le payload d'envoi (`conventionAttachment: { name, base64 }`, `sendEmailSchema`) — `communication:sendEmail` le décode et l'ajoute aux pièces jointes Nodemailer, désormais aussi capables de recevoir un `Buffer` en mémoire (`content`) en plus d'un chemin disque (`path`), via `email.service.ts`.*

*Mise à jour 30 juillet 2026 (nouveau module — Moteur de devis de construction, Module 17) — nouveau module `/construction` : génère un **devis quantitatif et estimatif de construction** à partir d'une vingtaine de caractéristiques d'un projet (type de bâtiment, standing, surfaces, pièces, chambres, SDE/SDB/WC, toiture, menuiserie, revêtement, climatisation, terrain, localisation, clôture, piscine, aménagements, assainissement), par correspondance avec une **bibliothèque d'ouvrages** (recettes de ressources, `ConstructionWorkItem`/`ConstructionWorkItemComponent`) regroupés en **22 lots**, via un **moteur de coefficients** (`ConstructionRatioDefinition`/`ConstructionRatioProfile`/`ConstructionRatioValue`) paramétrable par (type de bâtiment × standing) — le standing fait varier de vraies quantités/qualités, pas un multiplicateur arbitraire sur le prix. Méthode de prix BTP : **déboursé sec → frais de chantier → frais généraux → marge = prix de vente HT** (cascade par défaut), à partir d'un **bordereau de prix centralisé** (`ConstructionResource`, prix lu à chaud à chaque génération — une variation de prix se répercute automatiquement sur tous les ouvrages concernés, sans jamais altérer une estimation déjà générée). **Niveau 1** (estimation rapide, non persistée, live pendant la saisie) et **Niveau 2** (devis détaillé persisté, `ConstructionEstimate`/`ConstructionEstimateLine`/`ConstructionEstimateResourceLine`, versionné) partagent le même moteur de calcul (`construction-engine.service.ts` + registre de formules `construction-formulas.ts`). Le Niveau 2 peut créer directement un **devis du module Devis existant** (`Quote`/`QuoteItem`, un lot = une catégorie, régime déjà géré par `groupItemsByCategory` — aucune duplication de cette logique, export PDF/DOCX inchangé). Quantitatif des matériaux, besoin en main d'œuvre et marge prévisionnelle dérivés de la même estimation. **Reportés à une phase ultérieure** : planning prévisionnel, courbe de décaissement, Niveau 3 (reprise manuelle des métrés réels — champs réservés en base, non câblés à l'UI). Accès : création de projet/génération SUPER_ADMIN/ADMIN/MANAGER/AGENT (mêmes rôles que le module Devis) ; bibliothèque technique (Paramètres → « Moteur de devis construction » : lots, bordereau de prix, ouvrages, catalogue et profils de coefficients) SUPER_ADMIN/ADMIN uniquement. Seed indicatif Côte d'Ivoire (`scripts/seed-construction.mjs`) : 22 lots, 8 localités, ~55 ressources, ~40 ouvrages sur 8 lots de fond (les 14 autres lots restent vides, enrichissables sans code, signalés par l'indicateur de couverture de chaque estimation), ~56 coefficients, 2 profils (Villa basse × Moyen/Haut standing) — **valeurs de référence indicatives, à vérifier avant exploitation commerciale**. Migrations `20260729110000_construction_library`, `20260729120000_construction_estimates`.*

*Mise à jour 30 juillet 2026 (Moteur de devis de construction — bibliothèque étendue aux 22 lots) — les 12 lots jusque-là vides (charpente/couverture, menuiserie aluminium/bois, climatisation & ventilation, faux plafond, appareils sanitaires, cuisine, assainissement, VRD, clôture & portail, aménagements extérieurs, piscine) reçoivent leur bibliothèque d'ouvrages : **31 nouveaux ouvrages conditionnels** (`applicabilityRule` sur `roofType`/`joineryType`/`acType`/`hasFalseCeiling`/`kitchenType`/`sanitationType`/`fenceLength`/`gateCount`/`exteriorPavedSurface`/`hasLandscaping`/`hasPool`), **34 nouvelles ressources** (~89 au total — charpente bois/métallique/tuile, menuiserie alu standard/teinté et bois, splits/gaines de climatisation, dalles de faux plafond, appareils sanitaires complets, équipements de cuisine par gamme, systèmes d'assainissement par filière, pavés VRD, portail métallique, aménagements paysagers, structure et filtration de piscine — familles de ressources étendues de 12 à 22), **19 nouvelles formules** dans le registre `construction-formulas.ts` (dont plusieurs formules « passthrough » directes sur un champ du projet — ex. `QTE_CLOTURE_ML` = longueur de clôture saisie) et **8 nouveaux coefficients** au catalogue (`COEF_DEBORD_TOITURE`, `PART_FAUX_PLAFOND`, `PART_BAIGNOIRE`, `PART_DOUCHE_DANS_SDB`, `LAVABO_SUPP_INVITES`, `COEF_VRD_PART`, `COEF_ESPACES_VERTS_PART`, `ML_GAINE_VENTIL_PAR_M2`), portant le catalogue à ~64 coefficients répartis sur les 2 profils déjà seedés. **Aucune migration** — extension entièrement portée par le seed et le registre de formules (cf. principe P3 du module). Sur le projet de démonstration (villa basse haut standing sans piscine/faux plafond/aménagements), la couverture passe de 45 % à 86 % (les 3 lots restants ne s'appliquant légitimement pas à ce projet) ; un projet avec toutes les options activées atteint 100 % de couverture sur les 22 lots, avec un prix moyen au m² (~469 000 FCFA) cohérent avec l'ordre de grandeur attendu pour du haut standing en Côte d'Ivoire. Validé par un smoke test direct du moteur (`computeEstimate`) sur ces deux scénarios avant livraison — aucun avertissement de ressource/coefficient manquant.*

*Mise à jour 30 juillet 2026 (Moteur de devis de construction — les 45 profils de coefficients) — au-delà des 2 profils initiaux (Villa basse × Moyen/Haut standing), **les 45 combinaisons possibles sont désormais seedées** (9 `ConstructionBuildingType` × 5 `ConstructionStanding`, 2 880 `ConstructionRatioValue`). Le catalogue de coefficients passe d'une paire de valeurs (moyen/haut) à **5 paliers** (Économique/Standard/Moyen standing/Haut standing/Luxe) pour chacun des 64 coefficients, avec une progression cohérente vérifiée croissante (ex. `VILLA_BASSE` : 39,4 M FCFA en Économique → 60,5 M FCFA en Luxe, à surface égale). Pour les 5 typologies résidentielles, un même jeu de coefficients par standing est partagé entre villa basse/duplex/triplex, maison économique et immeuble — la distinction entre ces types passe par les caractéristiques du projet (niveaux, pièces), pas par des coefficients dédiés, ce qui est cohérent avec la conception des formules existantes (aucune formule n'a de branche par `buildingType`). Pour les 4 typologies non résidentielles (Bureau, Commerce, Entrepôt/hangar, Autre), les coefficients résidentiels sont repris à titre indicatif, faute de formules dédiées à ces typologies dans le registre actuel — chacun des 20 profils correspondants porte une `description` avertissant explicitement de cette limite. Validé par un smoke test sur des profils non testés jusque-là (Villa triplex × Luxe sur 3 niveaux, Maison économique × Économique, Bureau × Standard) et par une vérification de monotonie du prix total entre paliers de standing.*

*Mise à jour 30 juillet 2026 (Moteur de devis de construction — 5 documents PDF par estimation, main d'œuvre enfin visible) — jusqu'ici, la main d'œuvre de chaque ouvrage était fondue dans son prix unitaire (déboursé sec = matériaux + main d'œuvre + transport) et n'apparaissait donc **jamais** comme une ligne séparée sur un document exporté — signalé par l'utilisateur (« le fichier de devis construction produit ne prend apparemment pas en compte la main d'œuvre »). L'écran « Devis détaillé » d'une estimation (`ConstructionEstimatePage.tsx`) propose désormais **5 exports PDF distincts** (`src/renderer/modules/construction/utils/estimateDocument.ts`, canaux génériques `documents:exportDocumentPdf` déjà partagés — aucun nouvel IPC) : **Gros œuvre**, **Second œuvre**, **Finitions** (les 22 lots regroupés en 3 corps de métier classiques du BTP à partir de `ConstructionEstimateLine.lotPhase`, sans nouvelle donnée en base), **Main d'œuvre** (isolée et chiffrée séparément par corps de métier — maçon, ferrailleur, électricien, plombier…, à partir de `ConstructionEstimateResourceLine` filtré `MAIN_OEUVRE`, même source que l'onglet « Besoin main d'œuvre ») et **DQE Complet** (cumul des 22 lots + cascade de prix complète). Validé par un test direct des générateurs HTML sur l'estimation de démonstration : 39 lignes correctement réparties (19 gros œuvre + 11 second œuvre + 9 finitions), 8 corps de métier présents sur le document main d'œuvre, total du document main d'œuvre cohérent avec `totalDeboursMainOeuvre` de l'estimation (écart < 1 FCFA, arrondi).*

*Mise à jour 30 juillet 2026 (Moteur de devis de construction — correctifs Devis commercial/estimation, onglet Localités) — plusieurs correctifs et compléments ciblés sur le module :* ***(1)*** *libellé client des sélecteurs Client/Prospect (« Créer le devis commercial », « Générer une estimation », fiche/liste de projet, documents PDF) corrigé pour utiliser `formatPersonName` (n'affiche la raison sociale que si `type === 'ENTREPRISE'`) au lieu d'un raccourci local préférant à tort le champ « Entreprise » même pour un client `INDIVIDUEL` qui l'aurait renseigné — un client comme celui rattaché à `CLI-2022-0001` (type INDIVIDUEL, champ Entreprise néanmoins rempli) apparaissait sous ce nom d'entreprise plutôt que son nom, invisible à la recherche par nom de famille.* ***(2)*** *Nouvelle option **« Détailler la main d'œuvre par lot »** sur « Créer le devis commercial » / « Créer aussi le devis commercial » (payload `splitLaborByLot`, décochée par défaut) : retire de chaque ligne d'ouvrage sa part main d'œuvre (au même ratio de marquage que le reste de la ligne) et ajoute une ligne récapitulative « Main d'œuvre — <Lot> » en fin de chaque lot — total du devis et sous-totaux de lot strictement inchangés (vérifié sur une estimation réelle, écart nul).* ***(3)*** *Suppression d'un devis (`quotes:delete`) : nettoie désormais toute `ConstructionEstimate` pointant vers ce devis (`quoteId`/`quoteReference`/`convertedAt` remis à `null`, statut remis à `BROUILLON`) et fait redescendre le projet de « Devis émis » à « Estimé » si plus aucune de ses estimations n'est convertie — `ConstructionEstimate.quoteId` étant un scalaire sans FK Prisma (P5), sa suppression ne se répercutait pas automatiquement, laissant l'écran d'estimation proposer « Voir le devis » vers un devis supprimé au lieu de « Créer le devis ».* ***(4)*** *`<tfoot>` remplacé par une ligne finale de `<tbody>` sur les tableaux des 5 documents PDF (`buildLotItemsTable`, `buildLaborTable`) — un `<tfoot>` est répété par le moteur d'impression Chromium sur chaque page d'un tableau qui se scinde, faisant apparaître « TOTAL HT » en bas de chaque page au lieu d'une seule fois en fin de document.* ***(5)*** *Nouvel onglet **« Localités »** dans *Paramètres → « Moteur de devis construction »* (`ConstructionLocalitiesSettingsTab.tsx`, CRUD ville/région/coefficient de prix, SUPER_ADMIN/ADMIN) — les 8 localités seedées (Abidjan = coefficient 1,000 de référence, jusqu'à Man = 1,15) n'étaient jusque-là consultables/modifiables que par le script de seed, sans écran dédié (oubli du module, contrairement aux 5 autres volets de la bibliothèque technique). Le placeholder du champ « Localité » de « Nouveau projet de construction » est par ailleurs renommé de « Abidjan (référence) » à **« Par défaut »**.*

*Mise à jour 30 juillet 2026 (Moteur de devis de construction — suppression de projets et estimations) — la suppression d'un **projet** (`construction:projects:delete`) et d'une **estimation** (`construction:estimates:delete`) est désormais réservée à **SUPER_ADMIN, ADMIN, MANAGER** (nouvelle constante `DELETE_ROLES` dans `construction-projects.ipc.ts`, distincte de `WRITE_ROLES` qui inclut AGENT pour la création/modification/génération — AGENT en est donc exclu). Les deux handlers existaient déjà côté IPC mais **n'étaient reliés à aucun bouton** dans l'interface (fonctionnalité invisible) : ajout d'un bouton **« Supprimer »** (avec confirmation) sur la liste des projets (`ConstructionProjectsListPage.tsx`), sur la fiche projet — pour le projet lui-même et pour chaque estimation listée dans « Estimations générées » (`ConstructionProjectDetailPage.tsx`) — et sur la fiche détail d'une estimation (`ConstructionEstimatePage.tsx`), visibles uniquement pour SUPER_ADMIN/ADMIN/MANAGER (même liste côté renderer, `DELETE_ROLES` dupliquée localement dans chaque page, faute de module de constantes partagées entre main et renderer). Soft delete (`deletedAt`), sans changement du comportement de suppression lui-même.*

*Mise à jour 30 juillet 2026 (Moteur de devis de construction — écriture restreinte, lecture par référent commercial) — refonte du périmètre d'accès du module : la **création de projet, la génération d'estimation et la conversion en devis commercial** sont désormais réservées à **SUPER_ADMIN, ADMIN, MANAGER, ACCOUNTANT** (`WRITE_ROLES` ramené à `FULL_ACCESS` dans `construction-projects.ipc.ts` — **AGENT perd son droit de création**, qu'il avait jusque-là comme le module Devis). Les autres rôles disposant d'un accès au module (**AGENT, AGENT_TECHNIQUE, ASSISTANTE_DIRECTION, READONLY**, alignés sur la liste déjà exposée par `Sidebar.tsx`) passent en **lecture seule**, avec un périmètre **par référent commercial** plutôt que par créateur : un projet n'est visible que si le **client** ou le **prospect** qui lui est rattaché a cet utilisateur pour référent (`Client.assignedToId` / `Prospect.assignedToId`) — un projet sans client ni prospect rattaché devient invisible à ces rôles (aucun référent possible). `scopeWhere` (liste, filtre relationnel direct côté Prisma, `OR: [{client:{is:{assignedToId}}}, {prospect:{is:{assignedToId}}}]`) et `canAccess` (fiche/action précise, devenue **asynchrone** : résout `Client`/`Prospect.assignedToId` par une requête dédiée à partir des `clientId`/`prospectId` scalaires déjà présents sur l'objet chargé) remplacent l'ancien scoping par `createdById`, repris dans les ~13 points de contrôle du fichier (projets et estimations). Côté UI, les boutons **« Nouveau projet »**, **« Modifier »**, **« Générer une estimation »** et **« Créer le devis »** sont masqués pour les rôles non `WRITE_ROLES` (`ConstructionProjectsListPage.tsx`, `ConstructionProjectDetailPage.tsx`, `ConstructionEstimatePage.tsx`), et la garde d'écriture du routeur (`construction/projects/new`, `/edit`) resserrée sur la même liste (AGENT et AGENT_TECHNIQUE, qui y avaient accès en façade sans jamais pouvoir réellement écrire côté IPC, en sont retirés). Validé par un test direct de `canAccess` sur 5 scénarios (référent en correspondance, référent différent, projet sans client/prospect, rôles à vue complète) — comportement conforme dans les 5 cas.*

*Mise à jour 30 juillet 2026 (Moteur de devis de construction — écriture de la bibliothèque technique verrouillée côté composant) — les 3 onglets « Lots de travaux », « Bordereau des prix » et « Localités » de *Paramètres → « Moteur de devis construction »* masquent désormais leurs boutons Nouveau/Modifier/Supprimer (et « Mettre à jour le prix ») pour tout rôle autre que **SUPER_ADMIN/ADMIN** (`LIB_ADMIN_ROLES`, dupliquée localement dans chaque composant). Couche défensive supplémentaire : l'écriture était déjà bloquée côté IPC (`checkLibWrite`, liste exacte SUPER_ADMIN/ADMIN sans équivalence) et l'onglet déjà masqué de la navigation `SettingsPage.tsx` pour tout rôle non-admin (aucun `roles` déclaré = admin uniquement par défaut) — cette mise à jour ferme l'écart pour le cas où l'écran serait néanmoins atteint (ex. build du process main non redémarré après un changement de permissions).*

*Mise à jour 30 juillet 2026 (Moteur de devis de construction — catalogue des formules de calcul) — nouvel onglet **« Formules de calcul »** dans *Paramètres → « Moteur de devis construction »* (`ConstructionFormulasSettingsTab.tsx`, lecture seule, recherche par code/libellé/description) : référence des **57 formules** du registre `construction-formulas.ts` (process principal), regroupées par catégorie (Terrassements, Fondations, Béton armé, Maçonnerie & enduits, Électricité, Plomberie sanitaire, Revêtements, Peinture, Charpente/couverture, Menuiserie, Climatisation, Faux plafond, Appareils sanitaires, VRD, Clôture, Aménagements extérieurs, Piscine, Forfait), chacune avec un libellé et une description en français de ce qu'elle calcule — jusque-là uniquement lisibles par un développeur dans le code source ou via le `formulaTrace` d'une ligne d'estimation (info-bulle au survol, peu visible). Portée par un nouveau fichier renderer `src/renderer/modules/construction/utils/constructionFormulasCatalog.ts` (`FORMULA_CATALOG`, purement documentaire, à tenir à jour manuellement en miroir du registre — vérifié exhaustif par comparaison automatisée des 57 codes des deux fichiers). **Correctif au passage** : le sélecteur de formule du formulaire « Nouvel/Modifier ouvrage » (Bibliothèque d'ouvrages) s'appuyait sur une liste `FORMULA_CODES` locale **figée à 39 entrées**, jamais mise à jour lors de l'extension de la bibliothèque aux 22 lots (mise à jour du 30 juillet 2026 précédente, qui a porté le registre à 57 formules) — les 18 formules des lots nouvellement complétés (toiture, menuiserie, climatisation, faux plafond, appareils sanitaires, VRD, clôture, aménagements extérieurs, piscine) étaient donc **impossibles à sélectionner** depuis cet écran. Remplacé par `FORMULA_CATALOG` (liste complète, libellé lisible au lieu du code brut) ; la colonne « Formule » de la liste des ouvrages affiche désormais aussi le libellé (code en info-bulle) plutôt que le code brut.*

*Mise à jour 30 juillet 2026 (Communication — retrait de l'accès MANAGER/ACCOUNTANT/ASSISTANTE_DIRECTION à « Modèles email / SMS ») — l'onglet *Paramètres → « Modèles email / SMS »* n'est plus visible pour **MANAGER, ACCOUNTANT (Comptable) et ASSISTANTE_DIRECTION**. Cause : `TEMPLATE_ADMIN_ROLES` (`communication.ipc.ts`) listait `['SUPER_ADMIN', 'ADMIN', 'MANAGER']` et était consommée via `hasRole()`, qui s'appuie sur `checkRole()` **avec ses équivalences de rôle** (ACCOUNTANT et ASSISTANTE_DIRECTION héritent des permissions de MANAGER) — la présence de MANAGER dans la liste suffisait donc à rendre `communication:myTemplatePermissions` → `isPrivileged` vrai pour les 3 rôles, ce qui pilotait directement la visibilité de l'onglet côté `SettingsPage.tsx` (`canManageManualTemplates`). Ramenée à `['SUPER_ADMIN', 'ADMIN']` (rôle **exact**, aucune équivalence ne pouvant plus s'appliquer faute de MANAGER dans la liste) — même règle que `communication:deleteTemplate`, déjà restreinte à SUPER_ADMIN/ADMIN. Un utilisateur individuellement désigné éditeur de modèles « manuel » (*Modèles de messages → « Gérer les accès »*) garde son accès, limité aux modèles « manuel » (mécanisme inchangé, indépendant du rôle). Sans effet sur `TEMPLATE_FULL_ACCESS_ROLES` (ACCOUNTANT/MANAGER voient toujours les modèles « auto » dans le sélecteur d'« Envoyer un message », fonctionnalité distincte de l'écran d'administration).*

*Mise à jour 30 juillet 2026 (RH — ACCOUNTANT limité aux « Objectifs assignés » sur « Modèles de contrats de travail ») — sur *Paramètres → Modèles de contrats de travail*, **ACCOUNTANT (Comptable)** n'a désormais accès qu'au volet **« Objectifs assignés »**, comme MANAGER — les volets **Modèles / Fonctions / Fiches de poste** (configuration) restent réservés à SUPER_ADMIN/ADMIN/RH. Alors qu'ACCOUNTANT dispose par ailleurs du **plein accès RH & Paie** au même titre que RH (`HR_ADMIN_ROLES`, documenté dans `hr.ipc.ts`), il n'était jusqu'ici **jamais exclu** de la configuration des contrats spécifiquement (contrairement au Pointage ou à Retards & Départs précipités, déjà des exceptions documentées) : `hr:contractTemplates:create/update/delete`, `hr:contractFunctions:create/update/delete` et `hr:jobDescriptionTemplates:create/update/delete` utilisaient `HR_WRITE_ROLES` (qui inclut ACCOUNTANT), et `canManageContractConfig` côté renderer (`ContractTemplatesSettingsTab.tsx`) listait explicitly ACCOUNTANT. Nouvelle constante dédiée **`CONTRACT_TEMPLATE_CONFIG_ROLES = ['SUPER_ADMIN', 'ADMIN', 'RH']`** (`hr.ipc.ts`), substituée à `HR_WRITE_ROLES` sur ces 9 handlers uniquement — le reste du module RH (personnel, contrats, bulletins, congés, taux de paie…) n'est pas affecté. Les lectures (`list`) de ces 3 référentiels restent ouvertes à tout utilisateur authentifié (mises en page uniquement, réutilisées par le self-service). Le volet « Objectifs assignés » reste accessible en écriture à ACCOUNTANT via `OBJECTIVE_WRITE_ROLES` (`[...HR_WRITE_ROLES, 'MANAGER']`, inchangée), qui inclut déjà ACCOUNTANT par le biais de `HR_WRITE_ROLES`.*

*Mise à jour 30 juillet 2026 (Sidebar — « Paramètres » masqué aux rôles sans aucun accès) — l'entrée **« Paramètres »** du menu latéral était jusqu'ici affichée à **tout utilisateur authentifié**, indépendamment de son rôle (choix délibéré d'origine : « le filtrage réel par onglet reste dans SettingsPage »), ce qui menait un rôle sans aucun onglet accessible vers une page Paramètres vide. Elle n'apparaît désormais que si l'utilisateur a effectivement accès à **au moins un onglet** — rôle admin (SUPER_ADMIN/ADMIN), ou rôle explicitement autorisé sur un onglet (`SettingsPage.TABS[].roles` — seuls RH, MANAGER, ACCOUNTANT apparaissent dans au moins une de ces listes, via Modèles de contrats de travail / Informations particulières / Délais d'essai / Catalogue), ou désignation individuelle comme éditeur de modèles de messages manuels (`communication:myTemplatePermissions`, indépendante du rôle). Résultat : **ASSISTANTE_DIRECTION, AGENT, AGENT_TECHNIQUE et READONLY** — qui ne figurent dans aucune liste `roles` d'onglet — ne voient plus « Paramètres », sauf désignation individuelle. `SettingsPage.tsx` exporte désormais `TABS` et `ADMIN_ROLES` (précédemment locaux) pour que `Sidebar.tsx` réutilise exactement la même logique de visibilité sans la dupliquer (pas de cycle d'imports : `PageLayout.tsx`, utilisé par `SettingsPage.tsx`, n'importe pas `Sidebar.tsx` — seul `ProtectedLayout.tsx`, en dehors de toute page, l'importe).*

*Mise à jour 30 juillet 2026 (Moteur de devis de construction — MANAGER et ACCOUNTANT au même titre que les admins sur Lots/Bordereau/Localités) — les 3 onglets **« Lots de travaux »**, **« Bordereau des prix »** et **« Localités »** de *Paramètres → « Moteur de devis construction »* sont désormais accessibles en écriture (consultation + création/modification/suppression) à **MANAGER et ACCOUNTANT (Comptable)**, au même titre que SUPER_ADMIN/ADMIN — revient sur une restriction posée plus tôt dans la même journée (`checkLibWrite`, alors SUPER_ADMIN/ADMIN uniquement sur ces 3 interfaces). Nouvelle constante **`LIB_EXTENDED_WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT']`** et fonction `checkLibExtendedWrite` (`construction-library.ipc.ts`), substituées à `checkLibWrite`/`LIB_ADMIN_ROLES` sur les 8 handlers concernés (`construction:lots:upsert/delete`, `construction:localities:upsert/delete`, `construction:resources:create/update/updatePrice/delete`) — **`construction:resourceFamilies:*`** (non utilisé par l'écran Bordereau des prix, qui saisit la famille en texte libre) et les **4 autres onglets** (Bibliothèque d'ouvrages, Catalogue des coefficients, Profils de coefficients, Formules de calcul) restent réservés SUPER_ADMIN/ADMIN uniquement (`checkLibWrite` inchangée). Les 3 entrées `TABS` correspondantes de `SettingsPage.tsx` gagnent `roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT']` (rendant les onglets visibles à ces rôles) et `LIB_ADMIN_ROLES` (constante locale de chacun des 3 composants `ConstructionLotsSettingsTab.tsx`/`ConstructionResourcesSettingsTab.tsx`/`ConstructionLocalitiesSettingsTab.tsx`, gouvernant l'affichage des boutons Nouveau/Modifier/Supprimer) est alignée sur la même liste élargie.*

*Mise à jour 31 juillet 2026 (Moteur de devis de construction — devis à portée restreinte : clôture seule / piscine seule) — nouveau champ **`ConstructionProject.scope`** (`COMPLET` par défaut, `CLOTURE_SEULE`, `PISCINE_SEULE` — migration `20260731090000_construction_project_scope`) permettant de générer un devis ne portant que sur un ouvrage ancillaire, sans saisir les caractéristiques du bâtiment. Rendu possible par un constat sur les formules : `QTE_CLOTURE_ML`/`QTE_PORTAILS` (LOT19) et `QTE_PISCINE_STRUCTURE` (LOT21) sont des correspondances **directes** sur `fenceLength`/`gateCount`/`poolSurface`, sans dépendance aux coefficients de standing ni aux caractéristiques du bâtiment — un devis restreint produit donc exactement les mêmes quantités/prix que la ligne correspondante d'un devis complet. **Moteur** (`construction-engine.service.ts`) : nouvelle option `ComputeOptions.lotCodeFilter` (liste de codes de lot) — filtre la liste des ouvrages **avant** le calcul, de sorte que tous les totaux (déboursé, cascade, TVA, `coveragePct`) découlent naturellement du sous-ensemble filtré, sans toucher à la logique de calcul elle-même ; `coveragePct` se mesure désormais relativement aux **lots concernés par la portée**, pas aux 22 lots (sinon un devis clôture afficherait à tort ~14 % de couverture). **IPC** (`construction-projects.ipc.ts`) : `SCOPE_LOT_CODES` fait correspondre chaque portée aux lots à inclure — `CLOTURE_SEULE` → `[LOT01, LOT19, LOT22]`, `PISCINE_SEULE` → `[LOT01, LOT21, LOT22]` (LOT01 « Installation de chantier » et LOT22 « Nettoyage & réception » restent inclus même en portée restreinte, pratique BTP courante — leur forfait en % du sous-total s'applique alors au seul sous-total du lot filtré) ; appliqué à `construction:quickEstimate` et `construction:generateEstimate`. **Formulaire** (`ConstructionProjectFormPage.tsx`) : nouveau champ **« Type de devis »** en tête de formulaire ; en portée restreinte, les blocs Bâtiment/Second œuvre/Terrain-assainissement sont masqués (seule la Localité, qui influe sur le prix via son coefficient, reste affichée), et le bloc Extérieurs ne montre que le champ pertinent (Clôture+Portails, ou Surface piscine, rendu obligatoire). `effectiveValues` complète silencieusement `surfaceHabitable` (toujours obligatoire côté schéma Zod, sans effet sur le calcul pour ces formules) et force `hasPool=true` pour `PISCINE_SEULE` (nécessaire à `applicabilityRule`, vérifié par test direct du moteur compilé : sans ce forçage, 0 ligne générée). Le panneau « Estimation rapide » masque le `≈ X / m²` (dénué de sens sur une surface factice) via une nouvelle prop `hidePrixM2`. Liste et fiche projet affichent le type de devis à la place des caractéristiques de bâtiment non pertinentes. Validé par un test direct du moteur compilé sur les 3 scénarios (clôture seule, piscine seule, piscine seule sans `hasPool`) — comportement conforme dans les 3 cas.*

*Mise à jour 31 juillet 2026 (nouveau module — Moteur de devis de permis de construire, Module 18) — nouveau module `/permits` : chiffre les **prestations intellectuelles, administratives et réglementaires** liées à l'obtention d'un permis de construire (honoraires Architecte par phase de mission, BET, Géomètre, Études, frais administratifs, taxes), à partir d'une quinzaine de caractéristiques de projet (nature, standing, commune, superficies terrain/bâtie, niveaux, coût prévisionnel des travaux, sous-sol, piscine, ascenseur, groupe électrogène, forage, clôture, voirie intérieure, niveau de prestation/mission). **Catalogue unifié** (`PermitFeeItem`, un seul modèle discriminé par `category` — décision retenue au lieu de deux tables séparées « frais administratifs » et « taxes », mêmes mécanismes de calcul/surcharge pour les deux) avec 5 modes de calcul (`% du coût des travaux`, `forfait`, `FCFA/m² terrain`, `FCFA/m² bâti`, `barème par tranche de surface`). **Automatisation intelligente** des règles métier (ex. « R+4 et plus → étude structure approfondie, étude incendie, contrôle technique » ; « terrain > 5 000 m² → levé topographique complet, étude hydraulique » ; « piscine → plans spécifiques, étude hydraulique » ; « forage → étude hydrogéologique » ; « immeuble collectif → VRD, assainissement, circulation ») implémentée en **réutilisant le moteur de règle d'applicabilité déclaratif du Module 17**, extrait dans un module partagé générique `src/main/services/applicability-rule.ts` (`ConstructionWorkItem` et `PermitFeeItem` partagent désormais le même évaluateur `isApplicable`/`ApplicabilityRule`) — pas de second système de règles métier dédié. **Surcharges de taux** (`PermitFeeRateOverride`) par nature × standing × commune (la combinaison la plus spécifique l'emporte). **TVA appliquée uniquement aux prestations intellectuelles** (Architecte/BET/Géomètre/Études), jamais aux frais administratifs/taxes (débours non assujettis). Rattachement optionnel à un `ConstructionProject` existant (Module 17) pour déduire par défaut le coût prévisionnel des travaux depuis sa dernière estimation. Conversion en devis commercial (`Quote`) comme le Module 17, sans duplication de logique. **Prestations complémentaires** (impression, reliure, copies, déplacements…) volontairement **hors catalogue dédié** — couvertes par le Catalogue prestations/produits générique existant au moment de la conversion en devis. Rôles : mêmes conventions que le Module 17 (écriture SUPER_ADMIN/ADMIN/MANAGER/ACCOUNTANT, bibliothèque technique SUPER_ADMIN/ADMIN uniquement, lecture scopée par référent commercial pour les autres rôles). Seed indicatif Côte d'Ivoire (`scripts/seed-permit.mjs`) : 22 communes/districts, 31 prestations du catalogue, 2 barèmes par tranche de surface (permis de construire, levé topographique), 5 exemples de surcharge de taux par commune — **valeurs de référence indicatives, à vérifier avant exploitation commerciale**. Migration `20260731100000_permit_module`.*

*Mise à jour 3 août 2026 (ASSISTANTE_DIRECTION — accès restauré à « RH & Paie » — personnel & contrats, PAS les bulletins) — ce rôle était explicitement exclu de l'écran « RH & Paie » (personnel/contrats) à trois niveaux distincts : le menu latéral (`Sidebar.tsx`), le `RoleGuard` du routeur (`router.tsx`, commentaire « ASSISTANTE_DIRECTION EXCLUE ») et, plus profondément, deux constantes de rôle dédiées dans `hr.ipc.ts` (`HR_STAFF_READ_ROLES`/`HR_STAFF_WRITE_ROLES`, distinctes de `HR_READ_ROLES`/`HR_OPERATIONAL_ROLES` qui, elles, l'incluaient déjà) gatant les handlers `hr:employees:getById`/`create`/`update`, `hr:employees:linkableUsers`/`careerProfiles`/`stats`, `hr:contracts:create`/`update`/`getRenderData`, `hr:commissionActivities:list`, `hr:payroll:preview`. Cette exclusion contredisait la documentation ci-dessus (accès opérationnel restreint déjà décrit) et le fait que les pages elles-mêmes (`EmployeesListPage.tsx`/`EmployeeDetailPage.tsx`, `WRITE_ROLES`) et le mécanisme de périmètre par employé (`assertEmployeeAccessible`/`hrScopeWhere`, limité aux employés dont le contrat en cours n'est pas un CDI) étaient déjà construits pour ce rôle. Corrigé aux trois niveaux pour le **personnel et les contrats uniquement** (`Sidebar.tsx`/`router.tsx` : accès à `/hr/employees*` et aux impressions de contrat/fiche de poste ; `hr.ipc.ts` : nouvelles constantes `HR_STAFF_READ_ROLES_SCOPED`/`HR_STAFF_WRITE_ROLES_SCOPED` = constantes d'origine + ASSISTANTE_DIRECTION, appliquées aux handlers listés ci-dessus). Les **contrats signés** (`hr:signedContracts:*`) étaient déjà accessibles à ce rôle sans changement (gérés par `HR_READ_ROLES`/`HR_OPERATIONAL_ROLES`, pas par les constantes `HR_STAFF_*`). **« Bulletins de paie » reste explicitement hors périmètre** pour ASSISTANTE_DIRECTION — `/hr/payslips*` (liste, détail) est resté dans un `RoleGuard`/une entrée de menu séparés sans ce rôle, et les handlers `hr:payslips:list`/`getById`/`generate`/`duplicate`/`update`/`print` sont restés sur les constantes d'origine (sans ASSISTANTE_DIRECTION). Restent également hors périmètre pour ce rôle (constantes d'origine) : les suppressions (`employees:delete`, `contracts:delete`), les opérations financières des bulletins (`payslips:updateStatus`, `updatePayment`, `payAccounts`), et la configuration/les référentiels (`hr/payroll-settings`, `hr/templates`, modèles de contrats/fiches de poste, `jobPositions`/`departments`), réservés à SUPER_ADMIN/ADMIN/RH/ACCOUNTANT(/MANAGER selon l'écran), sans changement. **Correctif complémentaire (bouton « Téléverser » des contrats signés)** : `EmployeesListPage.tsx` et `EmployeeDetailPage.tsx` portaient chacun une constante locale `WRITE_ROLES` (gouvernant, entre autres, l'affichage du bouton « Téléverser » du bloc « Contrats signés ») dont le commentaire adjacent affirmait à tort inclure ASSISTANTE_DIRECTION — le `Set` réel ne le listait pas. Corrigé dans les deux fichiers (`WRITE_ROLES` inclut désormais explicitement `'ASSISTANTE_DIRECTION'`), sans changement côté IPC (déjà correct).*

*Mise à jour 4 août 2026 (Profils de carrière → Fonctions — synchronisation automatique) — les champs **« Poste »** et **« Rôle principal à ce niveau »** d'une étape de *Profils de carrière* alimentent désormais automatiquement le référentiel **« Fonctions »** de *Modèles de contrats de travail* (`ContractFunction.titre`/`contenu`) : à chaque création, modification ou duplication d'un profil de carrière, chacune de ses étapes est **synchronisée par upsert sur le titre** (`poste` → `titre`, `rolePrincipal` → `contenu`) — une fonction existante portant ce titre est mise à jour, sinon elle est créée (`syncContractFunctionsFromSteps`, `career-profiles.ipc.ts`, appelée dans la même transaction que `careerProfiles:create`/`update`/`duplicate`). Lien à **sens unique** (Profils de carrière → Fonctions) : retirer un poste d'un profil, ou supprimer un profil entier, ne supprime **jamais** la fonction correspondante (un même poste pouvant être partagé par plusieurs profils, cf. `@@unique([careerProfileId, poste])` sans contrainte globale). Si le même intitulé de poste existe avec un rôle principal différent dans deux profils distincts, la fonction — référentiel global non rattaché à un profil — reflète la **dernière synchronisation effectuée**. Aucune migration (aucun changement de schéma).*

*Mise à jour 4 août 2026 (nouveau module — Conformité LBC/FT/FP, Module 19) — nouveau module `/aml` : conformité anti-blanchiment/financement du terrorisme et de la prolifération, transposant les obligations de la loi uniforme UEMOA (GAFI) applicables aux professionnels de l'immobilier. Nouveau rôle **CONFORMITE** (dédié, calqué sur RH — aucune équivalence `checkRole`). **`AmlProfile`** (référence `LBC-AAAA-NNNN`, un par `Client` ou `Owner` via discriminateur `subjectType`/`subjectId`, même principe qu'`EntityTimelineEvent`) : niveau/score de risque, type de vigilance, statut PPE, origine des fonds/patrimoine, statut de validation. **`AmlBeneficialOwner`** pour les bénéficiaires effectifs des sujets `ENTREPRISE`. **Moteur de scoring** (`aml-risk-engine.service.ts`) volontairement simple — checklist de facteurs pondérés (`AmlRiskFactorCatalog`, calque de `KpiDefinition`), certains détectés automatiquement (type entreprise, PPE, pays à risque, montant élevé, espèces, watchlist confirmée), d'autres cochés manuellement — seuils paramétrables (`AppSetting` `aml.riskThresholds`). **Non-bloquant par conception** : aucun profil, quel que soit son risque, ne bloque la signature d'une convention — simple badge (`AmlProfileLinkBadge`/`AmlReviewBadge`) sur les fiches Client/Owner/Convention. **Criblage watchlist** (`AmlWatchlist`/`AmlWatchlistMatch`) manuel/semi-assisté par correspondance textuelle — **aucune API externe** (aucune disponible localement). **Revues de transaction** (`AmlTransactionReview`, référence `RC-AAAA-NNNN`, rattachée à une Convention par scalaire découplé) : file de candidats calculée à la demande, pas de tâche planifiée. **Déclarations de soupçon** (`AmlSuspiciousReport`, référence `DS-AAAA-NNNN`) — **strictement confidentielles** (non-divulgation/« tipping-off ») : signalement interne ouvert à tous sauf READONLY, mais liste/gestion réservées SUPER_ADMIN/ADMIN/CONFORMITE y compris pour le déclarant d'origine ; **aucune suppression jamais exposée** ; pièces jointes (`Document.amlSuspiciousReportId`) invisibles à la GED générale hors rôles habilités (filtre de confidentialité ajouté dans `documents.ipc.ts`, exception ciblée au comportement standard). Seed indicatif (`scripts/seed-aml.mjs`) : 12 facteurs de risque + seuils par défaut — **le référentiel de vigilance est livré vide par conception**, à alimenter manuellement. Migration `20260804100000_aml_module`.*

*Mise à jour 5 août 2026 (Conformité LBC/FT/FP — suivi des formations du personnel) — nouveau modèle **`AmlTraining`** (référence `FORM-AAAA-NNNN`, route `/aml/training`) : registre plat des formations LBC/FT/FP suivies par le personnel (participant — un `User`, pas un `Employee` du module RH, pour ne pas coupler ce module à la présence d'une fiche personnel —, date, sujet, organisme, durée, notes). Point initialement reporté à une phase ultérieure lors de la livraison du Module 19, implémenté à la demande. Gestion réservée `AML_ROLES` (SUPER_ADMIN/ADMIN/CONFORMITE) comme le reste du module — pas de workflow de validation ni de suivi d'obligations de recyclage périodique dans ce lot. Justificatif (attestation) via le pattern GED standard (`Document.amlTrainingId`, ajouté à `documents.ipc.ts` dans la même branche de contournement que `amlProfileId`/`amlTransactionReviewId`) — **sans confidentialité particulière**, ce champ ne rejoint pas le filtre `amlSuspiciousReportId` réservé aux déclarations de soupçon. Handlers `aml:training:list/getById/create/update/delete` ajoutés à `aml.ipc.ts` existant (pas de nouveau fichier IPC). Migration `20260805100000_aml_training`.*

*Mise à jour 5 août 2026 (Formations LBC/FT/FP — sélection multiple de participants à la création) — le champ « Participant » de « Nouvelle formation » (`AmlTrainingListPage.tsx`) devient un **sélecteur multiple** (puces + recherche + liste à cocher) : une même session de formation peut être enregistrée pour plusieurs participants en une seule saisie, sans repasser le formulaire plusieurs fois. Le registre reste **plat** (une ligne `AmlTraining` = un participant, cf. mise à jour précédente) : `aml:training:create` accepte désormais `userIds: number[]` (au lieu d'un `userId` unique) et crée une ligne par participant — références générées **séquentiellement** (boucle `for`/`await`, jamais `Promise.all`) pour éviter toute collision entre deux appels concurrents de `nextReference()`, chaque ligne portant sa propre référence `FORM-AAAA-NNNN` mais partageant sujet/date/organisme/durée/notes. La modification (`aml:training:update`) reste inchangée, au singulier — un enregistrement existant représente un seul participant, modifiable individuellement (nouveau schéma Zod dédié `trainingUpdateSchema`, distinct de `trainingCreateSchema`).*

*Mise à jour 6 août 2026 (Référentiel de vigilance — fiche d'identité complète) — le modèle `AmlWatchlist` et le formulaire *Paramètres → Conformité LBC/FT/FP → Référentiel de vigilance* (`AmlWatchlistSettingsTab.tsx`) gagnent 10 nouveaux champs facultatifs, calqués sur le format usuel des désignations SFC (Sanctions Financières Ciblées)/PPE : `sex` (Sexe), `birthPlace` (Lieu de naissance — `birthDate` existait déjà), `relatedPersons` (Identité ascendants, descendants, conjoint(e), parents ou proches, texte libre), `maritalStatus` (Situation matrimoniale, réutilise l'enum `StatutConjugalType` déjà utilisé par `Client.statutConjugal`), `spokenLanguage` (Langue parlée), `residenceCountry` (Pays de résidence habituel), `address` (Adresse), `phone` (Numéro de téléphone utilisé), `profession`, `reason` (Motif de l'inscription sur la liste — distinct du champ `notes` générique déjà existant). Champ `name` re-libellé « Nom et prénoms » (couvre aussi la raison sociale pour une personne morale, sans champ dédié séparé). **Le rapprochement (`aml:watchlist:screen`) reste basé uniquement sur `name`/`aliases`**, inchangé — les nouveaux champs sont purement documentaires, pour aider le chargé de conformité à qualifier une correspondance (confirmé/faux positif) une fois trouvée, pas pour élargir les critères de recherche. Migration `20260806100000_aml_watchlist_identity_fields`.*

*Mise à jour 6 août 2026 (Référentiel de vigilance — recherche et filtres) — l'écran gagne un champ de recherche (sur `name`) et deux filtres (type de liste, type de personne physique/morale). `aml:watchlist:list` (`aml.ipc.ts`) accepte désormais `filters.personType` en plus de `filters.listType`/`filters.search` déjà existants. Message d'état vide distingué : « Référentiel vide » (aucun filtre actif) vs « Aucun résultat » (filtres sans correspondance).*

*Mise à jour 6 août 2026 (Référentiel de vigilance — déplacé du menu Paramètres vers la barre latérale) — l'écran quitte *Paramètres → Conformité LBC/FT/FP* (onglet `amlWatchlist`, supprimé) pour devenir une page à part entière **`/aml/watchlist`**, accessible directement depuis le sous-menu « Référentiel de vigilance » du groupe latéral « Conformité LBC/FT/FP » (même `RoleGuard` que les autres pages du module — SUPER_ADMIN/ADMIN/CONFORMITE). Contenu strictement déplacé sans changement fonctionnel : `AmlWatchlistSettingsTab.tsx` supprimé, remplacé par `src/renderer/modules/aml/pages/AmlWatchlistPage.tsx` (enveloppé dans `PageLayout`, mêmes filtres/formulaire). Les 2 autres onglets AML de Paramètres (Catalogue des facteurs de risque, Seuils de scoring) restent en place, inchangés — seul le référentiel de vigilance déménage.*

*Mise à jour 6 août 2026 (Revues de transaction — déclenchement sur les encaissements effectifs, plus sur la Convention) — correction d'un défaut de conception initial du Module 19 : une Convention signée n'est pas un mouvement d'argent, le risque LBC/FT/FP porte sur **l'encaissement réel**, pas sur le contrat. `AmlTransactionReview.conventionId` (obligatoire) est remplacé par une référence polymorphe **`sourceType`** (`"PAYMENT"` | `"INSTALLMENT"`) + **`sourceId`** (scalaire sans FK, P5), rattachée à sa source concrète : **paiement de facture** (`Payment`), **échéance de convention** (`SaleInstallment.conventionId` renseigné) ou **échéance héritée** (`SaleInstallment` sans convention, client via `SaleInstallment.clientId`) — une échéance ne compte que si elle est effectivement encaissée (`status ∈ {PARTIEL, PAYE}`), une échéance simplement due n'étant pas un mouvement d'argent. `conventionId` devient un **contexte optionnel dérivé** (`Int?`, nul pour un paiement de facture sans convention ou une échéance héritée), conservé uniquement pour le badge déjà affiché sur la fiche Convention (`aml:reviews:getByConvention`, inchangé). `conventionReference` renommé **`sourceLabel`** (libellé figé au déclenchement, ex. « Paiement facture FAC-2026-0012 », « Échéance n°3 — CV-2026-0045 », « Échéance héritée — … »). `aml:reviews:pendingCandidates` (`aml.ipc.ts`) entièrement reciblé : interroge désormais `Payment` (jointure `Invoice` pour le client/la convention) et `SaleInstallment` encaissée (résolution du client par `clientId ?? convention.clientId`) au lieu de `Convention`, mêmes critères de détection (montant au-delà du seuil paramétrable, paiement en espèces, client lié à un profil à risque élevé/PPE), toujours calculé **à la demande** (pas de tâche planifiée). Côté renderer (`AmlReviewsListPage.tsx`, `AmlReviewDetailPage.tsx`) : la carte « Encaissements candidats » affiche un badge de type de source (Paiement de facture / Échéance de convention / Échéance héritée, `reviewSourceLabel` dans `aml.utils.ts`), le nom du client résolu, le montant et le mode de paiement. Migration `20260806110000_aml_review_source`.*

*Mise à jour 6 août 2026 (Revues de transaction — candidature automatique restreinte au seul seuil de montant) — affinage du changement précédent : la file de candidats (`aml:reviews:pendingCandidates`) ne retient désormais que les encaissements dont le **montant dépasse le « Seuil de montant élevé (FCFA) »** paramétrable (*Paramètres → Conformité LBC/FT/FP → Seuils de scoring*) — les critères « paiement en espèces » et « client lié à un profil à risque élevé/PPE », qui déclenchaient jusqu'ici seuls une candidature quel que soit le montant, sont retirés du filtre automatique (`highRiskClientIds`/comparaison `paymentMethod === 'ESPECE'` supprimées de `aml.ipc.ts`) : un paiement en espèces de faible montant, ou d'un client à risque, n'apparaît plus dans la file s'il reste sous le seuil. Les valeurs `ESPECES`/`RISQUE_ELEVE`/`PEP` de `AmlReviewTriggerReason` restent au catalogue (schéma et IPC les acceptent toujours) mais aucune candidature automatique ne les utilise plus — pas d'écran de création manuelle en phase 1 pour les déclencher autrement. Le motif affiché à l'ouverture d'une revue depuis un candidat est désormais toujours **« Seuil de montant dépassé »** (`AmlReviewsListPage.tsx` → `openFromCandidate`, au lieu de basculer sur « Paiement en espèces » selon le mode de paiement), cohérent avec le seul critère réellement appliqué.*

*Mise à jour 6 août 2026 (Revues de transaction — couverture des factures « Apport initial » / « Paiement comptant » réglées directement) — signalé : ces deux transactions n'apparaissaient jamais dans la file de candidats même au-delà du seuil, car leur mode de règlement usuel (bouton « → Payée » sur la fiche facture, `accounting:updateInvoiceStatus`) fait basculer l'`Invoice` en statut `PAYEE` **sans jamais créer de ligne `Payment`** — seul le formulaire « Enregistrer un paiement » (`accounting:addPayment`) alimente le bucket `Payment` déjà scruté par `aml:reviews:pendingCandidates`. Nouveau 3ᵉ bucket dans `aml:reviews:pendingCandidates` (`aml.ipc.ts`) : les `Invoice` de type `APPORT_INITIAL` ou `VENTE` (paiement comptant, auto-générées à la création d'une convention de vente — cf. `conventions.ipc.ts`), statut `PAYEE`, dont la somme des `Payment` rattachés est **strictement inférieure** au `total` de la facture (évite tout doublon avec le bucket `Payment` quand la facture a bien été réglée via « Enregistrer un paiement ») — le `total` de la facture sert alors de montant de comparaison au seuil. Nouvelle valeur `sourceType = 'INVOICE'` (`reviewCreateSchema` dans `aml.ipc.ts`, `AmlReviewSourceType` dans `aml.types.ts`) ; libellé « Apport initial — facture FAC-… » ou « Paiement comptant — facture FAC-… » selon `Invoice.type`. Badge dédié **« Facture réglée directement »**, en `warning` plutôt que `default` (traçabilité plus faible, aucune ligne de paiement associée) — nouvelle fonction partagée `reviewSourceBadgeVariant` dans `aml.utils.ts`, réutilisée par `AmlReviewsListPage.tsx` et `AmlReviewDetailPage.tsx` (remplace la logique de variante dupliquée inline dans les deux pages).*

*Mise à jour 6 août 2026 (Prospects — READONLY obtient les mêmes droits d'écriture qu'AGENT) — le rôle **READONLY** peut désormais **créer et modifier des prospects** (et changer leur statut), à l'identique du rôle **AGENT** : `WRITE_ROLES` de `prospects.ipc.ts` (`prospects:create`/`update`/`updateStatus`) étendu de `['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'AGENT']` à `[..., 'READONLY']` — ajout explicite et local à ce module (pas une équivalence globale dans `checkRole`, qui aurait élargi ce droit à tous les autres modules où READONLY est en lecture seule). Comportement hérité automatiquement, sans changement de code supplémentaire : auto-affectation à la création (`canAssign(session.role)` déjà `false` pour READONLY, comme pour AGENT), aucune vue globale (`FULL_VIEW_ROLES` inchangé — READONLY ne voit que ses prospects affectés), aucun droit d'affectation à un tiers ni de suppression (`prospects:assign`/`delete` restent réservés à SUPER_ADMIN/ADMIN/MANAGER). Aucun changement côté UI : le bouton « Nouveau prospect » (`ProspectsListPage.tsx`) et le formulaire (`ProspectFormPage.tsx`) n'étaient déjà filtrés par rôle nulle part — READONLY pouvait déjà naviguer vers `/prospects/new`, seul l'IPC bloquait la soumission.*

*Mise à jour 6 août 2026 (nouveau — Conventions pour prospects, Souscription/Vente en Brouillon) — les rôles habilités à créer des conventions (SUPER_ADMIN/ADMIN/MANAGER/ACCOUNTANT) peuvent désormais rattacher une nouvelle convention à un **prospect** plutôt qu'à un client. Schéma : `Convention.clientId` passe de `Int` (obligatoire) à `Int?`, nouveau champ **`prospectId Int?`** + relation `Prospect` — même pattern dual-FK nullable que `ConstructionProject`/`PermitProject` (`client`/`prospect`, invariant « l'un des deux, jamais les deux » validé côté Zod, pas de contrainte SQL). Migration `20260806120000_convention_prospect`. **Restrictions** (appliquées côté IPC `conventions.ipc.ts`, dupliquées côté formulaire `ConventionFormPage.tsx` pour un retour immédiat) : type **Souscription ou Vente uniquement**, statut **Brouillon uniquement** à la création (`.refine()` sur `conventionSchema`), et **verrou de statut/type en modification** tant que `clientId` reste vide (`conventions:update` rejette explicitement toute tentative de changement de statut ou de type hors Souscription/Vente). Aucune facture n'est générée automatiquement à la création d'une convention prospect (bloc de facturation auto entouré d'un garde `if (d.clientId)` — un prospect n'est pas un tiers facturable ; les montants saisis restent sur la convention pour facturation manuelle ultérieure). **Bascule automatique à la conversion** : `prospects:convertToClient` rattache désormais, dans la même transaction, `clientId` du nouveau client à toute convention portant `prospectId` sans `clientId` — `prospectId` n'est jamais effacé (traçabilité), et dès que `clientId` est renseigné la convention suit exactement les règles normales (aucun code supplémentaire nécessaire, le verrou se désactive de lui-même). Visibilité AGENT (`agentScopeWhere`, `conventions:getById`, `conventions:getInstallments`) étendue en symétrie : un AGENT référent d'un **prospect** voit désormais aussi les conventions BROUILLON qui lui sont liées, comme pour un client référent. Formulaire : bascule « Client »/« Prospect » (création uniquement) au-dessus du champ destinataire, sélecteur `Prospect *` réutilisant le pattern `useProspects`/`makeEntitySearch` déjà en place dans `ConstructionProjectFormPage.tsx`, liste des types restreinte, statut verrouillé sur Brouillon avec bandeau explicatif. Affichage : `ConventionDetailPage.tsx` et `ConventionsListPage.tsx` affichent le prospect (badge « Non converti », lien vers sa fiche) à la place du client tant que `clientId` est vide. **Limite assumée, non corrigée** : une convention **Vente sur un terrain** exige un terrain déjà attribué au client (`terrain.clientId`, filtre existant du formulaire) — impossible pour un prospect (jamais de terrain attribué) ; seules **Souscription (terrain)** et **Vente (bien immobilier)** sont donc réellement utilisables pour un prospect, ce qui couvre le besoin exprimé.*

*Mise à jour 6 août 2026 (nouveau — Réception des réponses par email, IMAP) — le module Communication ne se contentait jusqu'ici que d'envoyer des emails (SMTP) ; les champs `Communication.direction` (`ENTRANT`/`SORTANT`) et `CommStatus.RECU` existaient dans le schéma sans jamais être utilisés. Nouveau modèle **`MailAccount`** (`userId Int?` — `null` = boîte système partagée des relances, sinon boîte personnelle opt-in d'un utilisateur, une par utilisateur via `@unique`) et service **`mailbox-poller.service.ts`** : interroge par IMAP (`imapflow` + `mailparser`) chaque boîte active, récupère les nouveaux messages (curseur `lastUid`, aucun import de l'historique de la boîte à la première synchronisation — seuls les messages arrivés après connexion sont récupérés), et journalise chacun comme une `Communication` (`direction: ENTRANT`, `status: RECU`). **Rattachement automatique** à l'échange d'origine via les en-têtes `In-Reply-To`/`References` comparés au nouveau champ `Communication.messageId` (Message-ID sortant, capturé sur la réponse Nodemailer à l'envoi — `email.service.ts` le retournait déjà, seule la persistance manquait ; ajouté sur les 4 points d'envoi email : `communication:sendEmail`, `communication:resend`, `communication:shareLocation`, `reminders.service.ts`) ; à défaut de correspondance, repli sur une recherche de l'adresse expéditrice parmi `Client.email`/`Prospect.email`/`Owner.email`/`BusinessReferrer.email`. Nouveaux champs `Communication.inReplyToMessageId`, `parentCommunicationId` (auto-relation), `mailAccountId`, contrainte `@@unique([mailAccountId, messageId])` anti-doublon. Migration `20260806130000_mail_account`.

Chiffrement du mot de passe IMAP : la primitive AES-256-GCM portable jusque-là privée à `settings.service.ts` (couplée à `AppSetting`, un secret = une clé) est extraite dans **`src/main/utils/secretCrypto.ts`** (`encryptSecret`/`decryptSecret`/`isLegacySecret`), réutilisée telle quelle par `settings.service.ts` (comportement inchangé, zéro migration de données) et directement par `MailAccount.imapPasswordEnc` (table dédiée, potentiellement plusieurs lignes — pas un singleton `AppSetting`).

**Deux surfaces de configuration, un seul moteur de polling** : *Paramètres → Email* (admin) gagne une section « Réception (IMAP) — boîte de relances » (`ImapSettingsCard` dans `EmailSettingsTab.tsx`, IPC `settings:getImap`/`updateImap`/`testImap`) pour la boîte système ; « Mon profil » gagne une carte « Ma boîte email personnelle » (`PersonalMailboxCard` dans `ProfilePage.tsx`, IPC `mailAccount:get`/`upsert`/`test`/`delete`, self-service, aucune restriction de rôle) pour la boîte personnelle facultative — sert à récupérer les réponses aux emails envoyés « en tant que soi-même » (mode Particulier, `senderSelf` dans `communication.ipc.ts`, qui met `From:` = l'email personnel de l'utilisateur mais relaie via le SMTP partagé : sans boîte personnelle connectée, ces réponses n'atterrissent que dans la vraie boîte mail de l'utilisateur, hors de l'app). Les deux boîtes sont interrogées par le même `pollAllMailAccounts()`.

**Déclenchement — même duo que la politique de relance** : in-process (`scheduleMailboxPolling()`, `setInterval` 10 min — plus fréquent que l'heure des relances, une réponse étant plus sensible au délai) **et** script autonome **`src/main/scripts/run-mailbox-poll-once.ts`** (`npm run mail:poll`), calqué à l'identique sur `run-reminders-once.ts` (même résolution de `DATABASE_URL`, même garde `safeStorage` hors Electron), planifiable via Tâche planifiée Windows / NAS pour que les réponses remontent même quand aucun poste n'a l'application ouverte.

**`CommunicationPage.tsx`** (`STATUS_VARIANT`/`STATUS_LABEL` géraient déjà `RECU`, jamais atteint jusqu'ici) : nouveau filtre « Sens » (Envoyés/Reçus), colonne « Contact » (renommée depuis « Destinataire », neutre pour les deux sens) avec icône de direction par ligne, et bouton **« Rattacher »** sur les messages reçus non appariés automatiquement — ouvre `LinkInboundModal` (choix Client/Prospect + recherche, réutilise `makeEntitySearch`) appelant le nouveau handler `communication:linkInbound`.

⚠️ **Pas d'authentification OAuth2** (Gmail/Outlook modernes) dans cette phase — mot de passe applicatif IMAP classique uniquement ; un utilisateur avec double authentification devra générer un « mot de passe d'application » (mentionné dans le texte d'aide du formulaire « Mon profil »).*

*Mise à jour 6 août 2026 (Politique de relance — création et édition complète des règles) — *Paramètres → Politique de relance* permettait déjà d'activer/désactiver une règle et de changer son modèle, mais pas de créer une nouvelle règle ni de modifier son nom, sa description, son décalage ou son canal. Nouveau handler **`reminders:createRule`** (`reminders.ipc.ts`, réservé SUPER_ADMIN/ADMIN/MANAGER comme le reste du module) — `reminders:updateRule` exposait déjà ces champs côté schéma Zod (`ruleUpdateSchema`), seule l'interface ne les exposait pas. Aucun changement du moteur (`applyReminderRules`, `reminders.service.ts`) : il boucle déjà génériquement sur toutes les règles actives d'un `triggerType` donné (3 cas : `INSTALLMENT_UPCOMING`, `INSTALLMENT_OVERDUE`, `CONVENTION_EXPIRING`), donc ajouter une règle supplémentaire sur un cas existant (ex. une relance SMS à J-3, en plus des règles email J-15/J-7/J-0 déjà seedées) est purement une opération de données. `code` (identifiant technique, unique, jamais affiché ni saisi) généré automatiquement à la création (`{triggerType}_J{offset}_{channel}_{horodatage}`) — utilisé uniquement pour le journal et `Communication.metadata.ruleCode`, jamais réinterprété par le moteur. Le **type de déclenchement reste figé après création** (verrouillé dans la modale d'édition) — changer un type après coup changerait le sens même de la règle. Bouton **« Nouvelle règle »** dans l'en-tête et **« Modifier »** sur chaque ligne (`RemindersSettingsTab.tsx`) ouvrent la même modale `RuleFormModal` (Type de déclenchement, Nom, Description, Décalage en jours, Canal, Modèle). Pas de suppression exposée — désactiver (`isActive`, déjà existant) couvre le besoin de retrait sans perdre l'historique/la configuration de la règle.*

*Mise à jour 6 août 2026 (Politique de relance — suppression définitive d'une règle) — revient sur le choix précédent : bouton **« Supprimer »** ajouté à côté de « Modifier » sur chaque ligne de `RemindersSettingsTab.tsx`, avec confirmation (`ConfirmDialog`, action irréversible explicitement signalée). Nouveau handler **`reminders:deleteRule`** (réservé SUPER_ADMIN/ADMIN/MANAGER, `db.reminderRule.delete`) — suppression physique, `ReminderRule` ne portant pas de `deletedAt` (modèle de configuration, pas une entité métier soumise à archivage/traçabilité, à la différence des Client/Convention/etc. couverts par la règle générale de soft delete). Sans effet sur l'historique : `Communication.metadata.ruleCode` est une simple chaîne figée au moment de l'envoi, sans FK vers `ReminderRule` — les relances déjà envoyées restent visibles même après suppression de la règle qui les a déclenchées. La désactivation (`isActive`) reste le geste réversible pour un simple retrait temporaire ; la suppression est désormais l'option pour un nettoyage définitif (règle créée par erreur, doublon…).*

*Mise à jour 11 août 2026 (Politique de relance — Liste d'exclusion relances) — nouvelle carte **« Liste d'exclusion relances »** dans *Paramètres → Politique de relance* (`RemindersSettingsTab.tsx`) : un admin/manager (SUPER_ADMIN/ADMIN/MANAGER) peut y **rechercher et ajouter un client** (réutilise le sélecteur `SearchSelect`/`makeEntitySearch` déjà en place pour « Envoyer un message »/« Rattacher ce message reçu »), qui n'est alors plus jamais destinataire d'une relance automatique — échéances de vente à venir, échéances en retard **et héritées**, expiration de convention — quel que soit le canal (email, SMS, WhatsApp). **Aucune nouvelle donnée en base** : la fonctionnalité réutilise `Client.smsOptOut`/`emailOptOut` (champs présents dans le schéma depuis l'origine du module Communication, déjà lus par `processCandidate` dans `reminders.service.ts` pour les 3 types de déclenchement, mais jusque-là sans aucune interface pour les renseigner — le handler `reminders:setClientOptOut` existait déjà côté IPC et n'était appelé nulle part côté renderer). Ajouter/retirer un client de la liste pose **les deux drapeaux ensemble** (`true`/`true` ou `false`/`false`) plutôt que par canal séparé — simplification délibérée par rapport au réglage bas niveau existant, les relances WhatsApp partageant de toute façon l'opt-out SMS faute de champ dédié, ce qui rend une exclusion « tous canaux » cohérente avec l'intention de l'utilisateur (« ne plus contacter automatiquement ce client »). Nouveau handler **`reminders:listOptedOutClients`** (`READ_ROLES`, liste des clients actifs ayant au moins un des deux drapeaux à `true`) alimentant le tableau des clients déjà exclus, avec bouton « Retirer » par ligne. L'envoi manuel de messages (Communication, CRM…) n'est pas affecté — ces champs ne sont référencés nulle part en dehors du moteur de relances.*

*Mise à jour 11 août 2026 (Communication — noms complets au format Nom + Prénoms) — dans tout message envoyé (automatique ou manuel), la variable `{{fullName}}` d'un particulier (client/prospect/propriétaire/apporteur d'affaires) suit désormais le format **Nom + Prénoms** (ex. « N'DJOLE KOUAME KOUAME MARTIAL »), au lieu de Prénoms + Nom — alignement sur la convention déjà en vigueur ailleurs dans l'application (RH, Paie, Comptabilité, Analytics, Trésorerie). Concerne `recipientVariables()` (`communication.ipc.ts`, `{{fullName}}` des envois manuels et de `communication:resolveTarget`), `buildClientName()` (`reminders.service.ts`, `{{fullName}}` des relances automatiques), `recipientName` du partage de localisation GPS, ainsi que `{{agentName}}` (variable commune) et le nom d'affichage de l'expéditeur en mode « envoi en tant que soi-même » (`senderSelf`). Les raisons sociales (personnes morales) ne sont pas concernées.*

*Mise à jour 11 août 2026 (correctif — une règle de relance supprimée définitivement était réintégrée au redémarrage de l'app) — `seedDefaultRemindersConfig()` (`reminders.service.ts`), exécutée à **chaque démarrage de l'application** (`src/main/index.ts`) pour amorcer les 12 règles par défaut sur une base neuve, est **idempotente par code** (`db.reminderRule.findUnique({ where: { code } })` → ne recrée pas si trouvé) — mais ne pouvait pas distinguer un code **jamais créé** d'un code **volontairement supprimé** via `reminders:deleteRule` (ajoutée le 6 août 2026) : les deux se traduisent par une absence en base, donc le seed la recréait silencieusement au prochain lancement, rendant la suppression « définitive » illusoire au-delà du redémarrage suivant. Corrigé par une empreinte des codes supprimés (`AppSetting` `reminders.deletedSeedCodes`, JSON, `markRuleCodeDeleted()`/`loadDeletedSeedCodes()`) : `reminders:deleteRule` y ajoute le code de la règle supprimée, et `seedDefaultRemindersConfig()` ignore désormais tout code de `SEED_RULES` présent dans cette liste. N'affecte que les règles **seedées par défaut** (codes `SEED_RULES`) — une règle créée manuellement (`reminders:createRule`) porte un code unique généré à la volée qui ne figure de toute façon jamais dans `SEED_RULES`, donc jamais concernée par ce problème. Les règles déjà réintégrées par ce bug avant le correctif restent en base : à supprimer une dernière fois si non désirées, la suppression sera alors définitive.*

*Mise à jour 11 août 2026 (Activités & CRM — AGENT_TECHNIQUE voit toutes les « Créas / Publications / Articles », aperçu intégré des pièces jointes) — deux ajouts ciblés au module CRM (« Activités & CRM ») : **(1)** le rôle **AGENT_TECHNIQUE**, jusque-là restreint à ses propres activités comme AGENT (cf. mise à jour du 10 juillet 2026 sur `crm.ipc.ts`), voit désormais en plus **toutes** les activités de type **« Créas / Publications / Articles »** (`CREATION_PUBLICATION`) de **tous les utilisateurs** — pertinent pour ce rôle technique qui alimente le module Réseaux Sociaux & Plateformes Web et doit pouvoir suivre l'ensemble des publications, pas seulement les siennes. Implémenté dans `buildVisibilityWhere` (`crm.ipc.ts`) : la clause de vue propre (`activitiesForUserWhere`) est étendue d'une clause `{ type: 'CREATION_PUBLICATION' }` pour ce rôle uniquement — répercuté automatiquement sur `crm:listActivities`, `getActivity` et `getStats` (tous consommateurs de `buildVisibilityWhere`), sans changement côté UI (`CrmPage.tsx` affiche simplement ce que l'IPC retourne). **(2)** La vue détail d'une activité (`ActivityDetailModal.tsx`) permettait déjà de télécharger/ouvrir une pièce jointe (`documents:open`, application externe) mais pas de la prévisualiser dans l'app. Nouveau bouton **« Voir »** par pièce jointe (à côté de « Ouvrir ») ouvrant `AttachmentViewerModal.tsx` (nouveau, `src/renderer/modules/crm/components/`) — wrapper autour de `DocumentPreview` du module Archivage (images, PDF, audio, vidéo, repli « Ouvrir » pour les autres formats), calqué à l'identique sur `AttachmentViewerModal.tsx` du module Innovations IT (composant dupliqué plutôt que partagé entre modules, convention déjà en usage dans ce fichier pour ce type de wrapper léger).*

*Mise à jour 11 août 2026 (correctif complémentaire — AGENT_TECHNIQUE bloqué à l'ouverture des pièces jointes « Créas / Publications / Articles » d'un autre utilisateur) — l'extension de visibilité ci-dessus rendait bien l'activité et la présence de ses pièces jointes visibles à AGENT_TECHNIQUE, mais cliquer « Voir »/« Ouvrir » sur une pièce jointe d'un **autre utilisateur** échouait encore (« Accès refusé à ce document ») : `documents:open`/`documents:getFileData` (`documents.ipc.ts`) appliquent, en plus du rôle, un contrôle de **dossier GED** (`canReadDocumentFolder`) — un document sans dossier (`folderId = null`, cas normal d'une pièce jointe d'activité CRM, jamais déposée dans un dossier) n'est lisible que par les rôles du « pool général » (`GED_GENERAL_ROLES`), qui n'inclut pas AGENT_TECHNIQUE. Corrigé par un contournement ciblé (même principe que la confidentialité des pièces jointes de déclaration de soupçon, Module 19) : les deux handlers chargent désormais `Document.crmActivity.type` et **ignorent le contrôle de dossier** quand `session.role === 'AGENT_TECHNIQUE'` et que le document est rattaché à une activité `CREATION_PUBLICATION` — quel que soit le dossier (ou l'absence de dossier) de dépôt. N'affecte aucun autre rôle ni aucun autre type de pièce jointe.*

*Mise à jour 11 août 2026 (Conformité LBC/FT/FP — plein accès pour MANAGER) — le rôle **MANAGER** obtient un **plein accès** au Module 19, en parité totale avec ADMIN — y compris les 3 actions les plus sensibles (`AML_ADMIN_ONLY` dans `aml.ipc.ts` : suppression d'un profil de vigilance, suppression d'une revue de transaction, modification des seuils de scoring) normalement refusées même au rôle dédié **CONFORMITE** (choix explicite, confirmé par l'utilisateur — parité totale avec ADMIN plutôt qu'un périmètre calqué sur CONFORMITE). `AML_ROLES` et `AML_ADMIN_ONLY` (`aml.ipc.ts`) étendus à `'MANAGER'`, ainsi que leurs deux constantes dupliquées dans `documents.ipc.ts` (`AML_ROLES` local, `AML_CONFIDENTIAL_ROLES` — sans quoi MANAGER aurait pu gérer un profil/une revue/une déclaration mais pas en consulter les pièces jointes). Côté renderer : `RoleGuard` du groupe `/aml/*` (`router.tsx`) et le groupe de menu « Conformité LBC/FT/FP » (`Sidebar.tsx`) étendus à MANAGER ; les 2 onglets *Paramètres → Conformité LBC/FT/FP* (Catalogue des facteurs de risque, Seuils de scoring, `SettingsPage.tsx`) lui sont désormais visibles, avec écriture activée (`AmlThresholdsSettingsTab.tsx`) ; les constantes de rôle locales à chaque page/composant du module (`AmlProfileDetailPage.tsx` — dont le `ADMIN_ONLY` distinct gouvernant le bouton de suppression, `AmlReviewDetailPage.tsx`, `AmlWatchlistPage.tsx`, `AmlTrainingListPage.tsx`, `AmlProfileLinkBadge.tsx`, `AmlReviewBadge.tsx`) étendues une à une à `'MANAGER'`. **MANAGER n'est pas un rôle exclusif** comme CONFORMITE/RH : il conserve tous ses accès existants (Clients, Conventions, etc.) en plus de ce nouveau plein accès Conformité.*

*Mise à jour 11 août 2026 (Conformité LBC/FT/FP — plein accès pour ACCOUNTANT également) — même demande, même périmètre, cette fois pour le rôle **ACCOUNTANT (Comptable)** : plein accès au Module 19 en parité totale avec ADMIN, y compris les 3 actions `AML_ADMIN_ONLY`. Exactement les mêmes points de code que pour MANAGER précédemment sont étendus à `'ACCOUNTANT'` : `AML_ROLES`/`AML_ADMIN_ONLY` (`aml.ipc.ts`), `AML_ROLES`/`AML_CONFIDENTIAL_ROLES` dupliquées (`documents.ipc.ts`), `RoleGuard` `/aml/*` (`router.tsx`), groupe de menu « Conformité LBC/FT/FP » (`Sidebar.tsx`), les 2 onglets Paramètres (`SettingsPage.tsx`, `AmlThresholdsSettingsTab.tsx`), et les constantes de rôle locales de chaque page/composant AML — **y compris `AmlRiskFactorsSettingsTab.tsx`, omis par erreur lors du passage MANAGER** et corrigé au passage (l'onglet « Catalogue des facteurs de risque » était donc en lecture seule pour MANAGER jusqu'à ce correctif malgré l'onglet visible). Ni MANAGER ni ACCOUNTANT ne sont des rôles exclusifs au module — les deux conservent tous leurs accès habituels en plus de ce plein accès Conformité.*

*Mise à jour 11 août 2026 (Conformité LBC/FT/FP — accès restreint AGENT/AGENT_TECHNIQUE/ASSISTANTE_DIRECTION) — ces 3 rôles obtiennent un accès **restreint** au Module 19, limité aux deux interfaces **« Référentiel de vigilance »** et **« Formations »** (jamais Tableau de bord, Profils, Revues de transaction ni Déclarations de soupçon). Nouvelles constantes `AML_RESTRICTED_ROLES = ['AGENT', 'AGENT_TECHNIQUE', 'ASSISTANTE_DIRECTION']` et `WATCHLIST_RESTRICTED_WRITE_ROLES = ['AGENT_TECHNIQUE']` (`aml.ipc.ts`). **Référentiel de vigilance** : `aml:watchlist:list`/`getById` ouverts en lecture aux 3 rôles ; `create`/`update`/`delete` ouverts en plus à **AGENT_TECHNIQUE seul** (AGENT et ASSISTANTE_DIRECTION restent en lecture seule) — `aml:watchlist:screen`/`aml:watchlistMatches:*` restent réservés à `AML_ROLES` (nécessitent un profil, hors périmètre de ces 3 rôles). **Formations** : `aml:training:list`/`getById` ouverts en lecture aux 3 rôles, mais **strictement limités aux formations dont ils sont participants** — `list` force `where.userId = session.userId` en ignorant tout `filters.userId` transmis par le client pour ces rôles, `getById` masque en « Formation introuvable » toute formation d'un autre participant (pas de refus explicite, cohérent avec le style du reste du fichier) ; `create`/`update`/`delete` restent réservés à `AML_ROLES` (aucune écriture pour ces 3 rôles sur les Formations, à la différence du Référentiel où AGENT_TECHNIQUE écrit). Côté renderer : le bloc `RoleGuard` unique de `/aml/*` (`router.tsx`) est scindé en deux — un premier bloc inchangé (`AML_ROLES` complet) pour les 8 routes à plein accès, un second bloc nouveau (`AML_ROLES` + les 3 rôles restreints) portant **uniquement** `aml/training` et `aml/watchlist` — évite de dupliquer un même chemin sous deux `RoleGuard` différents (aurait rendu le routage ambigu), chaque route ne porte donc qu'un seul `RoleGuard` dimensionné à l'union des rôles qui doivent l'atteindre, même convention que la distinction opérationnel/configuration du Module 12 RH. `Sidebar.tsx` : le groupe « Conformité LBC/FT/FP » voit son `roles` élargi à l'union des 8 rôles (sinon le groupe entier resterait invisible aux 3 rôles restreints), et les 4 items désormais réservés au plein accès (Tableau de bord, Profils, Revues, Déclarations) reçoivent chacun un `roles` explicite qu'ils n'avaient pas jusque-là (hérité implicitement du groupe) — Formations et Référentiel de vigilance restent sans `roles` propre, donc visibles à tout le groupe élargi. `AmlWatchlistPage.tsx` : `AML_ROLES` local (gouvernant `canWrite`, donc le bouton « Nouvelle entrée », le formulaire d'édition et la colonne Actions) étendu à `'AGENT_TECHNIQUE'` uniquement — AGENT et ASSISTANTE_DIRECTION consultent la page en lecture seule sans aucun changement de code (le `canWrite` existant les exclut déjà). `AmlTrainingListPage.tsx` inchangé (`AML_ROLES` reste le périmètre plein accès) : les 3 rôles restreints n'ont droit à aucune écriture sur les Formations, la restriction de lecture à leurs propres participations étant entièrement portée côté serveur.*

*Mise à jour 11 août 2026 (Conformité LBC/FT/FP — READONLY rejoint le périmètre restreint, sans écriture) — même accès restreint que ci-dessus (Référentiel de vigilance + Formations personnelles uniquement) étendu au rôle **READONLY**, avec une nuance : contrairement à AGENT_TECHNIQUE, **READONLY n'obtient aucune écriture** sur le référentiel de vigilance — conformément à son rôle, il reste en lecture seule partout dans le module. `AML_RESTRICTED_ROLES` (`aml.ipc.ts`) étendu à `'READONLY'` ; `WATCHLIST_RESTRICTED_WRITE_ROLES` **volontairement inchangé** (`['AGENT_TECHNIQUE']` seul). `RoleGuard` du bloc restreint (`router.tsx`) et `roles` du groupe de menu (`Sidebar.tsx`) étendus à READONLY ; `AmlWatchlistPage.tsx`/`AmlTrainingListPage.tsx` inchangés (READONLY n'était déjà dans aucun `AML_ROLES` d'écriture). Au passage : READONLY reste le **seul rôle sans aucun moyen de signaler un soupçon LBC/FT** (`AML_REPORT_CREATE_ROLES`, « tous les rôles sauf READONLY », inchangé) — son accès au module se limite donc strictement à la consultation du référentiel de vigilance et de ses propres formations.*

*Mise à jour 11 août 2026 (correctif — « Activités à venir » vide pour ACCOUNTANT au Tableau de bord) — signalé par l'utilisateur : le widget « Activités à venir » de `DashboardPage.tsx` semblait ne jamais charger pour un utilisateur **ACCOUNTANT (Comptable)**. Cause réelle : pas un échec de chargement mais une incohérence frontend/backend — `isCrmFullView` dans `DashboardPage.tsx` incluait encore `'ACCOUNTANT'` (affichant la section « Activité CRM » en vue globale), alors que `FULL_VIEW_ROLES` dans `crm.ipc.ts` **ne l'inclut plus depuis le 10 juillet 2026** (retrait délibéré et documenté, cf. mise à jour de cette date) : un Comptable est donc restreint côté IPC à ses propres activités CRM (assignées/créées/clients référents), un périmètre quasi toujours vide en pratique pour ce rôle → liste vide affichée (« Aucune activité. »), lu à tort comme un blocage de chargement. Corrigé en alignant le Tableau de bord sur la restriction backend (déjà intentionnelle, non remise en cause) plutôt qu'en révisant `FULL_VIEW_ROLES` : nouvelle constante `isCrmOwnView` (`isAgent || role === 'ACCOUNTANT'`) qui bascule ACCOUNTANT sur le même rendu que AGENT/AGENT_TECHNIQUE (`CrmRecapSection` sans titre, propres activités) au lieu de la section pleine vue ; `isCrmFullView` ramené à `['SUPER_ADMIN', 'ADMIN', 'MANAGER']`, cohérent avec `FULL_VIEW_ROLES` de `crm.ipc.ts`.*

*Mise à jour 19 août 2026 (Fiche KYC — accès individuel pour AGENT/AGENT_TECHNIQUE/ASSISTANTE_DIRECTION/READONLY) — les boutons **« Fiche KYC »** et **« Fiche KYC non renseignée »** (Clients, Propriétaires, Apporteurs d'affaire) sont désormais **masqués par défaut** pour les rôles **AGENT, AGENT_TECHNIQUE, ASSISTANTE_DIRECTION et READONLY** — jusqu'ici accessibles sans restriction sur les fiches détail (le bouton « Fiche KYC » de `ClientDetailPage`/`OwnerDetailPage`/`ReferrerDetailPage` n'était gardé par aucun rôle) et, sur les listes, couplés à tort au périmètre générique d'export/impression (`canExportPrint`, sans possibilité d'octroi individuel). **Tous les autres rôles** (SUPER_ADMIN, ADMIN, MANAGER, ACCOUNTANT…) conservent un accès complet, sans changement. Nouveau mécanisme d'**accès individuel**, calqué sur les utilisateurs désignés des « Modèles de messages » manuels (`communication.ipc.ts` → `manualTemplateEditorIds`/`myTemplatePermissions`) : `AppSetting` `kyc.authorizedUserIds` (JSON, ids `User`), handlers `settings:getKycAuthorizedUsers`/`updateKycAuthorizedUsers` (réservés SUPER_ADMIN/ADMIN) et `settings:myKycAccess` (accessible à tout utilisateur authentifié, résout `{ hasAccess }` par rôle **exact** — `KYC_RESTRICTED_ROLES`, sans équivalence `checkRole` — puis par présence dans la liste pour les 4 rôles restreints). Nouvel onglet *Paramètres → « Fiche KYC — accès »* (`KycAccessSettingsTab.tsx`, admin uniquement, liste à cocher des utilisateurs actifs de ces 4 rôles, même UI que `ManualTemplateEditorsModal.tsx`). Côté renderer, nouveau hook partagé `useKycAccess()` (`src/renderer/shared/hooks/useKycAccess.ts`, faux par défaut pendant le chargement) appliqué aux 6 points d'affichage : `ClientDetailPage`/`ClientsListPage`, `OwnerDetailPage`/`OwnersListPage`, `ReferrerDetailPage`/`ReferrersListPage` — sur les listes, remplace l'ancien couplage à `canExport`/`canExportPrint` (qui bloquait aussi RH/CONFORMITE, sans jamais les concerner en pratique puisqu'ils n'ont pas accès à ces modules, et n'offrait aucun octroi individuel). Purement une restriction du bouton d'export/impression de la fiche formatée — les champs KYC bruts déjà affichés sur la page (carte « Informations complémentaires — Fiche KYC ») restent visibles pour tout rôle ayant un droit de lecture sur l'entité, inchangé. Migration : aucune (nouvelle clé `AppSetting`, pas de nouveau modèle Prisma).*
