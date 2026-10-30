# Formulaire de contact — préparation de l’intégration

## État au 30 octobre 2026

À la demande du propriétaire, le formulaire est temporairement retiré du rendu
public. Son composant, ses styles et son intégration sont conservés pour une
réactivation ultérieure. Les coordonnées directes et WhatsApp restent affichés.

Le dépôt est une application React/Vite statique. Aucun hébergement, backend,
fonction serverless ou compte de service d’envoi n’est configuré. Formspree est
recommandé pour conserver ce socle indépendant de l’hébergement. Aucune nouvelle
dépendance n’a été installée.

Le formulaire est prêt côté interface, mais **l’envoi est désactivé**. Aucun
identifiant réel n’a été fourni. Aucune requête de soumission ni aucun e-mail de
test n’a été envoyé. La réception dans Gmail n’a donc pas été testée.

## Configuration restant nécessaire

1. Créer un compte et un formulaire Formspree au nom du propriétaire. Vérifier
   l’adresse destinataire **kevinkilongo7@gmail.com** dans le service. Ne pas
   communiquer de mot de passe ou de jeton dans la conversation.
2. Appliquer côté service les règles de `contact-formspree.example.json` : champs
   obligatoires, type email et longueurs. Ce fichier est un modèle CLI Formspree,
   **pas une configuration active** ; il n’est ni exécuté par Vite ni déployé.
   Vérifier les possibilités du compte choisi et appliquer ces règles par la CLI
   officielle ou l’interface disponible. Ne pas activer l’envoi tant que cette
   validation côté service n’est pas effective.
3. Garder l’expéditeur autorisé géré par Formspree. Le champ `email` du visiteur
   devient le Reply-To ; ne jamais l’utiliser comme From. La destination est
   fixée dans le service, jamais dans les données envoyées par le navigateur.
4. Configurer l’antispam du service : `_gotcha` est déjà préparé ; vérifier la
   protection Formshield et le mode CAPTCHA du formulaire. Si un challenge est
   exigé, intégrer son widget et son jeton avant activation : le code actuel ne
   génère aucun jeton CAPTCHA et ne contourne pas cette protection. La limitation
   des requêtes est assurée par le fournisseur ; le navigateur affiche les erreurs
   429. Le verrou local évite les doubles clics, sans remplacer cette protection.
5. Définir le futur domaine, restreindre les domaines autorisés dans le service,
   vérifier le quota du compte et choisir la durée de conservation des demandes.
   Le fournisseur peut conserver les soumissions ; ne pas activer d’intégration
   marketing ou d’archivage supplémentaire sans nécessité. Aucun contenu saisi
   n’est journalisé ou conservé en localStorage par l’application.
6. Copier `.env.example` vers `.env.local` (ignoré par Git). Remplacer uniquement
   `VITE_FORMSPREE_FORM_ID` par l’identifiant **public** du formulaire et mettre
   `VITE_CONTACT_SERVICE_READY=true` après les vérifications précédentes. Ces deux
   valeurs sont publiques dans le bundle ; aucune clé API ou autre secret ne doit
   figurer dans une variable `VITE_*`. Les éventuelles informations privées de la
   CLI restent dans son authentification locale, hors dépôt.
7. Redémarrer Vite pour le développement, ou reconstruire pour un hébergement
   statique. L’hébergement devra aussi réécrire les routes vers `index.html`.
8. Après autorisation distincte, effectuer un véritable essai et vérifier la
   réception ainsi que Reply-To dans la boîte destinataire. Une acceptation HTTP
   ne prouve pas la livraison d’un e-mail.

Le consentement à configurer un service n’est pas une autorisation de souscrire
une offre payante. Si les règles requises ne sont pas disponibles sur le compte,
laisser l’envoi désactivé et choisir un backend lorsque l’hébergement sera fixé.

## Comportement et vérifications

Nom 2–100 caractères, email jusqu’à 254, téléphone facultatif jusqu’à 40,
objet 3–150, message 10–5000. Les champs disposent de labels visibles, erreurs
associées, attributs requis et focus sur la première erreur. Aucun envoi natif
vers une URL de remplacement. Champs conservés sur erreur, blocage des doubles
soumissions pendant la requête, délai maximal de 20 secondes et aucune relance
automatique. Une coupure peut empêcher de connaître le résultat : le message
d’erreur ne prétend alors pas que le service a refusé la demande.

Le succès exige une réponse JSON `ok: true` et un statut HTTP positif de
Formspree, sans erreur. Les champs ne sont effacés que dans ce cas. Le honeypot
rempli ne produit jamais de confirmation fictive. Les coordonnées directes et
WhatsApp restent accessibles même quand le formulaire est indisponible.

Contrôles sans réseau : `node --test scripts/contact.test.mjs`. Ils remplacent
le transport HTTP par des réponses contrôlées ; un succès de test ne constitue
**ni un transport configuré, ni une réception réelle**. `npm run build`,
`npm run lint` et `node scripts/validate-pages.mjs` vérifient le code et le rendu
React statique. Les interactions visuelles réelles nécessitent un navigateur.

Résultats de cette étape : build réussi, lint sans avertissement, cinq tests
hors réseau réussis et rendu statique des routes validé, y compris les labels,
champs requis et limites du formulaire. Contrôle HTTP local réussi sur 22 URL,
127 images, le PDF et les modules Vite à `http://127.0.0.1:5173/` ; aucune
soumission de formulaire n’a été effectuée pendant ce contrôle. Le navigateur
d’automatisation a expiré : rendu desktop/mobile, saisie et conservation des
champs dans le navigateur, doubles clics et focus restent à contrôler
manuellement. Les tests réseau contrôlés valident le transport et l’absence de
mutation des données, sans constituer un test interactif complet de React.

## Documentation officielle consultée

- [Formulaires pour sites statiques](https://formspree.io/html/)
- [Validation des champs côté service](https://help.formspree.io/articles/using-the-cli/the-formspree-json-file)
- [Reply-To](https://help.formspree.io/articles/building-your-form/email-reply-to-address/)
- [Honeypot](https://help.formspree.io/articles/building-your-form/honeypot-spam-filtering/)
- [Limites et réponses 429](https://help.formspree.io/articles/form-and-project-settings/system-limits)
