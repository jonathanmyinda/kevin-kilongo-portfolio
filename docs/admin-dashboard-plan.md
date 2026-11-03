# Plan technique — administration du portfolio

Date : 2 novembre 2026. Audit uniquement, aucune infrastructure créée.

## 1. État du projet

- Aucun AGENTS.md applicable trouvé dans les ancêtres ou les sources inspectées.
- État initial propre ; branche `feat/admin-dashboard` créée depuis `main`, commit
  `84aec19`. Aucun changement local préexistant susceptible d’interférer.
- React 19, Vite 8, Tailwind 4, React Router 8 ; aucune base, authentification ou
  API d’administration actuelle. Ne pas confondre le formulaire Formspree masqué
  avec un backend de gestion.
- `src/data/catalog.js` fusionne `projects.json` (18 projets), `profile.json`,
  `published-media.json` (images réellement affichées) et `homepage-selection.json`.
  Les anciennes références d’images de projects.json ne sont pas toutes publiques.
- Présentation, signatures, services et certains liens sont aussi codés dans
  HomeSections.jsx et Layout.jsx ou surchargés dans catalog.js : migrer le rendu
  effectif, pas uniquement le JSON historique. L’adresse résidentielle et les notes
  internes ne doivent pas être reprises dans le modèle public.
- Routes : `/`, `/projets`, `/projets/:slug`, page introuvable ; Perspectives est
  `/#perspectives`, pas une page indépendante. Conserver filtres et ancres.
- `public/` : 131 fichiers, 22 639 356 octets au total ; PDF de 9 515 589 octets,
  deux nouveaux portraits en couleur, images optimisées et polices locales.
  Archives PDF/SITE123 et portraits originaux restent dans docs, hors publication.
- Vercel : build npm run build, sortie dist, réécriture SPA. Projet existant
  kevin-kilongo-portfolio ; main déployée automatiquement. Aucun changement distant
  effectué pendant cet audit.

## 2. Architecture recommandée

Conserver le portfolio React/Vite et son design. Ajouter une application admin
chargée à la demande sous `/admin`, `/admin/connexion` et `/admin/apercu/...`.
Supabase fournit Auth, PostgreSQL avec RLS et Storage durable. Une mince API de
fonctions Vercel prend en charge sessions, validation des fichiers, publication et
lecture publique. Ni édition de fichiers Git ni écriture durable sur le disque
Vercel ; le disque temporaire éventuel sert uniquement au traitement d’un upload.

Choix : un seul fournisseur pour les identités, données et fichiers simplifie les
sauvegardes et permet des transactions pour la publication. Un CMS externe complet
reste une alternative si le propriétaire préfère une interface standard, mais
n’est pas nécessaire pour 18 projets et les règles de crédits spécifiques.

### Identité et sessions

Connexion e-mail/mot de passe avec Supabase Auth, inscription publique ET connexion
anonyme désactivées dans le service. Création/invitation des administrateurs par le
propriétaire via une opération privilégiée, jamais depuis un écran public.
`admin_members` référence les UUID Auth explicitement autorisés et leur état actif.
Une session valide sans appartenance active ne donne aucun droit de gestion.
Aucun utilisateur ne peut s’ajouter à cette liste ni modifier son propre rôle.

Préférer une session via API même origine, cookies Secure/HttpOnly/SameSite,
renouvellement et révocation gérés avec les outils Auth officiels ; ne pas stocker
les jetons dans localStorage. Vérifier le JWT côté serveur, son expiration et
l’autorisation à chaque opération. Protection CSRF (jeton + vérification Origin)
pour les requêtes mutantes utilisant les cookies. Déconnexion : révoquer le refresh
et effacer les cookies ; la désactivation dans admin_members bloque immédiatement
les nouvelles opérations, même avec un JWT pas encore expiré. Recommander MFA TOTP,
avec contrôle AAL2 pour les opérations sensibles après activation et récupération
préparée. SMTP réel nécessaire pour invitations/récupération fiables.

### API et permissions

- `GET /api/content` : projection explicite de la publication active seulement.
- `/api/admin/*` : connexion, lecture/édition, préparation uploads, aperçu,
  publication, archivage, export. Vérification serveur obligatoire, erreurs 401/403.
- API utilisant le JWT de l’utilisateur pour les opérations ordinaires : RLS reste
  effective même si un appelant contourne React. Privilèges serveur uniquement
  pour les opérations étroites qui les exigent ; contrôle admin avant ces appels.
