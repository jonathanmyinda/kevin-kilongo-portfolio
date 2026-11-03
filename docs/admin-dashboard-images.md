# Images des projets — parcours DEV

Implémenté sur `feat/admin-dashboard`, uniquement dans **kevin-portfolio-dev**,
référence `pahbwurduwagdglpslos`, région `eu-west-1`. Aucun déploiement ni changement
de source des contenus du portfolio public. Le PDF et le profil ne sont pas éditables
par ce parcours. Aucun compte ou rôle humain modifié durant cette étape.

## Essai personnel

1. Lancer `npm.cmd run dev:admin`, puis ouvrir http://127.0.0.1:5173/admin.
2. Se connecter et choisir **TEST — Vérification de l’éditeur**, conservé pour vos
   essais personnels. Les fixtures automatisées et le projet de recette navigateur
   ont été supprimés ; les 18 projets importés sont préservés.
3. Dans **Images et crédits → Importer des images**, choisir un JPEG, PNG ou WebP.
   Chaque ligne indique autorisation, transfert avec progression, validation,
   réussite ou erreur avec possibilité de réessayer.
4. Une image validée rejoint le brouillon. Renseigner son texte alternatif, sa
   légende et son crédit ; choisir la couverture. **Monter/Descendre** fonctionne
   au clavier (Tab puis Entrée/Espace), sur mobile et à la souris, sans glisser-déposer.
5. **Enregistrer le brouillon**, rouvrir le projet ou recharger, puis **Prévisualiser**.
   Rien ne change dans la version publiée tant que Publier n'a pas réussi.
6. **Retirer du brouillon** enlève seulement l'image de la saisie ; enregistrer pour
   conserver ce retrait. Les anciennes versions gardent leurs références.
7. Dans **Images importées disponibles et suppressions**, une image validée peut
   être ajoutée à nouveau. Ses derniers légende, texte alternatif et crédit enregistrés
   sont proposés ; les vérifier avant sauvegarde. La suppression définitive demande
   confirmation et est refusée si une version conservée ou un autre contenu l'utilise.

Un fichier rejeté n'est jamais ajouté à la galerie. La saisie du formulaire reste
en place après un échec ; une réponse réseau perdue ne déclenche pas un écrasement.
Après fermeture/rechargement volontaire sans sauvegarde, la saisie locale peut être
perdue, d'où l'avertissement existant. Les images déjà validées restent dans la
bibliothèque et peuvent être reprises même sans enregistrement du brouillon.

## Limites cohérentes

| Contrôle | Valeur |
|---|---|
| Formats entrants | JPEG, PNG, WebP fixes uniquement |
| Poids entrant | 6 Mio = 6 291 456 octets, interface/API/bucket de quarantaine |
| Dimensions | 6 000 px par côté, 20 000 000 pixels au total |
| Sortie serveur | WebP qualité 90, mêmes proportions, orientation EXIF appliquée, sRGB |
| Poids de sortie | 3 Mio maximum ; si dépassé, refus et demande de réduction des dimensions |
| Métadonnées | EXIF/XMP retirés ; légendes/crédits versionnés séparément, filigranes visibles conservés |
| Galerie | 100 images maximum, une couverture obligatoire |
| Admission | 20 imports en attente non expirés et 100 nouvelles demandes par administrateur sur 24 h |
| Bibliothèque | 100 imports validés les plus récents ; historique des références conservé en base |

La limite de payload Vercel est de 4,5 MB. Le navigateur envoie donc les octets
directement à Storage et **pas à l'API Vercel**. L'API ne reçoit que du JSON borné
à 100 000 octets ; elle télécharge ensuite les octets de Storage pour les vérifier.
Les nouvelles images d'aperçu font au plus 3 Mio. Les 126 images héritées existantes
ont été mesurées : la plus lourde fait 679 821 octets ; elles n'ont pas été réencodées.
Le bucket final historique garde ses limites précédentes pour compatibilité,
notamment avec le PDF. Cela ne relève pas la limite de 6 Mio du nouveau parcours.

## Chaîne de confiance

1. Le handler vérifie la session Auth et le rôle actif avant chaque action. Les
   POST exigent l'origine attendue et du JSON. Les cookies restent HttpOnly.
2. `admin_begin_image` vérifie à nouveau le rôle, les limites et les quotas, puis
   crée un import d'attente avec deux chemins UUID inédits. Pas de nom fourni
   par le visiteur utilisé comme chemin de fichier.
3. L'API utilise la clé serveur pour émettre une autorisation Storage signée,
   limitée à **un chemin** du bucket privé `portfolio-incoming`, sans upsert.
   Cette autorisation de transfert est valable deux heures selon Supabase ;
   elle est volontairement un droit temporaire transférable par son détenteur,
   pas un accès en lecture ni un JWT administrateur. Ne pas journaliser son URL.
