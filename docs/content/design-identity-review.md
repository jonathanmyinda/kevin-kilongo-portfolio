# Identité et intégration des médias — étape 7

30 octobre 2026. Branche `feat/portfolio-foundation`. Aucun commit, push ou déploiement. Les faits, missions, agences et 18 fiches du PDF sont conservés.

## Identité visuelle et composition

Le fond principal devient vert profond, la navigation et les services presque noirs. L’accent turquoise est légèrement éclairci par rapport au SITE123 pour améliorer le contraste des textes et des contrôles. Les couleurs et les deux familles typographiques sont centralisées dans `src/index.css` : Oswald pour les titres, Segoe UI/Arial pour les paragraphes. Oswald est servie localement, avec sa licence OFL et sa provenance dans `font-provenance.json`.

L’accueil présente le portrait noir et blanc complet, sans recadrer le visage ni supprimer ses inscriptions. Le texte chevauche partiellement le côté gauche de la composition sur ordinateur ; il passe au-dessus de la photographie sur petit écran. Les deux actions suivent immédiatement le texte, sans dépendre d’une animation ou d’une hauteur plein écran. Ce comportement est implémenté en CSS, mais reste à valider visuellement sur les appareils cibles.

La présentation personnelle reprend l’ancrage à Kinshasa, la mémoire des lieux, les usages, les matériaux et la lumière. La formation, les expériences datées, les stages, les logiciels et les langues restent accessibles. « Patrimoine & modernité : une même architecture » apparaît une fois dans la section À propos, avec le portrait couleur. Les quatre services comprennent conception, suivi/coordination, conseil/faisabilité et visualisation 3D.

## Sélection et Perspectives

Accueil : RHOM CITY, KIMIA TOWER, Mont-Ngafula, Restaurant Palms, centre oncologique et Stade Jabako. KIMIA TOWER remplace l’hôtel de Gemena grâce à ses nouvelles vues jour/nuit attribuées et à ses meilleures dimensions pour l’habitat collectif. Le centre oncologique dispose maintenant d’une couverture montrant les jardins, issue du site et vérifiée par comparaison du bâtiment et des aménagements.

Gemena reste dans le catalogue et dans l’aperçu Perspectives. Cette mosaïque montre aussi Bandalungwa, Minimal House et Architecture intérieure. Ses quatre images diffèrent des couvertures sélectionnées juste auparavant, ouvrent la visionneuse et donnent accès aux fiches avec leur mission et agence.

La catégorie de programme ne détermine pas la responsabilité de conception. Aucun rôle nouveau n’est déduit des nouvelles images. Le TFE reste académique ; Mont-Ngafula n’affiche aucun statut actuel de chantier ; Stade Jabako reste présenté comme une production de rendus.

## Décisions de médias

18 sources SITE123 retenues : **14 rendus attribués, 2 portraits et 2 photographies de chantier**. Les variantes et les crédits ont été comparés aux visuels du PDF lors de l’audit et de cette intégration.

| Projet / usage | Décision |
|---|---|
| KIMIA TOWER | Vue rapprochée de jour `gallery-034` en remplacement du petit rendu PDF, ajout des ensembles jour `033` et nuit `035`. `032` reste en réserve pour éviter une autre variante proche. |
| Bandalungwa | Vue d’angle `006` plus grande, ajout de l’angle `007`. La petite vue frontale PDF répétitive est retirée de l’affichage ; le frontal principal est conservé. Le PNG `008` reste en réserve car il répète une caméra existante. |
| Horizon Luxe | `009` remplace la perspective principale et `014` la petite vue d’entrée. Les autres angles du PDF restent disponibles. |
| Restaurant Palms | `003` remplace la vue de salle, avec le crédit APEX Engineering. Le PNG source reste archivé ; une version web est publiée. |
| Hôtel de Gemena | `011` remplace la perspective d’arrivée par un cadrage plus large ; la vue des chambres est conservée. Mission inchangée : visualisation. |
| Minimal House | `023` et `025` remplacent les petites vues d’angle et de rooftop ; `024` ajoute une variante de jour. Aucune conception ni agence ajoutée. |
| Centre oncologique | Ajout du jardin `030` à 1920 × 1080 en source ; les trois rendus PDF et les dessins techniques restent disponibles. `031`, incertain, est exclu. |
| Ensemble de villas | Ajout de la rue `002`, attribuée lors de la revue visuelle, avec crédit Smile Groupe. |
| Mont-Ngafula | Visuels PDF conservés avec OS’ARTS. La variante web `005` reste en réserve pour ne pas perdre le filigrane ni répéter une vue proche. |
| Architecture intérieure | Visuels PDF conservés : les nouvelles versions de bureau changent surtout la colorimétrie, sans bénéfice suffisamment clair. |
| RHOM CITY et autres projets | Visuels isolés du PDF conservés. Aucune planche SITE123 avec son texte utilisée comme galerie. |
| Profil et services | Portrait noir et blanc à l’accueil, portrait couleur À propos, photos de suivi et de conseil dans leurs services. Aucun chantier nommé à partir de ces photographies. L’illustration générique de plans n’est pas publiée. |

