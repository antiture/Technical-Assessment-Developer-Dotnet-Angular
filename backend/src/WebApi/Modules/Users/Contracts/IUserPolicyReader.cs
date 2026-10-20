namespace WebApi.Modules.Users.Contracts;

internal sealed record UserPolicy(Guid UserId, string FullName, bool IsEligible, int MonthlyExpenseLimit);

internal interface IUserPolicyReader
{
    Task<UserPolicy?> GetAsync(Guid userId, CancellationToken ct);
}
