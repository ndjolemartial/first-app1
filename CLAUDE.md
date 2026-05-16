# CLAUDE.md — Application de Gestion Immobilière

> Fichier de configuration pour Claude Code.

---

## 🏢 Vue d'ensemble du projet

**Nom du projet :** Afrikimmo-App  
**Type :** Application de bureau (Desktop) multiplateforme  
**Stack principale :** Electron + React + TypeScript + MariaDB  
**Objectif :** Système de gestion immobilière complet couvrant la relation client, les biens, les contrats, la comptabilité et la communication.

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
│   │   │   ├── contracts.ipc.ts
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
│   │   │   ├── contracts/
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
  contracts   Contract[]    @relation("AgentContracts")
  notes       Note[]
}

enum UserRole {
  SUPER_ADMIN
  ADMIN
  MANAGER
  AGENT
  ACCOUNTANT
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
  contracts       Contract[]
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
  contracts       Contract[]
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

// ── CONTRATS ──────────────────────────────────────────────────
model Contract {
  id              Int              @id @default(autoincrement())
  uuid            String           @unique @default(cuid())
  reference       String           @unique  // Ex: CT-2026-0007
  type            ContractType
  status          ContractStatus   @default(DRAFT)
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
  agent           User?            @relation("AgentContracts", fields: [agentId], references: [id])
  invoices        Invoice[]
  documents       Document[]
  activities      CrmActivity[]
  installments    SaleInstallment[]
}

enum ContractType {
  RENTAL_UNFURNISHED
  RENTAL_FURNISHED
  SALE
  MANAGEMENT
  COMMERCIAL_LEASE
}

enum ContractStatus {
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
  contractId      Int?
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
  contract        Contract?       @relation(fields: [contractId], references: [id])
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
  contractId         Int
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

  contract           Contract            @relation(fields: [contractId], references: [id])
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
  contractId    Int?
  createdAt     DateTime          @default(now())
  updatedAt     DateTime          @updatedAt

  user          User?             @relation(fields: [userId], references: [id])
  prospect      Prospect?         @relation(fields: [prospectId], references: [id])
  client        Client?           @relation(fields: [clientId], references: [id])
  owner         Owner?            @relation(fields: [ownerId], references: [id])
  property      Property?         @relation(fields: [propertyId], references: [id])
  contract      Contract?         @relation(fields: [contractId], references: [id])
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
  category    String?   // "contrat", "diagnostic", "identité", "documents sur biens immobiliers"…
  clientId    Int?
  ownerId     Int?
  propertyId  Int?
  contractId  Int?
  uploadedAt  DateTime  @default(now())

