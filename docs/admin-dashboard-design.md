# Refonte visuelle de l'administration — 4 novembre 2026

Branche : `feat/admin-dashboard`. Supabase DEV exclusivement. Aucune liaison du
portfolio public à Supabase, modification d'API, migration ou changement de modèle.

## Interface

- Barre latérale vert profond de 240 px, identité Kevin Kilongo, deux rubriques
  et déconnexion en bas. Bandeau blanc et avertissement DEV compact.
- Fond gris clair, cartes blanches, texte anthracite, boutons turquoise,
  police système sans-serif, icônes SVG homogènes sans nouvelle dépendance.
- Catalogue en grille avec couvertures et badges textuels, recherche par titre
  insensible à la casse et aux accents, filtre d'état, état vide et remise à zéro.
- Éditeur sur toute la largeur, sections Informations / Images / Publication
  et historique, miniatures avec repère de couverture, commandes d'ordre, barre
  d'actions persistante sur ordinateur et dans le flux normal sur mobile.
- L'API actuelle ne fournit pas la liste des anciennes versions d'un projet :
  aucun historique fictif ni bouton de restauration de projet n'a été ajouté.
  L'historique et la restauration du contenu du site existants restent disponibles.
- Contenu du site en cinq onglets : Présentation, Portraits, Services, Contact,
  Portfolio PDF. Les panneaux restent montés ; changer d'onglet conserve les
  champs et les imports en cours. Sauvegarde et publication portent toujours sur
  l'ensemble du contenu du site, avec portée explicite et conservation des projets.
- Si un champ invalide est dans un autre onglet, la validation de formulaire
  ouvre ce panneau avant d'afficher l'erreur native. Validation serveur inchangée.
- Connexion centrée, afficher/masquer le mot de passe, erreur près du formulaire.
  Le message de déconnexion apparaît après l'action, jamais sur une première visite.

Les styles sont réservés à `.admin-shell`. La feuille publique produite conserve
exactement son nom/hash `index-43a6D30Y.css`. Sections, composants et données du
portfolio public, fichiers serveur, API, migrations et configuration Vercel ne
sont pas modifiés par cette refonte. Les mécanismes de session, conflits 409,
validation, transferts directs, confirmation et protection des fichiers restent
ceux du parcours déjà validé.

## Contrôles effectués

- Build de production réussi ; lint sans avertissement.
- 18 tests Node existants réussis : contrats de contenus, accès, validation réelle
  d'images/PDF et comportement du formulaire de contact conservé.
- Audit des fichiers candidats et du bundle : secrets locaux absents, fichiers
  locaux exclus, séparation API/SPA conservée ; `git diff --check` réussi.
- Navigateur local réel, session administrateur existante : affichage à
  **1440 × 1000** et **390 × 844**, liste et éditeur, portraits, services et PDF.
- Recherche `rHoM` retourne RHOM CITY ; filtre Publié sans résultat affiche l'état
  vide. Les données DEV n'ont pas été publiées pour simuler des états supplémentaires.
- Saisie temporaire du sous-titre conservée après passage dans les cinq onglets,
  puis remise à sa valeur initiale, sans sauvegarde ni publication.
- Onglets parcourus par flèches, Home et End ; menu mobile avec focus contenu,
  fermeture Échap et retour au bouton déclencheur. Panneaux et menu fermés exclus
  de la navigation clavier. Barre d'actions mobile mesurée `position: static`.
- Aucun débordement horizontal mesuré sur liste, éditeur et contenu mobile.
- Déconnexion réelle de la session locale ; message présent après déconnexion,
  absent après rechargement. Afficher/masquer le mot de passe testé, puis connexion
  volontairement refusée avec identifiants fictifs ; message d'erreur accessible.
  Aucun compte n'a été créé et aucun mot de passe personnel n'a été demandé.
- Aucune erreur JavaScript relevée dans les journaux du navigateur consultés.
- Contrastes calculés : bouton turquoise/blanc **4,95:1**, texte principal/blanc
  **12,45:1**, texte secondaire/blanc **5,14:1**, navigation **9,13:1**, focus du
  menu **9,22:1**. Ce sont des mesures des paires principales, pas un audit WCAG
  complet. Les animations courtes respectent `prefers-reduced-motion` dans le CSS.

## Captures locales

Les 14 captures sont dans `docs/admin-redesign-captures/`, ignoré par Git et hors
de `public/`. Elles montrent l'interface réelle sur le serveur local, pas une
maquette. Principales captures :

- `connexion-desktop.jpg`, `connexion-mobile.jpg`, `connexion-erreur-desktop.jpg` ;
- `projets-desktop.jpg`, `projets-mobile.jpg` ;
- `editeur-desktop.jpg`, `editeur-mobile.jpg`, `galerie-desktop.jpg` ;
- `contenu-portraits-desktop.jpg`, `contenu-services-desktop.jpg`,
  `contenu-pdf-desktop.jpg`, `contenu-presentation-desktop.jpg` ;
- `navigation-mobile.jpg`, `connexion-apres-deconnexion-mobile.jpg`.

## Limites de cette recette

Pas de nouveau transfert de fichier, de publication ou de restauration pendant
la recette visuelle : ces parcours ont été validés lors de l'étape précédente,
et leur code serveur ainsi que la logique d'upload restent inchangés. Aucun contenu
enregistré de DEV n'a été modifié pour les captures. La déconnexion a fermé la
session locale utilisée ; se reconnecter normalement pour poursuivre.

Les contrôles visuels ci-dessus sont locaux. La Preview finale fait l'objet de
contrôles HTTP distincts après le push ; un test visuel dans la Preview protégée
et un contrôle avec lecteur d'écran restent à réaliser personnellement.
