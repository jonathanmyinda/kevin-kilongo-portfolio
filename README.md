# kevin-kilongo-portfolio
Portfolio web de Kevin Kilongo Munganga, architecte à Kinshasa, RDC.
Portfolio React + Vite + JavaScript, Tailwind CSS et React Router. Première version complète avec accueil, catalogue filtrable et 18 fiches projet.

## Prérequis

Node.js 26 LTS et npm (vérifiés avec Node.js 26.13.0 et npm 11.20.0).
Sous PowerShell, utiliser `npm.cmd` si `npm.ps1` est bloqué, sans modifier la politique d’exécution.

## Commandes

```sh
npm ci           # Installation reproductible depuis package-lock.json
npm run dev      # Développement ; URL affichée dans le terminal
npm run build    # Build de production dans dist/
npm run lint     # Oxlint, fourni par le modèle Vite
npm run preview  # Aperçu local du build
```

`npm install` permet d’installer ou de mettre à jour les dépendances ; conserver `package-lock.json` avec les changements correspondants.

## Structure

- `src/App.jsx` : routes de l’application et accueil.
- `src/main.jsx` : point d’entrée React.
- `src/index.css` : Tailwind, styles éditoriaux et adaptations responsive.
- `src/components/` : navigation, cartes, visionneuse et métadonnées.
- `src/sections/` : sections d’accueil et pages projets.
- `src/data/` : contenus sourcés et regroupements du catalogue.
- `src/assets/` : emplacement pour de futurs assets importés ; Git ne suit pas les dossiers vides.
- `public/` : versions d’images utilisées, polices locales et PDF téléchargeable.

Tailwind utilise `@tailwindcss/vite` dans `vite.config.js` et `@import "tailwindcss"` dans la feuille de style, selon la [documentation officielle](https://tailwindcss.com/docs/installation/using-vite).

`node_modules/`, `dist/` et les fichiers d’environnement locaux sont ignorés par Git.

## Contenus et médias préparés

Les données sont séparées dans `src/data/profile.json` et `src/data/projects.json`.
La sélection d’accueil est alimentée par `src/data/homepage-selection.json`.
Voir `docs/content/content-review.md` pour les sources, les attributions et les limites éditoriales.

Les 74 images PDF originales sont conservées, inchangées, dans `docs/content/pdf-media-originals/`. Leurs anciens chemins sont reliés aux archives par `docs/content/pdf-source-locations.json`.
Les seules versions utilisées par l’interface sont dans `public/images/optimized/`. Les variantes responsive sont référencées par `srcSet` ; aucun média non attribué ou vidéo n’est publié.
`src/data/published-media.json` sélectionne les images d’affichage sans réécrire les faits et missions du PDF. La provenance détaillée figure dans `docs/content/published-media-manifest.json`.
La copie inchangée du PDF est dans `public/documents/portfolio-kevin-kilongo-munganga.pdf`.

```sh
node scripts/validate-content.mjs
```

Cette commande vérifie les références de médias et leurs empreintes. Elle accepte aussi le chemin du PDF original en argument pour comparer la copie de téléchargement.

## Navigation et vérifications

Routes : `/`, `/projets`, `/projets/:slug` et page introuvable pour les autres URL.
Les filtres de programme sont conservés dans le paramètre `categorie`. Ils ne déterminent pas la mission de l’architecte, affichée séparément.

```sh
node scripts/validate-pages.mjs
# Avec contrôle du serveur local déjà lancé :
node scripts/validate-pages.mjs --http=http://127.0.0.1:5173
```

Ce contrôle rend les routes React sans navigateur : accueil, 18 fiches, filtres, URL inconnues, liens et références d’images. Il ne valide pas le rendu visuel, la console, le clavier ni la visionneuse. Il compile une entrée temporaire dans `node_modules/.cache/`, puis la supprime.

La visionneuse utilise `<dialog>.showModal()` pour le focus et l’arrière-plan inerte. Fermeture : bouton ou Échap ; navigation : boutons ou flèches gauche/droite. Le focus revient au visuel déclencheur.

Les libellés publics `publicRole` et `missionLabel` complètent les notes de source `role` sans les remplacer. Stade Jabako est présenté comme une prestation de rendu ; aucun statut actuel de chantier n’est affirmé pour Mont-Ngafula. Les liens LinkedIn, Instagram et WhatsApp proviennent du site de référence, sans déclaration de vérification du titulaire. L’adresse résidentielle, les horaires et les tarifs ne sont pas affichés.

La configuration `vercel.json` fixe le build `npm run build`, la sortie `dist` et
la réécriture SPA vers `index.html`. Les routes inconnues conservent la page
introuvable de React. Perspectives reste accessible à `/#perspectives`.
La branche de production Vercel est `main`, reliée au dépôt GitHub
`jonathanmyinda/kevin-kilongo-portfolio`. Chaque push sur `main` déclenche
automatiquement une publication. Aucun domaine personnalisé n’est requis.
`node scripts/validate-release.mjs` vérifie les fichiers publics, le build et
les exclusions avant publication. Les archives d’audit restent locales et sont
ignorées par Git ; `.vercelignore` exclut également docs et scripts des envois CLI.

Le bilan de réalisation et les vérifications manuelles restantes figurent dans `docs/content/implementation-review.md`.

L’étape 7 et les choix de médias du thème sombre sont documentés dans `docs/content/design-identity-review.md`. Oswald est servie localement avec sa licence OFL ; aucune nouvelle dépendance JavaScript n’a été ajoutée.

```sh
# Avec le Python disposant de Pillow :
python scripts/validate-published-media.py
python scripts/validate-reference-audit.py
```

Les HTML et scripts SITE123 archivés sont exclus du lint et de la détection Tailwind : ils constituent des preuves, pas du code de l’application.

## Formulaire de contact

Le formulaire est temporairement masqué ; son code est conservé et l’envoi reste
désactivé. L’e-mail, le téléphone et WhatsApp restent visibles. Voir [la procédure](docs/contact-form.md) et
`.env.example` : identifiant public uniquement, aucun secret côté React.
Les tests hors réseau s’exécutent avec `node --test scripts/contact.test.mjs`.
Aucun e-mail de test n’a été envoyé.

## Cache des dépendances en développement

Si le réseau du navigateur affiche `504 (Outdated Optimize Dep)` sur des modules
`/node_modules/.vite/deps/`, arrêter le serveur Vite du projet puis le relancer :

```sh
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort --force
```

`--force` reconstruit le cache des dépendances optimisées ; `--strictPort` évite
de lancer silencieusement un second serveur sur un autre port. Recharger ensuite
la page avec `Ctrl + Maj + R`. Ce problème de cache de développement ne justifie
pas une modification du design. Le contrôle `validate-pages.mjs --http=...`
vérifie aussi les modules optimisés : une réponse HTML 200 seule ne suffit pas.
