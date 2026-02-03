# 📅 EDTEsisar - Emploi du Temps Esisar

![HTML5](https://img.shields.io/badge/html5-%23E34F26.svg?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/css3-%231572B6.svg?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/javascript-%23323330.svg?style=for-the-badge&logo=javascript&logoColor=%23F7DF1E)
![PWA](https://img.shields.io/badge/PWA-%235A0FC8.svg?style=for-the-badge&logo=pwa&logoColor=white)

Application web moderne pour consulter et gérer les emplois du temps de l'école Esisar. Interface responsive avec mode sombre, support hors-ligne et fonctionnalités avancées de recherche.

## ✨ Fonctionnalités

### 📱 Interface Moderne
- **Design responsive** adapté à tous les écrans (mobile, tablette, desktop)
- **Mode sombre/clair** avec préférence système automatique
- **PWA** : Installation possible sur mobile et desktop
- **Support hors-ligne** grâce au Service Worker

### 📆 Gestion du Planning
- **Vue hebdomadaire** avec navigation fluide
- **Affichage dynamique des heures** : adaptation automatique sur mobile selon les cours de la journée
- **Indicateur temps réel** : ligne rouge montrant l'heure actuelle
- **Prochain cours** : carte dédiée affichant le cours à venir
- **10 types de cours** avec codes couleur distincts (IN, SN, PR, LV, XP, AU, EP, MAC, SP, PT)

### 🔍 Recherche Avancée
- **Recherche de salles** : trouvez l'emploi du temps d'une salle spécifique
- **Salles vides** : identifiez les salles disponibles actuellement
- **Filtres** : par année, filière, type de groupe et fichier ICS

### 📤 Export & Partage
- **Export ICS** : téléchargez votre planning au format calendrier
- **Partage direct** : partagez votre configuration via URL

### 🎨 Expérience Utilisateur
- **Optimisation mobile** :
  - Jour actuel placé en premier
  - Police agrandie pour meilleure lisibilité
  - Section recherche repositionnée
  - Espacement adapté pour le tactile
- **Modal détails** : cliquez sur un cours pour voir toutes les informations
- **Persistance** : vos préférences sont sauvegardées localement

## 🚀 Installation

### Accès Direct

L'application est déployée et accessible sur : **[https://edt.remcorp.fr](https://edt.remcorp.fr)**

### Déploiement

L'application est entièrement statique et peut être déployée sur :
- GitHub Pages
- Netlify
- Vercel
- Tout hébergement statique

Aucune compilation ou build n'est nécessaire.

## 🛠️ Technologies

### Frontend
- **HTML5** : Structure sémantique
- **CSS3** : 
  - Variables CSS pour thématisation
  - Grid & Flexbox pour layouts
  - Media queries pour responsive
  - Gradients pour optimisation rendering
- **JavaScript Vanilla** : Aucune dépendance externe
  - Parsing ICS natif
  - LocalStorage pour persistance
  - Fetch API pour requêtes HTTP

### PWA
- **Service Worker** : Cache intelligent pour fonctionnement hors-ligne
- **Web App Manifest** : Installation sur l'écran d'accueil
- **Cache Strategy** : Cache-first avec fallback réseau

## 📁 Structure du Projet

```
EDTEsisar/
├── index.html          # Page principale
├── styles.css          # Styles globaux (751 lignes)
├── script.js           # Logique applicative (964 lignes)
├── sw.js              # Service Worker pour PWA
├── manifest.json      # Manifest PWA
├── favicon.svg        # Icône de l'application
└── README.md          # Documentation
```

## 🎨 Système de Couleurs

L'application utilise 10 types de cours avec des couleurs distinctes :

| Type | Nom | Couleur (Light) | Couleur (Dark) |
|------|-----|-----------------|----------------|
| IN | Informatique | Violet clair | Violet foncé |
| SN | Sciences Numériques | Cyan | Bleu océan |
| PR | Initiation Recherche | Rouge clair | Rouge foncé |
| LV | Langue Vivante | Vert clair | Vert foncé |
| XP | Experience Pro | Jaune | Ambre |
| AU | Automatique | Orange clair | Orange foncé |
| EP | Electronique | Bleu clair | Bleu foncé |
| MAC | MAC | Vert lime | Vert émeraude |
| SP | Sport | Rose | Magenta |
| PT | Projet | Violet pastel | Violet profond |

## 📱 Responsive Design

### Desktop (> 1024px)
- Vue 5 colonnes (lundi - vendredi)
- Planning fixe 8h-18h
- Navigation semaine complète

### Tablette (481px - 1024px)
- Vue 2-4 colonnes selon largeur
- Adaptation des espacements

### Mobile (≤ 480px)
- Vue 1 colonne
- Jour actuel en premier
- **Heures dynamiques** : affichage adapté aux cours réels
- Police agrandie pour lisibilité
- Contrôles tactiles optimisés

## 🔧 Configuration

### Modifier les sources de données

Éditer `script.js` :
```javascript
const outputBase = "https://edt.remcorp.fr/output/";
```

### Ajuster les heures de planning

Les heures sont maintenant dynamiques sur mobile, mais peuvent être modifiées :
```javascript
let HOUR_START = 8;  // Heure début desktop
let HOUR_END = 18;   // Heure fin desktop
```

### Personnaliser les couleurs

Modifier les variables CSS dans `styles.css` :
```css
:root {
  --accent: #2563eb;
  --color-IN: #F0E8F8;
  /* ... autres couleurs */
}
```

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à :

1. Fork le projet
2. Créer une branche (`git checkout -b feature/AmazingFeature`)
3. Commit vos changements (`git commit -m 'Add AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

## 📝 Roadmap

- [ ] Filtres avancés (par enseignant, type de cours)
- [ ] Notifications push pour prochains cours
- [ ] Synchronisation avec Google Calendar / Outlook
- [ ] Vue mensuelle
- [ ] Thèmes personnalisés
- [ ] Export PDF du planning

## 🐛 Bugs Connus

Aucun bug critique actuellement. Pour signaler un problème, ouvrez une issue.

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus d'informations.

## 👨‍💻 Auteur

Développé avec ❤️ pour les étudiants de l'Esisar

---

⭐ **N'oubliez pas de mettre une étoile si ce projet vous a été utile !**
