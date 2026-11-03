# Supabase de développement distant — sans Docker

> Mise à jour : la connexion, les sept migrations et la recette réelle sur le dev
> ont été réalisées. Consulter [le rapport de résultats](admin-dashboard-dev-results.md)
> avant toute action. Les étapes de création/préparation ci-dessous sont historiques :
> ne pas recréer le projet ni rejouer les migrations déjà enregistrées.

## Reprise : cible déclarée par le propriétaire

Projet créé par le propriétaire : **kevin-portfolio-dev**, référence
**pahbwurduwagdglpslos**, URL **https://pahbwurduwagdglpslos.supabase.co**.
L’URL et la référence correspondent exactement. Le propriétaire confirme zéro
migration et les migrations automatiques désactivées. Ce sont les informations
déclarées ; le nom/région et l’état distant ne sont pas encore vérifiés via accès
authentifié. Le fichier `.env.supabase-dev.local` a été créé avec ces trois valeurs,
les autres champs vides. Il est ignoré par Git. Ne jamais imprimer son contenu.

À renseigner personnellement avant reprise : région réelle (Settings/General ou
informations du projet), publishable key et secret key (Settings > API Keys),
mot de passe de base défini à la création et hôte du **Session pooler** depuis
Connect > Session pooler > View parameters. Le nom utilisateur prérempli
`postgres.pahbwurduwagdglpslos` et port 5432 doivent être comparés au dialogue Connect.
Le secret sert uniquement à préparer/nettoyer les fixtures, jamais de preuve RLS.

Pour le contrôle distant préalable sans migration : dans le SQL Editor du Dashboard
dont l’URL contient précisément ce project ref, exécuter le fichier
`supabase/checks/preflight-dev.sql`. Il ne modifie rien. Vérifier qu’aucune table
portfolio n’existe et examiner les comptes/buckets préexistants avant de créer les
fixtures. Toute présence inattendue impose un diagnostic, pas un nettoyage global.
Les résultats de ce fichier ne prouvent pas à eux seuls l’identité du projet : la
référence doit aussi être vérifiée dans le Dashboard ou la liste CLI authentifiée.

Décision du 2 novembre 2026 : abandonner l’installation Docker/WSL sur ce PC de
4 Go. La nouvelle cible est un projet Supabase hébergé **réservé au développement
et aux tests**, distinct de toute base de production future. Aucune cible réelle
n’est encore connue ou configurée. Aucune migration ni connexion distante réalisée
pendant la préparation de cette procédure. La source JSON du portfolio reste intacte.

## 1. Création par le propriétaire

1. Ouvrir https://supabase.com/dashboard et se connecter/créer son compte soi-même.
   Ne communiquer ici ni mot de passe, ni clé, ni code de récupération.
2. Choisir une organisation **Free**. Si deux projets gratuits actifs occupent déjà
   le quota, s’arrêter et signaler la situation ; ne pas supprimer un autre projet
   ni passer sur une offre payante pour contourner ce quota.
3. Choisir New project, nom `kevin-portfolio-dev`. Vérifier que l’offre et les options
   proposées sont gratuites. Ne pas activer d’add-on, d’offre Pro, de domaine ou de
   sauvegarde payante.
4. Choisir et conserver le mot de passe de base dans un gestionnaire de mots de passe.
   Ne pas le coller dans la conversation ni dans .env.example.
5. Sélectionner la région après lecture du tableau ci-dessous, puis créer le projet.
   Attendre son état opérationnel. Il s’agit d’une création manuelle : aucun projet
   n’a été créé par l’agent à cette étape.

### Région avant sélection

La documentation actuelle propose des regroupements généraux Americas (North
Virginia), Europe (Frankfurt), APAC (Singapore), avec affectation selon capacité.
Pour un emplacement déterminé, choisir une région spécifique :

| Zone | Régions spécifiques documentées |
| --- | --- |
| Europe | Irlande eu-west-1, Londres eu-west-2, **Paris eu-west-3**, Francfort eu-central-1, Zurich eu-central-2, Stockholm eu-north-1 |
| Amérique du Nord | Californie us-west-1, Oregon us-west-2, Virginie us-east-1, Ohio us-east-2, Canada ca-central-1 |
| Amérique du Sud | São Paulo sa-east-1 |
| Asie/Pacifique | Mumbai ap-south-1, Singapour ap-southeast-1, Tokyo ap-northeast-1, Séoul ap-northeast-2, Sydney ap-southeast-2 |

