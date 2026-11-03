# Preview Vercel de la dashboard

## Isolation

Projet Vercel existant : `kevin-kilongo-portfolio`, relié à
`jonathanmyinda/kevin-kilongo-portfolio`. Seule la branche `feat/admin-dashboard`
est concernée ; `main` reste la branche de production et n'est pas fusionnée.

Six variables sont définies uniquement pour **Preview / feat/admin-dashboard** :
`SUPABASE_DEV_PROJECT_REF`, `SUPABASE_DEV_PROJECT_NAME`, `SUPABASE_DEV_REGION`,
`SUPABASE_DEV_URL`, `SUPABASE_DEV_PUBLISHABLE_KEY`, `SUPABASE_DEV_SECRET_KEY`.
Les clés sont enregistrées comme secrets Vercel et transmises à la CLI par stdin,
jamais dans les arguments. Aucun mot de passe de base ni jeton CLI n'est déployé.
Les valeurs de production ne sont pas modifiées. La cible reste épinglée à
`pahbwurduwagdglpslos` / `kevin-portfolio-dev` / `eu-west-1` côté serveur.

`ADMIN_ORIGIN` n'est pas copié depuis le poste local : l'API utilise l'origine
HTTPS du déploiement courant, ce qui permet les cookies de session de la preview
sans autoriser une origine tierce. Les cookies sont Secure, HttpOnly, SameSite
Strict et limités à `/api/admin`. Les réponses privées sont `no-store`.

La connexion actuelle utilise le mot de passe via une API de même origine,
sans OAuth, lien magique ou redirection de récupération. **Aucune nouvelle URL
de redirection Supabase n'est nécessaire**, aucun wildcard n'a été ajouté et
le Site URL Auth existant n'a pas été changé. Un futur parcours OAuth/récupération
nécessitera sa propre configuration ciblée.

Le public reste servi depuis les JSON et médias Git actuels. Les modifications
et publications de la dashboard agissent seulement dans Supabase DEV.

## Runtime et indexation

- Build `npm run build`, sortie `dist`, fonction Node `api/admin.mjs`.
- Les chemins `/api` et `/api/*` sont exclus de la réécriture React Router.
- Durée maximale de la fonction : 120 s. Le worker PDF.js est explicitement
  inclus dans le bundle serveur pour son chargement dynamique sur Linux.
- La Preview bénéficie du `X-Robots-Tag: noindex` natif de Vercel, effectivement
  contrôlé par HTTP. `/admin/*` et `/api/*` ont en plus une règle explicite
  `noindex, nofollow, noarchive`. Cela ne remplace pas l'authentification.
- La protection de déploiement Vercel reste active. Les tests automatisés passent
  par l'accès officiel CLI/automation autorisé, conservé seulement en mémoire.
  Un succès de ces tests ne signifie pas que l'URL est accessible sans compte Vercel.
- Aucun secret privilégié n'est fourni à React, ni préfixé `VITE_*`.

Les PDF (20 Mio) et images (6 Mio) vont directement vers des buckets privés avec
une autorisation limitée ; seuls les petits JSON de contrôle traversent l'API
entrante Vercel. La validation réelle côté fonction reste obligatoire avant
enregistrement dans la médiathèque. Voir `admin-dashboard-images.md` et
`admin-dashboard-site.md` pour les limites et les liens signés de 120 secondes.

## Recette reproductible

Prérequis : CLI Vercel officielle connectée au projet existant, CLI Supabase
connectée à DEV, `.env.supabase-dev.local` ignoré et complet.

```powershell
$env:ADMIN_TEST_URL='https://URL-IMMUTABLE-DE-LA-PREVIEW.vercel.app'
$env:VERCEL_TEST_CLI='CHEMIN-ABSOLU-VERS-vercel/dist/index.js'
node scripts/probe-admin-preview.mjs
node scripts/test-admin-site.mjs
node scripts/test-admin-images.mjs
```

Les deux recettes avec mutations doivent être exécutées **successivement**.
Le helper vérifie auprès de Vercel le projet, la branche, l'état READY et le fait
que la cible n'est pas en production avant de démarrer. Ne pas contourner cette
vérification en passant une URL de production. Le premier accès officiel peut
être préparé avec `vercel curl /admin --deployment URL-DE-PREVIEW`.

Chaque run crée ses comptes et contenus fictifs, sans invitation, conserve les
pointeurs initiaux, puis nettoie uniquement ses propres identifiants et chemins.
Le contrôle final compare l'empreinte des 18 projets importés. En cas de panne
réseau pendant une mutation, vérifier son résultat et le manifeste local avant
toute reprise ; ne pas réinitialiser DEV. Ces manifestes sont dans `node_modules`,
hors Git et hors déploiement. Les scripts de tests sont des sources reproductibles,
pas des fixtures enregistrées à publier.

Contrôles de préparation exécutés : build, lint, 18 tests Node (dont contact),
19 assertions pgTAP avec rollback, audit des fichiers candidats et du bundle.

## Résultats du runtime — 3 novembre 2026

