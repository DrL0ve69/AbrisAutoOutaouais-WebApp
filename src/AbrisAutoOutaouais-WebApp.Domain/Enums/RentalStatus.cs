using System;
using System.Collections.Generic;
using System.Text;

namespace AbrisAutoOutaouais_WebApp.Domain.Enums;

public enum RentalStatus
{
    // En attente du paiement (virement Interac) — statut INITIAL d'un nouveau contrat (EPIC 7.2).
    // Le statut est stocké en STRING (.HasConversion<string>()) : l'ajout est purement additif,
    // aucun risque ordinal. Placé en tête pour la lisibilité.
    PendingPayment = 0,
    Active = 1,
    Expired = 2,
    Cancelled = 3,
}
