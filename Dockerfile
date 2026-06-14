# syntax=docker/dockerfile:1
# Image de l'API AbrisTempo (.NET 10) pour Azure Container Apps.
# Contexte de build = RACINE du dépôt (accès aux 4 projets référencés).
# Build : `az acr build -r <acr> -t abristempo-api:<tag> -f Dockerfile .`

# ── Étape build (SDK) ─────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# On copie d'abord les .csproj pour profiter du cache de couches sur le restore.
COPY src/AbrisAutoOutaouais-WebApp.Domain/*.csproj         src/AbrisAutoOutaouais-WebApp.Domain/
COPY src/AbrisAutoOutaouais-WebApp.Application/*.csproj     src/AbrisAutoOutaouais-WebApp.Application/
COPY src/AbrisAutoOutaouais-WebApp.Infrastructure/*.csproj  src/AbrisAutoOutaouais-WebApp.Infrastructure/
COPY src/AbrisAutoOutaouais-WebApp.API/*.csproj             src/AbrisAutoOutaouais-WebApp.API/
RUN dotnet restore src/AbrisAutoOutaouais-WebApp.API/AbrisAutoOutaouais-WebApp.API.csproj

# Puis le reste des sources et la publication.
COPY src/ src/
RUN dotnet publish src/AbrisAutoOutaouais-WebApp.API/AbrisAutoOutaouais-WebApp.API.csproj \
    -c Release -o /app --no-restore

# ── Étape runtime (ASP.NET, image minimale sans SDK) ──────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

# Le conteneur écoute en HTTP sur 8080 (l'ingress Container Apps termine le TLS et
# cible ce port). Aucun certificat dans l'image.
EXPOSE 8080
ENV ASPNETCORE_HTTP_PORTS=8080

COPY --from=build /app ./
ENTRYPOINT ["dotnet", "AbrisAutoOutaouais-WebApp.API.dll"]
