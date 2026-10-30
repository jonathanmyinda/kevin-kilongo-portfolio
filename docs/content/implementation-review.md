# Première version navigable — étape 5

Branche : `feat/portfolio-foundation`. Aucun déploiement, commit ni push.

## Réalisation

- Accueil : RHOM CITY, six projets sélectionnés depuis les données, quatre expertises, portrait et parcours, logiciels, téléchargement et contact.
- Catalogue : 18 projets et filtres de programme regroupés (12 habitat/urbanisme, 3 intérieurs/restauration, 3 équipements/hôtellerie). La mission est affichée séparément.
- Fiches : 18 URL à partir des slugs, rôle public, agence/contexte, localisation et outils renseignés, galerie complète, précédent/suivant et contact.
- Page introuvable pour les URL et slugs inconnus.
- Navigation mobile avec état explicite, ancres vers l’accueil, focus visible et lien d’évitement.
- Visionneuse native `dialog` : bouton, Échap, précédent/suivant, flèches clavier, arrière-plan inerte et retour au déclencheur. Son fonctionnement réel reste à vérifier dans un navigateur.
- Titres et descriptions de page mis à jour selon la route.

## Choix visuels

Blanc cassé, anthracite, bronze. Georgia pour les titres et polices système pour les textes, sans requête de police externe. Grille éditoriale asymétrique, numéros, filets fins, aucune bibliothèque d’interface ou d’animation. Images proportionnelles non recadrées, dimensions déclarées, plafonds selon leur résolution et chargement différé des galeries. Portrait affiché à 200 px maximum, 125 px sur mobile. Transitions limitées et respect de `prefers-reduced-motion`.

## Fidélité éditoriale

Les notes de source sont conservées. Les champs `publicRole`, `missionLabel` et, pour Mont-Ngafula, `publicDescription`, servent à présenter les contributions sans afficher les incertitudes comme des faits. Stade Jabako : production de rendus pour MAK SARL uniquement. Centre oncologique : « Projet académique — TFE ». Aucun statut actuel de chantier annoncé pour Mont-Ngafula. Aucune surface globale ni date de projet déduite des emplois. Crédits et filigranes intacts.

Adresse résidentielle et réseaux sociaux absents de l’interface. WhatsApp pointe vers le numéro documenté sans déclaration de disponibilité. Aucun message envoyé et aucun appel déclenché lors des vérifications.

## Vérifications automatisées

- Build de production et lint Oxlint.
- Validation des 18 projets, 74 images et copie PDF par `scripts/validate-content.mjs`.
- Rendu React statique des routes réelles : accueil, 18 fiches, 4 états de filtre, filtre inconnu et 3 URL inconnues. Contrôle des titres h1, sections, alternatives, dimensions, liens, attributions particulières et absence d’adresse résidentielle / liens sociaux.
- Contrôle HTTP du serveur Vite : 22 URL, 74 images, PDF avec type MIME et modules d’entrée. Les réponses HTTP 200 des URL inconnues correspondent au shell SPA ; la page 404 est vérifiée séparément par le rendu React.
- Aucun contrôle statique ne remplace l’exécution JavaScript et les interactions dans un navigateur.

Commandes :

```sh
npm run build
npm run lint
node scripts/validate-content.mjs
node scripts/validate-pages.mjs --http=http://127.0.0.1:5173
```

## Limite des outils et validation manuelle

Le navigateur intégré a expiré. Computer Use a trouvé Chrome, mais la capture de fenêtre a expiré ; la reprise a été arrêtée par le mécanisme de contrôle, qui ne pouvait pas déterminer l’URL courante avec une certitude suffisante. Aucune interaction de navigateur ni capture de cette version n’est donc déclarée validée.

À vérifier manuellement sur `http://127.0.0.1:5173/` :

1. Compositions, lisibilité et absence de débordement à 320, 375, 768 et 1440 px, ainsi qu’au zoom 200 %.
2. Menu mobile, filtres, précédent/suivant, historique et ancres depuis une fiche.
3. Parcours au clavier, focus visible et retour du focus ; visionneuse avec boutons, flèches et Échap ; arrière-plan inaccessible pendant son ouverture.
4. Affichage complet des plans et filigranes, notamment sur petits écrans.
5. Absence d’erreurs dans la console du navigateur et mise à jour des titres de page.
6. Téléchargement du PDF ; ouverture des applications e-mail/téléphone et lien WhatsApp selon l’appareil, sans envoyer de message de test.

Valider également la direction graphique et les formulations des missions. La réécriture des URL pour l’hébergement sera traitée ultérieurement.
