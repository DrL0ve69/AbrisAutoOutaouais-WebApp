using System;
using System.Collections.Generic;
using System.Text;

namespace AbrisAutoOutaouais_WebApp.Domain.Enums;

public enum BookingStatus
{
    Pending = 0,
    Confirmed = 1,
    Completed = 2,
    Cancelled = 3,

    // En attente du paiement (virement Interac) — statut INITIAL d'une nouvelle réservation (EPIC 7.3).
    // Le statut est stocké en STRING (.HasConversion<string>()) : l'ajout est purement additif, aucun
    // risque ordinal. La réservation est CONFIRMÉE après réconciliation administrative du paiement
    // (Activate : PendingPayment → Confirmed). Miroir de RentalStatus.PendingPayment.
    PendingPayment = 4,
}
