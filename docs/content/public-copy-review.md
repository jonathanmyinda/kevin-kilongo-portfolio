# Nettoyage des textes publics — étape 9

Les styles, animations, routes et interactions sont inchangés. La suppression des notes retire leurs éléments HTML, sans laisser de paragraphe ou de légende vide. Les images, crédits et filigranes ne sont pas modifiés.

## Mentions retirées de l’interface

- Légendes « Photographie issue du site de Kevin » sous les photographies des services.
- Notes de référence au portfolio, à l’édition, aux pages du PDF et aux vues issues du site sur les fiches.
- Note du catalogue expliquant la fabrication des catégories et des missions.
- Phrase de Perspectives indiquant qu’une contribution est précisée dans chaque fiche.
- Mentions de provenance et de composition originale dans les textes alternatifs.
- Renvoi « En cours selon le portfolio » et son appel de note. Pour les expériences sans date de fin connue, seule la date de début est affichée ; les périodes closes conservent leurs deux bornes. Aucun statut actuel n’est déduit.

Ces éléments restent documentés dans les audits, les données de source et les manifestes internes. Les conditions commerciales non confirmées restent hors affichage.

## Exemples

| Avant | Après |
|---|---|
| Photographie issue du site de Kevin | Légende supprimée ; photographie et alternative conservées. |
| Photographie sur chantier présentée dans le service Conseil de Kevin Kilongo | Kevin Kilongo sur chantier, devant des coffrages en bois. |
| Portrait noir et blanc de Kevin Kilongo Munganga, composition originale avec la mention Architecte | Kevin Kilongo Munganga, portrait en noir et blanc. |
| Donner au maître d’ouvrage des éléments pour décider | J’étudie la faisabilité et les choix techniques du projet. |
| Mission de Kevin | Ma mission. Le texte précis du rôle reste identique. |
| Hôtel haut standing… | Hôtel à Gemena, avec une marquise d’accueil en porte-à-faux et des chambres ouvertes sur des terrasses. |

Les présentations de l’accueil, des services et de Perspectives sont raccourcies. Les descriptions de Kolwezi, Mont-Ngafula, Bistro, de l’immeuble résidentiel et de Gemena restent centrées sur les faits. Les descriptions initiales sont conservées dans les données de source ; `publicDescription` porte les formulations destinées à l’affichage.

## Préservation factuelle

- Les deux signatures personnelles sont conservées, chacune une fois dans le contenu de l’accueil.
- Les 18 titres, catégories, rôles exacts, agences et contextes professionnels sont conservés.
- Le centre oncologique reste « Projet académique — TFE ».
- Stade Jabako reste une prestation de rendu pour MAK SARL ; aucune conception supplémentaire attribuée.
- Mont-Ngafula n’affiche pas de statut actuel de chantier ; OS’ARTS reste visible sur les médias.
- Les vues restent qualifiées de rendus 3D, perspectives, plans ou dessins : aucun rendu présenté comme une photographie de bâtiment livré.

## Informations restant à confirmer

La poursuite actuelle des postes RHOM DESIGN, BELLATRIX Tech et Smile Groupe n’a pas été confirmée depuis l’édition 2026 du portfolio. Les dates connues sont conservées, sans « aujourd’hui » ni statut provisoire affiché. Les autres réserves de l’audit restent valables : horaires et prix, liens/titulaires externes, attributions incertaines des médias non publiés et crédits photographiques. Elles n’ont pas été transformées en informations publiques nouvelles.

## Contrôles

Build et lint. Le contrôle des routes rend l’accueil, les 18 fiches, les filtres et les pages inconnues ; il recherche les notes de fabrication dans le texte et les alternatives, vérifie l’absence de paragraphes vides, les deux signatures et la présence du rôle exact et des crédits. Les titres de page et descriptions ont été relus dans les composants et leurs données.

Ce contrôle est un rendu statique, pas une inspection visuelle en navigateur. Aucun changement de CSS, de comportement de navigation, de filtre, de visionneuse ou d’animation n’est introduit à cette étape. Aucun commit, push ni déploiement.
