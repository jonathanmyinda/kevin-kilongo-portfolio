# Liaison du portfolio de Preview à Supabase DEV

## Cible et publication initiale

Branche `feat/admin-dashboard`, projet Vercel existant. La lecture est activée par
`PORTFOLIO_CONTENT_SOURCE=supabase-dev`, variable serveur limitée à **Preview /
feat/admin-dashboard**. Le code refuse cette activation en production ou sur
une autre branche Vercel. Aucun secret n'utilise le préfixe `VITE_`.

La cible vérifiée est `kevin-portfolio-dev`, `pahbwurduwagdglpslos`, `eu-west-1`.
L'audit a retrouvé les 18 projets importés, avec leurs slugs, missions, agences,
crédits et galeries inchangés. Leur révision est résolue comme dans l'administration
(pointeur explicite ou `working_revision`), sans réimporter ni remplacer de données.
Le projet de test personnel existant, modifié récemment, reste privé et intact.

`scripts/publish-dev-initial.mjs` audite par défaut ; `--apply --actor UID_AUTORISÉ`
réalise une première publication atomique seulement si aucune publication n'existe.
Il vérifie le compte administrateur déjà autorisé, les identités, les fichiers,
les révisions et l'absence de modification depuis l'audit. Les six projets mis en
avant sont conservés. Une publication existante n'est jamais remplacée implicitement.
Les rapports de travail restent dans `node_modules/.cache/admin-workflow/`, ignoré.
La commande utilise la connexion SQL privilégiée CLI autorisée et le contexte de
l'administrateur déclaré ; elle ne prétend pas être une connexion interactive à
son compte et ne demande pas son mot de passe.

La publication initiale DEV contient 18 projets, les quatre services, les derniers
portraits bleu/jaune, les coordonnées et le PDF de 9 515 589 octets / 32 pages.
Aucun brouillon, fichier source ou rôle n'est modifié par cette publication.

## Lecture publique et médias

- `GET /api/content` lit la projection anonyme `read_portfolio` et ne renvoie que
  la publication active. Les champs d'archive sont exclus explicitement, notamment
  adresse résidentielle, pages sources, code JSX, notes et fichiers internes.
- Le parcours, la formation, les logiciels et les caractéristiques publiques
  existantes sont projetés depuis les archives des révisions avec une liste de
  champs autorisés. Ils ne sont pas perdus lors du passage à la source dynamique.
- Les données éditables viennent des révisions publiées : titres, descriptions,
  rôle, agence, crédits, galerie, profil, services, portraits, contacts et PDF.
- Les quatre choix de Perspectives restent une sélection éditoriale du design
  actuel ; ils ne sont affichés que si leur projet et leur image sont publiés.
  Une image retirée est remplacée par la couverture publiée de ce même projet.
- Le catalogue, les sélections, la navigation précédent/suivant et les fiches sont
  calculés exclusivement depuis les projets publiés, jamais fusionnés avec les JSON.
  Un slug non publié affiche la page introuvable existante.
- `GET /api/media?id=...` vérifie l'appartenance actuelle à la publication,
  signe un accès Storage de **120 secondes**, revérifie l'autorisation, puis répond
  par redirection HTTP 307. Les variantes ne sont autorisées que si leur parent
  est publié. Les RPC de résolution des clés restent réservées au serveur.
- Le navigateur garde une URL stable `/api/media` : toute nouvelle demande reçoit
  une nouvelle signature. Le téléchargement PDF utilise le nom publié côté serveur.
  Les fichiers ne transitent pas dans le corps d'une fonction Vercel ; le PDF de
  plus de 4,5 Mo est livré directement par Storage.
- Aucun accès de lecture anonyme aux buckets privés n'est ajouté. Un fichier
  simplement importé et validé reste inaccessible publiquement tant qu'il n'est
  pas référencé par une publication.

La migration `202611040001_public_preview.sql` ajoute les projections publiques,
la résolution serveur des médias et les fonctions administrateur de dépublication,
historique et restauration d'un projet. Toutes les fonctions privilégiées ont un
`search_path` explicite et vérifient le rôle lorsque l'action est administrative.
La dépublication et la restauration créent une publication atomique en conservant
les autres projets et le contenu du site publiés ; elles ne remplacent pas le brouillon.
Les commandes sont présentes dans la section Publication et historique de l'éditeur.

## Visibilité, erreurs et limites du cache

