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
        string subfolder = "products",
        CancellationToken ct = default)
    {
        if (!AllowedTypes.Contains(contentType))
            throw new BusinessRuleException("Type de fichier non supporté (jpg, png, webp uniquement).");
        if (fileStream.Length > MaxBytes)
            throw new BusinessRuleException("Fichier trop volumineux (max 5 Mo).");

        var safeFolder = string.IsNullOrWhiteSpace(subfolder) ? "products" : subfolder;
        var uploadsPath = Path.Combine(WebRoot, "uploads", safeFolder);
        Directory.CreateDirectory(uploadsPath);

        var ext = Path.GetExtension(fileName);
        var unique = $"{Guid.NewGuid()}{ext}";
        var fullPath = Path.Combine(uploadsPath, unique);

        await using var fs = new FileStream(fullPath, FileMode.Create);
        await fileStream.CopyToAsync(fs, ct);

        var request = accessor.HttpContext!.Request;
        return $"{request.Scheme}://{request.Host}/uploads/{safeFolder}/{unique}";
    }

    public Task DeleteAsync(string fileUrl, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(fileUrl)) return Task.CompletedTask;

        // L'URL publique est « {scheme}://{host}/uploads/{subfolder}/{fichier} » ;
        // LocalPath (« /uploads/… ») est indépendant de l'hôte → suppression robuste.
        var relative = Uri.TryCreate(fileUrl, UriKind.Absolute, out var uri)
            ? uri.LocalPath
            : fileUrl;
        var path = Path.Combine(WebRoot, relative.TrimStart('/').Replace('/', Path.DirectorySeparatorChar));
        if (File.Exists(path)) File.Delete(path);
        return Task.CompletedTask;
    }

    // WebRootPath est null si le dossier wwwroot n'existe pas encore au démarrage ;
    // on retombe alors sur ContentRoot/wwwroot et on garantit sa présence.
    private string WebRoot
    {
        get
        {
            var root = env.WebRootPath ?? Path.Combine(env.ContentRootPath, "wwwroot");
            Directory.CreateDirectory(root);
            return root;
        }
    }
}
