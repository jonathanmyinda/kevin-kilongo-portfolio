# Base locale de l’administration

> Procédure Docker suspendue à la demande du propriétaire. Pour le PC de 4 Go,
> suivre désormais [la procédure Supabase dev distant](admin-dashboard-remote-dev.md).
> Les migrations et tests ont ensuite été réellement exécutés sur le dev distant :
> voir [les résultats de recette](admin-dashboard-dev-results.md). Les mentions
> « non exécutés » ci-dessous décrivent uniquement la phase locale initiale.
> Ne pas installer Docker/WSL et ne pas réutiliser les commandes de réinitialisation
> ci-dessous sur un projet distant. Les sections locales restent une archive technique.

Préparation du 2 novembre 2026 sur `feat/admin-dashboard`. Aucun service distant
n’est appelé par les tests ou la simulation. Le portfolio continue d’importer ses
JSON actuels : aucun changement de source, de route ou de configuration Vercel.

## Fichiers et modèle

`supabase/config.toml` configure uniquement la pile locale : port API 54321, base
54322, inscriptions e-mail et anonymes désactivées. Seul `public` est exposé dans
la Data API ; `portfolio` reste privé. La désactivation des inscriptions devra être
réappliquée dans les paramètres du futur projet hébergé : une migration SQL seule
ne configure pas Auth dans le cloud.

Migrations versionnées, à appliquer dans l’ordre numérique :

1. `202611020001_content.sql` : membres administrateurs, projets/slugs stables,
   révisions, galeries ordonnées, couverture, crédits/alt/légendes, profil et contacts,
   services, réseaux, PDF, releases, pointeur actif et événements d’audit ; RLS.
2. `202611020002_publication_storage.sql` : publication atomique, restauration,
   lecture publique sur liste de champs explicite, aperçu admin et résolution des
   fichiers courants ; bucket privé et politiques Storage.
3. `202611020003_revision_guards.sql` : versions publiées figées, y compris ajout
   ou déplacement d’une ligne de galerie/service ; verrouillage des parents et
   identité/slug immuable. Les modifications exigent une nouvelle révision.
4. `202611020004_storage_delete_guard.sql` : protection des fichiers référencés,
   interdiction de remplacer un objet validé en place.
5. `202611020005_derivatives.sql` et `006` : conservation des variantes responsive
   et protection de leurs dépendances.

Les tables ne sont pas directement exposées. RLS est néanmoins activée sur toutes
les tables métier. Les administrateurs peuvent lire et éditer les tables de travail
avec le rôle SQL authenticated et un JWT valide ; les droits sont conditionnés par
`portfolio.is_admin()`. Les accès sont refusés au simple compte connecté. Aucun droit
d’écriture admin_members n’est accordé à authenticated : le premier membre est créé
uniquement par le propriétaire de la base, après création Auth autorisée. Aucun compte
réel n’a été inventé ou créé.

Le public a seulement EXECUTE sur `read_portfolio()` ; les identifiants internes de
révision, historiques et JSON `internal` n’y apparaissent pas. Le texte du site est
projeté champ par champ ; le contact résidentiel historique reste exclusivement
dans l’archive privée importée. Les fonctions sensibles vérifient `auth.uid()` dans
la liste active. Elles ont un search_path explicite et des droits EXECUTE restreints.
Le rôle propriétaire et les clés serveur peuvent contourner RLS : ne jamais les
utiliser pour une opération utilisateur sans contrôle préalable.

## Publication et concurrence

`publish_portfolio(revisionIds, siteRevisionId, featuredProjectIds, expectedVersion)`
verrouille le pointeur actif, les révisions et le profil. Il vérifie la version de
départ, la couverture, les fichiers validés/existants et l’appartenance des projets
mis en avant à la publication. La nouvelle release et le changement de pointeur sont
dans une même transaction. Une erreur conserve l’ancienne publication. Les écritures
sur les enfants prennent aussi le verrou du parent, pour sérialiser édition et
publication. La cohérence réelle de ces verrous reste à tester sous PostgreSQL.

Un brouillon édité ne change jamais la version référencée par une release. Une
release conserve les révisions originales ; restaurer repointe vers une release
historique avec contrôle de version. Archiver le registre d’un projet ne le retire
pas immédiatement du site : publier une nouvelle sélection sans ce projet réalise
la dépublication. Aucune suppression en cascade des versions historiques.

## Contrats et couche d’accès

`server/content/contracts.d.ts` décrit les DTO publics, la commande de publication
et la révision admin. `contracts.mjs` vérifie projets et galeries, et effectue une
validation **préliminaire** des signatures, poids et dimensions annoncées de fichiers.
Ce contrôle ne remplace pas un décodage d’image ou un parseur PDF fiable.

