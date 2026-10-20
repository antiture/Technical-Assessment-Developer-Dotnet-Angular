using Microsoft.EntityFrameworkCore;
using WebApi.Infrastructure.Persistence;
using WebApi.Modules.Users.Domain;

namespace WebApi.Modules.Users.Api;

internal static class UserEndpoints
{
    // Existing GET /users contract must remain unchanged.
    public sealed record UserInfo(Guid Id, string Name);
    public sealed record UserDetails(Guid Id, string FirstName, string LastName,
        string PostalAddress, int MonthlyExpenseLimit, bool IsActive);
    public sealed record SaveUserRequest(string? FirstName, string? LastName,
        string? PostalAddress, int MonthlyExpenseLimit, bool IsActive);

    public static IEndpointRouteBuilder MapUserEndpoints(this IEndpointRouteBuilder app)
    {
        var users = app.MapGroup("/users");

        users.MapGet("", async (AppDbContext db, CancellationToken ct) =>
            Results.Ok(await db.Set<User>().AsNoTracking()
                .Where(u => !u.IsDeleted)
                .Select(u => new UserInfo(u.Id, u.FirstName + " " + u.LastName))
                .ToListAsync(ct)));

        users.MapGet("/{id:guid}", async (Guid id, AppDbContext db, CancellationToken ct) =>
        {
            var user = await db.Set<User>().AsNoTracking().FirstOrDefaultAsync(
                u => u.Id == id && !u.IsDeleted, ct);
            return user is null ? Results.NotFound() : Results.Ok(ToDetails(user));
        });

        users.MapPost("", async (SaveUserRequest? request, AppDbContext db, CancellationToken ct) =>
        {
            if (request is null) return Results.BadRequest(new { error = "Request body is required." });
            try
            {
                var user = User.Create(request.FirstName!, request.LastName!,
                    request.PostalAddress!, request.MonthlyExpenseLimit, request.IsActive);
                db.Set<User>().Add(user);
                await db.SaveChangesAsync(ct);
                return Results.Created($"/users/{user.Id}", ToDetails(user));
            }
            catch (ArgumentException ex) { return Results.BadRequest(new { error = ex.Message }); }
        });

        users.MapPut("/{id:guid}", async (Guid id, SaveUserRequest? request,
            AppDbContext db, CancellationToken ct) =>
        {
            if (request is null) return Results.BadRequest(new { error = "Request body is required." });
            var user = await db.Set<User>().FirstOrDefaultAsync(u => u.Id == id && !u.IsDeleted, ct);
            if (user is null) return Results.NotFound();
            try
            {
                user.UpdateProfile(request.FirstName!, request.LastName!, request.PostalAddress!);
                user.ChangeMonthlyExpenseLimit(request.MonthlyExpenseLimit);
                if (request.IsActive) user.Activate(); else user.Deactivate();
                await db.SaveChangesAsync(ct);
                return Results.Ok(ToDetails(user));
            }
            catch (ArgumentException ex) { return Results.BadRequest(new { error = ex.Message }); }
        });

        users.MapDelete("/{id:guid}", async (Guid id, AppDbContext db, CancellationToken ct) =>
        {
            var user = await db.Set<User>().FirstOrDefaultAsync(u => u.Id == id && !u.IsDeleted, ct);
            if (user is null) return Results.NotFound();
            user.SoftDelete();
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });

        return app;
    }

    private static UserDetails ToDetails(User u) =>
        new(u.Id, u.FirstName, u.LastName, u.PostalAddress, u.MonthlyExpenseLimit, u.IsActive);
}
