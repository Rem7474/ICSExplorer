<div align="center">

# 📅 ICSExplorer

**L'application moderne, fluide et intelligente pour consulter vos emplois du temps universitaires.**

Fini la lenteur et l'austérité d'ADE Campus sur smartphone : accédez instantanément à vos cours, trouvez des salles libres en un clic, et profitez d'un affichage clair avec coloration automatique et fonctionnement hors-ligne.

[![CI Pipeline](https://github.com/Rem7474/ICSExplorer/actions/workflows/ci.yml/badge.svg)](https://github.com/Rem7474/ICSExplorer/actions/workflows/ci.yml)
[![Docker](https://img.shields.io/badge/Docker-Multi--stage%20(~25MB)-2496ED?logo=docker&logoColor=white)](docker-compose.yml)
[![Vue.js](https://img.shields.io/badge/Frontend-Vue%203%20%7C%20Vuetify%20(Material%203)-4FC08D?logo=vuedotjs&logoColor=white)](frontend/)
[![Go](https://img.shields.io/badge/Backend-Go%201.25%20%7C%20Stdlib-00ADD8?logo=go&logoColor=white)](cmd/server/)
[![Tests](https://img.shields.io/badge/Tests-Passing-brightgreen?logo=vitest&logoColor=white)](frontend/)
[![PWA](https://img.shields.io/badge/PWA-Installable%20%26%20Offline-5A0FC8?logo=pwa&logoColor=white)](frontend/public/manifest.json)
[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE)

[✨ Fonctionnalités](#-ce-que-vous-pouvez-faire) • [🧭 Guide d'utilisation](#-comment-lutiliser-au-quotidien-) • [🚀 Démarrage Rapide](#-démarrage-rapide) • [🔒 Vie Privée](#-respect-de-la-vie-privée--sécurité) • [📡 API & Docs](#-api-rest)

</div>

---

## 💡 Pourquoi ce projet ?

Les logiciels d'emplois du temps universitaires (comme **ADE Campus**) sont souvent pensés pour les gestionnaires et s'avèrent peu pratiques pour le quotidien des étudiants et des enseignants :
- 📱 **Interfaces lentes et peu adaptées aux mobiles** (menus déroulants minuscules, déconnexions régulières).
- 🎨 **Monochromie ou couleurs aléatoires** qui rendent difficile la distinction visuelle des matières.
- 🏫 **Aucun moyen simple de trouver une salle libre** entre deux cours ou pour réviser.
- 📴 **Inutilisables sans réseau** dans les amphis ou les sous-sols où la 4G/5G ne passe pas.

**ICSExplorer** transforme cette expérience en une application web moderne, réactive et installable sur votre téléphone (PWA) :
1. **Une vraie app sur téléphone** : interface Material 3 avec barre d'onglets, planning natif qui défile au doigt, installable sur l'écran d'accueil (iPhone et Android).
2. **Reconnaissance visuelle immédiate** : Algorithme de coloration déterministe qui attribue toujours la même teinte à un même cours.
3. **Universel** : Conçu à l'origine pour **Grenoble INP — Esisar**, il fonctionne désormais avec **toutes les universités équipées d'ADE Campus**.
4. **Détection des salles vides** : Vue en temps réel des salles disponibles créneau par créneau.

---

## ✨ Ce que vous pouvez faire

### 🗓️ Un planning pensé pour le téléphone
* **Vue 1 jour ou 5 jours** : la journée entière tient à l'écran sans défiler ; on passe d'un jour (ou d'une semaine) à l'autre en faisant glisser le doigt, avec un calage magnétique natif.
* **Retour à aujourd'hui** : un bouton flottant « Aujourd'hui » apparaît dès qu'on s'éloigne du jour actuel.
* **Tirer pour actualiser**, comme dans une app native.
* **Indicateur temps réel** et **chevauchements** affichés côte à côte.
* **Détails d'un cours** dans une feuille qui monte du bas : salle, enseignant, groupes, ajout au calendrier du téléphone, et raccourcis vers le planning du prof ou de la salle.
* **Menu du RU** directement dans le planning.

### 🔎 Rechercher n'importe quel planning
* **Un seul champ** pour les promos, les professeurs et les salles (accents et majuscules ignorés).
* **Favoris** en un geste (étoile dans la barre du haut), listes à parcourir par année, filière, ordre alphabétique ou bâtiment.

### 🏫 Salles libres
* Les salles disponibles **maintenant**, dans 1 h, demain matin ou à n'importe quel moment (sélecteurs natifs de date et d'heure), filtrables par bâtiment, avec l'heure jusqu'à laquelle chacune reste libre.

### 🎓 Mon planning personnel (toutes universités ADE)
* **Parcours en 3 étapes** plein écran : établissement (ou adresse de votre planning ADE) → connexion (compatible trousseau iCloud et gestionnaires de mots de passe) → choix du groupe dans l'arborescence ADE.
* Planning conservé sur l'appareil (IndexedDB) pour l'afficher même hors ligne.

### 🎨 Coloration intelligente & thème sombre
* **Même couleur pour un même cours**, semaine après semaine, et statistiques d'heures par matière (touchez une matière pour la masquer).
* **Thème clair / sombre** Material 3.

### 📱 Une PWA installable, même hors ligne
* **iPhone** : écrans de démarrage et icône dédiés, guide d'installation (*Partager → Sur l'écran d'accueil*).
* **Android** : bouton « Installer » et raccourcis (Planning, Rechercher, Salles libres) par appui long sur l'icône.
* **Hors ligne** : les plannings consultés restent accessibles grâce au Service Worker.

---

## 🧭 Comment l'utiliser au quotidien ?

L'application s'organise en quatre onglets : **Planning**, **Rechercher**, **Salles libres** et **Plus**.

### 1. Étudiant ou enseignant Esisar
1. Ouvrez **Rechercher** et tapez le nom de votre promo, d'un professeur ou d'une salle (ou parcourez les listes).
2. Le planning s'ouvre dans l'onglet **Planning** ; touchez l'étoile ⭐ pour l'ajouter à vos **favoris**.

### 2. Étudiant d'une autre université (UGA, etc.)
1. Dans **Rechercher**, touchez **Ajouter mon planning ADE**.
2. Choisissez votre établissement (ou « Autre établissement » pour coller l'adresse de votre planning ADE), connectez-vous, puis choisissez votre groupe.
3. Votre planning s'affiche ; *Plus → Actualiser mon planning ADE* le met à jour.

### 3. Trouver une salle pour réviser
1. Ouvrez **Salles libres** : la liste des salles libres maintenant s'affiche.
2. Changez le moment ou le bâtiment si besoin, puis touchez une salle pour voir son planning.

### 4. S'abonner depuis son agenda
*Plus → S'abonner dans mon agenda* (Apple Calendar, Outlook, Thunderbird) ou *Copier le lien du calendrier* pour Google Agenda.

---

## ⌨️ Raccourcis Clavier

Pour aller encore plus vite sur ordinateur :

| Raccourci | Action |
|:---|:---|
| `←` / `→` | Jour ou semaine précédent / suivant |
| `T` | Revenir à aujourd'hui (*Today*) |
| `Ctrl + K` ou `Cmd + K` | Rechercher un planning |
| `Échap` | Fermer la feuille ou la fenêtre ouverte |

---

## 🔒 Respect de votre Vie Privée & Sécurité

La confidentialité de vos données universitaires est une priorité absolue :

- 🛡️ **Aucun stockage serveur de vos identifiants personnels** : Lorsque vous utilisez l'explorateur ADE pour votre planning personnel, vos identifiants sont transmis en mémoire uniquement pour dialoguer avec votre université. Ils ne sont **jamais écrits sur le disque du serveur** et ne figurent dans **aucun fichier de log**.
- 🔒 **Mémorisation locale facultative** : Vos identifiants ne sont conservés **que** si vous cochez *"Se souvenir de moi"*, et uniquement dans le stockage local de votre propre navigateur (`localStorage`, en clair : à éviter sur un appareil partagé). Sans cette option, rien n'est conservé après le chargement du planning.
- 🧱 **Protection anti-SSRF** : Une URL ADE collée ne peut cibler qu'une adresse publique en `https://` ; les adresses internes (loopback, réseaux privés, métadonnées cloud) sont refusées, y compris après résolution DNS et redirections. Les réponses ADE sont plafonnées en taille et le parcours d'arborescence est borné.
- 🚦 **Anti-abus** : Limitation de débit par IP sur les endpoints ADE (compatible reverse proxy via `TRUSTED_PROXIES`), synchronisation manuelle désactivée sans `ADMIN_TOKEN`.
- 👤 **Exécution sécurisée** : Le serveur backend s'exécute dans un conteneur non-root (`appuser`, UID 10001) avec en-têtes de sécurité renforcés (CSP stricte, `nosniff`, `SAMEORIGIN`, HSTS derrière HTTPS). Le CORS n'est ouvert que sur les flux ICS publics.

Pour signaler une vulnérabilité, consultez [SECURITY.md](SECURITY.md).

---

## 🚀 Démarrage Rapide

### 1. Déploiement avec Docker Compose (Recommandé)

Le projet utilise l'image officielle multi-architecture publiée sur GitHub Container Registry (~25 Mo) :

```bash
# 1. Cloner le dépôt
git clone https://github.com/Rem7474/ICSExplorer.git
cd ICSExplorer

# 2. Configurer les variables d'environnement (optionnel)
cp .env.example .env

# 3. Télécharger l'image officielle et démarrer le conteneur
docker compose pull
docker compose up -d
```

> 💡 **Astuce :** Pour forcer une recompilation locale à partir des sources au lieu de l'image officielle, ajoutez le flag `--build` : `docker compose up -d --build`.

---

> 🔐 **Derrière un reverse proxy** (Traefik, Caddy, Nginx…), renseignez `TRUSTED_PROXIES` avec l'adresse du proxy : sans cela, tous les visiteurs partagent la même IP pour la limitation de débit.

### 2. Déploiement direct avec Docker CLI (Sans cloner le dépôt)

```bash
docker run -d \
  --name icsexplorer \
  --restart unless-stopped \
  -p 8080:8080 \
  -v ./data/output:/app/data/output \
  -v ./data/rooms:/app/data/rooms \
  ghcr.io/rem7474/icsexplorer:latest
```

L'application est immédiatement accessible sur **`http://localhost:8080`**.

---

### Développement Local

Si vous souhaitez contribuer ou compiler l'application localement :

**Prérequis :** Go 1.25+ (1.27 recommandé, utilisé par la CI et les images) · Node.js 22+

```bash
# 1. Lancer le frontend Vue 3 en mode dev (avec rechargement à chaud)
cd frontend
npm install
npm run dev

# 2. Lancer le backend Go (dans un second terminal)
go run ./cmd/server
```

---

## ⚙️ Configuration (`.env`)

| Variable | Description | Valeur par défaut |
|---|---|:---:|
| `PORT` | Port d'écoute du serveur HTTP | `8080` |
| `AGALAN_LOGIN` | Identifiant Agalan pour la synchronisation Esisar globale | *vide* |
| `AGALAN_PASSWORD` | Mot de passe Agalan | *vide* |
| `SYNC_INTERVAL` | Périodicité de synchronisation automatique en tâche de fond | `30m` |
| `SYNC_ON_STARTUP` | Lancer une synchronisation dès le démarrage du conteneur | `true` |
| `SYNC_CERCLE` | Intégrer les événements associatifs du Cercle des élèves | `true` |
| `SYNC_RU` | Générer le menu du RU (CROUStillant Open Data) | `true` |
| `RU_RESTAURANT_ID` / `RU_SLOT_START` / `RU_SLOT_END` | Restaurant et créneau affiché du menu RU | `1459` / `12:00` / `13:00` |
| `CONCURRENCY` | Nombre de téléchargements parallèles simultanés | `5` |
| `MAX_DATA_AGE` | Seuil d'alerte pour les données obsolètes (`/api/health`) | `24h` |
| `LOG_LEVEL` | Niveau de verbosité (`debug`, `info`, `warn`, `error`) | `info` |
| `ADMIN_TOKEN` | Jeton requis pour déclencher `POST /api/sync` (vide = synchro manuelle désactivée) | *vide* |
| `TRUSTED_PROXIES` | IP/CIDR des reverse proxies autorisés à fournir `X-Forwarded-For` / `X-Forwarded-Proto` | *vide* |

---

## 📡 API REST

Le backend Go expose une API REST performante permettant d'interroger la santé du service, d'explorer les plannings ADE Campus et de télécharger les flux iCalendar (RFC 5545).

👉 **[Consulter la documentation complète de l'API REST](docs/api.md)**

Principaux points d'entrée :
- `GET /api/health` : État de santé et fraîcheur des données (`200 OK` / `503 Service Unavailable`)
- `GET /api/status` : Métriques du serveur, configuration et statistiques de synchronisation
- `GET /api/files` & `GET /api/rooms` : Liste des calendriers étudiants et de salles disponibles
- `GET /api/universities` : Liste des universités configurées pour le planning personnel
- `POST /api/tree` : Exploration dynamique de l'arborescence ADE
- `POST /api/personal-calendar` : Récupération à la volée d'un emploi du temps personnel
- `POST /api/sync` : Déclenchement manuel d'une synchronisation globale (nécessite `ADMIN_TOKEN`)
- `GET /output/{fichier}.ics` & `GET /rooms/{fichier}.ics` : Téléchargement direct des calendriers ICS

---

## 🧪 Tests & Qualité

Le projet applique une politique de tests rigoureuse assurant une stabilité maximale :

```bash
# Exécuter les tests unitaires du frontend (Vitest)
cd frontend && npm test

# Vérifier le linter (0 warning, 0 error)
npm run lint

# Tests de bout en bout (Playwright) sur l'app réelle servie par le backend Go :
# iPhone/Safari (WebKit), Android (Chromium) et desktop
npx playwright install webkit chromium   # une seule fois
npm run test:e2e

# Exécuter les tests du backend Go avec détection de concurrence de données
go test -v -race ./internal/... ./cmd/...
```

- ✅ **Suite complète de tests unitaires frontend** couvrant le planning, la navigation, la recherche, les salles libres, le parcours ADE et le cache hors ligne.
- ✅ **100% des paquets Go couverts** par des tests automatisés avec race detector.
- ✅ **Tests de bout en bout Playwright** : parcours clés (planning, recherche, retour navigateur, salles) et absence de débordement horizontal, sur WebKit (iPhone), Chromium (Android) et desktop, avec des données générées pour la semaine en cours.
- ✅ **Scan de sécurité Trivy** intégré au pipeline GitHub Actions sur chaque image Docker produite.

---

## 📄 Licence

Ce projet est distribué sous licence **GPL-3.0**. Consultez le fichier [LICENSE](LICENSE) pour plus de détails.

---

<div align="center">
  Fait avec ❤️ pour les étudiants et enseignants de Grenoble INP - Esisar et d'ailleurs.
</div>