Recommandation : **Paris eu-west-3** pour ce projet de développement utilisé depuis
Kinshasa. C’est une proposition géographique, pas une mesure de latence ; aucune
garantie sur les routes réseau depuis la RDC. Francfort est une alternative si Paris
n’est pas proposé. Aucune région africaine n’est répertoriée dans cette liste. Les
options effectivement disponibles doivent être vérifiées dans l’écran de création ;
ne pas accepter silencieusement une autre région. Le choix concerne la résidence
principale des données, pas une attestation de conformité juridique.

Source : [régions Supabase](https://supabase.com/docs/guides/platform/regions).

## 2. Configuration locale, secrets hors Git

Créer **manuellement**, sans écraser les fichiers existants, un fichier
`.env.supabase-dev.local` à la racine du dépôt. Il est déjà ignoré par `.gitignore`
et par `.vercelignore` ; ne rien renseigner dans Vercel. Copier uniquement les
variables SUPABASE_DEV_* nécessaires depuis .env.example, puis remplir :

- SUPABASE_DEV_PROJECT_REF : Project ID / Reference ID, depuis les réglages du projet
  ou l’URL du Dashboard. Identifiant public, distinct du nom libre du projet.
- SUPABASE_DEV_PROJECT_NAME : kevin-portfolio-dev.
- SUPABASE_DEV_REGION : code de la région réellement choisie.
- SUPABASE_DEV_URL : URL exacte du projet dans Connect / paramètres API.
- SUPABASE_DEV_PUBLISHABLE_KEY : clé publishable depuis les paramètres de clés API ;
  faible privilège, autorisée techniquement dans un client mais **non ajoutée à React**.
- SUPABASE_DEV_SECRET_KEY : seulement si nécessaire aux futurs scripts de tests
  Auth/validation Storage. Très privilégiée, réservée aux processus serveur/scripts.
  Elle ne doit jamais être utilisée pour simuler les requêtes des visiteurs/admins.
- SUPABASE_DB_PASSWORD : mot de passe de base, seulement pour les futurs processus
  CLI/SQL qui en ont besoin. Ce n’est pas le mot de passe du compte Supabase.

Ne pas recopier les paramètres localhost de l’ancien mode Docker dans cette cible.
Ne pas remplacer les variables Supabase génériques existantes destinées à une future
API. Aucun secret VITE_*, aucune capture d’écran des clés, aucun dump de variables.
Le fichier n’est pas automatiquement chargé par Vite ou les scripts : son chargement
sera explicite dans les seuls scripts dev. Les scripts n’afficheront que les
identifiants de cible et résultats, jamais les clés ou mots de passe.

Contrôles inoffensifs après remplissage :

```powershell
git check-ignore .env.supabase-dev.local
node scripts/check-dev-target.mjs
```

Le second contrôle est **hors ligne** : il vérifie le format et l’accord URL/ref,
mais ne prouve pas que le projet distant porte réellement ce nom. Il ne crée pas
de fichier secret, n’appelle aucune API et n’applique aucune migration.

## 3. Porte de contrôle obligatoire avant toute migration

À l’étape suivante, le propriétaire devra donner uniquement l’identifiant public
du projet et la région, et confirmer qu’il s’agit d’un projet de développement neuf.
L’agent devra annoncer explicitement la cible :
« kevin-portfolio-dev / <référence réelle> / <région> / développement uniquement ».

Vérifier les valeurs dans le Dashboard, et si la CLI est authentifiée, dans la liste
des projets retournée par `npx --no-install supabase projects list`. L’authentification
CLI éventuelle se fera personnellement avec la procédure officielle de `supabase
login` : ne jamais demander de coller le jeton dans cette conversation. Un nom
seul, ou la seule déclaration du fichier local, n’est pas une vérification distante.

Contrôler que le projet est indépendant de toute future production et ne contient
pas de données utiles préexistantes. Toute divergence de référence, nom, région ou
environnement bloque l’application. Ne pas réutiliser un lien Supabase résiduel de
ce dépôt sans comparaison avec cette référence approuvée.

## 4. Migrations ultérieures, sans Docker ni réinitialisation

Méthode officielle privilégiée : CLI Supabase déjà installée, `db push` contre le
projet dev explicitement vérifié, avec son suivi de migrations. Après autorisation
de l’étape migrations seulement : liaison explicite par `supabase link --project-ref`
avec cette référence, revue de `migration list`, puis `db push --dry-run`, revue des
migrations attendues, et enfin `db push`. Ni --include-all ni --include-seed par défaut.
Ne pas lancer ces commandes maintenant. Utiliser les variables de processus prévues
par la CLI pour le mot de passe plutôt que des secrets dans les arguments/historique.
Le dry-run liste les opérations : il ne prouve pas la validité SQL ou des politiques.

Si la liaison échoue à cause d’un réseau IPv4, prendre les paramètres **Session pooler**
du dialogue Connect (port 5432), et non le transaction pooler 6543 pour des tests qui
dépendent d’une session. La connexion directe convient si IPv6 est disponible.
Ne pas acheter l’add-on IPv4. Ne pas désactiver la vérification TLS pour contourner
une erreur. Les hôtes de pooler doivent être copiés du Dashboard, pas construits
depuis une région supposée. Vérifier aussi le project ref dans le nom utilisateur
du pooler `postgres.<ref>`.

Alternative officielle si la CLI rencontre une limite : SQL Editor du **seul projet
dev vérifié**, migrations relues dans l’ordre, une seule fois chacune. Documenter
précisément celles exécutées ; ne pas mélanger cette méthode et db push sans aligner
au préalable l’historique des migrations. Ne jamais rejouer les CREATE sur une base
déjà partiellement migrée sans diagnostic de l’échec.

Exclus de la procédure normale : db reset, --linked/--db-url avec reset, db diff/pull
nécessitant une base shadow Docker, suppression/recréation de projet ou bucket,
TRUNCATE, DROP de schéma/table, effacement global Auth/Storage et désactivation RLS.
Le script admin-import.mjs --apply-local reste volontairement limité à localhost :
ne pas enlever ce garde-fou pour le réutiliser sur le cloud. Son --dry-run et son
--export restent utiles hors ligne ; l’import cloud sera un script séparé avec le
contrôle de cible précédent, pas une modification improvisée du script local.

Références : [workflow de migrations](https://supabase.com/docs/guides/local-development/cli-workflows),
[connexions et pooler](https://supabase.com/docs/guides/database/connecting-to-postgres).

## 5. pgTAP à distance : possible, runner sans Docker à choisir

Supabase hébergé prend en charge l’extension pgTAP. Après validation de la cible,
vérifier sa présence dans pg_available_extensions et l’activer sur le projet dev
si nécessaire, conformément à la documentation. Ne pas supposer que l’extension
est déjà activée. Le fichier supabase/tests/admin_access.test.sql contient les
19 assertions préparées, BEGIN/ROLLBACK et des identités fictives.

Exécution sans Docker prévue : SQL Editor, dans une seule exécution/transaction,
ou client SQL léger connecté au session pooler avec la même session pour tout le
fichier. Lire explicitement les 19 résultats TAP et finish() : une réponse SQL HTTP
200 n’est pas un résultat de test réussi. Les tests SQL passent par des rôles
SET LOCAL anon/authenticated et des JWT fictifs dans la session : ce n’est pas une
preuve de l’authentification ou de Storage HTTP réels.

Le runner `supabase test db` peut dépendre d’outils/conteneurs suivant la version ;
ne pas promettre qu’un --db-url supprime Docker. Vérifier son aide réelle avant de
l’utiliser ; le SQL Editor évite cette dépendance. Si pgTAP n’est pas disponible,
préparer un script SQL transactionnel équivalent : assertions PL/pgSQL avec RAISE
sur écart, contrôle de SQLSTATE, rôles anon/authenticated, compteur de cas attendus,
ROLLBACK final. Ne pas rapporter ces cas comme exécutés tant qu’ils ne le sont pas.

Adapter avant exécution distante les fixtures déterministes du test actuel : UUID
uniques à chaque run, préfixe de test et vérification de non-collision. Aucune
insertion dans auth.users à conserver : ces fixtures SQL sont annulées, pas des
comptes invités. L’activation éventuelle de l’extension est distincte de ce rollback.

Sources : [pgTAP hébergé](https://supabase.com/docs/guides/database/extensions/pgtap),
[tests de base](https://supabase.com/docs/guides/database/testing).

## 6. Vrais tests Auth/API/Storage ensuite

Préparer un runner Node dédié au projet dev, avec identifiant de run aléatoire et
manifeste local ignoré listant uniquement ses créations. Aucun e-mail envoyé : créer
deux comptes fictifs via l’API Auth Admin avec e-mails example.invalid, mot de passe
aléatoire conservé en mémoire et confirmation de test. Attribuer le rôle admin au
seul UUID de fixture prévu par une opération propriétaire vérifiée, jamais via la
requête du compte. Sign-in normal pour obtenir deux JWT distincts. Ne pas ouvrir
les inscriptions publiques pour rendre le test possible.

| Client utilisé | Vérifications attendues |
| --- | --- |
| Clé publishable, aucun JWT | Lecture publiée seulement ; brouillons/historique non exposés, écriture/aperçu/signature admin refusés ; upload et lecture publique du bucket refusés |
| JWT non administrateur | Même lecture publique ; publication, attribution de rôle, uploads et accès aux brouillons refusés |
| JWT administrateur | Upload sous clé nouvelle autorisé, aperçu privé, publication de fixtures et restauration ; aucun droit de se promouvoir ou d’administrer les membres |
| Serveur de test privilégié | Préparation/nettoyage et validation de fixture seulement ; ne sert jamais de client pour prouver les permissions précédentes |

Tester de vrais petits JPEG/PNG/WebP et PDF, extension refusée, MIME incohérent,
fichier trop lourd, upsert et suppression d’un objet utilisé, image brute non validée,
absence d’accès anonyme à son URL et refus de résolution publique de son identifiant.
La validation actuelle est préliminaire : le bucket applique un plafond de 20 Mio,
et le pipeline serveur doit encore imposer 10 Mio/décodage pour les images. Un fichier
à extension autorisée mais au contenu trompeur peut entrer en quarantaine : on exige
qu’il ne soit pas validé/publié, pas que le Storage fasse une analyse antivirus.

Créer une publication initiale de fixtures, modifier un nouveau brouillon, vérifier
que la réponse publique reste identique, puis publier et vérifier la bascule complète.
Tester refus sur version obsolète, compte révoqué et échec transactionnel. Les endpoints
HTTP Vercel /api/admin et de signature n’existent pas encore : tester les RPC REST et
Storage/Auth existants, et marquer les protections de la future API non testées.
Ne pas changer Vercel pour effectuer cette recette.

Nettoyage en finally, strictement par les UUID/chemins du manifeste de run. Les
releases immuables et le pointeur actif exigent un nettoyage propriétaire ciblé dans
une transaction : vérifier le namespace de fixture, restaurer exactement l’état
initial du pointeur si celui-ci appartient encore au run, retirer seulement ses
références puis ses objets et comptes. Si une autre publication intervient, refuser
le nettoyage automatique et signaler les seuls IDs concernés. Aucune suppression
globale, aucune désactivation de trigger/RLS ; aucun utilisateur ou média préexistant
n’est éligible au nettoyage. Conserver le manifeste si une étape échoue pour reprise.
Le runner et ce nettoyage seront implémentés/revus avant le premier test distant.

## 7. Limites et état actuel

Free : 500 Mo de base, 1 Go de Storage, deux projets actifs maximum, quotas de
trafic séparés et mise en pause après inactivité. Choisir uniquement cette offre ;
pas de garantie de disponibilité continue ni de sauvegarde automatique gratuite.
Les données de ce projet sont fictives/de développement ; ne pas y connecter le site
public. [Offres Supabase](https://supabase.com/pricing).

Procédure préparée, mais projet non créé par l’agent, référence non fournie, région
non sélectionnée et configuration locale non remplie. Aucun test distant, migration,
compte de test ou lien CLI exécuté. La première action du propriétaire est d’ouvrir
le Dashboard et de choisir une organisation Free pour créer kevin-portfolio-dev.