Recette complète sur le commit `dacb2f9`, Preview
`https://kevin-kilongo-portfolio-hpavl1gka-jonathan-myindas-projects.vercel.app`.
Les ajouts ultérieurs concernent uniquement la documentation et les scripts de
recette : aucun changement du code de la fonction, du client, du lockfile ou de
la configuration runtime par rapport à cette version testée.

- **36 contrôles profil/projets/PDF réussis**, dont connexion réelle, refus
  anonyme et non-administrateur, sauvegarde/relecture, aperçu privé, publication
  du projet fictif, brouillons exclus du public, publication cohérente du profil,
  restauration et conflits 409. Le PDF de **9 515 589 octets / 32 pages** est
  transféré en direct puis réellement validé par PDF-lib et PDF.js sous Linux
  Vercel. Téléchargement privé au hash inchangé, nom adapté, ancien PDF conservé
  pendant l'édition, faux PDF rejeté, refus réel de Storage au-delà de 20 Mio.
- La réponse HTTP de restauration a été perdue sur le réseau après son commit.
  Les identifiants de publications ont été réconciliés par l'acteur fictif,
  sans rejouer la mutation. Cinq assertions finales ont été terminées avec
  `resume-admin-site-test.mjs` après vérification de l'état réellement enregistré.
  Seul le mot de passe aléatoire du compte fictif a été renouvelé pour cette
  reprise ; aucun compte humain n'a été modifié. Les 36 assertions sont donc
  acquises sur deux phases, pas un run ininterrompu.
- **34 contrôles images réussis**, dont PNG de plus de **4,5 Mo** transmis
  directement, validation/décodage sous Vercel, lecture privée réellement
  décodable, JPEG/WebP, ordre/couverture/crédits après rechargement, aperçu,
  conservation de la publication, dépendances de suppression, fichier annoncé
  PNG contenant un JPEG, faux contenu, dimensions excessives, transfert absent,
  refus anonyme/non-administrateur et cookies Secure/HttpOnly/SameSite Strict.
- Les premiers essais images ont subi des interruptions réseau et ont été
  nettoyés. Le run final a abouti. Les lectures GET peuvent être reprises deux
  fois sur erreur réseau ; aucun POST n'est rejoué automatiquement. L'admission
  API refuse les images de plus de 6 Mio. Le test de dépassement direct du
  bucket images a été interrompu sur cette liaison et n'a pas été rejoué dans
  la recette Preview finale ; il reste distingué du test Storage PDF réellement
  réussi et des tests images précédemment exécutés depuis l'environnement local.
- Contrôles HTTP : accueil, catalogue, fiche projet et `/admin` ; noindex,
  no-store privé, API inconnue non capturée par la SPA. Les six assets JS/CSS
  distants correspondent octet pour octet au build local, sans clé privilégiée.
  Les deux portraits et le PDF publics sont également inchangés.
- Comptes, projets, révisions, publications, images et PDF des tests nettoyés ;
  publication/espace de travail initiaux restaurés. Les 18 projets importés et
  le compte personnel sont préservés. Les éventuelles métadonnées de sessions
  TUS terminées expirent selon Storage ; leurs fichiers de test ont été supprimés.
- Vérification Vercel : branche de production `main`, déploiement de production
  `dpl_7y4m9uPr5nrern2NNMP4iQHi78fW`, variables de production inchangés. Le site de
  production répond HTTP 200. Aucun domaine modifié, aucune offre souscrite.

Les journaux Preview consultés n'ont révélé aucune valeur de clé locale, cookie
de session ou contenu de brouillon. L'API ne journalise pas les corps ni les
erreurs brutes de ses services. Cela reste une observation de la fenêtre de
recette, pas une garantie sur tout journal futur.

Le navigateur intégré n'a pas pu naviguer jusqu'à la Preview (timeout).
**Aucun contrôle visuel distant ordinateur/mobile, du CORS dans un navigateur,
ni du lecteur PDF natif n'est prétendu effectué.** La connexion et les mutations
ci-dessus sont des contrôles HTTP du vrai runtime, distincts d'un parcours UI.
Utiliser la recette personnelle ci-dessous pour terminer ces contrôles.

## Contrôle personnel

1. Ouvrir l'URL Preview suivie de `/admin`. Si Vercel le demande, se connecter
   au compte Vercel déjà autorisé pour ce projet.
2. Se connecter ensuite à la dashboard avec son compte Supabase DEV habituel.
   Ne transmettre aucun mot de passe dans la conversation.
3. Utiliser le projet de test dédié pour enregistrer, prévisualiser et publier.
4. Tester les deux rubriques sur ordinateur et mobile, le réordonnancement au
   clavier, puis l'import d'une image et d'un PDF. Attendre la validation serveur.
5. Vérifier le lecteur PDF intégré et son bouton d'actualisation d'accès privé.
   Le lecteur natif dépend du navigateur ; le lien d'ouverture reste disponible.

## Sources officielles

- [Variables par environnement et branche](https://vercel.com/docs/environment-variables/manage-across-environments)
- [CLI et variables](https://vercel.com/docs/cli/env)
- [Durée des fonctions](https://vercel.com/docs/functions/configuring-functions/duration)
- [Limites de Vercel Functions](https://vercel.com/docs/functions/limitations)