- Schéma privé pour versions et listes d’administration, non exposé à la Data API.
  RLS activée sur toute table exposée, droits SQL minimaux, aucune écriture anon.
  Appliquer aussi les politiques sur storage.objects. Ne pas utiliser user_metadata
  modifiable par le client comme preuve d’administration.
- Fonctions privilégiées : search_path fixé, références qualifiées et EXECUTE
  retiré de PUBLIC/anon. Contrôle admin interne. Préférer security invoker ; une vue
  exposée doit être security_invoker et ne contenir aucune donnée de travail.
- Limites de taille, fréquence et pagination côté API/service ; pas de journalisation
  des sessions, secrets ou corps complets. Audit minimal des actions et identifiants.

Vercel devra router `/api/*` vers les fonctions avant le fallback SPA ; tester qu’une
API inconnue retourne du JSON 404 et non index.html. Conserver les routes publiques
et la page introuvable React. Configurer secrets séparément en Preview/Production ;
les previews Git ne doivent jamais recevoir par défaut un accès administratif de
production. Prévoir un projet Supabase de test distinct.

## 3. Modèle de données proposé

| Entité | Données et contraintes |
| --- | --- |
| admin_members | user_id UUID Auth unique, actif, rôle, créé_par ; gestion propriétaire uniquement |
| projects | UUID, legacy_id unique project-01…18, slug unique et stable, numéro, archived_at ; pas de texte de brouillon public |
| project_revisions | UUID, project_id, numéro de version, titre, description, catégorie, localisation nullable, mission publique exacte, agence, contexte académique/personnel/agence, crédits, outils, faits optionnels, provenance privée, auteur, dates ; immuable après publication |
| revision_media | revision_id, media_id, position unique, légende, alt, crédit, rôle couverture ; couverture appartenant à la galerie |
| media | UUID, clé Storage immuable, nom original, MIME vérifié, octets, dimensions, sha256, état pending/validated/rejected, auteur ; pas d’écrasement de fichier |
| site_revisions | présentation, signatures, parcours, formation, logiciels/langues, coordonnées/liens validés, portraits distincts, services ordonnés, PDF référencé ; schéma JSON validé et versionné |
| releases | UUID, version du schéma, état préparée/publiée, date, auteur ; publication immuable |
| release_projects | release_id, project_id, revision_id ; inclut exactement les projets visibles |
| release_featured | release_id, project_id, position unique ; référence à release_projects |
| release_perspectives | release_id, media_id, project_id, position ; conserve la sélection actuelle |
| site_state | singleton active_release_id + compteur pour verrouillage optimiste |
| media_dependencies | relations explicites vers révisions, portraits, services, PDF et releases ; clés étrangères restrictives |
| audit_events | acteur, action, identifiant concerné, date, ancienne/nouvelle release ; sans secret ni contenu complet |

Les brouillons modifiables sont de nouvelles révisions ; le contenu publié n’est
jamais écrasé. Utiliser un numéro de version attendu pour empêcher deux appareils
d’écraser silencieusement leurs éditions. Une modification concurrente impose de
recharger/comparer les changements. Les slugs existants restent fixes en V1 ; une
future modification exigera une table d’alias et une redirection explicite.

## 4. Fichiers et prévisualisation privée

Bucket privé unique pour originaux, images et PDF versionnés. Aucun upload de
brouillon dans public/ ou un bucket public. Import direct navigateur → Storage via
URL d’upload autorisée courte durée, préparée par le serveur pour un admin ; aucun
secret dans cette URL au-delà du droit limité prévu. La taille des fichiers ne doit
pas dépendre de la limite du corps d’une fonction Vercel (4,5 Mo).

Validation serveur après upload avant statut validated : signature réelle, décodage,
MIME, dimensions/pixels, quota et poids ; ne pas croire extension/Content-Type client.
Images JPEG/PNG/WebP seulement en V1, maximum proposé 10 Mo et 30 mégapixels ; exclure
SVG/HTML, conserver couleurs/ICC, normaliser orientation et retirer EXIF GPS. Générer
dérivés responsive sans agrandir ; conserver original privé et crédits. Prévoir une
fonction de traitement avec mémoire/durée bornées, et job durable si ces limites
sont dépassées : un travail ne doit pas dépendre d’une fonction laissée en arrière-plan.
PDF : maximum proposé 20 Mo, signature et parsing PDF, rejet des fichiers corrompus,
chiffrés ou actifs suspects ; validation terminée avant publication. L’ancien PDF
reste actif jusqu’au changement de release. Ces seuils sont des choix applicatifs,
à confirmer ; le PDF actuel tient dans cette limite.