`repository.mjs` est une couche serveur RPC indépendante de React, sans secret
embarqué : lecture publique sans JWT utilisateur ; aperçu/publication/restauration
avec un fournisseur de jeton utilisateur. Les fonctions Supabase contrôlent elles-
mêmes l’identité. Des tests remplacent le réseau par un transport contrôlé ; ils
ne prouvent pas l’efficacité des politiques PostgreSQL.

Contrats HTTP prévus pour l’étape API (aucune route HTTP ajoutée aujourd’hui) :

| Opération | Autorisation / données | Réponse |
| --- | --- | --- |
| GET /api/content | Anonyme ; RPC read_portfolio | DTO PublishedContent ou absence de release ; jamais brouillon |
| GET /api/admin/projects/:id | Admin actif ; révisions et version attendue | AdminRevision, no-store |
| POST /api/admin/projects/:id/revisions | Admin ; ProjectDraft validé, copie indépendante | Nouvel ID de révision ; pas d’effet public |
| PATCH /api/admin/revisions/:id | Admin ; version attendue et champs validés | 409 si conflit ou révision publiée ; édition privée |
| GET /api/admin/preview/:revision | Admin ; RPC preview_project | Projection privée, no-store et noindex |
| POST /api/admin/publications | Admin ; PublishCommand | ID release ; 409 si version obsolète |
| POST /api/admin/restore | Admin ; releaseId + expectedVersion | Confirmation après transaction |
| POST /api/admin/uploads | Admin ; nom, type, taille prévalidés | Autorisation d’import limitée à une clé nouvelle |
| POST /api/admin/uploads/:id/validate | Admin ; serveur relit/décode l’objet | validated=true seulement après contrôle réel |
| DELETE /api/admin/media/:id | Admin + confirmation | 409 et dépendances si utilisé, purge serveur sinon |
| PATCH /api/admin/site-drafts/:id | Admin ; champs typés profil/services/social/PDF | Brouillon privé ou 409 |
| GET /api/media/:id | Résolution serveur du fichier publié courant | URL courte pour cet objet uniquement ou 404 |

L’API devra ajouter gestion des cookies sécurisés/CSRF, authentification serveur,
validation stricte de chaque champ et limites de requête. Les fonctions de publication
ne sont pas une API complète d’édition : les endpoints CRUD et la signature Storage
restent à implémenter à l’étape suivante. Ne pas exposer directement le schéma privé
pour contourner ce travail. Les changements de brouillon devront utiliser un compteur
de révision attendu côté API (la concurrence de publication est déjà préparée en SQL).

## Storage privé : comportement prévu

Bucket `portfolio-private`, jamais public. L’import exige un administrateur actif,
un nom UUID nouveau, un MIME de la liste autorisée et un maximum de 20 Mio au niveau
bucket. Images JPEG/PNG/WebP ; PDF seulement. La limite image de 10 Mio et de
30 mégapixels s’applique au registre et au futur validateur serveur. Un objet brut
de 15 Mio peut donc entrer en quarantaine dans le bucket mais ne doit pas être validé
comme image ni publié. Le quota de quarantaine et sa purge seront ajoutés à l’API.

Pas d’upsert, ni de DELETE/UPDATE accordé au client. Le validateur doit relire les
octets, décoder, vérifier MIME réel/dimensions/poids/empreinte, retirer les données
GPS sans altérer les couleurs, et analyser le PDF. Seul ce serveur peut créer les
enregistrements média et basculer validated. Aucun RPC public ne permet de le faire.
La migration crée le bucket et les règles ; elle n’implémente pas ce pipeline de
traitement ni une protection antivirus.

La suppression de binaires référencés est refusée par trigger, y compris lors d’une
suppression côté serveur. Les FK bloquent aussi la suppression du registre tant que
galeries, portraits, services, PDF ou variantes le référencent. Supprimer une révision
historique pour contourner cette règle n’est pas autorisé aux clients.

`published_media_key(id)` est exécutable uniquement avec le rôle serveur et retourne
une clé uniquement si le média validé est référencé par la release **active**. L’API
devra l’utiliser avant la signature (durée proposée 60 secondes), sans accepter une
clé libre du client. Les variantes sont conservées en base mais ne sont pas résolues
publiquement par ce RPC initial ; extension contrôlée à prévoir pour le responsive
dynamique. Les previews signeront uniquement après contrôle admin dans un endpoint
distinct, jamais par l’API publique.

Après dépublication : plus de nouvelle signature publique, réponses content/media
no-store ; les liens déjà émis restent utilisables jusqu’à expiration et le cache
Storage/CDN peut garder des objets. Les copies déjà téléchargées ne peuvent pas être
retirées. Aucun lien de brouillon n’est émis aujourd’hui, aucun Storage n’est connecté.

## Import local reproductible