Les quatre vues d’Immeuble mixte dont les pixels sont identiques à celles du PDF ne sont pas dupliquées. Les 18 images non attribuées et les deux URL du même fichier vidéo restent dans l’archive d’audit hors de `public/`. Aucune vidéo n’est chargée ou intégrée.

## Conservation, formats et poids

Les **74 JPEG d’origine PDF sont conservés inchangés** dans `docs/content/pdf-media-originals/`. Les anciens identifiants de source restent dans les données et le manifeste historiques ; `pdf-source-locations.json` indique leur nouvel emplacement d’archive. Les 100 fichiers SITE123 originaux restent dans leur archive d’audit.

L’application combine les faits de `profile.json` / `projects.json` avec la sélection d’images de `published-media.json`, sans réécrire les notes de source. Le manifeste de publication donne pour chaque fichier le chemin et l’empreinte de l’original, le crédit, les dimensions natives et de sortie, les références PDF ou l’URL SITE123. Les drapeaux de l’ancien inventaire décrivent l’audit initial ; seules les dérivées référencées par ce manifeste sont publiées.

Les rendus sont exportés en WebP, sans recadrage ni agrandissement. Un JPEG déjà plus compact que son export WebP est conservé. Les plans gardent leur JPEG natif pour éviter une recompression destructrice ; leur aperçu peut disposer d’une variante légère. Les dimensions, `srcSet`, `sizes` et le chargement différé sont déclarés ; seul le portrait d’accueil est prioritaire sur la page d’accueil.

- **82 images principales** : 78 visuels de projets et 4 images de profil/services.
- **45 variantes responsive**, soit **127 fichiers d’images**, tous référencés.
- Images : **13 105 362 octets — 13,11 Mo** pour l’ensemble du portfolio, pas pour le chargement initial.
- Polices : **40 356 octets — 40,36 Ko**, servies localement.
- Images et polices : **13 145 718 octets — 13,15 Mo**.
- PDF inchangé : **9 515 589 octets — 9,52 Mo**, proposé au téléchargement, sans chargement automatique.

L’ensemble d’exports et de variantes représente environ 34 % de moins que les octets des sources sélectionnées (19,75 Mo). Les 100 sources de travail n’ont pas été copiées en bloc dans les fichiers publics. Les anciens exports de travail inutilisés ont été supprimés ; aucun original n’a été perdu.

## Contact, liens et interactions

Les liens LinkedIn et Instagram documentés sont affichés avec des libellés accessibles, sans prétendre que LinkedIn a été vérifié. « Demander un rendez-vous » utilise le lien WhatsApp documenté `https://wa.me/message/6SE5RNJA3PEJM1`. E-mail, téléphone et téléchargement sont conservés. Aucun horaire, prix, calendrier ou formulaire simulé.

Le menu mobile, les filtres, les ancres entre routes, les pages introuvables, la pagination des projets et la visionneuse native sont conservés. Le focus est turquoise sur fond sombre et sombre autour des plans clairs. Le contenu est visible par défaut, sans effet d’apparition ; `prefers-reduced-motion` est respecté.

## Contrôles réalisés et limites

- Build de production réussi ; lint réussi, sans les avertissements des scripts tiers archivés. Ces preuves SITE123 sont exclues d’Oxlint et de la détection des classes Tailwind, sans modification de leurs fichiers.
- Rendu React statique : accueil, six projets sélectionnés, signatures uniques, quatre Perspectives distinctes des couvertures, 18 fiches, quatre filtres, filtre inconnu, trois URL inconnues, liens sociaux/contact/PDF.
- HTTP du serveur local : 22 URL, 127 images/variantes, PDF, polices, modules d’entrée et dépendances Vite. Aucun module en erreur 504.
- Validation des chemins, dimensions, SHA-256, absence d’agrandissement, absence de vidéo publique, absence de source non attribuée et absence d’export inutilisé.
- Vérification des 74 originaux PDF archivés et du PDF ; vérification de l’archive des 100 sources SITE123.
- Contrastes calculés : texte principal/fond 16,23:1 ; texte secondaire/fond 9,89:1 et surface relevée 7,83:1 ; accent/fond 9,58:1 ; texte des boutons 10,28:1 ; légendes des plans 9,77:1. Ces calculs ne remplacent pas l’inspection des textes superposés à la photographie.
- Revue visuelle d’un échantillon des exports, incluant portraits, photos de chantier, rendus et OS’ARTS ; planche `step7-media-review.jpg`. Cette planche n’est pas une capture du site.

Le navigateur a expiré lors de la tentative de connexion ; aucune relance répétée n’a été effectuée. Restent **non vérifiés en navigateur** : rendu ordinateur/mobile, chevauchement réel du titre et du portrait, débordements horizontaux, menu au clavier, filtres interactifs, ouverture/navigation/fermeture et retour du focus de la visionneuse, console et mise à jour des titres côté client.

Serveur local laissé accessible : `http://127.0.0.1:5173/`. Valider ces points et la direction visuelle avant toute publication. Aucun nouvel ajout de dépendance JavaScript.
