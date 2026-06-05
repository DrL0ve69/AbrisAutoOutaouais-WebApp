using System;
using System.Collections.Generic;
using System.Text;

namespace AbrisAutoOutaouais_WebApp.Domain.Events;

/// <summary>
/// Les Domain Events signalent qu'une chose importante s'est produite. Ils peuvent déclencher des effets secondaires(email, mise à jour d'un agrégat voisin).
/// </summary>
public interface IDomainEvent
{
}
