using Microsoft.EntityFrameworkCore;
using WebApi.Infrastructure.Persistence;
using WebApi.Modules.Users.Contracts;
using WebApi.Modules.Users.Domain;

namespace WebApi.Modules.Users.Infrastructure;

internal sealed class UserPolicyReader(AppDbContext db) : IUserPolicyReader
{
    public Task<UserPolicy?> GetAsync(Guid id, CancellationToken ct) =>
        db.Set<User>().AsNoTracking().Where(u => u.Id == id)
            .Select(u => new UserPolicy(u.Id, u.FirstName + " " + u.LastName,
                u.IsActive && !u.IsDeleted, u.MonthlyExpenseLimit))
            .SingleOrDefaultAsync(ct);
}