4. Le bucket n'accorde aucun accès client ordinaire à la quarantaine, même aux
   administrateurs. Seul le service lit les octets pour finaliser l'import.
   L'ancienne écriture directe par JWT admin dans le bucket final est retirée ;
   le nouveau parcours passe donc par la quarantaine et la validation serveur.
   Une révocation interdit immédiatement de demander une nouvelle autorisation,
   de finaliser, lire ou supprimer. Elle ne révoque pas une autorisation de transfert
   déjà émise : celle-ci reste limitée à son chemin jusqu'à expiration, et ne peut
   pas rendre son contenu publiable sans une nouvelle validation autorisée.
5. `image-finish` prend un bail de validation en base. Le serveur compare le poids
   réel au poids annoncé, contrôle la signature avant de solliciter un décodeur,
   identifie le format avec Sharp/libvips, contrôle les
   dimensions, refuse les animations, décode tous les pixels et réencode le résultat.
   `metadata()` seul et une compression navigateur ne sont jamais une validation.
   Les chunks APNG/WebP animés sont aussi inspectés : certains décodeurs PNG ne
   présentent que la première frame à metadata(). Transparence PNG préservée.
6. Le résultat va sur un nouveau chemin du bucket privé final. Pas d'upsert :
   en cas de réponse perdue, un résultat existant doit avoir la même empreinte
   SHA-256. L'enregistrement `media.validated=true` est créé seulement après
   décodage et écriture réussis. Un import d'attente n'est ni listé ni réutilisable
   dans une sauvegarde ou une publication.
7. Les aperçus passent par l'API authentifiée existante, sans URL publique ou signée
   de téléchargement du brouillon. Réponses privées `no-store` et contrôle de rôle
   renouvelé à chaque requête. Les secrets restent dans `.env.supabase-dev.local`.

`SUPABASE_DEV_SECRET_KEY` est désormais nécessaire **à l'API serveur** pour valider,
créer les autorisations limitées et supprimer les fichiers ; elle était déjà
présente localement pour les scripts. Aucun secret `VITE_*` ni clé privilégiée dans
React. La future configuration Vercel n'est pas effectuée ici.

## Retrait, suppression et nettoyage

Le retrait est versionné : sauvegarder une galerie sans une image ne supprime pas
ses anciennes références. La suppression physique est donc volontairement refusée
pour **toute** version conservée, publiée ou non, ainsi que pour les références du
profil, des services et des variantes. Le message cite les projets concernés.
Une purge d'historique n'est pas fournie par cette étape ; il n'existe pas de bouton
contournant cette protection. Les médias hérités ne sont pas ajoutés arbitrairement
à la nouvelle bibliothèque ; ils conservent leurs références et leurs fichiers.

Une suppression autorisée prend un verrou sur le média et le marque indisponible
avant l'appel Storage. Un trigger sur la galerie verrouille/vérifie le média avant
toute nouvelle référence, et le trigger Storage précédent protège encore le binaire.
En cas d'interruption, le média reste en cours de suppression et le bouton permet
de reprendre. L'API vérifie une vraie absence du binaire et la base vérifie encore
son absence avant de retirer le registre. Les fichiers déjà téléchargés ne peuvent
pas être rappelés.

Les originaux en quarantaine sont conservés au moins **2 h 15**. Cela évite de
supprimer puis permettre de recréer un objet avec une autorisation encore valide.
Le bouton **Nettoyer les imports temporaires expirés** traite au plus 20 entrées
expirées par appel, par leurs chemins exacts : originaux temporaires et éventuels
résultats provisoires sans média enregistré. Il ne supprime jamais le résultat
validé d'une image encore enregistrée. Les fichiers apparus tardivement après
une interruption sont retrouvés à l'appel suivant. Les imports validés mais jamais
attachés restent disponibles jusqu'à une suppression explicite confirmée.
Pas de cron distant installé : le nettoyage est une action administrateur, pas une
promesse de purge automatique permanente. Aucun balayage destructeur de bucket.

## Fichiers et migrations

- `server/admin/images.mjs` : validation Sharp et orchestration privée.
- `server/admin/handler.mjs` : actions `images` (GET), `image-begin`, `image-finish`,
  `image-delete`, `image-cleanup` (POST), après contrôle de session/rôle.
- `src/admin/ProjectImages.jsx` et `project-images.css` : transferts directs XHR,
  progression, reprises et bibliothèque ; intégration dans l'éditeur existant.
- `202611030002_project_images.sql` : imports, RLS, bucket privé, fonctions
  utilisateur/service séparées et protection contre une référence pendant suppression.
- `202611030003_image_cleanup_recovery.sql` : reprise du nettoyage après interruption.
- `202611030004_image_reuse_credits.sql` : préremplissage des crédits à la réutilisation.
- `202611030005_final_bucket_server_writes.sql` : écritures finales réservées au serveur.

