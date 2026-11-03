# Recette réelle du projet Supabase de développement

> Historique de la recette initiale du 2 novembre. Le parcours applicatif et les
> contenus importés du 3 novembre sont décrits dans
> [admin-dashboard-workflow.md](admin-dashboard-workflow.md). La base contient
> désormais 18 projets et 127 médias privés ; les anciens prérequis de base vide
> ne s'appliquent plus au nouveau runner applicatif.

## Cible et périmètre

Projet vérifié via la CLI authentifiée : **kevin-portfolio-dev**, référence
**pahbwurduwagdglpslos**, région **eu-west-1**, état ACTIVE_HEALTHY, PostgreSQL 17.
URL : https://pahbwurduwagdglpslos.supabase.co. Aucun autre projet modifié.
Le précontrôle réel a trouvé zéro table publique métier, aucun schéma portfolio,
zéro utilisateur Auth et zéro bucket. pgTAP était disponible.

Les deux clés API ont été récupérées automatiquement et écrites uniquement dans
`.env.supabase-dev.local`, ignoré par Git. Le Session pooler a été récupéré après
liaison CLI explicite au projet dev. Mot de passe de base non récupéré/non réinitialisé :
il n’a pas été nécessaire. La CLI 2.122.0 permet `db query --linked --project-ref`
via Management API et la gestion des migrations via sa connexion autorisée.
Les codes CLI temporaires ont été retirés du fichier ; aucun secret dans ce rapport.

## Migrations réellement exécutées

Les fichiers 202611020001 à 202611020006 ont été appliqués dans l’ordre avec
`supabase db query --linked --project-ref pahbwurduwagdglpslos --file <fichier>`.
La première tentative de 001 a été annulée par la transaction : `freeze` était un
nom de trigger réservé. Le trigger a été renommé `guard_published`, l’absence du
schéma après rollback a été vérifiée, puis la migration corrigée a réussi.

Les tests HTTP ont révélé des délais répétés sur le conflit de version utilisant
SQLSTATE 40001. La migration supplémentaire **202611020007_conflict_http_status.sql**
change ce cas applicatif en **PT409 / HTTP 409** dans publish/restore, sans retirer
les contrôles de version ni les verrous. Elle a été appliquée ; le test HTTP 409
réussit désormais.

L’historique officiel a été aligné via `supabase migration repair --status applied`
pour les sept versions réellement exécutées ; `migration list` confirme l’alignement.
Il ne faut pas rejouer les CREATE. Aucune commande reset, TRUNCATE ou suppression
globale exécutée, aucune migration automatique Git activée.

## Configuration Auth

Les inscriptions publiques étaient activées par défaut dans le nouveau projet.
Une configuration minimale isolée a été comparée puis appliquée sur ce seul projet.
L’interdiction globale des inscriptions est maintenant active, ainsi que le refus
de connexion anonyme. Le fournisseur e-mail reste disponible pour les comptes créés
par un administrateur : avec cette version CLI, le désactiver bloquait aussi leur
connexion. `auth.enable_signup=false` demeure la protection globale ; le paramètre
`auth.email.enable_signup=true` préserve le fournisseur e-mail. Le test HTTP de
`/auth/v1/settings` vérifie réellement `disable_signup=true` et `external.email=true`.
La version locale de config.toml a été alignée.

Les paramètres non déclarés de la configuration minimale (confirmations, MFA, URLs,
OTP, réglages DB…) ont été laissés inchangés par la CLI. Aucun SMTP, compte humain,
région, domaine ni configuration Vercel créé ou modifié.

## Résultats SQL : 19/19 assertions pgTAP

`scripts/run-dev-pgtap.mjs` prépare des UUID uniques, exécute le fichier de test sur
le dev épinglé et exige les 19 résultats `ok`, sans diagnostic d’échec. Toutes les
fixtures SQL sont dans une transaction annulée.

La Management API ne renvoyant que le dernier résultat SQL, le runner collecte les
lignes TAP en table temporaire et termine avec une exception volontaire contenant
un rapport compact encodé. Cette exception annule intégralement la transaction ;
le runner la reconnaît, vérifie le rapport complet et ne considère pas une simple
réponse API/SQL comme un succès. Ne pas interpréter ce rollback de test comme une
migration échouée. Les identifiants et comptes fictifs ne persistent pas.

Cas couverts : lectures anon/publiées et privées, utilisateur connecté non admin,
interdiction d’auto-attribution, écritures refusées, droits admin, extension Storage
interdite, publication, brouillon sans effet public, immutabilité, version obsolète,
confidentialité et clé étrangère protégeant le registre d’un média utilisé.

Le test de suppression SQL initial ciblait directement storage.objects ; Supabase
interdit déjà cette opération et exige son API Storage. Le test SQL 19 vérifie donc
la protection FK du registre ; la protection du binaire est vérifiée par l’API réelle.

