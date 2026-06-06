using AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;
using AbrisAutoOutaouais_WebApp.Domain.Exceptions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using System;
using System.Collections.Generic;
using System.Text;

namespace AbrisAutoOutaouais_WebApp.Infrastructure.Services;

internal sealed class LocalFileStorageService(
    IWebHostEnvironment env,
    IHttpContextAccessor accessor) : IFileStorageService
{
    private static readonly string[] AllowedTypes = ["image/jpeg", "image/png", "image/webp"];
    private const long MaxBytes = 5 * 1024 * 1024; // 5 MB

    public async Task<string> SaveAsync(
        Stream fileStream, string fileName, string contentType,
        CancellationToken ct = default)
    {
        if (!AllowedTypes.Contains(contentType))
            throw new BusinessRuleException("Type de fichier non supporté (jpg, png, webp uniquement).");
        if (fileStream.Length > MaxBytes)
            throw new BusinessRuleException("Fichier trop volumineux (max 5 Mo).");

        var uploadsPath = Path.Combine(env.WebRootPath, "uploads", "products");
        Directory.CreateDirectory(uploadsPath);

        var ext = Path.GetExtension(fileName);
        var unique = $"{Guid.NewGuid()}{ext}";
        var fullPath = Path.Combine(uploadsPath, unique);

        await using var fs = new FileStream(fullPath, FileMode.Create);
        await fileStream.CopyToAsync(fs, ct);

        var request = accessor.HttpContext!.Request;
        return $"{request.Scheme}://{request.Host}/uploads/products/{unique}";
    }

    public Task DeleteAsync(string fileUrl, CancellationToken ct = default)
    {
        var fileName = Path.GetFileName(new Uri(fileUrl).LocalPath);
        var path = Path.Combine(env.WebRootPath, "uploads", "products", fileName);
        if (File.Exists(path)) File.Delete(path);
        return Task.CompletedTask;
    }
}
