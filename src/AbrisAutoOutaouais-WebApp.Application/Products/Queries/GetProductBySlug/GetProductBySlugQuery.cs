using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using System;
using System.Collections.Generic;
using System.Text;

namespace AbrisAutoOutaouais_WebApp.Application.Products.Queries.GetProductBySlug;

public sealed record GetProductBySlugQuery(string Slug) : IQuery<ProductDto>;
