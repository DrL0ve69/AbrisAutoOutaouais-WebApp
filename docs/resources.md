# Ressources externes — veille & références (AbrisTempo Local)

> Liste **curée** de références utiles au projet, **cadrée par la règle budget**
> (`.claude/rules/budget-free-tier.md`) : avant d'ajouter tout fournisseur/dépendance, on cherche
> d'abord l'équivalent **gratuit et sans clé**. Source initiale : `probleme abris-auto-outaouais.docx`
> (2026-06-19). **Rien ici n'est installé automatiquement** — ce sont des pointeurs à consulter.

## API & services gratuits (à consulter AVANT d'ajouter un fournisseur)

- **public-apis** — <https://github.com/public-apis/public-apis> — annuaire d'API publiques, filtre
  « no-auth / free ». Le 1er réflexe quand on cherche une donnée (géocodage, météo, etc.) **sans clé**.
- **free-for-dev** — <https://github.com/ripienaar/free-for-dev> — paliers gratuits SaaS/cloud pour
  devs. Sert à vérifier qu'un service tient dans le gratuit **sans carte** (sinon = payant, cf. règle).
- **open-source-alternatives** — <https://github.com/btw-so/open-source-alternatives> — remplacer un
  SaaS payant par une brique open-source auto-hébergeable.

> Rappel `/mesurer` : la pile actuelle (Leaflet + geoman-free + tuiles **Esri World Imagery** keyless +
> Turf + géocodage **Photon**) est déjà 100 % gratuite. **Google Maps Platform / Earth Engine = rejetés**
> (compte de facturation requis + redondants). Voir `.claude/rules/budget-free-tier.md`.

## Références générales (apprentissage / architecture)

- **system-design-primer** — <https://github.com/donnemartin/system-design-primer> — utile pour
  EPIC 16 (briques transverses : cache, rate-limit, observabilité).
- **awesome** — <https://github.com/sindresorhus/awesome> · **free-programming-books** —
  <https://github.com/EbookFoundation/free-programming-books> · **build-your-own-x** —
  <https://github.com/codecrafters-io/build-your-own-x> — veille générale.

## Outillage Claude Code — CANDIDATS À ÉVALUER (non installés)

> ⚠️ **Aucun n'est installé.** Avant d'adopter une skill/agent tiers : revue sécurité (code exécuté),
> ajustement au dépôt (FR, WCAG 2.2 AA, .NET 10 / Angular 21), et **règle budget** (gratuit). On
> **mine les idées**, on ne clone pas en aveugle.

- **ui-ux-pro-max-skill** — <https://github.com/nextlevelbuilder/ui-ux-pro-max-skill> — *évalué
  2026-06-19* : réel, **gratuit** (Python autonome, sans clé) mais Python-centré et **redondant** avec
  notre skill `a11y-ux-pass` + `docs/ux/*`. **Non installé.** Idées non-redondantes retenues →
  repliées dans `.claude/rules/motion-a11y.md` §6 (anti-patrons d'industrie, check pré-livraison UI/UX).
- **awesome-claude-code** — <https://github.com/hesreallyhim/awesome-claude-code> — index de
  hooks/skills/commands. À parcourir ponctuellement pour des idées de hooks.
- **superpowers** — <https://github.com/obra/superpowers> — collection de skills. Candidat d'évaluation.
- **claudemarketplaces / mcpmarket** — <https://claudemarketplaces.com/skills> ·
  <https://mcpmarket.com/server> — places de marché skills/MCP. Vérifier coût + sécurité avant tout usage.
