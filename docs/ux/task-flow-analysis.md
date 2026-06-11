# Analyses de flux de tâches — AbrisTempo Local

> Objectif : décortiquer les **parcours réels** de l'utilisateur, repérer les **points de
> friction** (constats de convivialité) et formuler des **recommandations concrètes**.
> Méthode : *task-flow analysis* + parcours clavier/lecteur d'écran, fondés sur le code réel.

Quatre tâches clés :
1. Parcourir et acheter un abri
2. S'inscrire / se connecter (courriel ou nom d'utilisateur)
3. Gérer son profil
4. Réserver une installation

Légende friction : 🟢 fluide · 🟡 friction mineure · 🔴 bloquant / parcours incomplet.

---

## Tâche 1 — Parcourir et acheter un abri

**Composants** : `home.ts`, `catalog.ts`, `product-detail.ts`, `product-card.ts`, `cart.service.ts`, `navbar.ts`.

### Flux nominal
```
1. Arrivée sur l'accueil (/)
2. Clic « Voir le catalogue » (CTA hero)  ──► /boutique
3. (option) Filtrer par catégorie  ──► chips aria-pressed, rechargement liste (loadProducts)
4. Lire une carte produit (nom, prix, location/mois, dispo « En stock »)
5a. Clic « Ajouter au panier »          ──► toast + badge navbar (cart.count())
5b. OU clic sur le nom/produit          ──► /boutique/:slug (détail)
6. Sur le détail : lire description, dispo, prix ──► « Ajouter au panier »
7. Clic icône panier (navbar)           ──► /panier
8. 🔴 Checkout / paiement                ──► NON IMPLÉMENTÉ
```

