# Profil, services et portfolio PDF — Supabase DEV

## Périmètre et lancement

Cette étape fonctionne exclusivement avec `kevin-portfolio-dev`, référence
`pahbwurduwagdglpslos`, région `eu-west-1`. Le portfolio public garde ses sources
locales actuelles. Aucun changement de production, de Vercel, de compte personnel,
aucun commit ni push n'est nécessaire pour cette recette.

```powershell
npm.cmd run dev:admin
```

Ouvrir `http://127.0.0.1:5173/admin`, se connecter, puis choisir **Profil, services
et PDF**. La configuration reste dans `.env.supabase-dev.local`, ignoré par Git.
Les secrets Supabase restent dans l'API et les scripts locaux, jamais dans React.

## Contenus et publication

La rubrique regroupe le profil, les contacts, deux portraits indépendants, les
services ordonnés, leurs images/crédits et la référence du PDF. Les textes actuels
et les derniers portraits validés (chemise bleue à l'accueil, jaune à propos)
ont été repris sans publier une nouvelle version. Les crédits sont conservés.
`scripts/seed-site-editor.mjs` initialise ce brouillon de manière reproductible
et ne remplace pas un espace de travail déjà initialisé.

Les sauvegardes créent des révisions immuables. Le pointeur `site_workspace`
désigne le brouillon ; la publication active désigne une autre révision.
**Enregistrer le brouillon** ne change donc aucune réponse publique.
Les contacts sont validés côté serveur : e-mail, numéro international, liens
sociaux HTTPS sans identifiants incorporés. Les liens `mailto:` et WhatsApp sont
construits à partir de ces valeurs ; aucun message n'est envoyé automatiquement.

**Publier profil, services et PDF** publie ce groupe atomiquement en reprenant
uniquement les révisions de projets déjà publiées. Les brouillons de projets ne
sont jamais inclus. Réciproquement, la première publication d'un projet utilise
le profil initial épinglé, jamais un nouveau brouillon du profil. Les conflits
de version restent des HTTP 409 ; il faut recharger avant de réessayer.

L'historique permet d'apercevoir puis de restaurer une version déjà publiée.
La restauration est une nouvelle publication, conserve le brouillon courant
et les projets actuellement publiés. Les références des anciennes versions
empêchent la suppression définitive de leurs fichiers. Aucun outil de purge
d'historique n'est fourni à cette étape.

L'aperçu privé montre les éléments éditables : accueil, deux portraits, textes
À propos, services, contacts et document. Ce n'est pas une copie complète de
toutes les pages et des rubriques publiques statiques. Les réponses privées
sont `no-store` et exigent session valide + rôle administrateur, côté API et SQL.

## Images et PDF

Les portraits et images des services réutilisent l'import sécurisé des projets,
avec choix dans la médiathèque, textes alternatifs et crédits séparés. La limite
des images reste **6 Mio** ; elle n'est pas utilisée pour les PDF.

Le PDF accepte **20 Mio (20 971 520 octets), 100 pages maximum**. Le document actuel
fait **9 515 589 octets, 32 pages** et a réellement été transféré et validé.
Chaque import utilise un chemin aléatoire neuf ; aucun PDF publié n'est écrasé.

1. L'API vérifie l'administrateur et ouvre une intention limitée à un fichier.
2. Le navigateur transfère directement au bucket privé `portfolio-pdf-incoming`
   avec TUS signé, chunks de 6 Mio, progression et reprise dans le même onglet.
   La route est `/storage/v1/upload/resumable/sign` sur le domaine Storage direct.
   Elle utilise la clé publiable et une signature limitée au chemin, pas de clé
   privilégiée ni de JWT de session exposé par l'API.
3. L'API réclame un verrou de validation, télécharge au maximum 20 Mio, vérifie
   le poids réel, la signature et la structure avec PDF-lib, puis interprète les
   opérations graphiques de toutes les pages avec PDF.js.
4. Les fichiers chiffrés, formulaires, scripts/actions actives et pièces jointes
   sont refusés. Garde-fous : 30 000 objets, profondeur 100, 200 000 opérations
   par page et 2 millions au total ; délai de 45 secondes pour la phase PDF.js.
5. Seul un PDF accepté est copié, sans réécriture, dans `portfolio-private` puis
   enregistré comme réutilisable. Un échec conserve la saisie et le brouillon.

Les gros fichiers ne transitent pas dans une requête entrante Vercel (limite
4,5 Mo). Les deux parseurs ne constituent pas un antivirus : cela reste une
limite de cette version. Les modules natifs et le temps d'exécution sur Linux
Vercel ont ensuite été vérifiés dans la Preview décrite dans
[le guide Vercel DEV](admin-dashboard-preview.md), avec le PDF réel de 32 pages.
Aucun déploiement en production n'a été effectué.

L'aperçu/téléchargement nécessite un administrateur. Il reçoit des liens signés
**120 secondes**, jamais inclus dans la lecture publique des brouillons. Un lien
signé est une capacité temporaire : une personne qui le reçoit peut le lire
jusqu'à expiration. Une dépublication ne retire ni les copies déjà téléchargées
ni instantanément une URL encore valide. Le lecteur intégré dépend du navigateur ;
les liens « Ouvrir » et « Télécharger » restent proposés avec actualisation.
Le nom de téléchargement accepte lettres, chiffres et tirets, suivi de `.pdf`.

Au maximum cinq intentions PDF en attente et dix par jour par administrateur.
Le nettoyage explicite traite dix intentions expirées à la fois, après **27 h**
(signature de transfert 2 h, session TUS pouvant durer 24 h, marge). Il cible
leurs chemins exacts, jamais un bucket entier ni des fichiers enregistrés et
référencés. La suppression définitive demande confirmation et est refusée si
une révision de profil conservée référence le PDF.

## Migrations appliquées uniquement sur DEV

- `202611030006_site_editor.sql` : champs, espace de travail privé, contrats,
  brouillon, aperçu, publication/restauration atomiques, projection publique.
- `202611030007_pdf_imports.sql` : bucket privé, intentions, validation, quotas,
  bibliothèque et suppression protégée.
- `202611030008_site_workspace_safe_update.sql` : sauvegarde compatible avec
  `safeupdate` (clause WHERE explicite), sans désactiver cette protection.
- `202611030009_project_profile_publication_boundary.sql` : profil initial
  épinglé pour isoler la publication des projets des brouillons du profil.

Les fonctions privilégiées contrôlent les droits et utilisent un search_path
explicite. Les tables privées ont la RLS ; le navigateur ne peut ni déclarer
un fichier validé ni écrire directement dans le bucket final.

## Vérifications réellement exécutées

```powershell
node --test scripts/admin-foundation.test.mjs scripts/admin-images.test.mjs scripts/admin-site.test.mjs
node scripts/run-dev-pgtap.mjs
node scripts/test-admin-site.mjs
npm.cmd run build
npm.cmd run lint
```

- **13 tests Node réussis**, dont vrais petits PDF, faux document, PDF tronqué,
  script actif, poids excessif, validation des contacts et protocoles.
- **19 assertions pgTAP réussies** après les nouvelles migrations, transaction
  de test intégralement annulée.
- **36 contrôles HTTP/Auth/API/Storage réussis** le 3 novembre 2026 : refus
  anonyme/non-administrateur, sauvegarde/relecture, portraits/services réellement
  téléchargeables et décodables, ordre/crédits, frontières de publication dans
  les deux sens, brouillon absent du public, ancien PDF conservé, transfert réel
  de 9,52 Mo, analyse 32 pages, téléchargement au hash inchangé avec nom adapté,
  limite réelle Storage, faux PDF refusé après upload, conflits 409, suppression
  référencée refusée, publication et restauration.
- Build et lint réussis. Le SDK TUS est chargé à la demande par la dashboard.
- Fixtures de comptes/projet/PDF/révisions/publications nettoyées ; pointeurs
  initiaux restaurés. L'empreinte des 18 projets importés est inchangée et le
  compte personnel n'a pas été modifié.

La première intégration TUS utilisait la mauvaise route ; elle a été corrigée
vers la route signée officielle avant la recette réussie. Une erreur de
connexion CLI avant envoi SQL a nécessité une reprise du nettoyage ciblé ; aucun
rejeu automatique n'est effectué après une mutation au résultat ambigu.

Le contrôle visuel ordinateur/mobile n'a pas pu aboutir : le navigateur intégré
n'a pas accédé au serveur local. Les tests HTTP utilisent réellement le même
handler, mais ne prouvent pas la mise en page ou le fonctionnement du lecteur
PDF natif. Ces deux contrôles restent à faire manuellement.

## Recette manuelle

1. Ouvrir `/admin`, puis **Profil, services et PDF**. Vérifier les deux portraits
   et les textes préremplis.
2. Modifier un texte, ajouter un service, le monter/descendre (boutons utilisables
   au clavier), choisir éventuellement une image et ses crédits.
3. **Enregistrer le brouillon**, puis **Recharger le brouillon** pour contrôler
   la persistance. **Prévisualiser le profil** affiche la version enregistrée.
4. Importer un PDF inférieur à 20 Mio. Attendre le transfert puis la validation ;
   ajuster son nom, enregistrer et ouvrir l'aperçu privé/téléchargement.
5. **Publier profil, services et PDF** agit seulement sur DEV après confirmation.
   Après une seconde publication, utiliser l'historique pour restaurer la première.
   Aucun brouillon de projet ne sera publié et le site public restera inchangé.

## Références officielles

- [Supabase : transferts reprenables](https://supabase.com/docs/guides/storage/uploads/resumable-uploads)
- [Exemple officiel TUS signé](https://github.com/supabase/supabase/blob/master/examples/storage/resumable-upload-signed-uppy/index.html)
- [Supabase : liens signés](https://supabase.com/docs/reference/javascript/storage-from-createsignedurl)
- [PDF.js](https://mozilla.github.io/pdf.js/getting_started/)
- [Vercel : limites des fonctions](https://vercel.com/docs/functions/limitations)
