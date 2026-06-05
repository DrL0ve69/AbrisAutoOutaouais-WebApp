using System;
using System.Collections.Generic;
using System.Text;

namespace AbrisAutoOutaouais_WebApp.Application.Common.Mediator;

/// <summary>Type "void" typé — permet ICommand sans résultat significatif.</summary>
public readonly struct Unit
{
    public static readonly Unit Value = new();
}
