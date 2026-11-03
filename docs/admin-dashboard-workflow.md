# Premier parcours administrateur — Supabase DEV

> La gestion des images est désormais implémentée et testée :
> [parcours images, limites et recette](admin-dashboard-images.md).
> Les limitations d'uploads mentionnées dans le rapport initial ci-dessous sont
> historiques. Le PDF et le profil restent hors du parcours d'édition actuel.

## État réel au 3 novembre 2026

Branche `feat/admin-dashboard`. Cible vérifiée par la CLI : **kevin-portfolio-dev**,
`pahbwurduwagdglpslos`, **eu-west-1**. Aucun changement de production, compte humain,
invitation, commit, push ou déploiement. Le portfolio public continue à importer ses
JSON et ses fichiers locaux ; aucune lecture publique React vers Supabase.

La migration additive `202611030001_admin_workflow.sql` est réellement appliquée
et enregistrée : huit migrations au total. Les migrations précédentes sont conservées.
Les 18 projets sont importés en brouillon, avec 18 révisions et 127 fichiers privés
(galeries, variantes, portraits, services et PDF). Slugs, missions, agences, couvertures,
ordre, textes alternatifs et crédits ont été comparés aux sources locales.
L'import a été rejoué après une coupure réseau sans doublon ni écrasement.

L'état final vérifié après nettoyage des tests est : 18 projets, 18 révisions,
127 médias validés/stockés, zéro compte Auth, administrateur ou release, pointeur
actif null et version 0. Les publications des tests n'ont pas été conservées.

## Démarrer interface et API ensemble

Depuis la racine du dépôt, avec Node dans le PATH :

```powershell
npm.cmd run dev:admin
```

Ouvrir **http://127.0.0.1:5173/admin**. Une seule commande démarre Vite et le même
handler Node que la future fonction Vercel. Port strict : arrêter un autre serveur
sur 5173 avant lancement. `npm run dev` seul ne démarre pas cette API.
Le serveur lit `.env.supabase-dev.local` côté Node uniquement. Aucun secret n'est
envoyé à React. Aucun paramètre privilégié ne doit être préfixé `VITE_`.

Configuration requise : `SUPABASE_DEV_PROJECT_REF`, `SUPABASE_DEV_PROJECT_NAME`,
`SUPABASE_DEV_REGION`, `SUPABASE_DEV_URL`, `SUPABASE_DEV_PUBLISHABLE_KEY`.
Les scripts d'import/tests utilisent aussi `SUPABASE_DEV_SECRET_KEY`, jamais l'API
applicative. Les valeurs DEV sont épinglées ; toute autre cible est refusée.
`ADMIN_ORIGIN`, facultatif, fixe l'origine CSRF exacte. Localement utiliser
`http://127.0.0.1:5173` si ce paramètre est renseigné. Ne pas copier les valeurs
fictives de `.env.example` sur le fichier local déjà configuré.

## Premier compte : intervention personnelle

### Accès personnel désormais autorisé

Le compte personnel créé par l'utilisateur a été retrouvé par l'UID explicitement
fourni, dans `pahbwurduwagdglpslos` ; son e-mail est confirmé. Seule son entrée
`portfolio.admin_members.active` a été activée. Une comparaison transactionnelle
confirme que les droits des autres comptes sont inchangés. Aucun compte, mot de
passe ou invitation créé/modifié par le script. Aucun rôle système Supabase ajouté.

La commande reproductible accepte maintenant un UID explicite :
`node scripts/authorize-dev-admin.mjs --uid <UID_AUTORISÉ> --apply`.
Le mode historique par adresse locale reste disponible ; ne pas l'utiliser pour
autoriser une adresse différente de celle expressément demandée.

Un projet **TEST — Vérification de l’éditeur**, slug `test-editeur-administration`,
est préparé en brouillon. Il reprend des médias existants et leurs crédits, sans
nouvel upload. La préparation vérifie transactionnellement que les 18 projets
importés (identités, révisions, galeries, pointeurs de brouillon) et la publication
restent identiques. L'état compte donc désormais 19 projets, dont un seul de test.

Pour la vérification personnelle :

1. Ouvrir `http://127.0.0.1:5173/admin` et saisir personnellement ses identifiants.
2. Sélectionner uniquement **TEST — Vérification de l’éditeur**.
3. Modifier son texte fictif, puis **Enregistrer le brouillon**.
4. Recharger/rouvrir ce projet et comparer le texte enregistré.
5. Cliquer **Prévisualiser**, vérifier les textes et images sur ordinateur/mobile.
6. Essayer une saisie non enregistrée puis changer de projet : l'avertissement doit
   apparaître ; annuler pour conserver la saisie. Ne modifier aucun projet importé.

Aucune publication du projet de test n'a été effectuée. La connexion humaine n'a
pas été testée par l'agent : la saisie des identifiants appartient à l'utilisateur.
Le script `prepare-admin-editor-fixture.mjs` retrouve son propre projet au prochain
lancement et refuse tout écrasement d'un projet différent occupant ce slug.

