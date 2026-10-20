using Microsoft.EntityFrameworkCore;
using WebApi.Domain.Entities;

namespace WebApi.Infrastructure.Persistence;

internal sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfiguration(new UserEntityTypeConfiguration());
    }

    internal static async Task SeedAsync(DbContext context, CancellationToken cancellationToken)
    {
        if (!context.Set<User>().Any())
        {
            context.Set<User>().Add(new User { FirstName = "Juste", LastName = "Leblanc" });
            context.Set<User>().Add(new User { FirstName = "Marc", LastName = "Assin" });
            await context.SaveChangesAsync(cancellationToken);
        }
    }
}