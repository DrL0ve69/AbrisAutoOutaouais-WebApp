using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using AbrisAutoOutaouais_WebApp.Infrastructure.Identity;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace AbrisAutoOutaouais_WebApp.Infrastructure.Identity;

/// <summary>
/// Service de génération de JWT tokens.
/// </summary>
public sealed class TokenService
{
    private readonly IConfiguration _configuration;

    public TokenService(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    /// <summary>
    /// Génère un JWT token pour l'utilisateur fourni.
    /// </summary>
    public string GenerateToken(AppUser user, IReadOnlyList<string> roles)
    {
        var key = _configuration["Jwt:Key"]
            ?? throw new InvalidOperationException("JWT Key not configured");
        var issuer = _configuration["Jwt:Issuer"]
            ?? throw new InvalidOperationException("JWT Issuer not configured");
        var audience = _configuration["Jwt:Audience"]
            ?? throw new InvalidOperationException("JWT Audience not configured");

        var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key));
        var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Email, user.Email ?? string.Empty),
            new(ClaimTypes.Name, user.FullName),
            new("FirstName", user.FirstName),
            new("LastName", user.LastName),
        };

        // Ajouter les rôles en tant que claims
        foreach (var role in roles)
        {
            claims.Add(new Claim(ClaimTypes.Role, role));
        }

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            expires: DateTime.UtcNow.AddHours(24),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