### Procédure initiale conservée pour référence

L'adresse communiquée est préparée dans `SUPABASE_DEV_FIRST_ADMIN_EMAIL` du fichier
local ignoré. Elle appartient à Kévin : conformément à la consigne, aucun compte
n'a été créé pour lui et aucun message n'a été envoyé.

Pour ouvrir un accès humain ultérieurement :

1. Dans [le projet DEV](https://supabase.com/dashboard/project/pahbwurduwagdglpslos/auth/users),
   aller dans **Authentication → Users → Add user → Create new user**.
2. Renseigner personnellement l'adresse retenue et un mot de passe fort. Utiliser
   la création directe avec confirmation du compte, **pas Invite user**. Ne saisir
   aucun mot de passe dans la conversation. Ne pas activer les inscriptions publiques.
3. Dans le terminal local, avec la session CLI autorisée :

   ```powershell
   node scripts/authorize-dev-admin.mjs
   # Vérifie uniquement la présence d'un compte existant unique.
   node scripts/authorize-dev-admin.mjs --apply
   ```

   Ce script vérifie la cible puis autorise seulement le compte existant correspondant
   à la variable locale. Il ne crée aucun utilisateur, n'envoie aucun e-mail et ne
   réinitialise aucun mot de passe. Un compte Auth seul n'a aucun droit administrateur.
4. Se connecter sur `/admin`. Si l'accès humain de cette étape doit être réservé à
   quelqu'un d'autre, remplacer d'abord l'adresse locale par celle explicitement choisie.

## Parcours disponible

- Connexion e-mail/mot de passe et déconnexion ; aucun lien d'inscription publique.
- Liste des projets : brouillon, publié, modifications non publiées.
- Création avec slug nouveau ; modification avec slug existant immuable.
- Titre, description, catégorie, localisation, mission, agence, contexte ; textes
  alternatifs, légendes, crédits, couverture et ordre de la galerie.
- Pour un nouveau projet, sélection explicite des médias d'un projet existant.
  Leur pertinence et leurs crédits doivent être vérifiés ; aucun upload n'est ouvert.
- Sauvegarde append-only, aperçu privé de la version enregistrée, publication DEV
  du projet sélectionné. Sauvegarder avant aperçu/publication.
- Avertissement de saisie non enregistrée avant changement de projet, déconnexion
  ou fermeture/rechargement de page. Les erreurs réseau gardent la saisie.
- Après un conflit, actualiser la liste : la saisie reste en place. Rouvrir le projet
  pour charger la version distante demande confirmation si la saisie est différente.

## API et autorisations

Fonction Vercel préparée : `api/admin.mjs`, handler partagé
`server/admin/handler.mjs`. Endpoint unique `/api/admin?action=...` :

| Méthode | Action | Contrat |
|---|---|---|
| POST | login | `{email,password}` ; retourne l'e-mail, jamais les tokens |
| GET | session | utilisateur vérifié par Auth puis rôle par RPC |
| POST | logout | révoque la session locale Auth et efface les cookies |
| GET | projects | snapshot privé, révisions courantes et version de publication |
| POST | save | `{projectId,expectedRevision,data}` ; retourne `revisionId` |
| GET | preview&id=UUID | projection de la révision enregistrée, réservée aux admins |
| GET | media&id=UUID | binaire privé, autorisé à chaque requête, aucun lien signé exposé |
| POST | publish | `{projectId,revisionId,siteId,expectedVersion}` ; retourne `releaseId` |

Les cookies d'accès et de renouvellement sont HttpOnly, SameSite=Strict, Secure en
production HTTPS. Pas de JWT ni mot de passe stocké en localStorage ou renvoyé à
React. Chaque opération vérifie l'utilisateur auprès d'Auth, puis son autorisation
active en base. Renouvellement du token si nécessaire ; refus 401 lorsque la session
ne peut plus être renouvelée, 403 pour le rôle refusé. La saisie reste dans l'onglet
pendant la reconnexion. Les POST exigent une origine identique et du JSON, avec
limite de taille ; aucune permission n'est déduite de la route React.

Les réponses, y compris les binaires et erreurs, portent `private, no-store` et des
directives CDN `no-store`. Les mots de passe, JWT et contenus ne sont pas journalisés.
Supabase Auth fournit sa limitation côté service ; une limite complémentaire par
processus existe sur login. Elle n'est pas présentée comme un quota distribué Vercel.

Les RPC sont refusées à anon et contrôlent elles-mêmes `portfolio.is_admin()`.
Toutes les nouvelles tables ont RLS. `project_workspaces` ne reçoit aucune permission
d'écriture client : seule la fonction de sauvegarde gère le pointeur sous verrou.
Les fonctions privilégiées fixent `search_path=''` et ne gèrent aucun rôle.
Les contraintes SQL complètent le contrat serveur existant `validateProject`.

Chaque sauvegarde crée une nouvelle révision et compare la révision attendue sous
verrou du projet. La publication réutilise `publish_portfolio`, conserve les autres
versions actuellement publiées, et remplace uniquement le projet sélectionné.
L'ancien contenu reste inchangé tant que la publication atomique n'a pas réussi.
Les conflits de brouillon ou de publication restent **HTTP 409** ; aucune tentative
automatique n'écrase la version distante. L'historique immuable reste disponible.

`vercel.json` conserve build/dist et le fallback React Router, avec exclusion de
`/api/` pour ne pas réécrire les fonctions vers index.html. Aucun paramètre ou
déploiement distant Vercel n'a été changé. Le runtime reste volontairement épinglé
à DEV : préparer séparément la production avant tout déploiement futur.

## Import reproductible et vérification

```powershell
node scripts/import-dev-content.mjs
# Simulation + manifeste privé sous node_modules/.cache/admin-workflow.
$env:PORTFOLIO_PYTHON='CHEMIN_ABSOLU_VERS_PYTHON_AVEC_PILLOW_ET_PYPDF'
node scripts/import-dev-content.mjs --validate-files
node scripts/import-dev-content.mjs --apply
node scripts/check-dev-import.mjs
```

La cible est vérifiée via la CLI à chaque exécution. SQL idempotent préparé par
`admin-import.mjs` : aucun écrasement de révision. L'import dédié distant compare
SHA-256 des fichiers déjà présents, refuse un binaire différent et n'utilise pas
d'upsert Storage. Trois transferts au maximum en parallèle. En cas de coupure,
relancer : un upload réussi mais sans réponse est retrouvé et comparé.
La validation finale est marquée après réussite de tous les transferts.
Pillow décode les 126 images et compare leurs dimensions aux métadonnées ; pypdf
lit le PDF existant non chiffré. Ceci concerne **uniquement les fichiers existants
déjà utilisés et examinés**. Ce n'est pas un pipeline générique d'uploads non fiables
(réencodage, retrait EXIF, analyse PDF et quarantaine restent à construire).

## Recette réellement exécutée

```powershell
node scripts/test-admin-workflow.mjs
node scripts/run-dev-pgtap.mjs
node --test scripts/admin-foundation.test.mjs
npm.cmd run build
npm.cmd run lint
```

Ne pas lancer les suites DB en parallèle. Le nouveau runner applicatif accepte les
contenus importés et conserve la publication de départ ; l'ancien `test-dev-api.mjs`
exige une base vide et ne doit donc plus être lancé sur cette base importée.

Résultats : **28 contrôles HTTP applicatifs réels**, **19/19 pgTAP**, **5/5 tests Node**,
build, lint et `git diff --check` réussis. Les tests HTTP passent par le vrai handler
Node et les services Auth/PostgREST/Storage DEV, avec deux utilisateurs fictifs
`example.invalid`, mots de passe aléatoires en mémoire et aucune invitation.
Ils couvrent notamment refus anonymes/non-admin, RPC directe refusée, cookies,
sauvegarde/rechargement, aperçu privé, média protégé, publication, conservation de
l'ancienne version, double conflit 409, seconde publication, origine étrangère,
renouvellement réel des tokens, session invalide refusée, révocation et déconnexion.
Deux projets fictifs sont publiés pour vérifier réellement la conservation d'un
autre projet publié, ainsi que l'absence de publication implicite des brouillons.
Le cas de session périmée est provoqué par des tokens non valides et un vrai refus
Auth ; nous n'avons pas attendu une heure l'expiration naturelle d'un JWT.

Nettoyage exact des projets/révisions/releases/comptes du run, restauration du
pointeur initial seulement si aucun tiers n'a publié depuis ; aucune suppression
de média importé ni réinitialisation. Le test pgTAP est entièrement rollbacké et
son contrôle de lecture admin est maintenant limité à sa propre fixture, pour
coexister avec les 18 projets.

Le serveur Vite complet répond réellement à `/admin` (HTML et modules React), et
à l'API anonyme (401). Écran de connexion contrôlé visuellement sur ordinateur
et à 390 × 844, focus visible, sans erreur/warning dans la console relevée.
Les écrans authentifiés et le comportement visuel de l'éditeur n'ont pas été
contrôlés dans le navigateur : leurs opérations ont été testées par HTTP.
La fonction n'a pas été déployée sur Vercel ; sa réécriture en production n'est
donc pas prétendue validée. Aucun SMTP/MFA ou mécanisme de récupération configuré.

## Sources officielles consultées

- [Supabase : sessions côté serveur](https://supabase.com/docs/guides/auth/server-side/advanced-guide)
- [Supabase : fonctions PostgreSQL et droits](https://supabase.com/docs/guides/database/functions)
- [Vercel : runtime Node.js](https://vercel.com/docs/functions/runtimes/node-js)

Prochaine étape : ouvrir le compte humain autorisé, contrôler l'éditeur avec lui,
puis préparer la gestion sécurisée des nouveaux médias et l'édition du profil.