Ces quatre migrations sont réellement appliquées et enregistrées sur DEV. Les fonctions
service sont refusées à anon et authenticated ; elles exigent aussi un acteur encore
administrateur. Toutes les nouvelles tables ont RLS, sans écriture client directe.
La table de médias ne reçoit qu'un indicateur de suppression, sans modification
des contenus importés ni de la projection publique.

## Contrôles réellement exécutés

```powershell
node scripts/test-admin-images.mjs
node scripts/run-dev-pgtap.mjs
node --test scripts/admin-images.test.mjs scripts/admin-foundation.test.mjs
npm.cmd run build
npm.cmd run lint
node scripts/check-dev-import.mjs
```

Ne pas exécuter plusieurs suites modifiant la publication simultanément.

- **33 contrôles HTTP réels** : Auth, API applicative, upload signé direct Storage,
  JPEG/PNG/WebP valides, poids excessif annoncé et réel, quarantaine privée, accès
  anonymes/non-admin refusés, écriture directe finale refusée même au JWT admin,
  RPC privilégiée refusée au JWT utilisateur, validation
  idempotente, aucun écrasement, binaire privé décodable, ordre/couverture/légendes/
  crédits rechargés, aperçu, version publiée conservée pendant édition/retrait,
  refus de suppression référencée, suppression orpheline confirmée, formats réels
  incohérents, contenu invalide, dimensions excessives, transfert absent, réutilisation
  prématurée refusée, brouillon inchangé après échecs et nettoyage ciblé expiré.
- **19/19 assertions pgTAP** : transaction de fixtures entièrement annulée.
  Le cas d'upload direct admin historique est maintenant remplacé par son refus
  attendu dans le bucket final ; l'upload signé courant est testé par HTTP.
- **5 tests de validation Sharp** : orientation, décodage complet, métadonnées,
  troncature, format/poids/dimensions, transparence et APNG animé réel.
- **5 tests de fondation**, build, lint sans avertissement et diff check.
- **Navigateur connecté réellement** : deux imports fictifs, états d'avancement,
  ordre changé avec Entrée, couverture choisie, sauvegarde/rechargement, images
  décodées dans l'aperçu privé. Un JPEG renommé PNG a été rejeté et le texte non
  enregistré est resté intact. Retrait puis ajout depuis la bibliothèque avec
  légende/crédit conservés. Réorganisation au clavier et vue à 390 px vérifiées,
  sans débordement horizontal. Capture : `docs/admin-images-mobile.png`.

Une coupure réseau Storage a interrompu un run intermédiaire ; ses seules fixtures
ont été nettoyées, puis la recette complète a été relancée avec succès. Aucun échec
réseau n'est interprété comme une validation ou une suppression réussie.

Les comptes fictifs `example.invalid`, projets, révisions, objets et imports de
la recette sont nettoyés par leurs IDs exacts ; le compte personnel et le projet
manuel existant restent présents. La comparaison des 18 projets importés avant/après
inclut identités, textes et galeries. Le projet de recette navigateur a lui aussi
été supprimé, sans publication. Ses fichiers sont des aplats de couleur de test,
jamais des médias présentés comme des réalisations de Kévin.

Contrôle final réellement exécuté : **12 migrations enregistrées, 18 projets importés
et le projet manuel existant, 127 médias et 127 objets finaux, zéro import de recette
restant et zéro objet en quarantaine, un compte personnel et un administrateur actif**.
Pointeur publié restauré à null, version 0. Aucune clé Supabase locale retrouvée dans
les bundles navigateur. Les fichiers et données publics n'ont pas été modifiés.

### Limites de la recette

Pas de déploiement Vercel : packaging natif Linux de Sharp et limites de temps réelles
du runtime distant restent à vérifier lors d'une future autorisation de déploiement.
Le plafond de sortie 3 Mio existe côté serveur ; le run HTTP ne force pas un résultat
réencodé dépassant ce plafond. Pas de crash de processus au milieu d'une suppression
ni de test de charge concurrente ; les états et verrous sont préparés, avec reprise.
Le délai de nettoyage a été avancé seulement pour une fixture, sans attendre 2 h 15.
L'APNG animé est testé localement, pas transféré dans le run HTTP.
La qualité 90 n'est pas une conservation binaire de l'original : ses proportions,
orientation, couleurs converties sRGB et marques visibles restent dans le résultat.
Les crédits doivent être vérifiés dans leurs champs ; pas d'extraction automatique
des attributions EXIF. Aucun remplacement du PDF ou édition du profil ajouté.

## Documentation officielle

- [Supabase : autorisation d'upload signée valable deux heures](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl)
- [Supabase : uploads standards](https://supabase.com/docs/guides/storage/uploads/standard-uploads)
- [Vercel : limites de payload des fonctions](https://vercel.com/docs/functions/limitations)
- [Sharp : métadonnées, qui seules ne décodent pas tous les pixels](https://sharp.pixelplumbing.com/api-input/)
