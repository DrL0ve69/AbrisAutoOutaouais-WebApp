using AbrisAutoOutaouais_WebApp.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddOpenApi();

// Add Infrastructure services (Database, Identity, Auth, etc.)
builder.Services.AddInfrastructureServices(builder.Configuration);

// Add CORS for frontend (Angular)
var allowedOrigins = builder.Configuration.GetSection("AllowedOrigins").Get<string[]>() ?? ["http://localhost:4200"];
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", corsBuilder =>
    {
        corsBuilder
            .WithOrigins(allowedOrigins)
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials();
    });
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

app.UseCors("AllowFrontend");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Initialize Identity (create default roles and admin user)
await app.Services.InitializeIdentityAsync();

app.Run();

