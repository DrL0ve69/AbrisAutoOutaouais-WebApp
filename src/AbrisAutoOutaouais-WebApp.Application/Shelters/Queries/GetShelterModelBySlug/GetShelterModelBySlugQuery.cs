using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;

namespace AbrisAutoOutaouais_WebApp.Application.Shelters.Queries.GetShelterModelBySlug;

/// <summary>Détail complet d'un modèle d'abri paramétrique par son slug (incl. options de dimensions).</summary>
public sealed record GetShelterModelBySlugQuery(string Slug) : IQuery<ShelterModelDetailDto>;