Le portfolio obtient des URL signées courtes uniquement pour les médias de la release
active ; un endpoint de résolution vérifie la dépendance publiée avant signature.
RLS interdit la lecture anon des objets privés et l’énumération. L’aperçu admin
utilise une API distincte, autorisation à chaque lecture et URLs privées ; no-store,
noindex, aucun lien de partage anonyme en V1. Ne jamais mettre un brouillon dans une
réponse publique, même si React le masque ensuite. Les URL signées ne sont pas des
liens permanents et doivent être renouvelées après expiration.

Supprimer un média utilisé est refusé avec la liste des dépendances : brouillons,
publications actuelles et historiques inclus. Archivage logique recommandé ; purge
physique uniquement après confirmation, sauvegarde et expiration de la rétention.
La suppression d’un objet Storage ne sera jamais confiée au client librement : droits
DELETE réservés à une fonction serveur vérifiant les dépendances transactionnelles.

## 5. Publication et lecture publique

1. Enregistrer le brouillon n’affecte que la révision de travail.
2. Prévisualiser rend cette révision dans une session admin ; aucun cache public.
3. Publier crée une release candidate basée sur la release active et remplace seulement
   les révisions explicitement choisies. Valider titres, crédits, couvertures, ordre,
   médias et PDF, avec résumé de ce qui sera rendu public.
4. Une transaction PostgreSQL vérifie version attendue et autorisation, puis bascule
   active_release_id. Tout réussit ou l’ancienne release reste active. Aucun appel
   Storage lent dans la transaction ; les fichiers doivent être validés auparavant.
5. Dépublier retire le projet de la prochaine release et des sélections ; archiver
   confirme l’action et conserve les versions. Un ancien slug dépublié rend la page
   introuvable, sans exposer le brouillon. Pas de suppression définitive en V1.

Le frontend remplace les imports JSON par un adaptateur conservant l’interface du
catalogue et les composants actuels. GET /api/content produit une projection autorisée
sans provenance interne, identifiants Auth ou brouillons. Données publiques no-store
au début pour éviter des révisions mêlées et faciliter les dépublications ; médias
signés à durée limitée. Mettre à jour tout le catalogue en un seul état cohérent.
Une page déjà ouverte nécessite rafraîchissement ou revalidation au retour au premier
plan ; prévoir ce comportement. Pas de rebuild Git pour publier un contenu.

En cas d’indisponibilité, conserver le dernier état déjà chargé en mémoire et afficher
une erreur/reprise aux nouvelles visites ; ne pas retomber silencieusement sur les
anciens JSON après migration, ce qui ressusciterait un projet dépublié. Au basculement
initial, garder le site statique existant jusqu’à validation complète du nouveau
lecteur. Pour les médias publiés, des copies déjà téléchargées ou URL signées déjà
émises peuvent survivre à une dépublication jusqu’à expiration ; confidentialité
stricte des brouillons, pas promesse de révocation instantanée des copies publiques.

## 6. Migration sans perte

Créer un export de référence depuis catalog.js ET les composants : 18 slugs actuels,
missions publiques, crédits d’agence, contexte académique et faits nullable. Migrer
les 6 projets mis en avant, 4 Perspectives, 4 services, signatures et textes, liens
sociaux effectivement utilisés, WhatsApp et mailto devis, parcours, portraits actuels,
PDF et réglages de cadrage. Conserver role/sourcePages privés et publicRole séparé ;
ne jamais transformer un rendu en bâtiment construit. Ne pas importer l’adresse
résidentielle ni les informations sociales manquantes comme contenus publics.

Migration idempotente par legacy_id et sha256 : copie des seuls médias effectivement
référencés, vérification des octets/dimensions/alt/crédits/ordre, aucune association
inférée. Préserver les fichiers partagés par déduplication, sans modifier leurs usages.
Comparer un manifeste avant/après et les 18 pages. Les archives originales restent
hors public et ne sont pas aspirées comme galerie.

Préserver `/projets/<slug>` exactement. Garder les anciens chemins publics des médias
et du PDF comme copies historiques statiques, sans écrasement, pendant la transition ;
ils restent téléchargeables par leurs anciennes URL. Les nouveaux contenus utilisent
les objets durables versionnés. Mettre à jour les validateurs historiques : le
manifeste d’extraction et certaines vérifications média précèdent le remplacement
récent des portraits. Ne pas réimporter ces anciens portraits à la place des nouveaux.
Après validation en environnement distinct, importer une release initiale puis
basculer explicitement le lecteur public. Ni migration ni basculement aujourd’hui.

