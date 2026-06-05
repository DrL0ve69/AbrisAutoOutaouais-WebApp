using System;
using System.Collections.Generic;
using System.Text;

namespace AbrisAutoOutaouais_WebApp.Application.Common.Models;

/// <summary>
/// Représente le succès ou l'échec d'une opération SANS lancer d'exception.
/// Utiliser pour les chemins d'erreur attendus (validation métier légère).
/// Utiliser les exceptions Domain pour les violations sérieuses (NotFoundException, etc.).
/// </summary>
public sealed class Result
{
    public bool IsSuccess { get; }
    public string? Error { get; }

    private Result(bool success, string? error) { IsSuccess = success; Error = error; }

    public static Result Success() => new(true, null);
    public static Result Failure(string error) => new(false, error);
}

public sealed class Result<T>
{
    public bool IsSuccess { get; }
    public T? Value { get; }
    public string? Error { get; }

    private Result(bool success, T? value, string? error)
    { IsSuccess = success; Value = value; Error = error; }

    public static Result<T> Success(T value) => new(true, value, null);
    public static Result<T> Failure(string error) => new(false, default, error);
}
