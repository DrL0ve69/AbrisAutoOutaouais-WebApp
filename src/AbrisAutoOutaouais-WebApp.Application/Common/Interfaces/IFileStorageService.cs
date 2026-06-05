using System;
using System.Collections.Generic;
using System.Text;

namespace AbrisAutoOutaouais_WebApp.Application.Common.Interfaces;

public interface IFileStorageService
{
    /// <summary>Stocke un fichier, retourne son URL publique.</summary>
    Task<string> SaveAsync(Stream fileStream, string fileName, string contentType,
        CancellationToken ct = default);
    Task DeleteAsync(string fileUrl, CancellationToken ct = default);
}
