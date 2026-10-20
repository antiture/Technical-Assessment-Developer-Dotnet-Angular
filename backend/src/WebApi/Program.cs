using WebApi.Modules.Users.Contracts;
using WebApi.Modules.Users.Infrastructure;
using WebApi.Modules.Expenses.Api;
using Microsoft.EntityFrameworkCore;
using System.Diagnostics.CodeAnalysis;
using WebApi.Infrastructure.Api;
using WebApi.Infrastructure.Persistence;
using WebApi.Modules.Users.Api;

var builder = WebApplication.CreateBuilder(args);

builder.AddRedisClient(connectionName: "cache");
builder.AddNpgsqlDbContext<AppDbContext>(connectionName: "database",
    configureDbContextOptions: options =>
        options.UseAsyncSeeding(async (context, _, cancellationToken) =>
            await AppDbContext.SeedAsync(context, cancellationToken)));
builder.Services
    .AddOpenApi()
    .AddPersistence();
builder.Services.AddHealthChecks();
builder.Services.AddScoped<IUserPolicyReader, UserPolicyReader>();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    try
    {
        using var sp = app.Services.CreateScope();
        await sp.ServiceProvider.GetRequiredService<AppDbContext>()
            .Database.MigrateAsync();
    }
    catch (Exception e)
    {
        app.Services.GetRequiredService<ILogger<Program>>()
            .LogError(e, "An error occurred while migrating the database.");
        return;
    }
    app.MapOpenApi();
}

app.UseHttpsRedirection();

app.MapUserEndpoints();
app.MapExpenseEndpoints();
app.MapHealthChecks("/health");

app.Run();

[SuppressMessage("ReSharper", "ClassNeverInstantiated.Global")]
public partial class Program;
