using AbrisAutoOutaouais_WebApp.Domain.Exceptions;
using System;
using System.Collections.Generic;
using System.Text;

namespace AbrisAutoOutaouais_WebApp.Domain.ValueObjects;

public sealed class Money
{
    public decimal Amount { get; init; }
    public string Currency { get; init; } = "CAD";

    private Money() { }

    public static Money Of(decimal amount, string currency = "CAD")
    {
        if (amount < 0)
            throw new ArgumentException("Le montant ne peut pas être négatif.", nameof(amount));
        return new Money { Amount = amount, Currency = currency };
    }

    public Money Add(Money other)
    {
        if (Currency != other.Currency)
            throw new BusinessRuleException("Impossible d'additionner des devises différentes.");
        return Of(Amount + other.Amount, Currency);
    }

    public Money Multiply(int quantity) => Of(Amount * quantity, Currency);

    public override string ToString() => $"{Amount:F2} {Currency}";
}
