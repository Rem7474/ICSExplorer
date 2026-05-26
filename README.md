# 📅 EDTEsisar — Emploi du Temps Esisar

![HTML5](https://img.shields.io/badge/html5-%23E34F26.svg?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/css3-%231572B6.svg?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/javascript-%23323330.svg?style=for-the-badge&logo=javascript&logoColor=%23F7DF1E)
![PWA](https://img.shields.io/badge/PWA-%235A0FC8.svg?style=for-the-badge&logo=pwa&logoColor=white)

Application web moderne pour consulter les emplois du temps de l'école Esisar à partir des fichiers ICS publiés sur `edt.remcorp.fr`. Architecture modulaire en ES modules natifs (zéro build, zéro dépendance), PWA installable avec support hors-ligne.

**Production :** [https://edt.remcorp.fr](https://edt.remcorp.fr)

## ✨ Fonctionnalités

### Consultation
- **Trois modes** : par groupe d'élève, par professeur, ou par salle.
- **Vue hebdomadaire** avec navigation flèches + bouton « Semaine actuelle ».
- « Semaine actuelle » est intelligent : si tous les cours de la semaine sont finis (ou vacances en cours), saute automatiquement à la semaine du prochain cours.
- **Colonne d'heures** sur le côté du planning (desktop).
- **Indicateur temps réel** : ligne rouge au niveau de l'heure actuelle.
- **Chevauchements** : deux cours en parallèle s'affichent côte à côte (layout par colonnes, algorithme de clusters).
- **Carte « Prochain cours »** sticky en haut du planning, visible sur tous les écrans.
- **10 types de cours** avec couleurs distinctes (IN, SN, PR, LV, XP, AU, EP, MAC, SP, PT) générées en HSL et variées par code matière.

### Recherche & multi-EDT
- **Recherche par salle** sur l'ensemble des EDT élèves (agrégation cross-fichiers).
- **Salles vides** à un créneau donné (sélecteur d'heure + smart-default 8h30 / 14h / maintenant).
- **Favoris** : épingle jusqu'à 8 EDT (le tien, celui d'un binôme, une salle, un prof…) — bascule en un tap.

### Données
- **Stats semaine** : total d'heures + chips par matière (triées décroissant).
- **Téléchargement ICS** du fichier brut.
- **Abonnement webcal://** : ajoute le calendrier dans Google Calendar / Apple Calendar / Outlook avec **mises à jour automatiques**.
- **Détection ETag** : toast quand l'EDT a changé côté serveur depuis la dernière consultation.
- **Notifications** opt-in 15 min avant chaque cours (via Service Worker).
- **Refresh automatique** au retour de focus et toutes les 5 min en arrière-plan.

### Expérience mobile
- **Vue swipe** : un jour par écran, scroll-snap natif, démarre sur aujourd'hui.
- **Indicateurs ronds** au-dessus du planning : tap pour sauter à un jour, le point actif suit le swipe.
- Re-render au changement d'orientation / breakpoint.

### Personnalisation
- **Mode sombre/clair** persistant.
- **Persistence** localStorage + URL partageable.
- **Modal détails** accessible (`role=dialog`, focus trap, `Escape` ferme).

### Sécurité & a11y
- Échappement HTML systématique sur tout contenu ICS injecté (anti-XSS).
- Boutons SVG avec `aria-label`.
- Évènements navigables au clavier (`Enter` / `Espace`).
- `aria-live` sur les messages d'état.

## 🚀 Installation

### Accès direct

PWA hébergée sur [https://edt.remcorp.fr](https://edt.remcorp.fr). Installable depuis Chrome / Safari (« Ajouter à l'écran d'accueil »).

### Déploiement

Application 100 % statique :

```bash
git clone https://github.com/votre-org/EDTEsisar.git
# Servir le dossier avec n'importe quel serveur statique
python -m http.server 8000
# ou
npx serve
```

Hébergement compatible : GitHub Pages, Netlify, Vercel, Apache, nginx, n'importe quel hébergeur statique. **Aucune compilation requise.**

Côté serveur il faut juste :
1. Servir le contenu du repo à la racine du domaine.
2. Exposer un dossier `/output/` contenant les fichiers `*.ics` (avec autoindex Apache/nginx **ou** un `files.json` listant les fichiers — voir [Configuration](#-configuration)).

## 🛠️ Stack technique

### Frontend (pur navigateur, zéro dépendance)
- **HTML5** sémantique.
- **CSS3** : variables CSS thématisables, Grid + Flexbox, scroll-snap natif pour le swipe mobile.
- **JavaScript Vanilla** en **ES modules natifs** (`<script type="module">`, pas de bundler).
- Parser ICS natif, fetch API, localStorage.

### PWA
- **Service Worker** avec trois stratégies de cache :
  - Network-first pour `index.html` (toujours frais en ligne)
  - Network-first pour `/output/` et `*.ics` (données dynamiques)
  - Stale-while-revalidate pour les assets JS / CSS
- **Install résilient** : `Promise.allSettled` + `cache.put` individuel — un fichier en 404 ne casse plus l'install.
- **Auto-update** : détection nouvelle version + reload via `controllerchange`.
- **Notifications** via `ServiceWorkerRegistration.showNotification()` (compatible iOS PWA 16.4+).

## 📁 Structure du projet

```
EDTEsisar/
├── index.html                # Page principale
├── styles.css                # Styles globaux
├── sw.js                     # Service Worker (cache + notifications)
├── manifest.json             # Manifest PWA
├── favicon.svg               # Icône
├── README.md
└── src/                      # ES modules
    ├── main.js               # Point d'entrée, wiring DOM + état
    ├── utils/
    │   ├── dom.js            # escapeHtml, $, setSelectOptions
    │   ├── dates.js          # formatters, getWeekStart/End, getRelevantWeekStart
    │   ├── colors.js         # HSL subject colors avec cache
    │   └── collections.js    # getUnique
    ├── ics/
    │   ├── parser.js         # parseIcs, parseIcsDate, extractTeacherNames
    │   ├── api.js            # fetchIcsText, fetchFileList (+ JSON fallback)
    │   └── aggregator.js     # getAggregatedEvents, getTeacherIndex (TTL 10min)
    ├── ui/
    │   ├── schedule.js       # Rendu calendrier + collision + dots + empty state
    │   ├── controls.js       # Cascade Année→Parcours→Type→Suite
    │   ├── modal.js          # Modal a11y (Escape, focus trap)
    │   └── toast.js          # Notifications in-app
    ├── state/
    │   └── persistence.js    # localStorage + URL params
    └── features/
        ├── empty-rooms.js    # Salles vides à un créneau
        ├── week-stats.js     # Stats hebdomadaires
        ├── favorites.js      # Pills favoris persistées
        ├── etag-watcher.js   # Détection MAJ ICS
        └── notifications.js  # Notifications opt-in via SW
```

## 🎨 Système de couleurs

10 types de matières avec couleurs HSL générées dynamiquement à partir des variables CSS de base. Le code matière (`SN123`, `IN201`…) varie la teinte / saturation / luminosité pour distinguer les modules au sein d'un même type.

| Type | Nom |
|------|-----|
| IN | Informatique |
| SN | Sciences Numériques |
| PR | Initiation Recherche |
| LV | Langue Vivante |
| XP | Experience Pro |
| AU | Automatique |
| EP | Electronique |
| MAC | MAC |
| SP | Sport |
| PT | Projet |

Les couleurs respectent automatiquement le thème (clair / sombre).

## 📱 Responsive

| Breakpoint | Layout |
|---|---|
| Desktop (> 1024px) | 5 colonnes lundi–vendredi + colonne d'heures |
| Tablette (769–1024px) | 4 colonnes + colonne d'heures |
| Petite tablette (481–768px) | 2 colonnes + colonne d'heures fine |
| Mobile (≤ 480px) | 1 jour visible, swipe horizontal entre jours, indicateurs ronds |

Bascule **automatique** au resize / rotation (matchMedia listener).

## 🔧 Configuration

### Source de données

Éditer `src/ics/api.js` :

```js
export const outputBase = "https://edt.remcorp.fr/output/";
```

### Liste des fichiers — deux options

1. **Autoindex Apache/nginx** (par défaut) — le serveur expose `/output/` comme un listing HTML, l'app extrait les liens `*.ics`.
2. **Fichier `files.json`** (fallback automatique) — si l'autoindex est désactivé, l'app tente `https://edt.remcorp.fr/output/files.json` au format :
   ```json
   ["1A-IN-eleve.ics", "1A-SN-eleve.ics", "2A-IN-eleve.ics"]
   ```
   Générable côté serveur avec un cron :
   ```bash
   cd /var/www/output && ls *.ics | jq -R -s 'split("\n") | map(select(. != ""))' > files.json
   ```

### Heures de planning

Modifier `src/ui/schedule.js` :

```js
const DEFAULT_HOUR_START = 8;
const DEFAULT_HOUR_END = 18;
```

Les heures s'élargissent automatiquement si un événement déborde.

### Couleurs

Variables CSS dans `styles.css` :

```css
:root {
  --accent: #2563eb;
  --accent-dark: #1d4ed8;
  --border-IN: #7C3AED;
  /* ... un --border-XX par type de matière */
}
```

Les couleurs des événements sont dérivées de ces bases avec des variations par code module.

### Service Worker

À chaque déploiement, bump `CACHE_NAME` dans `sw.js` :

```js
const CACHE_NAME = 'edt-v13';  // Incrémenter
```

Le SW notifie automatiquement la nouvelle version au client (toast + reload).

## 🤝 Contribution

1. Fork le projet
2. Crée une branche (`git checkout -b feature/AmazingFeature`)
3. Commit (`git commit -m 'feat: add AmazingFeature'`)
4. Push (`git push origin feature/AmazingFeature`)
5. Ouvre une Pull Request

## 📝 Roadmap

### Fait
- [x] Architecture modulaire ES modules
- [x] Mode sombre avec respect du thème système
- [x] PWA installable + support offline
- [x] Layout collision (chevauchements en colonnes)
- [x] Vue swipe mobile + indicateurs jours
- [x] Salles vides cross-EDT
- [x] Notifications 15 min avant cours (SW-based)
- [x] Favoris multi-EDT
- [x] Détection ETag (MAJ silencieuse)
- [x] Abonnement webcal://
- [x] Export ICS individuel d'un cours
- [x] Stats hebdomadaires par matière
- [x] Toasts in-app
- [x] Modal accessible (focus trap + Escape)
- [x] Auto-refresh au focus

### À faire
- [ ] Filtre par matière dans l'EDT chargé (chips cliquables)
- [ ] Print stylesheet A4 paysage
- [ ] Notifications push via serveur (vraiment background, hors « PWA en mémoire »)
- [ ] Vue mensuelle
- [ ] Tests unitaires (Vitest) sur le parser ICS
- [ ] Icône PNG dédiée pour iOS (actuellement SVG + fallback screenshot)

## 🐛 Bugs connus

Aucun bug critique connu. Pour signaler un problème, ouvrez une issue avec :
- Navigateur + OS + version
- Mode PWA installée ou navigateur ?
- Message exact des toasts d'erreur (le cas échéant)
- Capture console (F12)

## 📄 Licence

MIT — voir le fichier `LICENSE`.

## 👨‍💻 Auteur

Développé pour les étudiants de l'Esisar.

---

⭐ **Mets une étoile si le projet t'a servi !**