### Constats de convivialité
- 🟢 **Carte produit accessible** : `<article>` sémantique, un seul lien cliquable (titre), image en `tabindex="-1" aria-hidden` pour éviter le doublon de tabulation (`product-card.html`), dispo annoncée en texte + icône.
- 🟢 **Feedback d'ajout** clair (toast `ToastService` + badge `cartLabel()` annoncé aux lecteurs d'écran).
- 🟡 **Pas de recherche ni de tri** : seul le filtre par catégorie existe (`catalog.ts`). Au-delà de quelques produits, retrouver un modèle précis devient laborieux.
- 🟡 **Catalogue dédoublé** : la home affiche un catalogue (`#catalogue`) avec un rendu de carte **différent** de `/boutique` (les cartes de home n'ont pas de bouton « ajouter »). Incohérence d'attente.
- 🟡 **Bouton « Ajouter » désactivé si épuisé** (`[disabled]`, `aria-disabled`) — bon, mais aucune alternative proposée (alerte de réapprovisionnement).
- 🔴 **Le parcours d'achat s'arrête au panier** : pas de page panier fonctionnelle ni de checkout. La tâche « acheter » n'est pas complétable de bout en bout.

### Recommandations
1. Ajouter une **recherche** (`role="search"`, label associé) et un **tri** (prix, dispo) ; brancher la **pagination** serveur déjà exposée (`pageNumber/pageSize/hasNext`).
2. **Unifier le rendu** : réutiliser `ProductCardComponent` sur la home (ne garder que les *vedettes*) et renvoyer au `/boutique` pour le catalogue complet.
3. Concevoir le **checkout accessible** : étapes claires, récapitulatif révisable (WCAG 3.3.4), pré-remplissage depuis le profil (3.3.7), messages d'erreur reliés (3.3.1).
4. Sur produit épuisé : proposer « M'avertir du retour en stock ».

---

## Tâche 2 — S'inscrire / se connecter (courriel ou nom d'utilisateur)

**Composants** : `auth.ts` + `auth.html` (carte *flip*), `auth.service.ts`, `publicGuard`.

### Flux nominal — connexion
```
1. Clic « Connexion » (navbar)          ──► /auth (publicGuard : si déjà connecté → /)
2. Saisir identifiant (courriel OU nom d'utilisateur) + mot de passe
   (champ type="text", autocomplete="username" → gestionnaire de mots de passe OK)
3. Clic « Se connecter »                 ──► spinner + aria-busy
4a. Succès                               ──► navigateByUrl('/mon-compte/profil')
4b. Échec                                ──► alerte role="alert" « Identifiants incorrects. »
```

### Flux nominal — inscription
```
1. Sur /auth, clic « S'inscrire »        ──► flip de carte (switchTo('register'), ~640ms)
   (annonce SR via aria-live « Formulaire d'inscription »)
2. Saisir prénom, nom, courriel, nom d'utilisateur, mot de passe, confirmation
   (hints visibles : règles mot de passe, contraintes username)
3. Validation cross-field (passwordsMatch) + patterns (majuscule/chiffre/spécial)
4. Clic « Créer mon compte »             ──► succès → /mon-compte/profil
```

### Constats de convivialité
- 🟢 **Authentification accessible (WCAG 3.3.8)** : connexion par courriel **ou** username, pas de `Validators.email` bloquant sur le login (`auth.ts`), `autocomplete` correct → remplissage par gestionnaire de mots de passe, **aucun test cognitif** (pas de CAPTCHA).
- 🟢 **Erreurs reliées** : `aria-invalid` + `aria-describedby` + `role="alert"` par champ ; hints (`field__hint`) qui documentent les règles **avant** l'erreur.
- 🟢 **`publicGuard`** évite d'atterrir sur /auth quand on est déjà connecté.
- 🟡 **Animation *flip*** : 2 × 320 ms (`HALF_FLIP`) ; pendant `isFlipping()`, les boutons de bascule sont désactivés. À vérifier que `prefers-reduced-motion` neutralise le flip (la règle globale réduit les animations, mais l'effet 3D mérite une désactivation explicite).
- 🔴 **Dette de cohérence** : composants legacy `login.ts`/`login.html` (champ `email` avec `Validators.email`, comportement divergent) et `register.component.ts` (`*ngIf`, sans ARIA d'erreur, libellés non i18n, styles inline) coexistent avec `AuthComponent`. Risque qu'une route les réintroduise → expérience incohérente.
- 🟡 **Lien « Mot de passe oublié »** pointe vers `/auth/reset` — vérifier que la page existe (sinon impasse).

### Recommandations
1. **Supprimer** `login.ts`/`login.html` et `register.component.ts` ; router tout sur `AuthComponent`.
2. Désactiver explicitement le *flip* sous `prefers-reduced-motion` (transition `none` sur `.auth-card`).
3. Validation **asynchrone** de l'unicité courriel/username (debounce) pour éviter l'échec tardif.
4. Vérifier/implémenter la page de réinitialisation ; sinon masquer le lien.

---

## Tâche 3 — Gérer son profil

**Composants** : `profile.ts` + `profile.html`, `authGuard`, formulaires réactifs (infos, adresse, sécurité).

### Flux nominal
```
1. Connecté → menu utilisateur (navbar) → « Mon profil »  ──► /mon-compte/profil (authGuard)
2. Skeleton aria-busy pendant le chargement
3. Onglets (role=tablist) : Informations | Adresse de livraison | Sécurité
4a. Informations : prénom, nom, (courriel en lecture seule), téléphone, langue préférée
4b. Adresse : rue, ville, province (select), code postal (format A1A 1A1), pays (readonly)
4c. Sécurité : mot de passe actuel + nouveau + confirmation
5. « Sauvegarder »  ──► spinner ; succès annoncé via aria-live « Modifications sauvegardées »
```

### Constats de convivialité
- 🟢 **Onglets ARIA corrects** : `role="tablist/tab/tabpanel"`, `aria-selected`, `aria-controls`, `id` reliés (`profile.html`).
- 🟢 **Feedback en `aria-live="polite"`** pour succès, `role="alert"` pour erreur — annoncé sans déplacer le focus.
- 🟢 **Courriel en lecture seule** avec hint explicatif (« ne peut pas être modifiée ici ») → prévention d'erreur.
- 🟢 **Adresse mémorisée** et réutilisée (WCAG 3.3.7) — réduit la ressaisie.
- 🟡 **Navigation par onglets au clavier** : les `role="tab"` ne semblent pas implémenter la navigation **par flèches** (pattern APG : flèches gauche/droite entre tabs, `tabindex` roving). Le clic et Tab fonctionnent, mais le patron tabs complet n'est pas garanti.
- 🟡 **Liens sidebar** « Mes commandes / réservations / locations » mènent à des routes possiblement non implémentées (cf. routes commentées dans `app.routes.ts`).
- 🟡 **Déconnexion sans confirmation** (`auth.logout()` direct).

### Recommandations
1. Implémenter la **navigation flèches** des onglets (roving `tabindex`, flèches gauche/droite, Home/End) selon l'ARIA Authoring Practices.
2. Vérifier l'existence des routes liées dans la sidebar ; afficher un état « bientôt disponible » plutôt qu'une 404 silencieuse.
3. **Déplacer le focus** vers le panneau actif (ou son titre `h2`) au changement d'onglet pour les lecteurs d'écran.

---

## Tâche 4 — Réserver une installation

**Composants** : `installation.ts` (et `location.ts`), liens depuis `home.html` (hero + CTA) et `navbar`.

### Flux attendu vs réel
```
ATTENDU
1. Clic « Réserver une installation » (hero / CTA / navbar)
2. Choix d'un créneau / formulaire d'adresse / récapitulatif
3. Confirmation + courriel

RÉEL
1. Clic « Réserver une installation »  ──► /installation
2. 🔴 Page « en construction » :
   « La réservation en ligne ... arrive bientôt. Appelez-nous au 819 123-4567 »
3. Seule issue : appel téléphonique
```

### Constats de convivialité
- 🟢 La page placeholder est **elle-même accessible** : `h1` unique, `aria-labelledby`, langage clair, CTA de repli (`installation.ts`).
- 🟢 **Aide cohérente (WCAG 3.2.6)** : le numéro 819 123-4567 est offert ici, dans le footer et dans le bandeau CTA — toujours au même endroit relatif.
- 🔴 **Tâche non réalisable en ligne** : trois points d'entrée (hero, CTA home, navbar) mènent tous à un cul-de-sac fonctionnel. Attente créée par les CTA non honorée.
- 🟡 Même situation pour `/location` (location saisonnière).

### Recommandations
1. **Court terme** : enrichir le placeholder en page informative (zone desservie en Outaouais, étapes, délais, prix indicatifs, FAQ) pour que le clic apporte de la valeur.
2. **Moyen terme** : implémenter un formulaire de réservation accessible : sélection de date (date-picker au clavier + saisie texte alternative), pré-remplissage de l'adresse depuis le profil (3.3.7), étape de **révision** avant confirmation (3.3.4), messages d'erreur reliés (3.3.1), confirmation en `aria-live`.
3. Tant que la réservation en ligne n'existe pas, **clarifier les CTA** (« Demander une soumission par téléphone ») pour ne pas tromper l'attente.

---

## Évaluation de la convivialité (efficacité · efficience · satisfaction)

Selon les trois composantes de l'utilisabilité (ISO 9241-11) :

| Tâche | Efficacité (l'objectif est-il atteignable ?) | Efficience (effort/étapes) | Satisfaction |
|-------|-----------------------------------------------|----------------------------|--------------|
| 1. Acheter un abri | **Partielle** — navigation OK, mais pas de checkout | Bonne jusqu'au panier ; recherche/tri manquants | Bonne (UI claire, feedback) mais frustration en fin de parcours |
| 2. S'inscrire / se connecter | **Élevée** — parcours complet et accessible | Très bonne (flip sans changement de page, autocomplete) | Élevée ; dette legacy invisible à l'utilisateur final |
| 3. Gérer son profil | **Élevée** sur les 3 onglets implémentés | Bonne ; ressaisie minimisée (adresse mémorisée) | Bonne ; clavier-tabs à parfaire |
| 4. Réserver une installation | **Nulle en ligne** — repli téléphonique | N/A (bloqué) | Faible (attente non honorée par les CTA) |

**Synthèse** : l'**efficience** et la **satisfaction** sont fortes là où les fonctionnalités
existent, portées par un design system cohérent, des états annoncés et une accessibilité
soignée. Le talon d'Achille est l'**efficacité de bout en bout** sur les deux parcours
transactionnels (achat et réservation), faute de checkout et de module de réservation. Les
priorités UX sont donc : (1) compléter le checkout, (2) implémenter/clarifier la réservation,
(3) ajouter recherche/tri, (4) résorber la dette des composants auth legacy.
