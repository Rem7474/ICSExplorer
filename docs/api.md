# 📡 Documentation de l'API REST ICSExplorer

L'API de **ICSExplorer** est servie par le backend Go natif (port par défaut `8080`). Elle fournit les endpoints nécessaires pour interroger la santé du service, lister les emplois du temps pré-générés, explorer les arborescences ADE Campus et générer des flux iCalendar (RFC 5545) à la volée.

---

## 📋 Informations Générales

- **En-têtes de sécurité automatiques** :
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: SAMEORIGIN`
  - `Referrer-Policy: strict-origin-when-cross-origin`
- **CORS** : Tous les endpoints autorisent les requêtes cross-origin (`Access-Control-Allow-Origin: *`, `GET, POST, OPTIONS`).
- **Protection Rate-Limiting** : Les endpoints `/api/tree` et `/api/personal-calendar` appliquent une limite de **120 requêtes / minute par adresse IP** (renvoie HTTP `429 Too Many Requests` en cas de dépassement).
- **Stateless & Confidentialité** : Les identifiants transmis aux endpoints ADE ne sont jamais stockés sur disque ni écrits dans les logs.

---

## 🗺️ Résumé des Endpoints

| Méthode | Route | Description | Auth requise |
|:---:|---|---|:---:|
| `GET` | [`/api/health`](#get-apihealth) | Contrôle de santé et fraîcheur des données | Non |
| `GET` | [`/api/status`](#get-apistatus) | Statistiques de synchronisation et configuration | Non |
| `GET` | [`/api/files`](#get-apifiles) | Liste des fichiers ICS de promotions/groupes | Non |
| `GET` | [`/api/rooms`](#get-apirooms) | Liste des fichiers ICS de salles | Non |
| `GET` | [`/api/universities`](#get-apiuniversities) | Liste des universités pré-configurées pour ADE | Non |
| `POST` | [`/api/tree`](#post-apitree) | Exploration hiérarchique de l'arborescence ADE | Non (Rate-limit) |
| `POST` | [`/api/personal-calendar`](#post-apipersonal-calendar) | Génération à la volée d'un calendrier ADE personnel | Non (Rate-limit) |
| `POST` | [`/api/sync`](#post-apisync) | Déclenchement manuel d'une synchronisation globale | Optionnelle (`ADMIN_TOKEN`) |
| `GET` | [`/output/{fichier}`](#get-outputfichier) | Téléchargement direct d'un flux ICS ou `files.json` | Non |
| `GET` | [`/rooms/{fichier}`](#get-roomsfichier) | Téléchargement direct d'un calendrier de salle ICS | Non |

---

## 🔍 Détail des Endpoints

### `GET /api/health`

Contrôle de santé du service utilisé pour les sondes Docker, Kubernetes ou de monitoring externe.

- **Codes de retour :**
  - `200 OK` : Le service est sain et les données sont fraîches (âge < `MAX_DATA_AGE`).
  - `503 Service Unavailable` : Données absentes, périmées ou dernière synchronisation en échec critique.

#### Réponse (`200 OK`) :
```json
{
  "status": "healthy",
  "files_checked": 42,
  "last_sync": "2026-09-08T18:00:00Z",
  "data_age": "15m30s",
  "errors": []
}
```

---

### `GET /api/status`

Fournit les métriques d'exécution du serveur, les statistiques du synchro-tâche de fond et la configuration active.

#### Réponse (`200 OK`) :
```json
{
  "sync_stats": {
    "is_syncing": false,
    "last_sync_time": "2026-09-08T18:00:00Z",
    "last_sync_duration": "4.21s",
    "total_syncs": 28,
    "failed_syncs": 0,
    "files_generated": 42,
    "errors": []
  },
  "health_report": {
    "status": "healthy",
    "files_checked": 42,
    "last_sync": "2026-09-08T18:00:00Z",
    "data_age": "15m30s"
  },
  "config": {
    "academic_year": "2025-2026",
    "sync_interval": "30m0s",
    "sync_cercle": true,
    "concurrency": 5,
    "max_data_age": "24h0m0s"
  }
}
```

---

### `GET /api/files`

Retourne la liste alphabétique des calendriers de promotions / filières générés et prêts au téléchargement.

#### Réponse (`200 OK`) :
```json
[
  "1A.ics",
  "2A.ics",
  "3A_CS.ics",
  "3A_SEI.ics",
  "4A_CS.ics"
]
```

---

### `GET /api/rooms`

Retourne la liste alphabétique des emplois du temps de salles générés dans le dossier `data/rooms`.

#### Réponse (`200 OK`) :
```json
[
  "B017.ics",
  "B112.ics",
  "C101.ics",
  "D204.ics"
]
```

---

### `GET /api/universities`

Renvoie la liste des universités pré-enregistrées pour la fonctionnalité « Planning Personnel ADE ».

#### Réponse (`200 OK`) :
```json
[
  {
    "id": "grenoble-inp",
    "name": "Grenoble INP (Esisar / Ense3 / Phelma / Ensimag)",
    "description": "Authentification Agalan requise"
  },
  {
    "id": "uga",
    "name": "Université Grenoble Alpes (UGA)",
    "description": "Identifiants UGA requis"
  }
]
```

---

### `POST /api/tree`

Explore l'arborescence ADE Campus d'un établissement pour permettre à l'utilisateur de naviguer dans les dossiers (promotions, filières, groupes TD/TP) et sélectionner son calendrier.

- **Rate-limit** : 120 requêtes / min par IP.
- **Taille maximale du corps** : 16 KiB.

#### Corps de la requête (`application/json`) :
```json
{
  "universityId": "grenoble-inp",
  "branchPath": ["102", "1450"],
  "category": "trainee",
  "login": "monLoginAgalan",
  "password": "monPassword"
}
```
*Note : Il est possible de renseigner `adeUrl` au lieu de `universityId` si l'utilisateur utilise un lien direct ADE.*

#### Réponse (`200 OK`) :
```json
{
  "nodes": [
    {
      "id": "1451",
      "name": "Groupe TD 1",
      "isLeaf": true,
      "category": "trainee"
    },
    {
      "id": "1452",
      "name": "Groupe TD 2",
      "isLeaf": true,
      "category": "trainee"
    }
  ]
}
```

- **Codes d'erreur possibles :**
  - `400 Bad Request` : Requête invalide ou paramètres manquants.
  - `401 Unauthorized` : Identifiants ADE incorrects.
  - `429 Too Many Requests` : Quota de requêtes atteint.
  - `502 Bad Gateway` : Serveur ADE distant injoignable.

---

### `POST /api/personal-calendar`

Récupère et nettoie en temps réel le planning ADE personnel d'un étudiant ou d'un enseignant, et le renvoie au format normalisé iCalendar RFC 5545 (`text/calendar`).

- **Rate-limit** : 120 requêtes / min par IP.
- **Taille maximale du corps** : 16 KiB.

#### Corps de la requête (`application/json`) :
```json
{
  "universityId": "grenoble-inp",
  "branchPath": ["102", "1450", "1451"],
  "resourceId": "1451",
  "login": "monLoginAgalan",
  "password": "monPassword"
}
```
*Ou avec une URL directe ADE contenant un jeton d'accès :*
```json
{
  "adeUrl": "https://ade.mon-universite.fr/jsp/custom/modules/plannings/direct?data=xxx"
}
```

#### Réponse (`200 OK`) :
- **Content-Type** : `text/calendar; charset=utf-8`
```ics
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//ICSExplorer//FR
CALSCALE:GREGORIAN
BEGIN:VEVENT
SUMMARY:Algorithmique Avancée
DTSTART:20260910T080000Z
DTEND:20260910T100000Z
LOCATION:B112
END:VEVENT
END:VCALENDAR
```

- **Codes d'erreur possibles :**
  - `400 Bad Request` : URL non reconnue ou `resourceId` manquant.
  - `401 Unauthorized` : Identifiants ADE rejetés.
  - `429 Too Many Requests` : Limite d'appels par minute atteinte.
  - `502 Bad Gateway` : Échec de communication avec l'instance ADE distante.

---

### `POST /api/sync`

Déclenche immédiatement un cycle de synchronisation global des calendriers en tâche de fond.

- **Authentification** : Si la variable d'environnement `ADMIN_TOKEN` est définie sur le serveur, l'en-tête suivant est requis :
  ```http
  Authorization: Bearer <ADMIN_TOKEN>
  ```

#### Exemple `curl` :
```bash
curl -X POST http://localhost:8080/api/sync \
  -H "Authorization: Bearer mon_token_secret"
```

#### Réponse (`202 Accepted`) :
```json
{
  "message": "synchronization started in background"
}
```

- **Codes d'erreur possibles :**
  - `401 Unauthorized` : Token manquant ou invalide.
  - `409 Conflict` : Un cycle de synchronisation est déjà en cours d'exécution.
  - `405 Method Not Allowed` : Méthode autre que `POST`.

---

### `GET /output/{fichier}`

Sert les fichiers statiques de calendriers étudiants situés dans `data/output/` avec en-têtes de cache optimisés (`Cache-Control: public, max-age=300, must-revalidate`).

- `GET /output/` : Génère un auto-index HTML sécurisé listant tous les calendriers disponibles.
- `GET /output/files.json` : Fournit la liste au format JSON.
- `GET /output/{promo}.ics` : Télécharge le fichier `.ics` au standard RFC 5545.

---

### `GET /rooms/{fichier}.ics`

Sert les calendriers ICS des salles de cours situés dans `data/rooms/`.

- `GET /rooms/{nom_salle}.ics` : Télécharge l'emploi du temps de la salle correspondante.