## 7. Sauvegarde, export et retour arrière

Exporter les données et releases en JSON versionné, manifeste des fichiers avec
empreintes, et copie binaire des objets (originaux et dérivés). Export admin privé ;
archive distribuée en lien signé de courte durée, sans mot de passe/secret. Pour de
gros volumes, tâche durable et téléchargement Storage plutôt qu’un gros retour API.
Compléter par dump PostgreSQL, schéma/migrations/politiques et procédure de restauration
Auth ; ne pas mettre les dumps contenant des données privées dans Git. Sauvegarde
hors fournisseur chiffrée, accès propriétaire, fréquence quotidienne proposée et avant
migration/purge ; rétention proposée 30 jours à chiffrer selon volume.

Les sauvegardes SQL ne contiennent pas les fichiers Storage. Tester une restauration
complète dans un environnement isolé, y compris droits et dépendances. En Free, pas
de sauvegarde automatique incluse : le propriétaire doit assurer ces exports ; une
copie locale unique ne suffit pas. Propose un objectif de perte maximale 24 h uniquement
si la sauvegarde quotidienne est effectivement automatisée et contrôlée.

Retour éditorial : repointer active_release_id vers une release antérieure dans une
transaction validée, sans mutation des anciennes révisions. Retour du code : version
Vercel précédente compatible avec le schéma ; un rollback Vercel seul ne restaure ni
base ni fichiers. Migrations SQL additives au début, export avant migration destructive.

## 8. Réalisation dans l’ordre

1. Valider cette architecture et les décisions ci-dessous. Préparer schéma SQL,
   contrats JSON et tests d’autorisation localement, sans dépendance de production.
2. Après autorisation, créer le projet Supabase de test ; configurer Auth sans
   inscription publique, SMTP/récupération, admin_members et RLS. Tester anon,
   authentifié non-admin, admin actif, admin révoqué et sessions expirées.
3. Implémenter sessions/API/admin mobile : connexion/déconnexion, navigation séparée,
   états d’erreur ; pas de menu admin public nécessaire. Test CSRF et accès direct API.
4. Implémenter Storage privé, uploads validés, dépendances, export et restauration.
   Tester faux MIME, surcharge, fichier corrompu et suppression d’un média utilisé.
5. Implémenter projets et révisions, galerie/couverture/ordre, sélection d’accueil,
   aperçu privé puis publication atomique et concurrence entre deux appareils.
6. Externaliser présentation/services/parcours/contacts/portraits/PDF. Interface
   française : Enregistrer le brouillon, Prévisualiser, Publier ; confirmer archivage,
   suppression et retour arrière. Avertir avant fermeture/navigation interne avec
   modifications non enregistrées ; ne pas promettre de blocage infaillible sur mobile.
   Sauvegarde durable explicite, sans se reposer sur localStorage pour le contenu.
7. Migrer et comparer les 18 projets en test, adapter le lecteur public sans refonte.
   Vérifier que champs de brouillon, historique privé et uploads non validés sont
   absents des réponses anon et des caches, et inaccessibles par URL directe.
8. Recette desktop/mobile/clavier, réseau interrompu, erreurs de publication et
   restauration ; vérifier les crédits, routes, médias, PDF et quatre services.
9. Après validation séparée : configurer production, sauvegarder/importer, tester
   permissions, déployer le code sur Vercel puis basculer la release. Ne pas connecter
   les previews arbitraires Git au backend de production. Surveillance des quotas.

## 9. Paramètres et interventions du propriétaire

- Confirmer les administrateurs autorisés (UUID après invitation), Kévin compris ;
  l’adresse de contact publique n’accorde pas automatiquement le rôle admin.
- Créer/posséder les comptes quand cette étape sera autorisée ; choisir région de
  données, organisation, projet de test et de production, récupérer les accès de
  secours. Connexion et validation personnelle réalisées par le propriétaire.
- Fournir l’URL et la clé publique du projet par la configuration prévue ; installer
  les secrets via les paramètres sécurisés Vercel/Supabase, jamais dans la conversation.
- Choisir SMTP/expéditeur vérifié pour Auth et valider l’adresse ou le domaine requis
  par ce fournisseur. Aucun domaine à acheter/configurer dans cette phase.
- Valider MFA, limites uploads, conservation des exports et droits sur les médias,
  comportement en panne et fréquence attendue de publication.