Les réponses de contenu et de résolution média sont `no-store` (navigateur et
CDN Vercel). Le portfolio relit les publications toutes les **30 secondes** lorsque
l'onglet est visible, et au retour du focus. Un rechargement lit immédiatement la
dernière publication. Délai normal : jusqu'à 30 secondes plus le temps de réponse.
Une requête de contenu est interrompue après 20 secondes ; une erreur masque le
contenu au profit d'un message avec Réessayer, sans revenir aux anciens JSON.
Une publication changeant pendant la lecture renvoie 409 et invite à recommencer.

Les images peuvent renouveler leur demande une fois sur erreur. Le changement
d'une révision remonte la galerie pour fermer proprement une visionneuse obsolète.
Les signatures encore valides, les images déjà chargées, le cache de Storage et
les copies téléchargées ne peuvent pas être retirés instantanément. La dépublication
refuse immédiatement les **nouvelles résolutions** du média ; un lien déjà obtenu
peut encore fonctionner jusqu'à son expiration de 120 secondes. Les anciens fichiers
statiques, déjà publiés avant Supabase, restent à leurs URL historiques : cela ne
rend pas publics les nouveaux brouillons privés et ne les réintroduit pas dans l'UI.

## Retour explicite à la source statique

Dans Vercel, changer **uniquement** `PORTFOLIO_CONTENT_SOURCE` pour Preview /
feat/admin-dashboard en `static`, puis redéployer la Preview ou pousser un commit.
Ne pas toucher aux variables Production. Pour réactiver DEV, remettre `supabase-dev`.
En local, modifier seulement `.env.supabase-dev.local`, puis relancer `npm run dev:admin`.
Les données Supabase et les publications conservées restent disponibles.

Ce retour est une décision explicite vers le catalogue historique : il peut donc
réafficher un ancien projet qui a ensuite été dépublié dans DEV. Il ne se déclenche
jamais automatiquement lors d'une erreur de réseau ou d'une dépublication.

## Vérifications reproductibles

```powershell
npm.cmd run build
npm.cmd run lint
node --test scripts/public-content.test.mjs scripts/admin-foundation.test.mjs scripts/admin-images.test.mjs scripts/admin-site.test.mjs scripts/contact.test.mjs
node scripts/validate-pages.mjs
node scripts/run-dev-pgtap.mjs
node scripts/test-public-link.mjs
```

Ne pas exécuter plusieurs recettes SQL simultanément : la CLI utilise un rôle
temporaire de connexion partagé. Les reprises automatiques ne concernent que les
échecs d'initialisation/connexion avant envoi SQL, jamais une mutation au résultat
ambigu. Aucune commande de réinitialisation ou de suppression globale n'est utilisée.

Résultats locaux : build et lint réussis, 22 tests Node réussis, 19 assertions
pgTAP réussies avec rollback, rendu statique des routes/18 fiches/filtres validé,
24 contrôles réels Auth/API/Storage de liaison réussis et fixtures nettoyées.
Le navigateur local affiche la publication réelle : 18 cartes sans fixture,
six projets sélectionnés, quatre services, portrait chargé et PDF 9,52 Mo.

Le test de dépassement Storage utilise la route officielle **TUS signée** du
même bucket images, avec un buffer PNG de 6 Mio + 1 octet et une autorisation
limitée valide. Un transfert PNG de contrôle réussit avant le test ; la requête
surdimensionnée reçoit réellement HTTP 413 avec une erreur de taille, pas une
erreur d'authentification. Les limites/politiques n'ont pas été affaiblies.

La recette importe un PDF fictif d'une page et vérifie intégralement son téléchargement
privé (hash et nom). Pour le PDF public existant de 9,52 Mo, le chemin de téléchargement
est contrôlé par une requête Range (HTTP 206, signature PDF et nom de téléchargement),
sans prétendre avoir retéléchargé intégralement ce document pendant cette recette.

Pour tester la Preview, définir `ADMIN_TEST_URL` et `VERCEL_TEST_CLI` comme dans
`admin-dashboard-preview.md`, puis lancer `node scripts/test-public-link.mjs`.
L'option `--hold` conserve temporairement ses propres fixtures pour un contrôle UI ;
son fichier de travail et ses identifiants fictifs sont ignorés et nettoyés ensuite.
La recette restaure seulement son état initial et contrôle l'empreinte des contenus
préexistants, y compris le test personnel. Le compte personnel n'est pas modifié.
