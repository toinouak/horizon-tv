# Horizon

Écran d'accueil minimaliste façon Apple TV pour les TV Samsung sous Tizen (testé pour une The Frame 2022, Tizen 6.5).
C'est un **module TizenBrew** : rien n'est modifié dans le système de la TV, et tout s'enlève en deux clics.

- Dock de tes applis préférées, avec leurs vraies icônes.
- « Toutes les applis » (flèche bas), avec possibilité de masquer celles qui ne servent pas.
- Photos de paysages qui défilent en fondu, avec un léger zoom lent (photos remarquables de Wikimedia Commons).
- Horloge et date en français.
- Mode ambiance : après 90 secondes sans toucher la télécommande (ou touche Retour), seuls la photo et l'heure restent.

## Utilisation à la télécommande

| Touche | Action |
|---|---|
| Gauche / Droite | Se déplacer dans le dock |
| OK | Ouvrir l'appli |
| OK maintenu | Options : déplacer, retirer du dock, ajouter au dock, masquer |
| Bas | Toutes les applis |
| Retour | Fermer le panneau ouvert, ou passer en mode ambiance |
| Accueil (Home) | Accueil Samsung, comme d'habitude |

## Installation

Il faut TizenBrew sur la TV (l'outil qui fait aussi tourner TizenTube) et ce dossier publié sur GitHub.

1. Publie ce dossier dans un dépôt GitHub **public** (par exemple `horizon-tv`), avec `package.json` à la racine.
2. Sur la TV, ouvre TizenBrew, puis **Module Manager > Add GitHub module** et saisis `TON-PSEUDO/horizon-tv`.
3. Ouvre **Horizon** dans la liste des modules.
4. Dans TizenBrew, **Settings > Autolaunch > Horizon**, pour que TizenBrew ouvre directement Horizon.
5. Active « Remplacer l'accueil Samsung » (section suivante) pour que Home et l'allumage mènent à Horizon.

Le mode développeur de la TV doit avoir **127.0.0.1** comme IP du PC hôte pour que les modules TizenBrew démarrent.

## Remplacer l'accueil Samsung (touche Home et allumage)

Horizon ne peut pas modifier la touche Home elle-même. À la place, son service écoute l'API publique des états
d'applis de Tizen : dès que l'accueil Samsung s'affiche (touche Home, allumage de la TV, sortie d'une appli),
il rouvre TizenBrew, qui affiche Horizon. L'accueil Samsung peut apparaître une fraction de seconde avant.

1. Toutes les applis (flèche bas) > tuile **Réglages Horizon** > **Remplacer l'accueil Samsung…**
2. Appuie sur la touche **Home** dans les 12 secondes : Horizon apprend quel écran correspond à l'accueil Samsung,
   puis revient tout seul.
3. Pour l'allumage : laisse « Démarrer avec l'accueil Smart Hub » **activé** et « Exécuter automatiquement la
   dernière application » **désactivé**. La TV s'allume sur l'accueil Samsung, et Horizon prend sa place.

Pour accéder malgré tout à l'accueil Samsung (réglages, sources) : appuie **deux fois sur Home** en moins de 4 secondes.
Sécurité : si Horizon reprend la main plus de 4 fois en 20 secondes, l'option se coupe toute seule.
Pour revenir en arrière : Réglages Horizon > Remplacer l'accueil Samsung : activé (OK pour désactiver).

Le service doit tourner : il démarre avec TizenBrew et reste actif tant que la TV est en veille ou allumée.
Après une coupure de courant, ouvre TizenBrew une fois pour le relancer.

## Réglages

Tout est dans `app/config.js` : dock par défaut, applis masquées par défaut, durée de chaque photo, liste des photos.
Le dock et les applis masquées que tu modifies sur la TV sont gardés sur la TV (stockage local du module).

## Désinstallation

Réglages Horizon > Remplacer l'accueil Samsung : désactivé. Puis TizenBrew > Settings > Autolaunch : désactivé,
et Module Manager : supprimer `horizon-tv`.
Rien d'autre à faire : Horizon n'installe rien sur la TV en dehors de TizenBrew.

## Fonctionnement

- `app/` : la page affichée (HTML, CSS, JavaScript ES5).
- `service/service.js` : petit service lancé par TizenBrew, joignable uniquement depuis la TV (127.0.0.1:8097).
  Il liste les applis installées, fournit leurs icônes, ouvre l'appli choisie et, si tu l'actives, rouvre Horizon
  quand l'accueil Samsung s'affiche. Son seul réglage est un petit fichier `horizon-tv.json`. Il ne modifie rien d'autre.

## Crédits

Photos : images remarquables de Wikimedia Commons, chargées directement depuis Commons. Chaque photo garde la licence
et l'auteur indiqués sur sa page Commons. Si la TV est hors ligne, Horizon dessine des paysages de secours.

Licence du code : MIT.