```powershell
node scripts/admin-import.mjs --dry-run
node scripts/admin-import.mjs --export
# Seulement après démarrage de la base locale et migrations :
node scripts/admin-import.mjs --apply-local
```

La simulation est le mode par défaut. Elle lit les JSON et extrait les quatre
services et les paragraphes visibles depuis le composant actuel. L’échec d’extraction
ou une référence incorrecte est bloquant. La fusion utilise les images de
published-media.json, jamais les anciens chemins non publics de projects.json.
Dimensions annoncées, signatures, poids, empreintes disponibles et existence locale
sont contrôlés. L’empreinte des fichiers réellement lus génère des IDs reproductibles.
Les slugs et legacy_id project-01 à project-18 sont préservés, crédits et ordre aussi.

L’export produit uniquement dans node_modules/.cache/admin-import, ignoré de Git :
`drafts.sql` (transaction idempotente) et `manifest.json` (fichiers et IDs candidats).
Les INSERT sélectionnent uniquement les identités absentes, sans écraser un brouillon
ou une publication existante. Une nouvelle source produit de nouvelles révisions.
Les JSON originaux complets, provenance, parcours, outils, Perspectives et JSX utiles
sont conservés dans internal ; l’adresse résidentielle n’est pas projetée au public.

L’importeur ne téléverse aucun fichier et laisse validated=false. --apply-local
insère uniquement les brouillons dans PostgreSQL, avec psql et LOCAL_DATABASE_URL
limité à localhost/127.0.0.1:54322/postgres. Aucun chemin de connexion distante n’est
accepté ; aucun mot de passe passé en argument ou imprimé. Les fichiers du manifeste
devront ensuite être téléversés et validés par le pipeline local, puis la publication
réalisée explicitement via la session admin. Aucun premier admin n’est créé par
l’import. Les avertissements location/year/areaSqm manquants ne sont pas comblés.

**Pas encore prêt au basculement du site public** : le DTO initial ne projette pas
encore parcours/formation/outils, détails techniques étendus, variantes et Perspectives.
Ces données sont préservées dans l’archive privée ; leur modèle public typé et le
lecteur complet doivent être ajoutés avant toute migration de production. Les URL
actuelles et fichiers statiques du portfolio sont intégralement laissés en place.

## Démarrage local et premier administrateur ultérieur

1. Installer Docker et la CLI officielle Supabase ; démarrer Docker.
2. Dans ce dépôt : `supabase start`, puis `supabase db reset` **uniquement sur cette
   pile locale jetable**. Ne pas utiliser --linked ni lier un projet distant.
3. Récupérer les valeurs de la pile locale via `supabase status` et renseigner les
   paramètres serveur dans un fichier local ignoré. Ne pas copier ses secrets dans
   un rapport. .env.example est fictif et n’est pas chargé automatiquement par les
   scripts Node ; fournir explicitement les variables à leur processus.
4. Lorsqu’une identité réelle est confirmée par le propriétaire, créer/inviter cet
   utilisateur dans Auth avec le mécanisme administrateur officiel. Pas d’inscription
   publique temporaire, pas de bootstrap ouvert. Dans une session propriétaire SQL,
   ajouter son **UUID Auth existant** à portfolio.admin_members. Ne jamais prendre
   cet UUID depuis une requête d’inscription ni s’appuyer sur l’e-mail public du site.
5. Tester récupération/déconnexion/révocation avant tout usage réel. La région et
   SMTP ne sont pas choisis ici ; invitations/mots de passe du cloud restent à configurer.

Paramètres : URL et sb_publishable sont des paramètres publics de faible privilège
(ici utilisés côté serveur uniquement). SUPABASE_SECRET_KEY, accès DB, SMTP et jetons
CLI restent réservés au serveur/scripts ; aucun secret VITE_*. Aucun nouveau paramètre
VITE n’est nécessaire à ce stade. Les sessions utilisateur ne sont jamais imprimées.
Les fonctions Vercel réelles, cookies et routes API ne sont pas encore installés.

## Tests et résultats

```powershell
node --test scripts/admin-foundation.test.mjs
node scripts/admin-import.mjs --dry-run
npm run build
npm run lint
# Plus tard, avec Supabase local en fonctionnement :
supabase test db
```

Tests Node exécutés : import déterministe, références des 18 projets, données privées
non acceptées par le contrat public, mauvaise galerie/type/signature/poids logique,
refus d’import distant, couche RPC sans session, erreurs de permission simulées et
contrôles statiques de SQL/config. Ce sont des validations de code/contrats, **pas des
tests RLS**. Aucun appel réel à Auth, PostgreSQL ou Storage pendant ces tests.

`supabase/tests/admin_access.test.sql` prépare 19 assertions pgTAP avec fixtures
jetables en transaction annulée : anon, utilisateur non admin, admin, refus d’auto-
attribution, publication, édition isolée du brouillon, immutabilité, version concurrente,
confidentialité et suppression de Storage référencé. Fixtures de comptes example.invalid
uniquement dans une transaction rollback, jamais des administrateurs réels.

