<div align="center">

# 📅 ICSExplorer

**L'application moderne, fluide et intelligente pour consulter vos emplois du temps universitaires.**

Fini la lenteur et l'austérité d'ADE Campus sur smartphone : accédez instantanément à vos cours, trouvez des salles libres en un clic, et profitez d'un affichage clair avec coloration automatique et fonctionnement hors-ligne.

[![CI Pipeline](https://github.com/Rem7474/ICSExplorer/actions/workflows/ci.yml/badge.svg)](https://github.com/Rem7474/ICSExplorer/actions/workflows/ci.yml)
[![Docker](https://img.shields.io/badge/Docker-Multi--stage%20(~25MB)-2496ED?logo=docker&logoColor=white)](docker-compose.yml)
[![Vue.js](https://img.shields.io/badge/Frontend-Vue%203%20%7C%20PrimeVue%204-4FC08D?logo=vuedotjs&logoColor=white)](frontend/)
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
1. **Instantanéité & Fluidité** : Calendrier hebdomadaire pensé pour mobile et desktop, avec navigation au swipe tactile ou au clavier.
2. **Reconnaissance visuelle immédiate** : Algorithme de coloration déterministe qui attribue toujours la même teinte à un même cours.
3. **Universel** : Conçu à l'origine pour **Grenoble INP — Esisar**, il fonctionne désormais avec **toutes les universités équipées d'ADE Campus**.
4. **Détection des salles vides** : Vue en temps réel des salles disponibles créneau par créneau.

---

## ✨ Ce que vous pouvez faire

### 🗓️ Un Calendrier pensé pour vous
* **Vue semaine fluide & intuitive** : Grille élégante propulsée par **PrimeVue 4** et **PrimeIcons**, avec calcul automatique des plages horaires réelles de la semaine.
* **Indicateur temps réel** : Ligne rouge animée marquant la minute exacte de la journée.
* **Gestion intelligente des chevauchements** : Les cours parallèles ou options s'affichent côte-à-côte sans débordement.
* **Navigation ultra-rapide** : Changement de semaine au swipe mobile, saut direct au jour d'aujourd'hui, ou via les touches fléchées `←` / `→`.
* **Détails en un clic** : Modal moderne affichant les détails complets (salle, enseignant, description) avec boutons de rebond direct pour voir l'emploi du temps du prof ou de la salle.

### 🎨 Coloration Intelligente & Déterministe
* **Attribution automatique par matière** : Informatique, Mathématiques, Électronique, Management, Langues, etc.
* **Cohérence absolue** : Vos cours d'algorithmique ou d'anglais auront **toujours exactement la même couleur**, semaine après semaine.
* **Thème Sombre / Thème Clair natif** : Bascule en un clic avec adaptation fine des contrastes et des transparences.

### 🎓 Mon Planning Personnel (Toutes Universités ADE)
* **Connexion simplifiée** : Choisissez votre établissement dans la liste ou collez simplement l'URL directe de votre planning ADE.
* **Explorateur d'arborescence visuel** : Naviguez dans les dossiers de votre université (filières, promotions, groupes de TD/TP) grâce à un fil d'Ariane interactif et choisissez directement votre groupe.
* **Mise à jour d'un clic** : Actualisez votre emploi du temps personnel à tout moment via le bouton de synchronisation rapide.

### 🏫 Détecteur de Salles Vides
* **Fini la recherche à l'aveugle** : Choisissez un jour et un horaire pour afficher instantanément la liste des salles non occupées de l'école.
* **Filtrage immédiat** : Isolez les salles par étage, bâtiment ou capacité.

### 📊 Statistiques & Filtres de semaine
* **Bilan d'heures par matière** : Visualisez en un coup d'œil le volume horaire de chaque discipline pour votre semaine.
* **Filtrage par clic** : Cliquez sur une matière pour masquer temporairement les autres cours et vous concentrer sur vos priorités.

### 📱 Installable en PWA (Mode Hors-ligne)
* **Installez l'application** directement sur l'écran d'accueil de votre iPhone, Android ou ordinateur (icônes adaptatives maskable).
* **Consultation hors-ligne complète** : Grâce au Service Worker, vos plannings consultés restent accessibles même sans aucune connexion Internet.

---

## 🧭 Comment l'utiliser au quotidien ?

### 1. Étudiant ou Enseignant Esisar
1. Rendez-vous sur l'application.
2. Choisissez votre **Année** (ex: *3A - CS*), votre **Groupe** ou sélectionnez un **Professeur** / une **Salle**.
3. Cliquez sur l'étoile ⭐ pour l'ajouter à vos **Favoris** et le retrouver immédiatement au prochain lancement !

### 2. Étudiant d'une autre université (UGA, etc.)
1. Cliquez sur l'onglet **Mon Planning ADE** (ou l'icône diplôme).
2. Choisissez votre université dans la liste (ou collez votre lien de planning direct ADE).
3. Entrez vos identifiants si demandé, puis explorez l'arbre pour sélectionner votre promotion ou groupe.
4. Votre calendrier s'affiche instantanément !

### 3. Trouver une salle de révision libre
1. Cliquez sur le bouton **Salles Vides** dans la barre d'outils.
2. Sélectionnez l'heure actuelle ou l'horaire souhaité.
3. Obtenez instantanément toutes les salles disponibles à cet instant.

---

## ⌨️ Raccourcis Clavier

Pour aller encore plus vite sur ordinateur :

| Raccourci | Action |
|:---|:---|
| `←` | Semaine précédente |
| `→` | Semaine suivante |
| `T` | Revenir à la semaine actuelle (*Today*) |
| `Ctrl + K` ou `Cmd + K` | Ouvrir la recherche rapide instantanée |
| `Échap` | Fermer les fenêtres modales ouvertes |

---

## 🔒 Respect de votre Vie Privée & Sécurité

La confidentialité de vos données universitaires est une priorité absolue :

- 🛡️ **Aucun stockage serveur de vos identifiants personnels** : Lorsque vous utilisez l'explorateur ADE pour votre planning personnel, vos identifiants sont transmis en mémoire uniquement pour dialoguer avec votre université. Ils ne sont **jamais écrits sur le disque du serveur** et ne figurent dans **aucun fichier de log**.
- 🔒 **Mémorisation locale facultative** : L'option *"Se souvenir de moi"* enregistre vos identifiants uniquement dans le stockage local de votre propre navigateur (`localStorage`), sous votre contrôle total.
- 👤 **Exécution sécurisée** : Le serveur backend s'exécute dans un conteneur non-root (`appuser`, UID 10001) avec headers de sécurité renforcés (`nosniff`, `SAMEORIGIN`, `strict-origin`).

---

## 🚀 Démarrage Rapide

### Déploiement en 1 minute avec Docker (Recommandé)

Le projet est fourni prêt à l'emploi avec une configuration **Docker Compose** optimisée (~25 Mo d'image finale) :

```bash
# 1. Cloner le dépôt
git clone https://github.com/Rem7474/ICSExplorer.git
cd ICSExplorer

# 2. Configurer les variables d'environnement (optionnel pour Esisar global)
cp .env.example .env

# 3. Démarrer le conteneur
docker compose up -d
```

L'application est immédiatement accessible sur **`http://localhost:8080`**.

---

### Développement Local

Si vous souhaitez contribuer ou compiler l'application localement :

**Prérequis :** Go 1.25+ · Node.js 20+ / 22+

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
| `CONCURRENCY` | Nombre de téléchargements parallèles simultanés | `5` |
| `MAX_DATA_AGE` | Seuil d'alerte pour les données obsolètes (`/api/health`) | `24h` |
| `LOG_LEVEL` | Niveau de verbosité (`debug`, `info`, `warn`, `error`) | `info` |
| `ADMIN_TOKEN` | Jeton d'autorisation optionnel pour déclencher `/api/sync` | *vide* |

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
- `POST /api/sync` : Déclenchement manuel d'une synchronisation globale
- `GET /output/{fichier}.ics` & `GET /rooms/{fichier}.ics` : Téléchargement direct des calendriers ICS

---

## 🧪 Tests & Qualité

Le projet applique une politique de tests rigoureuse assurant une stabilité maximale :

```bash
# Exécuter les tests unitaires du frontend (Vitest)
cd frontend && npm test

# Vérifier le linter (0 warning, 0 error)
npm run lint

# Exécuter les tests du backend Go avec détection de concurrence de données
go test -v -race ./internal/... ./cmd/...
```

- ✅ **Suite complète de tests unitaires frontend** couvrant le calendrier, la navigation, le découpage multi-jours, les calculs d'horaires et les modales PrimeVue.
- ✅ **100% des paquets Go couverts** par des tests automatisés avec race detector.
- ✅ **Scan de sécurité Trivy** intégré au pipeline GitHub Actions sur chaque image Docker produite.

---

## 📄 Licence

Ce projet est distribué sous licence **GPL-3.0**. Consultez le fichier [LICENSE](LICENSE) pour plus de détails.

---

<div align="center">
  Fait avec ❤️ pour les étudiants et enseignants de Grenoble INP - Esisar et d'ailleurs.
</div>