## Résultats Auth/API/Storage : 19/19 contrôles réels

`scripts/test-dev-api.mjs` utilise des requêtes HTTPS réelles, deux comptes Auth
fictifs confirmés sans invitation/e-mail et deux JWT obtenus via connexion normale.
La clé serveur sert uniquement à préparer/valider les fixtures et à les nettoyer.
Les requêtes censées prouver les droits admin utilisent le JWT admin, pas cette clé.

1. Inscriptions désactivées et fournisseur e-mail disponible.
2. Aucune publication métier initiale.
3. Upload anonyme refusé.
4. Upload du non-administrateur refusé.
5. Upload WebP de l’administrateur autorisé.
6. URL publique du fichier privé inaccessible.
7. Signature anonyme du brouillon refusée.
8. Type SVG refusé.
9. Aperçu non administrateur refusé.
10. Brouillons non exposés via REST.
11. Aperçu administrateur autorisé.
12. Publication non administrateur refusée.
13. Publication administrateur par RPC réussie, avec fichiers réellement téléversés.
14. Projection publique sans texte de brouillon ni contenu internal.
15. Nouvelle édition privée sans changement de la publication active.
16. Conflit de version renvoyant HTTP 409.
17. Suppression directe admin sans effet, fichier toujours téléchargeable par l’admin.
18. Suppression serveur du fichier référencé refusée, binaire toujours présent.
19. Administrateur révoqué immédiatement privé d’aperçu malgré son JWT valide.

Storage peut répondre 200 avec une liste vide quand DELETE ne touche aucune ligne
autorisée. Le test vérifie donc le contenu de la réponse ET la persistance réelle
du fichier, puis tente séparément la suppression côté serveur, protégée par trigger.
Il ne se contente pas de tester un statut HTTP supposé.

Des runs intermédiaires ont été interrompus par une erreur réseau, la configuration
e-mail indisponible, le conflit 40001 puis cette différence de sémantique DELETE.
Leurs blocs finally ont nettoyé uniquement leurs fixtures. Le run final complet
réussit sans masquer ces erreurs ni désactiver les politiques.

## Nettoyage et reproductibilité

Le runner refuse de commencer si la base dev contient déjà des utilisateurs ou des
données métier ; il ne les efface pas. Chaque run conserve un manifeste privé sous
node_modules/.cache/admin-dev-tests avec IDs/chemins uniquement, jamais les mots de
passe ni JWT. Les fixtures portent un UUID de run ; nettoyage exact de ces IDs et
préfixes, jamais de suppression de bucket, de données tierces ou de trigger.
Le pointeur actif initial est restauré seulement si la release courante appartient
encore au run ; une autre publication arrête le nettoyage automatique.

Après recette, le contrôle final doit retrouver zéro utilisateur Auth, administrateur,
projet, révision, média, release et objet Storage de test ; pointeur actif null et
version 0. Le bucket privé et les migrations restent présents : ce sont les structures
de développement voulues, pas des résidus de test.

Commandes, depuis le dépôt, uniquement avec la session CLI autorisée :

```powershell
node scripts/check-dev-target.mjs
node scripts/run-dev-pgtap.mjs
# Attendre la fin ; ne pas exécuter les deux suites DB en parallèle.
node scripts/test-dev-api.mjs
node --test scripts/admin-foundation.test.mjs
npm run build
npm run lint
```

Pour diagnostiquer l’historique : `npx --no-install supabase migration list --linked
--project-ref pahbwurduwagdglpslos`. Ne pas utiliser ces commandes sur une autre cible.

## Limites et prochaine étape

- Le pipeline applicatif complet de décodage/réencodage, retrait EXIF, analyse PDF et
  quarantaine reste à développer. Les fixtures marquées validated sont des fichiers
  contrôlés de test, pas une preuve qu’un validateur générique existe déjà.
- Les limites de poids sont préparées dans le bucket et les contraintes SQL ; cette
  recette HTTP n’envoie pas un fichier de plus de 20 Mio et ne valide donc pas ce cas
  réseau de bout en bout. SVG et accès sont réellement testés.
- Sessions Vercel, cookies HttpOnly/CSRF, MFA, récupération de compte, CRUD HTTP complet,
  URLs signées de l’API applicative et vraie concurrence de deux transactions restent
  à implémenter/tester. Le test de version obsolète ne remplace pas un test de charge.
- Le lecteur public continue à utiliser ses fichiers JSON : aucun contenu dev n’est
  injecté dans le portfolio. La prévisualisation publique de Vercel n’a pas été modifiée.

Prochaine étape : API de session/édition et validation des uploads sur cette base de
développement, avant l’interface admin. Aucun commit, push ou déploiement effectué.
