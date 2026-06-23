using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;

namespace AbrisAutoOutaouais_WebApp.Application.Catalog.Queries.ResolveCatalogSlug;

/// <summary>
/// Résout le TYPE d'un slug de catalogue : un même slug peut désigner un MODÈLE d'abri paramétrique
/// (<c>/shelters/{slug}</c>) OU un produit fixe (<c>/products/{slug}</c>). Le client interroge ce
/// résolveur AVANT de charger la fiche, pour appeler le bon endpoint sans provoquer un 404 spéculatif
/// (le double appel « tente shelter puis produit » générait du bruit 404 en console — rework EPIC 9).
/// </summary>
public sealed record ResolveCatalogSlugQuery(string Slug)
    : IQuery<CatalogSlugTypeDto>;
