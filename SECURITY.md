# Politique de sécurité

## Versions supportées

Seule la dernière version publiée (tag `vX.Y.Z` le plus récent et l'image `ghcr.io/rem7474/icsexplorer:latest`) reçoit des correctifs de sécurité.

## Signaler une vulnérabilité

Merci de **ne pas ouvrir d'issue publique** pour une faille de sécurité.

Utilisez le signalement privé de GitHub : onglet **Security → Report a vulnerability** du dépôt
(<https://github.com/Rem7474/ICSExplorer/security/advisories/new>).

Indiquez si possible :
- la version concernée (`/api/status` ou `icsexplorer -version`) ;
- les étapes de reproduction ou une preuve de concept ;
- l'impact estimé.

Un premier retour est visé sous 7 jours.

## Périmètre

Sont notamment concernés : le backend Go (`internal/`, `cmd/`), le frontend (`frontend/`), l'image Docker et les workflows GitHub Actions.
Les serveurs ADE Campus des établissements, l'API CROUStillant et Google Calendar sont des services tiers hors périmètre.
