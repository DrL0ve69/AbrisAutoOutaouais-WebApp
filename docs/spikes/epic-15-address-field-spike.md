# Spike EPIC 15 — Champ d'adresse : un seul champ ? lecture seule ou éditable ?

> **Livrable de US-15.1** (spike 2 pts). **But :** comparer *un seul champ d'adresse* vs *champs
> séparés*, et *lecture seule* vs *éditable*, aux meilleures pratiques (GOV.UK, Google/autocomplete,
> WCAG 2.2 — `autocomplete` 1.3.5), puis **recommander** une approche **avant** d'écrire la refonte
> (US-15.2 / US-15.3, 6 pts). **Décision figée à reconsidérer** : Épic D avait tranché « champ unique
> intelligent → **champs structurés éditables** » ; le 2ᵉ `.docx` propose l'inverse (**lecture
> seule**). L'utilisateur a demandé : *spike d'abord, décision ensuite* — ce document éclaire la
> décision, il ne la verrouille pas.
>
> **Date :** 2026-06-18. **Auteur :** boucle d'agents (architecte/recherche). **Statut :** ✅ spike
> terminé. **Décision utilisateur prise (2026-06-18) :** **un seul champ « n° + rue » + auto-rempli
> ÉDITABLE** (option recommandée ; le « lecture seule » du `.docx` est **écarté**). Implémentation
> (US-15.2 / US-15.3) **différée** — à lancer via `/feature-cycle` quand l'utilisateur le décidera
> (ou après l'EPIC 9). Voir §6.

---

## 1 · Les bugs à résoudre (rappel des constats utilisateur)

Le 2ᵉ `.docx` (points 5.2 / 6.4) signale trois symptômes concrets, tous reliés au **n° civique en
champ séparé** :

1. **Le n° civique séparé casse l'autocomplétion.** Les fournisseurs d'adresses renvoient une **ligne
   de rue combinée** (« 45 rue de l'Atmosphère ») ; un champ civique distinct **se bat** contre la
   suggestion (il faut re-parser le n° hors du libellé — cascade `parseCivicFromLabel`, fragile).
2. **Mauvais codes postaux proposés** (ex. « 45 Atmosphère » → `J9A 2V9`). Le `lookupPostalCode`
   géocode au mieux ; il **se trompe parfois**.
3. **On peut changer le n° civique sans que la rue suive** → adresse incohérente envoyée au serveur
   (US-15.3).

> **Observation-clé du spike :** les bugs 1 et 3 **n'existent que parce que le n° civique est un
> contrôle séparé**. Les fusionner dans un seul champ « n° + rue » les **supprime par construction**.
> Le bug 2 (mauvais code postal) est, lui, un argument **contre** le verrouillage en lecture seule.

---

## 2 · État actuel du code (ancrage — ne pas re-théoriser)

5 champs séparés partagés par 5 écrans (profil, caisse, location, installation, `/mesurer`) :

| Contrôle | Aujourd'hui | Remarques |
|----------|-------------|-----------|
| `civicNumber` | `<input>` **séparé, éditable** | `CIVIC_PATTERN /^\d+[A-Za-z]?$/` ; cascade `s.civicNumber ?? parseCivicFromLabel(label) ?? valeur saisie` (D1) |
| `street` | `app-address-autocomplete` (combobox APG) | émet `valueChange` + `suggestionSelected` ; ne porte pas le `FormControl` |
| `apartment` | `<input>` optionnel | jamais auto-rempli |
| `city` | `<input>` | auto-patché depuis la suggestion |
| `province` | profil = `<select>` ; **autres = `<input>` texte** | **code 2 lettres canonique** attendu serveur (L-004/L-011) — incohérence : texte libre ailleurs |
| `postalCode` | `<input>` éditable | `lookupPostalCode` après sélection ; annonce `role=status` (**manquante sur installation** — bug) |

Logique centralisée : `AddressFormController` (`createAddressFormController`, auto-injecté) +
`AddressAutofillService` (`applySuggestion`, `syncStreet`) + `PlacesService` (proxy backend
`/api/v1/places/*` — Photon défaut / Radar / Google, **jamais d'appel tiers direct**, L-011).
Backend : `AddressDto` + `AddressDtoValidator` (Application) — **`civicNumber` séparé côté serveur**.

**Dettes annexes repérées** (à replier dans la refonte) : préfixes d'`id` incohérents (`co-`,
`mesurer-`, aucun…) ; province en texte libre hors profil ; annonce code postal absente sur
installation ; **aucun token `autocomplete` WCAG 1.3.5** sur les champs (à confirmer/poser).

---

## 3 · Meilleures pratiques (recherche)

### 3.1 Un seul champ vs champs séparés

- **GOV.UK Design System — *Addresses*.** Recommande des **champs séparés** (line 1, line 2 *opt.*,
  town/city, postcode), **mais combine systématiquement le bâtiment + la rue dans « Address line 1 »** :
  le **n° de porte n'est jamais un champ à part**. Trois approches : *multiple inputs* (quand on
  connaît les pays — permet validation par partie), *address lookup* (autocomplétion), *textarea*
  (quand on n'a pas besoin des sous-parties). → **Sépare ville/CP, mais garde n°+rue ensemble.**
- **Baymard — *Avoid Splitting Single Input Entities*.** Éviter d'éclater une entité unique sur
  plusieurs champs (surtout mobile) : navigation pénible, ambiguïté requis/optionnel, **décalage avec
  le modèle mental** de l'utilisateur. (Nuance honnête : Baymard dit n'avoir **pas** de test
  concluant *spécifiquement* sur l'adresse — la règle est générale, pas une preuve dédiée à l'adresse.)
- **Autocomplétion d'adresse (industrie).** L'autocomplétion remplit le formulaire ~30 % plus vite,
  réduit le temps de saisie jusqu'à ~78 % et les erreurs >20 %, car elle insère une adresse **vérifiée
  et déjà découpée** en sous-parties. Elle fonctionne le mieux avec **une ligne de saisie unique**
  (l'utilisateur tape, choisit, le reste se remplit).

> **Convergence :** *une **ligne** d'adresse combinée (n° + rue)* alimentée par l'autocomplétion, puis
> ville / province / code postal en champs distincts. Ce n'est **pas** un textarea fourre-tout (on
> perd les sous-parties) ni 5 champs dont un civique isolé (ce qui casse justement l'autocomplétion).

### 3.2 Lecture seule vs éditable

- **Principe autofill (web.dev / accessibilité).** *L'autofill ne devrait remplir que des champs que
  l'utilisateur pourrait remplir lui-même* → un champ auto-rempli **doit rester éditable**. Un
  `readonly`/`disabled` n'est pas censé être rempli automatiquement.
- **Correction d'erreur.** Une autocomplétion **incorrecte** laisse au client la charge de corriger
  — *avant* qu'il n'abandonne. Or **notre lookup renvoie parfois un mauvais code postal** (bug 2) :
  **verrouiller** le champ piégerait l'erreur **sans recours** → abandon ou adresse fausse.
- **Re-remplissage intelligent (L-002).** Ne ré-autofiller un champ que s'il est **pristine /
  inchangé** ; ne jamais écraser une valeur saisie par l'utilisateur.
- **« Afficher le code postal après sélection ».** La demande du `.docx` est une **affordance de
  confirmation** (montrer la valeur trouvée pour validation/correction), **pas** un verrou. C'est
  exactement la bonne pratique : auto-rempli + **visible** + **corrigeable**.

> **Conclusion §3.2 :** **auto-rempli mais ÉDITABLE** est la meilleure pratique. Le « lecture seule »
> du `.docx` est, sur le fond, **déconseillé** — surtout vu notre bug de code postal. On peut
> **présenter** province/CP comme « confirmés » (style atténué + bouton/affordance « modifier »),
> mais ils **doivent rester corrigeables**. La décision figée d'Épic D (« éditable ») **tient**.

### 3.3 WCAG 2.2 — 1.3.5 *Identify Input Purpose*

- Exige que la **finalité** d'un champ soit **programmatiquement déterminable** via l'attribut HTML
  `autocomplete` (technique suffisante **H98**). Tokens d'adresse : `address-line1`, `address-line2`,
  `address-level2` (ville), `address-level1` (province/état), `postal-code`, `country-name`.
- **Une ligne combinée « n° + rue » mappe proprement sur `autocomplete="address-line1"`** — aucun
  conflit avec le choix « un seul champ d'adresse ».
- **À faire dans la refonte** : poser ces tokens sur **tous** les champs des 5 écrans (gap actuel).

---

## 4 · Recommandation

| Axe | Décision figée Épic D | Proposition `.docx` | **Recommandation du spike** |
|-----|----------------------|---------------------|------------------------------|
| **Structure** | champ rue + **civique séparé** éditable | **un seul** champ (n°+rue) | ✅ **Un seul champ « Adresse (n° et rue) »** = `address-line1`, alimenté par l'autocomplétion. **Supprimer le contrôle `civicNumber` séparé.** Ville / province / code postal **restent des champs distincts**. |
| **Édition** | éditable | **lecture seule** | ✅ **Auto-rempli mais ÉDITABLE** (on **ne retient pas** le lecture-seule). Province/CP présentés comme « confirmés » + **affordance de correction** ; ré-autofill **pristine-only** (L-002). |
| **Confirmation** | — | afficher le CP après sélection | ✅ **Afficher le code postal trouvé** (valeur visible + annonce `aria-live` déjà en place) pour validation/correction. |
| **WCAG 1.3.5** | (absent) | — | ✅ **Poser les tokens `autocomplete`** sur tous les champs des 5 écrans (`address-line1`, `address-level2`, `address-level1`, `postal-code`, `country-name`). |

**Pourquoi ça corrige les bugs :**
- Bugs 1 & 3 (autocomplete cassée, civique désynchronisé) **disparaissent** : il n'y a plus de champ
  civique séparé à désynchroniser ; la ligne combinée est exactement ce que renvoie le fournisseur.
- Bug 2 (mauvais code postal) : champ **éditable** + valeur **affichée** → l'utilisateur corrige.

### 4.1 Décision d'implémentation clé (à confier à l'architecte en US-15.2)

Le `AddressDto` serveur porte `civicNumber` **séparé**. Deux voies :

- **(B1) Garder le DTO serveur découpé ; fusionner seulement à la présentation.** Le client n'a qu'un
  champ `addressLine1` ; au moment d'envoyer, on **scinde** (`parseCivicFromLabel` réutilisé) en
  `civicNumber` + `street`. **Rayon de souffle minimal**, validateurs/qualité de données serveur
  intacts (L-004). **Recommandé** comme point de départ.
- **(B2) Effondrer `AddressDto.street` en une seule ligne** (retirer `civicNumber` serveur). Modèle
  plus propre, mais **migration EF + churn des validateurs + impact L-004 inter-écrans** plus lourds.

> Le « un seul champ » est d'abord une préoccupation de **présentation/parsing** : **B1** livre la
> valeur utilisateur sans toucher au domaine. Trancher B1 vs B2 **au lancement de US-15.2** (la chaîne
> L-004 « un format partagé, tous les valideurs d'accord » s'applique).

### 4.2 À replier dans la refonte (dettes §2)

- Province en **`<select>` contrôlé partout** (code 2 lettres canonique — fin du texte libre, L-011).
- **Uniformiser les préfixes d'`id`** (éviter les collisions L-013).
- **Annonce code postal manquante** sur installation → l'ajouter.
- Tokens `autocomplete` WCAG 1.3.5 partout.
- **Cohésion EPIC 13** : l'input adresse de la carte `/mesurer` réutilise ce composant unique.

### 4.3 Vérification attendue (US-15.2/15.3)

`dotnet test` ; depuis le client `npm run build` + `npm test` + **`npm run e2e`** (axe **dual-thème**
— le contraste n'est pas couvert en vitest, L-016) ; e2e SSR+hydratation via **locator
`pressSequentially` + barrière réseau** `waitForResponse(/places\/suggest/)`, jamais `keyboard.type`
+ wait fixe (L-012) ; **mock = forme du provider par défaut Photon** (nom complet → normalisé, pas
une forme déjà conforme qui masque le trou — L-011). Garde la non-régression Ontario→pass (L-004).

---

## 5 · Risques

- **🟠 Touche les 5 écrans d'adresse** (profil, caisse, location, installation, `/mesurer`) — d'où le
  composant partagé : la refonte est **centralisée** dans `AddressFormController` /
  `AddressAutofillService` / le composant autocomplete, pas dupliquée.
- **Saisie manuelle hors autocomplétion** : un utilisateur qui tape « 45 rue X » sans choisir de
  suggestion doit produire une adresse valide → le **split B1 doit tolérer la frappe libre**
  (parse best-effort + champs ville/CP saisissables à la main).
- **L-004 (format partagé)** : si on passe en B2, tous les validateurs (client + `PlaceOrder`,
  `AddressDtoValidator`…) doivent s'accorder **dans le même diff**.

---

## 6 · Décision (tranchée par l'utilisateur — 2026-06-18)

Le spike **recommandait** : **(1) un seul champ « n° + rue »** et **(2) auto-rempli mais ÉDITABLE**
(pas lecture seule), avec le **code postal affiché** pour confirmation et les **tokens WCAG 1.3.5**.

✅ **Décision retenue : les deux recommandations sont adoptées.** Champ d'adresse unique (n° + rue)
+ champs ville/province/CP **auto-remplis mais ÉDITABLES** (le « lecture seule » du `.docx` est
**écarté** — un mauvais code postal doit rester corrigeable). Le CP est affiché pour confirmation ;
tokens `autocomplete` WCAG 1.3.5 partout. **US-15.2 est donc réorientée** : remplacer « lecture
seule » par « auto-rempli **éditable** ». L'implémentation (US-15.2 / US-15.3) est **différée**
(décision utilisateur « s'arrêter au spike ») — à lancer plus tard via `/feature-cycle` ; voie
serveur **B1** (DTO découpé, split à la présentation) recommandée comme point de départ (§4.1).

---

### Sources

- [GOV.UK Design System — Addresses](https://design-system.service.gov.uk/patterns/addresses/)
- [WCAG 2.2 — Understanding SC 1.3.5 Identify Input Purpose](https://www.w3.org/WAI/WCAG22/Understanding/identify-input-purpose.html)
- [Baymard — Avoid Splitting Single Input Entities](https://baymard.com/blog/mobile-form-usability-single-input-fields)
- [web.dev — Autofill](https://web.dev/learn/forms/autofill)
- [Zuko — Optimizing the Form Address Field](https://www.zuko.io/blog/optimizing-the-form-address-field)
- [AddressZen — Best Practices for an Online Address Form](https://addresszen.com/guides/best-practices-address-form)