  client      Client?   @relation(fields: [clientId], references: [id])
  owner       Owner?    @relation(fields: [ownerId], references: [id])
  property    Property? @relation(fields: [propertyId], references: [id])
  contract    Contract? @relation(fields: [contractId], references: [id])
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
  entityRef     String            // Référence lisible (ex: CT-2026-0007, CLI-00042)
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
  CONTRACT
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
  CONTRAT_TERMINE
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
| CRUD Prospects          | ✅          | ✅    | ✅      | ✅    | ❌         | 👁️       |
| CRUD Clients            | ✅          | ✅    | ✅      | ✅    | 👁️         | 👁️       |
| CRUD Propriétaires      | ✅          | ✅    | ✅      | ✅    | 👁️         | 👁️       |
| CRUD Biens              | ✅          | ✅    | ✅      | ✅    | 👁️         | 👁️       |
| CRUD Contrats           | ✅          | ✅    | ✅      | ❌    | 👁️         | 👁️       |
| Comptabilité (lecture)  | ✅          | ✅    | ✅      | ❌    | ✅         | 👁️       |
| Comptabilité (écriture) | ✅          | ✅    | ✅     | ❌    | ✅         | ❌       |
| Envoyer emails/SMS      | ✅          | ✅    | ✅      | ✅    | ❌         | ❌       |
| Archiver une entité     | ✅          | ✅    | ✅      | ❌    | ❌         | ❌       |
| Restaurer une archive   | ✅          | ✅    | ❌      | ❌    | ❌         | ❌       |
| Suppr. définitive arch. | ✅          | ❌    | ❌      | ❌    | ❌         | ❌       |
| Gérer politiques arch.  | ✅          | ✅    | ❌      | ❌    | ❌         | ❌       |
| Consulter les archives  | ✅          | ✅    | ✅      | 👁️    | 👁️         | ❌       |
| Tableau de bord         | ✅          | ✅    | ✅      | ✅    | ✅         | ✅       |
| Paramètres app          | ✅          | ✅    | ❌      | ❌    | ❌         | ❌       |

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
- Fiche client complète : infos personnelles, documents KYC, contrats liés, historique paiements
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
- Fiche bien complète : photos (galerie avec drag-and-drop), caractéristiques, diagnostics DPE
- Carte interactive (si géocodage disponible)
- Historique des locations/ventes (cash ou par échéances)
- Gestion des documents associés (diagnostics, actes…)
- Statut en temps réel (disponible, loué, vendu, sous option…)
- Indicateur du mode de paiement appliqué (cash ou modalité d'échéances)
- Export fiche bien en PDF (pour publication)
- Export csv et PDF de listes de biens par filtre 

### Module 6 — Gestion des contrats

**Route :** `/contracts`  
**Fonctionnalités :**
- Génération de contrats PDF (baux meublés/non meublés, compromis de vente, avenants de prolongation de délai, avenants de changement de site …)
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
  - Remboursement anticipé : annulation des échéances restantes et clôture du contrat
  - Export PDF du tableau d'échéances pour le client

### Module 7 — Comptabilité

**Route :** `/accounting`  
**Fonctionnalités :**
- Génération et envoi des factures (loyers, honoraires, charges)
- Suivi des paiements (encaissements, impayés)
- **Suivi des ventes par échéances** :
  - Vue globale des contrats de vente en cours (cash vs échéances)
  - Tableau de bord par contrat : montant total, encaissé, restant dû, nombre d'échéances réglées / restantes
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
- Alertes actives : contrats expirant, loyers en retard, documents manquants
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
- Envoi manuel depuis n'importe quelle fiche (client, contrat, prospect)
- Campagnes de relance automatiques (configurer déclencheurs et délais)
- Historique de toutes les communications par entité
- Configuration SMTP (email) et API SMS (Twilio / OVH / Brevo)
- File d'attente d'envoi avec retry en cas d'échec
- Prévisualisation avant envoi

### Module 10 — CRM

**Route :** `/crm`  
**Fonctionnalités :**
- Agenda partagé : rendez-vous, visites, rappels (vue jour/semaine/mois)
- Activités : notes, appels, tâches, tous rattachables à n'importe quelle entité
- Tableau des tâches à faire (style kanban ou liste)
- Alertes et rappels (notification système Electron)
- Rapport d'activité par agent (appels passés, visites réalisées, conversions)
- Scoring des prospects basé sur l'activité CRM

### Module 11 — Archivage

**Route :** `/archiving`  
**Fonctionnalités :**
- Vue centralisée de toutes les entités archivées avec filtres par type (client, contrat, bien, prospect…)
- Archivage manuel depuis n'importe quelle fiche avec saisie obligatoire du motif
- Snapshot JSON complet de l'entité au moment de l'archivage (traçabilité immuable)
- Restauration d'un élément archivé vers son module d'origine (avec vérification des conflits)
- Suppression définitive après expiration de la durée de rétention (SUPER_ADMIN uniquement)
- Recherche fulltext dans les archives (référence, nom, notes)
- Politiques d'archivage automatique configurables (ex : contrats terminés depuis > 365 jours)
- Tableau de bord des archives : volume par type, archives en attente de suppression, historique
- Export des archives en CSV et PDF (avec horodatage et identité de l'archiveur)
- Journal d'audit complet : qui a archivé/restauré/supprimé, quand et pourquoi
- Alertes de rétention : notification avant suppression définitive automatique (J-30, J-7)
- Conformité RGPD : suppression définitive à la demande (droit à l'oubli)

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
- `contracts:generateInstallments` — Générer le tableau d'échéances d'un contrat de vente
- `contracts:getInstallments` — Récupérer les échéances d'un contrat
- `accounting:payInstallment` — Enregistrer le paiement d'une échéance
- `accounting:getOverdueInstallments` — Lister les échéances en retard
- `accounting:getUpcomingInstallments` — Lister les échéances à venir (filtre par jours)

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
| E2E           | Playwright             | Parcours critiques (connexion, contrat…) | Parcours clés    |

### Cas de test prioritaires

1. Authentification (connexion, permissions, session expirée)
2. Création d'un prospect → conversion en client
3. Création d'un contrat de location complet
4. Génération et envoi d'une quittance de loyer
5. Calcul de révision de loyer (IRL)
6. Envoi d'email / SMS de relance
7. Export PDF d'un contrat

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
8. **Contrats** — Création, workflow, génération PDF
9. **Comptabilité** — Factures, paiements, relances
10. **Communication** — Templates, envoi email/SMS
11. **CRM** — Agenda, activités, tâches
12. **Archivage** — Politiques, archivage manuel, restauration, conformité RGPD
13. **Dashboard** — KPIs, graphiques, exports
14. **Tests & QA** — Couverture, parcours E2E
15. **Packaging** — Build distributable (Windows, Linux, macOS)

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

*Dernière mise à jour : Mai 2026 — Afrikimmo-app v1.0 (ajout module Archivage + gestion paiements par échéances)*
