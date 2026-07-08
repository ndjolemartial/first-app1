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
| CRUD Prospects          | ✅          | ✅    | ✅      | ✅    | ✅         | 👁️       |
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

> **Performances (Module 14)** — gestion opérationnelle (objectifs, évaluations, plans, classements) : SUPER_ADMIN, ADMIN, RH et **MANAGER** (†ce dernier **limité à son équipe** — employés dont `Employee.managerId` = sa fiche). Le **tableau de bord de performance** et la **configuration** (catalogue KPI, pondérations par poste) : SUPER_ADMIN, ADMIN, RH **uniquement** — le **MANAGER en est exclu** (menu masqué, routes fermées par `RoleGuard`, handler `performance:dashboard` en `PERF_ADMIN_ROLES`). Signature « Direction » (3ᵉ niveau) : SUPER_ADMIN, ADMIN. Signature « collaborateur » : l'employé concerné via « Mon espace RH ». Le rôle **RH** accède aux performances mais reste par ailleurs cantonné à son module (aucune équivalence `checkRole`).

> **RH (Ressources Humaines / Paie)** — rôle **dédié** au module RH & Paie (personnel, contrats, bulletins de paie, congés, pointage). Il accède **uniquement** au module RH/Paie et au tableau de bord ; les autres modules lui sont **refusés au niveau IPC**. Le rôle RH **n'hérite d'aucun autre droit** (aucune équivalence dans `checkRole`).
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
> **Équivalence de rôles** — les utilisateurs **ACCOUNTANT (Comptable)** disposent des **mêmes droits d'accès que les MANAGER** : la colonne ACCOUNTANT ci-dessus est identique à la colonne MANAGER. Cette équivalence est appliquée de manière centralisée dans `checkRole` (`src/main/services/auth.service.ts`) — ACCOUNTANT n'obtient toutefois aucun droit réservé aux rôles ADMIN / SUPER_ADMIN. **ASSISTANTE_DIRECTION** hérite également des droits MANAGER via `checkRole`, **sauf** pour la modification des **Clients, Biens et Terrains** : sur ces trois modules, les rôles **AGENT, ASSISTANTE_DIRECTION et READONLY sont en lecture seule** (écriture refusée par `checkClientWriteRole` / `checkWriteRole` dans les handlers IPC correspondants, et boutons masqués côté UI).

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
- **Attestation de solde sur échéances héritées** (souscription héritée = échéances **sans convention**) : émission possible dès que le **solde net est ≤ 0** (`total souscrit − total réglé`, sans plafond bas — le trop-perçu est accepté). Le **terrain de souscription est obligatoire** (il figure sur l'attestation), mais le **solde est vérifié sur les échéances héritées du client** : si le terrain choisi n'a **aucune échéance rattachée** (fréquent, les échéances importées n'étant pas toujours liées à un terrain), le contrôle **retombe automatiquement sur l'ensemble des échéances héritées du client** (repli dans `assertLegacySubscriptionSettled` / `attestations:getLegacyBalance`). Bouton **« Attestation de solde »** dans *Comptabilité → Échéances → onglet « Échéances héritées »* (route `/accounting/installments`) → ouvre `/conventions/attestations/new?legacy=1&type=SOLDE&clientId=…[&terrainId=…]`. Rôles : SUPER_ADMIN, ADMIN, MANAGER, ACCOUNTANT. Le formulaire propose (mode hérité) un champ **« Prix Total du bien »** (`Attestation.prixTotalBien`, migration `20260707280000_attestation_prix_total_bien`) affiché sur le document via les variables `{{attestation.prixTotalBien}}` / `{{attestation.prixTotalBien.enLettres}}`.
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
- Campagnes de relance automatiques (configurer déclencheurs et délais)
- Historique de toutes les communications par entité
- Configuration SMTP (email) et API SMS (Twilio / OVH / Brevo)
- File d'attente d'envoi avec retry en cas d'échec
- Prévisualisation avant envoi

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
- **Vue détail d'une activité** : depuis la liste, un clic sur le sujet ou le bouton « Voir » ouvre un panneau (modal `ActivityDetailModal`) présentant type, statut, description, dates (prévue / terminée / créée), assigné à, **créé par**, **entités rattachées** (puces cliquables vers chaque fiche) et **pièces jointes** (ouverture via `documents:open`). Alimenté par `crm:getActivity` (qui inclut `createdBy` et `attachments`).
- **Tâche liée à un objectif de performance** : à la création d'une activité de **type « Tâche »**, le collaborateur connecté peut la **lier à l'un de ses objectifs à Mesure « Manuelle »** doté d'une cible chiffrée (`CrmActivity.objectiveId`, sélecteur alimenté par `performance:me:manualObjectives` — objectifs personnellement assignés via `Employee.userId`). La tâche porte une **quantité réalisée** (`CrmActivity.objectiveRealized`) ; la vue détail affiche le **taux d'avancement** (réalisé / cible) et permet de la renseigner. La tâche **ne peut passer au statut « Traité » qu'à 100 %** de la cible (garde côté IPC : `crm:createActivity` / `updateActivity` / `completeActivity`). L'avancement de l'objectif lié est recalculé (quantité réalisée cumulée des tâches liées / cible) à chaque modification.

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
- **Rattachement à un compte utilisateur** (`Employee.userId`, relation 1-1 `@unique` vers `User`) : depuis le formulaire personnel, l'admin/RH peut lier un membre du personnel à un compte de connexion de l'application. Le sélecteur ne propose que les comptes **actifs non déjà rattachés** à un autre employé (`hr:employees:linkableUsers`, avec conservation du compte de l'employé édité) ; l'unicité est contrôlée côté IPC (création & modification) et le compte lié est affiché sur la fiche détail.
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
- **KPI configurables** (`KpiDefinition`) **calculés automatiquement** depuis les données de l'entreprise via `performance.service.ts` (`computeMetricValue`). Attribution par utilisateur (`Employee.userId`) : ventes/conventions (`Convention.agentId`), **conventions résiliées** (`Convention.type` = RESILIATION / AVENANT_RESILIATION_HERITE, LOWER_BETTER), commissions (`Commission.userId`), encaissements (`Payment` sur factures de l'agent), activités CRM (`CrmActivity.userId`), **taux de conversion prospects → clients** (`Prospect.assignedToId` — part des prospects assignés créés sur la période désormais convertis) ; attribution directe (`Employee.id`) : assiduité/pointage (`AttendanceRecord`), congés (`LeaveRequest`). Sources : `SALES / COMMISSIONS / ACCOUNTING / CRM / PROSPECTS / ATTENDANCE / LEAVE / PROJECT / MANUAL`. *(Pas de module « tickets d'assistance » → KPI `MANUAL`. `Project` n'a pas d'attribution par utilisateur → KPI `PROJECT` au niveau service ou manuel.)* Un employé **non lié à un compte utilisateur** n'a que des KPI manuels.
- **Pondération configurable par poste** (`PerformanceWeightProfile` + lignes) : chaque poste valorise différemment les KPI ; poids relatifs ramenés à 100 % au calcul du score.
- **Évaluations avec validation électronique à 3 niveaux** (`PerformanceEvaluation`, réf. `EVA-AAAA-NNNN`) : circuit `BROUILLON → SOUMISE → VALIDEE_RESPONSABLE → VALIDEE_COLLABORATEUR → VALIDEE_DIRECTION` (ou `REFUSEE`). Signatures horodatées (`managerSignedById/At`, `employeeSignedById/At`, `directionSignedById/At`). Bouton **« Calculer les KPI »** (`performance:evaluations:computeKpis`) qui injecte les valeurs réelles et la note globale ; lignes KPI/objectifs éditables (`PerformanceEvaluationLine`).
- **Historique des évaluations et plans de progrès** (`ProgressPlan` : actions, **besoins de formation**, échéance, statut) — rattachés à une évaluation, persistés (soft delete).
- **Classements multi-périodes** (`performance:rankings:get`) hebdo/mensuel/trimestriel/semestriel/annuel. **Base mixte** : score **KPI pondéré** normalisé relativement à la cohorte pour les périodes courtes (SEMAINE/MOIS), **note d'évaluation validée** pour les périodes de revue (TRIMESTRE/SEMESTRE/ANNEE), avec repli KPI. Archivage d'un classement figé (`PerformanceRankingSnapshot` + `…Entry`, `performance:rankings:snapshot` / `history` / `getSnapshot`).
- **Tableau de bord RH de performance** (`performance:dashboard`) : performances par service (département), tendance des notes validées (12 mois), top performers du mois, besoins de formation agrégés, compteurs.
- **Self-service « Mes performances »** : onglet dans « Mon espace RH » (`performance:me:overview` / `evaluation` / `ranking`), avec **signature collaborateur** (`performance:me:sign`, réservée à l'employé concerné via `Employee.userId`).

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
- `documents:import` — Importer un ou plusieurs fichiers dans la GED (rattachements optionnels, dont `crmActivityId` pour les pièces jointes d'activité CRM)
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
- `hr:contracts:create` / `update` / `delete` — Contrats de travail
- `hr:contracts:getRenderData` — Données de rendu d'un contrat (contrat + employé + entreprise) pour la génération du document côté renderer
- `hr:contractTemplates:list` / `create` / `update` / `delete` — Modèles de contrats éditables (zones En-tête/Corps/Fin/Pied, variables)
- `hr:payslips:list` / `getById` / `generate` / `updateStatus` / `delete` / `print` — Bulletins de paie
- `hr:payslipTemplates:list` / `update` — Modèles de bulletins (MODELE_1/2/3)
- `hr:payroll:getRates` / `setRates` — Taux et barème ITS de la paie
- `hr:leaveTypes:list`, `hr:leave:balance`, `hr:leaveRequests:list` / `create` / `decide` / `delete` — Congés & absences
- `hr:attendance:list` / `summary` / `bulkUpsert` — Pointage / heures (alimente la paie ; inclut heures d'arrivée/départ)
- `settings:getAttendanceQr` / `updateAttendanceQr` — Config du pointage par QR (URL de l'app web déployée, seuils, rôles autorisés) ; admin uniquement
- *(le pointage lui-même est servi hors IPC par l'app web autonome `web/` — `index.php` / `api.php`, connectée directement à MariaDB)*
- `visitors:list` / `getById` / `create` / `update` / `delete` / `stats` — Gestion des visiteurs (rôles SUPER_ADMIN/ADMIN/ASSISTANTE_DIRECTION)
- `settings:getVisitorQr` / `updateVisitorQr` — Config du QR Visiteurs (URL de l'app web, rôles, modèle) ; admin uniquement
- *(le formulaire visiteur est servi hors IPC par l'app web autonome publique `web-visiteurs/` — `index.php` / `api.php`)*
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
