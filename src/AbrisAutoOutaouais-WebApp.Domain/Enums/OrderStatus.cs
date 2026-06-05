namespace AbrisAutoOutaouais_WebApp.Domain.Enums;

public enum OrderStatus
{
    Pending = 0,   // En attente de paiement
    Confirmed = 1,   // Paiement reçu
    Shipped = 2,   // Expédiée / en livraison
    Delivered = 3,   // Livrée
    Cancelled = 4,   // Annulée
}
