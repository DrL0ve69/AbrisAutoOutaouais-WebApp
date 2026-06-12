using System;
using System.Collections.Generic;
using System.Text;

namespace AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;

public interface IFileStorageService
{
    /// <summary>
    /// Stocke un fichier sous <c>wwwroot/uploads/{subfolder}</c> et retourne son URL publique absolue.
    /// </summary>
    Task<string> SaveAsync(Stream fileStream, string fileName, string contentType,
        string subfolder = "products", CancellationToken ct = default);

    /// <summary>Supprime un fichier précédemment stocké, à partir de son URL publique.</summary>
    Task DeleteAsync(string fileUrl, CancellationToken ct = default);
}
