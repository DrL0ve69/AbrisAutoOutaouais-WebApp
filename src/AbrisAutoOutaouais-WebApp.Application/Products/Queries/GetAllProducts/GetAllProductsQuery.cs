using AbrisAutoOutaouais_WebApp.Application.Common.Mediator;
using AbrisAutoOutaouais_WebApp.Application.Common.Models;
using AbrisAutoOutaouais_WebApp.Application.Products.Queries.GetProductBySlug;
using System;
using System.Collections.Generic;
using System.Text;

namespace AbrisAutoOutaouais_WebApp.Application.Products.Queries.GetAllProducts;

public sealed record GetAllProductsQuery(int Page, int PageSize, string? Category, string? Search) : IQuery<PaginatedList<ProductDto>>;
