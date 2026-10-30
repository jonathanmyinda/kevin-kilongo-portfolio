# Audit du site de référence — 29 octobre 2026

Branche : `feat/portfolio-foundation`. Aucun changement de l’apparence, des routes, des données affichées ou des assets publics existants. Aucun formulaire soumis, message envoyé ni rendez-vous réservé. Aucun commit, push ou déploiement.

## Méthode et limite du contrôle

Les huit URL demandées ont été récupérées directement en HTTP 200. L’outil web n’a pas pu les ouvrir et le navigateur intégré a expiré. Les contenus ont été lus dans les captures HTML/textes ; les styles, scripts et médias téléchargés ont été inspectés. Il ne s’agit pas d’une validation du rendu complet des pages dans un navigateur.

L’audit de Perspectives ne s’arrête pas au HTML initial : celui-ci contient 50 éléments. Les scripts publics `galleryAddInfinityScroll` et `s123InfiniteScroll` indiquent le point d’accès GET `versions/2/wizard/modules/gallery/front/infiniteScroll.php`, le module `6a3c500063be3`, l’album et une limite de 50. La requête de page 2 a été exécutée avec ces paramètres : **11 éléments supplémentaires et `hasNextPage: false`**. Les 61 URL ont ensuite été téléchargées. Le bas de la pagination est vérifié par l’API ; le défilement physique jusqu’au pied de page et le comportement mobile de la galerie n’ont pas été observés.

Preuves conservées dans `site-reference/source/` : huit HTML, textes et métadonnées de requête, réponse et URL de la page 2, scripts publics de galerie. Empreintes SHA-256 et dates UTC de capture conservées. Le pied de page est présent dans les captures, ce qui ne vaut pas observation de son affichage après défilement.

## Synthèse par page

