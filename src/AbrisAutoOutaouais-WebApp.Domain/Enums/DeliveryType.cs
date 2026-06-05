using System;
using System.Collections.Generic;
using System.Text;

namespace AbrisAutoOutaouais_WebApp.Domain.Enums;

public enum DeliveryType
{
    Pickup = 0,   // Ramassage en magasin/entrepôt
    Delivery = 1,   // Livraison à domicile
    ExpressPickup = 2,   // Livraison express avec ramassage en magasin/entrepôt
    ExpressDelivery = 3,   // Livraison express à domicile
}