Docker, Supabase CLI et psql non trouvés dans le PATH actualisé de cette session :
**migrations et pgTAP non exécutés**, RLS, transactions concurrentes et triggers
Storage non validés en fonctionnement. Le test SQL simule des métadonnées d’objets :
il faudra aussi tester de vrais uploads/signatures MIME/limites via l’API Storage,
les sessions expirées/révoquées et deux transactions simultanées. Ne pas autoriser une
connexion de production sur la seule base des vérifications statiques.

Prochaine étape : rendre la pile Supabase locale disponible, appliquer ces migrations,
corriger les éventuelles erreurs SQL constatées, exécuter pgTAP et les tests Storage
réels, puis implémenter l’API de session/validation/CRUD. L’interface admin vient après.

Documentation officielle vérifiée :
[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[Storage](https://supabase.com/docs/guides/storage/security/access-control),
[configuration locale](https://supabase.com/docs/guides/local-development/cli/config).

Résultats obtenus dans cette session : cinq tests Node réussis, simulation de
18 projets / 127 fichiers / zéro erreur et 48 avertissements (champs absents et
projection publique à compléter), build et lint réussis, diff sans erreur de format.
Aucune migration SQL, assertion pgTAP ou validation réelle de Storage exécutée.
Seuls des fichiers locaux préparatoires sont modifiés ; aucun commit/push/déploiement.

## Étape 3 — vérification de l’hôte Windows (2 novembre 2026)

- Windows 11 Professionnel, build 26200 ; CPU Intel Celeron N4120, virtualisation
  firmware et SLAT disponibles et activés. Mémoire visible : 4 011 528 Kio,
  soit environ 3,83 Gio (configuration matérielle de 4 Go).
- WSL rapporte explicitement « non installé ». Docker Desktop absent des chemins
  machine et utilisateur, aucun moteur Docker disponible. winget 1.29.380 présent.
- La lecture des fonctionnalités Windows nécessite une élévation administrateur
  Windows ; sortir du sandbox Codex ne fournit pas ce jeton UAC. Aucun contournement
  ni changement de fonctionnalité système tenté.
- Docker Desktop demande actuellement au moins 8 Go de RAM et WSL 2.1.5 minimum.
  Cet hôte ne satisfait pas le prérequis mémoire : installation Docker non lancée.
- CLI Supabase ajoutée comme dépendance de développement officielle (npm install
  --save-dev supabase, version résolue 2.122.0), avec package-lock conservé. Aucune
  installation PostgreSQL séparée, aucune liaison de projet distant.
  Version 2.122.0 réellement exécutée. `supabase status` confirme linked_project=null
  et échoue avec StatusDbInspectError : docker introuvable (podman également absent).
  L’initialisation de ~/.supabase a nécessité l’autorisation hors sandbox ; aucune
  authentification Supabase n’a été effectuée.
- Build et lint relancés avec succès. Les migrations, 19 assertions pgTAP et tests
  d’intégration Auth/API/Storage restent NON exécutés : absence de moteur local.
  Aucune correction SQL déclarée validée, aucune clé locale générée ou exposée.

Intervention nécessaire avant reprise : disposer d’un hôte Windows avec au moins
8 Go de RAM et virtualisation activée. Sur cet hôte, ouvrir PowerShell **en tant
qu’administrateur** et exécuter `wsl --install --no-distribution`, puis redémarrer
si Windows le demande. La distribution Ubuntu n’est pas nécessaire pour le backend
WSL de Docker. Installer ensuite Docker Desktop depuis sa page officielle, choisir
le backend WSL 2, accepter personnellement les éventuelles demandes Windows et lancer
Docker Desktop. Confirmer que `docker info` affiche un serveur Linux opérationnel.
Si ce PC reste à 4 Go, utiliser une autre machine locale répondant aux prérequis ;
ne pas remplacer ces tests par une connexion à la production.

Après cette intervention : actualiser le PATH, vérifier `wsl --version`,
`docker version` et `docker info`, puis utiliser `npx --no-install supabase start`
dans ce dépôt (configuration existante à préserver). Appliquer les migrations
uniquement à la pile locale jetable et exécuter `npx --no-install supabase test db`.
Les tests HTTP réels des comptes de test et de Storage restent à préparer/exécuter
quand la pile démarre. Ne pas annoncer la sécurité RLS validée avant ces résultats.

Sources officielles consultées :
[Docker Windows — prérequis](https://docs.docker.com/desktop/setup/install/windows-install/),
[commandes WSL](https://learn.microsoft.com/en-us/windows/wsl/basic-commands),
[Supabase CLI et npm](https://supabase.com/docs/guides/local-development/cli/getting-started).