| Page | Structure et contenus utiles | Apport / réserve |
|---|---|---|
| [Accueil](https://6a3c46bee53b4.site123.me/) | Signature principale, courte promesse, À propos, Perspectives avec « Montrez Plus », deuxième signature, Services, Réservation, Contact et Portfolio ; navigation et pied de page communs. | Accueil long, présentant la personne autant que ses rendus. Grand visuel noir et blanc disponible, avec texte déjà intégré à l’image. |
| [À propos](https://6a3c46bee53b4.site123.me/%C3%80-propos) | Présentation à la première personne, ancrage à Kinshasa, mémoire vivante, culture, rigueur technique, créativité, héritage et modernité. Portrait couleur en fond/illustration de section. | Démarche personnelle à intégrer dans une prochaine proposition éditoriale ; pas un nouveau diplôme ou une preuve de spécialisation patrimoniale. |
| [Perspectives](https://6a3c46bee53b4.site123.me/perspectives) | Album de rendus et vidéos ; images sans titres ni descriptions ; mosaïque Isotope, chargement paresseux et défilement infini ; visionneuse. | 61 URL vérifiées sur deux lots : 59 images, 2 vidéos. L’absence de légendes interdit d’inventer noms, lieux, agences ou missions pour les rendus non identifiés. |
| [Services](https://6a3c46bee53b4.site123.me/services) | Conception architecturale ; Suivi de projet & coordination ; Consultant. Une illustration de plans et deux photographies de chantier. | La rubrique Conseil est plus développée que dans le nouveau portfolio. Le chantier et la mission des photos ne sont pas nommés. Illustration Conception générique : ne pas la transformer en projet de Kevin. |
| [Prise de rendez-vous](https://6a3c46bee53b4.site123.me/prise-de-rendez-vous) | Réunion de consultation pour réhabilitation, extension ou construction ; attentes, identité du lieu, réglementation et stratégie de conception. Durée affichée : 02:00 ; prix final affiché : $500. | Condition commerciale à confirmer, exclue de l’application. L’interface contient aussi « Prix HT $0.00 » et « Coupon $0.00 » : ne pas en déduire taxes, remise ou prix contractuel. Aucun créneau réservé. |
| [Contact](https://6a3c46bee53b4.site123.me/contact) | Nom, téléphone, e-mail et formulaire ; ville, téléphone, e-mail, horaires. | Coordonnées concordantes avec le PDF. Disponibilité annoncée lundi–vendredi 8 h–17 h, à confirmer ; fuseau non explicité. Aucune soumission. |
| [Portfolio](https://6a3c46bee53b4.site123.me/portfolio) | Une entrée « Portfolio » et sa vignette. | Accès à une publication, pas une liste de projets contextualisés. |
| [Portfolio / portfolio](https://6a3c46bee53b4.site123.me/portfolio/portfolio) | Fil d’Ariane et 32 planches présentées comme images, avec variantes vignette 800 et ouverture 2000. | Les 32 planches correspondent visuellement au PDF préparé. Pas de nouveau fichier PDF trouvé dans les liens de ces pages. Ne pas utiliser ces planches complètes dans les galeries. |

La navigation principale présente Accueil, À propos, Perspectives, Services, Prise de Rendez-Vous et Portfolio ; Contact est également disponible dans le pied de page et les sections. Les mentions SITE123 sont celles de la plateforme et ne font pas partie du contenu professionnel à reprendre.

## Faits, démarche et conditions commerciales

### Faits professionnels concordants

- Architecte à Kinshasa, RD Congo.
- E-mail : `kevinkilongo7@gmail.com`.
- Téléphone : `+243813732058`, identique au numéro formaté du PDF.
- Trois services déclarés : conception, suivi/coordination et conseil.
- Le site n’ajoute aucune nouvelle date de diplôme, surface, localisation de projet ou responsabilité individuelle que l’on puisse attribuer avec certitude.

### Présentation personnelle et démarche

Les deux signatures à conserver sont exactement :

> Architecture de sens, héritage en mouvement

> Patrimoine & modernité : une même architecture

Le texte À propos insiste sur la mémoire, la culture, le dialogue entre racines et horizons nouveaux, et sur l’équilibre entre rigueur technique et créativité. Il décrit une intention architecturale, pas une certification en restauration patrimoniale ni un bilan environnemental prouvé.

Le service Conception évoque les volumes, la lumière, les matières, les parcours et les contraintes techniques. Le Conseil aborde faisabilité, orientations techniques et budgétaires, matériaux, performance environnementale et phasage. Reprendre ces thèmes comme champs d’accompagnement déclarés, sans promesse chiffrée ou garantie inventée.

### Conditions à confirmer, non publiées

- Horaires : lundi au vendredi, 8 h–17 h ; disponibilité et fuseau à valider.
- Consultation : 2 heures, prix affiché $500 ; devise exacte, fiscalité, périmètre, modalités et validité à valider.
- Aucun élément commercial n’a été ajouté aux données de l’application ou à son interface.

## Liens sociaux et destinations

Les liens sont bien présents sur le site ; les formes avec paramètres de partage sont conservées dans les captures et `editorial-findings.json`.

| Destination nettoyée | Résultat de lecture GET | Conclusion |
|---|---|---|
| [LinkedIn](https://www.linkedin.com/in/kevin-kilongo-778a543a0) | HTTP 999 | Lien trouvé, destination bloquée pour l’outil. Profil/titulaire non vérifiés. |
| [Instagram](https://www.instagram.com/kilongokevin/) | HTTP 200, URL finale identique | Destination joignable ; ce statut ne certifie ni le titulaire ni la visibilité du profil connecté. |
| [WhatsApp](https://wa.me/message/6SE5RNJA3PEJM1) | HTTP 200 ; redirection vers `https://api.whatsapp.com/message/6SE5RNJA3PEJM1?autoload=1&app_absent=0` | Lien court résolu. Aucun message envoyé. Ne pas affirmer que ce compte correspond au lien numérique actuel sans vérification complémentaire. |

Ces liens sont préparés dans l’audit uniquement, sans ajout dans la navigation publique.

## Direction graphique de la référence

Le relevé du chef de projet est corroboré par les variables CSS et les médias, sans prétendre à un contrôle de rendu écran :

- Fond principal vert très sombre `#0a1a1a`, alternance `#0e2f2f`.
- Navigation et pied de page presque noirs `#081212`, fond d’accueil noir `#000000`.
- Accent turquoise `#2ba2a4`, textes/titres blancs `#ffffff`.
- Oswald configurée pour logo, navigation, titres, slogans et police globale ; caractère condensé distinct du choix éditorial actuel.
- Visuel d’accueil noir et blanc, portrait couleur À propos, mosaïque de rendus et présence humaine sur chantier dans les services.

Le portrait d’accueil est une composition graphique de 2000 × 1414 px avec le mot « ARCHITECTE » et une phrase intégrée ; ce n’est pas un portrait détouré. Le portrait couleur mesure réellement 960 × 1280 px malgré le préfixe `2000_`. La direction à proposer ultérieurement doit tenir compte de ces compositions et préserver les inscriptions/crédits. Aucun changement de couleur, police, disposition ou image sur le nouveau site à cette étape.

## Inventaire et stockage des médias

Inventaire détaillé : `site-reference/media-inventory.json`. Chaque entrée contient URL et pages sources, chemin local, date de capture, octets, SHA-256, dimensions décodées, type, projet ou statut d’incertitude, crédit, doublon, usage recommandé et comparaison PDF. Les tailles annoncées par SITE123 sont conservées séparément des dimensions réelles. Les correspondances automatiques sont explicitement des **candidats**, distincts des décisions de revue visuelle.

| Ensemble | URL téléchargées |
|---|---:|
| Perspectives, lots 1 et 2 | 61 : 59 images + 2 vidéos |
| Portraits et services, dont variante 800 du portrait d’accueil | 6 images |
| Portfolio : 32 planches + vignette de couverture | 33 images |
| **Total** | **100 fichiers : 98 images + 2 vidéos ; 45 704 766 octets, soit 45,70 Mo** |

Les 100 URL correspondent à **91 contenus binaires distincts**. Perspectives comporte 52 contenus binaires distincts pour 61 URL : 8 doublons d’images et 1 doublon vidéo. Tous les originaux téléchargés restent conservés, y compris les doublons d’URL, pour garder une provenance sans ambiguïté. Les deux PNG initialement en erreur 502 ont été récupérés lors d’une seconde tentative ; aucun média demandé ne reste en échec de téléchargement.

Classement hors de `public/` :

- `site-reference/media/projects/` : 41 entrées de galerie attribuées après revue visuelle, dont 12 planches composites RHOM CITY non destinées à une galerie web.
- `site-reference/media/unidentified/` : 20 entrées non attribuées — 18 images et les 2 URL vidéo identiques.
- `site-reference/media/profile-services/` : 6 médias du profil et des services.
- `site-reference/media/portfolio-sheets/` : 32 reproductions de pages et leur vignette.
- `site-reference/review/` : planches de comparaison WEB/PDF et contrôle des 32 reproductions. Ce sont des dérivés de QA, pas les originaux à afficher.

Le fichier `unidentified-media.json` isole également les médias sans attribution. Tous portent `publicDisplayEnabled: false`. Les médias connus restent eux aussi hors interface en attendant la prochaine étape.

## Comparaison avec les 74 images du PDF

Comparaison des empreintes des fichiers, des pixels RGB décodés, des dimensions et des vues, suivie d’une revue des planches comparatives. Les distances visuelles calculées ne sont jamais utilisées seules pour attribuer un projet.

- **Aucun fichier web identique octet par octet à un des 74 JPEG du PDF.**
- **Quatre images aux pixels RGB exactement identiques** aux vues d’Immeuble mixte (pages 13–14) : `gallery-053` à `gallery-056`. Les octets/encodages diffèrent, mais ces images n’apportent ni pixels ni vue supplémentaires.
- D’autres vues sont proches mais diffèrent par cadrage, compression, éclairage ou colorimétrie. Elles ne sont pas des doublons exacts et ne justifient pas automatiquement un remplacement.
- Les fichiers web originaux sont conservés sans retouche de couleurs ou filigranes. Une agence reprise du PDF est un crédit de projet ; elle n’est pas présentée comme le nom du photographe ou de l’auteur du fichier.

| Projet / média | Constat vérifié | Recommandation |
|---|---|---|
| Portrait couleur | 960 × 1280 px, 68 363 octets ; nouveau portrait par rapport au PDF 227 × 292 px | Bon candidat À propos, présenté comme Kevin par le contexte de la page ; crédit photographique non précisé. |
| Portrait d’accueil | 2000 × 1414 px, 167 514 octets ; variante 800 × 566 également récupérée | Candidat pour une prochaine direction visuelle, en conservant sa composition et ses inscriptions. |
| Photos de chantier | Suivi : 800 × 1067 ; Conseil : 800 × 630 | Apport humain/professionnel ; ne pas nommer le chantier ni en déduire une mission précise. |
| Illustration Conception | 800 × 514, plans et instruments génériques | Ne pas présenter comme un projet ou plan produit par Kevin ; origine/licence à confirmer. |
| KIMIA TOWER | Vue rapprochée 1495 × 1052 contre PDF 1080 × 760 ; vues d’ensemble et nocturnes supplémentaires (`032`, `033`, `035`) | Enrichissement pertinent, après optimisation et conservation du crédit RHOM DESIGN. La variante `052` reste 1080 × 760 malgré son nom `2000_`. |
| Bandalungwa | Fichiers réels de 2000 × 1407/1409 ; angle supplémentaire et variantes (`006`–`008`) | Comparer netteté/colorimétrie, puis intégrer les compléments utiles avec crédit Smile Groupe. Les PNG `007` et `008` pèsent environ 4,39 et 5,25 Mo : ne pas les publier tels quels. |
| Centre oncologique | Vue jardin `030`, 1920 × 1080 ; même bâtiment, percements, arbres et gazebo, autre caméra que PDF p. 16 | Complément pertinent au TFE, pas une réalisation construite. Le jardin `031` reste seulement candidat, non attribué. |
| Hôtel présidentiel | `011` : 1920 × 1080, cadrage élargi du même accueil que PDF p. 25 | Complément possible, en maintenant la seule contribution documentée de visualisation et le crédit Smile Groupe. |
| Horizon Luxe | `009` et `014`, vues concordantes, 1920 × 1080 ; l’entrée PDF est une petite image de 418 × 295 | Versions à examiner pour plus de confort d’affichage ; cadre plus large/teinte différente. Ne pas étendre automatiquement l’attribution à d’autres immeubles ressemblants. |
| Minimal House | Angle et rooftop (`023`, `025`) ; variante de jour de façade (`024`) | Compléments possibles sans inventer de conception ou d’agence. |
| Restaurant Palms | `003`, 1494 × 1053, PNG volumineux ; même intérieur que PDF p. 28, cadrage différent | Optimiser avant usage, conserver APEX Engineering ; ne pas conclure à un meilleur détail sur la seule taille. |
| Architecture intérieure | `036` et `037` plus grands, mais colorimétrie différente ; `048`–`051` proches des JPEG actuels | Comparer le rendu souhaité, conserver RHOM DESIGN ; pas de remplacement automatique. |
| Ensemble de villas | `002`, rue et villa d’angle visuellement concordantes, autre cadrage | Vue complémentaire possible avec crédit Smile Groupe. |
| Mont-Ngafula | `005`, 2000 × 1125 contre PDF 911 × 548 pour la vue correspondante ; traitement/cadrage différents | Préserver la référence et le filigrane OS’ARTS du PDF ; ne pas remplacer une attribution visible par une version qui la perd. Aucun nouveau statut de chantier déduit. |
| RHOM CITY | `042`/`059`, 2000 × 1414 : moins de pixels que le JPEG PDF de 2246 × 1588 ; nombreuses planches texte/plans | Conserver le visuel natif du PDF ; ne pas publier les planches composites comme galeries. |
| Planches Portfolio | 32 images correspondant visuellement aux 32 pages du PDF | Archive documentaire uniquement. Aucune preuve d’édition différente ; identité binaire avec le PDF non applicable. |

Les autres rendus résidentiels, une terrasse, des villas/piscines et des jardins ne sont pas nommés de façon fiable. Leurs ressemblances ne suffisent pas à les rattacher à Kolwezi, Horizon Luxe ou à un autre projet. Ils restent séparés et non affichés.

## Vidéos : comparaison concluante

Les deux URL fournies ont été récupérées :

- `normal_6ad4635813d31.mp4` (`gallery-038`).
- `normal_6ad5a3c1c72d5.mp4` (`gallery-058`, lot 2).

Chaque fichier mesure **2 773 247 octets**, dure **27,5 secondes** et annonce une piste vidéo **1080 × 1920** dans son conteneur MP4. SHA-256 commun :

`ab571121b781615778b52050cbfd7d8ff61fd0dd17a92946448f6d4758ce948c`

Les fichiers complets sont identiques, et le bloc média `mdat` possède aussi la même empreinte. Il s’agit donc du **même contenu vidéo**, pas seulement de premières vues similaires. Une lecture/décodage image par image n’est pas nécessaire pour établir cette identité et n’a pas été effectué. Le projet filmé n’est pas attribué sans contrôle de son contenu ; les deux copies sont classées hors affichage public. Ne prévoir qu’une vidéo si l’intégration est ensuite validée.

## Éléments à ajouter / corriger lors de la prochaine étape

1. Proposer une direction graphique fondée sur les préférences vert sombre, turquoise, Oswald et portraits du site, puis la faire valider avant modification.
2. Réintroduire les deux signatures et une courte démarche personnelle, en complément du parcours factuel du PDF.
3. Développer le Conseil sans transformer les intentions de durabilité/patrimoine en certifications ou garanties.
4. Proposer les portraits et photos de chantier sourcés ; ne pas attribuer de chantier précis aux photographies.
5. Enrichir les galeries uniquement avec les correspondances vérifiées, en tenant compte des doublons, de la netteté, des variations de couleur et des crédits.
6. Préparer les liens sociaux maintenant connus dans l’audit, mais vérifier le profil LinkedIn bloqué et le titulaire du lien WhatsApp avant leur activation.
7. Conserver horaires, durée et prix dans les conditions à confirmer ; ne rien publier de commercial à ce stade.

## Incertitudes et limites restantes

- Aucun contrôle de mise en page dans un navigateur, ni observation réelle du défilement. La fin du chargement est cependant prouvée par la réponse GET `hasNextPage: false`, et tous les médias annoncés ont été récupérés.
- Attribution exacte de 18 images et du projet de la vidéo à obtenir de Kevin ; aucun nouveau projet créé dans les données de l’application.
- Crédits photographiques, origine/licence de l’illustration générique et relation du filigrane OS’ARTS avec les contributions personnelles à clarifier.
- Liens externes : LinkedIn bloqué ; HTTP 200 Instagram/WhatsApp ne signifie pas vérification de titulaire ni disponibilité commerciale.
- Les 32 planches et certaines images contiennent textes, prix ou annotations : ce ne sont pas des assets prêts à afficher tels quels.
- « Plus grand en pixels » ne signifie pas « source native plus détaillée ». Dimensions décodées et revue visuelle sont conservées dans l’inventaire pour décider plus tard.

## Contrôles de conservation

Les fichiers de l’application et `public/` n’ont pas été modifiés pour cet audit. Tous les téléchargements sont dans `docs/content/site-reference/`, hors affichage. Les chemins, tailles et SHA-256 sont vérifiables avec `scripts/validate-reference-audit.py`. Le contrôle existant des 74 images/PDF peut être relancé sans utiliser le site distant.