- Décider de l’hébergement commercial et budget avant passage en production.
- Lister les URLs Auth exactes : production actuelle + localhost de développement,
  et preview de test explicitement autorisée ; pas de wildcard large pour production.

## 10. Clés et secrets

| Valeur | Emplacement |
| --- | --- |
| URL Supabase, clé publishable sb_publishable_… | Publiques ; VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY possibles si accès direct choisi ; aucune autorisation admin par cette clé |
| Clé anon legacy | Publique mais préférer publishable pour un nouveau projet ; RLS indispensable |
| sb_secret_…, service_role legacy, mot de passe DB, jeton CLI, SMTP | Paramètres serveur protégés uniquement, jamais VITE_*, Git, logs ou bundle |
| Jetons utilisateur | Cookies sécurisés dans l’option API recommandée ; jamais traités comme des clés publiques |
| URL signée Storage | Autorisation limitée et temporaire ; ne pas journaliser ni mettre dans une URL d’aperçu partageable |

API recommandée même origine : la clé publishable peut rester serveur aussi ; sa
publicité n’est pas un mécanisme de sécurité. Fournir seulement un .env.example
fictif lors de l’implémentation et garder les fichiers locaux ignorés. Le serveur
ne doit jamais convertir une clé secrète en accès admin pour une requête non autorisée.

## 11. Coûts, limites et décisions ouvertes

Documentation consultée le 2 novembre 2026 ; revalider les offres avant souscription.
Supabase Free peut servir au développement : base 500 Mo, fichiers 1 Go, 50 000
utilisateurs actifs mensuels, 2 projets actifs maximum, sorties 5 Go non cachées et
5 Go cachées (quotas distincts), upload maximum 50 Mo. Mise en pause possible après
une semaine d’inactivité ; pas de sauvegardes automatiques ni transformation d’images
incluse. Nos 22,6 Mo publics tiennent largement, mais originaux, historique et PDF
répétés consomment ce stockage et le trafic peut dominer. Ce calcul n’est pas une
garantie de production gratuite durable. Voir [tarifs](https://supabase.com/pricing)
et [facturation](https://supabase.com/docs/guides/platform/billing-on-supabase).

Supabase Pro démarre à 25 USD/mois ; coûts supplémentaires possibles pour calcul,
stockage, trafic et sauvegardes avancées. SMTP, traitement d’images et conservation
hors fournisseur peuvent avoir leurs propres coûts. Aucun abonnement souscrit.

Vercel Hobby reste limité à un usage personnel non commercial. Un portfolio destiné
à obtenir des clients peut relever d’un usage commercial : faire confirmer
l’éligibilité avant d’étendre ce déploiement. Pro affiché à partir de 20 USD/mois,
plus consommation éventuelle ; pas d’achat automatique. Voir
[Hobby](https://vercel.com/docs/plans/hobby) et [tarifs Vercel](https://vercel.com/pricing).
Le backend devra respecter les limites de fonctions ; uploads directs Storage pour
éviter le plafond de requête/réponse 4,5 Mo des fonctions Vercel.

Décisions encore nécessaires : budget de production et tolérance à la pause,
région, liste admin/MFA, fournisseur SMTP, fréquence/rétention des sauvegardes,
limites exactes de fichiers et éventuel partage d’aperçus (hors V1 par défaut).

## 12. Références officielles complémentaires

- [Auth : désactiver les inscriptions](https://supabase.com/docs/guides/auth/general-configuration)
- [SMTP et restrictions de l’envoi par défaut](https://supabase.com/docs/guides/auth/auth-smtp)
- [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Clés publiques et secrètes](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys)
- [Buckets privés/publics et restrictions](https://supabase.com/docs/guides/storage/buckets/fundamentals)
- [Politiques Storage](https://supabase.com/docs/guides/storage/security/access-control)
- [Fonctions et privilèges SQL](https://supabase.com/docs/guides/database/functions)
- [Sécurité des API](https://supabase.com/docs/guides/api/securing-your-api)
- [Sauvegardes et objets Storage](https://supabase.com/docs/guides/platform/backups)
- [Limites des fonctions Vercel](https://vercel.com/docs/functions/limitations)

## Bilan de la mission

Audit du code et documentation uniquement. Branche créée, ce fichier est le seul
nouveau livrable. Aucun compte, secret, migration ou changement des données distantes.
Aucun commit, push ni déploiement. Build/lint non relancés : aucune modification du
code applicatif. Première étape proposée : contrats de données, migrations SQL et
tests de politiques en local, avant toute interface de gestion ou connexion distante.
