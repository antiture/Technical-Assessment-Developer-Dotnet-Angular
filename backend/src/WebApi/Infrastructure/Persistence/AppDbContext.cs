using Microsoft.EntityFrameworkCore;
using WebApi.Modules.Users.Domain;
using WebApi.Modules.Users.Infrastructure;

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
        if (!await context.Set<User>().AnyAsync(cancellationToken))
        {
            context.Set<User>().Add(User.Create("Juste", "Leblanc", "", 10, true));
            context.Set<User>().Add(User.Create("Marc", "Assin", "", 10, true));
            await context.SaveChangesAsync(cancellationToken);
        }
    }
}
