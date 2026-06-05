using System;
using System.Collections.Generic;
using System.Text;

namespace AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;

/// <summary>
/// Abstraction de DateTime.UtcNow pour les tests unitaires.
/// Dans les tests, on injecte un mock avec une date fixe.
/// </summary>
public interface IDateTimeProvider
{
    DateTime UtcNow { get; }
}
