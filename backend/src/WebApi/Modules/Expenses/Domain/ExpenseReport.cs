namespace WebApi.Modules.Expenses.Domain;

internal sealed class ExpenseReport
{
    public Guid Id { get; private set; }
    public Guid UserId { get; private set; }
    public int Year { get; private set; }
    public int Month { get; private set; }
    public string UserDisplayName { get; private set; } = string.Empty;
    public ICollection<Expense> Expenses { get; private set; } = new List<Expense>();

    private ExpenseReport() { }
    public static ExpenseReport Create(Guid userId, int year, int month, string userDisplayName)
    {
        if (userId == Guid.Empty) throw new ArgumentException("UserId is required.");
        if (year < 1 || year > 9999 || month < 1 || month > 12)
            throw new ArgumentException("A valid year and month are required.");
        if (string.IsNullOrWhiteSpace(userDisplayName))
            throw new ArgumentException("User display name is required.");
        return new ExpenseReport { Id = Guid.NewGuid(), UserId = userId,
            Year = year, Month = month, UserDisplayName = userDisplayName.Trim() };
    }
}
