# Adaptateurs de paiement (`IPaymentService`)

Port : `Application/Common/Interfaces/IPaymentService.cs`. Sélection par config
(`Payments:Provider`) dans `Infrastructure/DependencyInjection.cs` — même idiome
port/adaptateur/Strategy que `IPlacesService` (Photon/Radar/Google).

## Adaptateurs

| Provider (`Payments:Provider`) | Adaptateur | État |
|---|---|---|
| `manual` (**défaut**) | `ManualInteracPaymentService` | Virement Interac manuel. Gratuit, **sans clé**, **sans appel réseau**. Confirmation = réconciliation admin (`Order.MarkPaid`). |
| `vopay` | `VoPayPaymentService` | **STUB keyless d'extensibilité — JAMAIS le défaut, JAMAIS activé par accident.** |
| `paysafe` | `PaysafePaymentService` | **STUB keyless d'extensibilité — JAMAIS le défaut, JAMAIS activé par accident.** |

## Garde fail-fast au démarrage

Sélectionner `vopay` / `paysafe` **sans clé** (`Payments:VoPay:ApiKey` /
`Payments:Paysafe:ApiKey` vide) fait **échouer le démarrage** (`InvalidOperationException`,
même idiome que `Jwt:Key` / `Client:BaseUrl`). C'est l'**unique point d'enforcement** de
l'invariant budget : aucun adaptateur payant ne peut être activé par mégarde.

## Règle budget (rappel)

L'intégration **réelle** de VoPay/Paysafe exige une clé API + un contrat marchand payant
(compte de facturation) → **traité comme PAYANT** par `.claude/rules/budget-free-tier.md`.
Le vrai appel API REST n'est livré **que sous l'accord explicite du propriétaire**. Tant que
la clé est vide, ces adaptateurs restent inertes (les stubs ne lèvent jamais et n'appellent
aucun réseau, conformément au contrat de résilience du port).

## Webhooks (patron documenté, NON codé)

Le MVP manuel n'a **aucun webhook**. Le patron pour un futur adaptateur API — réception
`[AllowAnonymous]`, **vérification de signature HMAC** du corps brut, **idempotence**
(rejeu sans re-confirmation, garde naturelle `Order.Confirm()` + L-046), réponse `200`
systématique — est décrit (sans implémentation) dans
[`docs/spikes/epic-7-payments-spike.md` §4.5](../../../../../docs/spikes/epic-7-payments-spike.md).
