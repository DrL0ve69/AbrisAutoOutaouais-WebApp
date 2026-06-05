using System;
using System.Collections.Generic;
using System.Text;

namespace AbrisAutoOutaouais_WebApp.Domain.Enums;

public enum BookingType
{
    Installation = 0,   // Pose d'un abri acheté ou loué
    Delivery = 1,   // Livraison seule
    Removal = 2,   // Démontage / récupération
}
