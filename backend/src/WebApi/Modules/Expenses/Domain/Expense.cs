namespace WebApi.Modules.Expenses.Domain;

internal sealed class Expense
{
    public Guid Id { get; private set; }
    public Guid ExpenseReportId { get; private set; }
    public DateOnly Date { get; private set; }
    public string Description { get; private set; } = string.Empty;
    public decimal Amount { get; private set; }
    public string Store { get; private set; } = string.Empty;
    public string Street { get; private set; } = string.Empty;
    public string PostalCode { get; private set; } = string.Empty;
    public string City { get; private set; } = string.Empty;
    public bool IsDeleted { get; private set; }
    private Expense() { }

    public static Expense Create(Guid reportId, int year, int month, DateOnly date, string? description,
        decimal amount, string? store, string? street, string? postalCode, string? city)
    {
        if (reportId == Guid.Empty) throw new ArgumentException("Report is required.");
        var expense = new Expense { Id = Guid.NewGuid(), ExpenseReportId = reportId };
        expense.Update(year, month, date, description, amount, store, street, postalCode, city);
        return expense;
    }

    public void Update(int year, int month, DateOnly date, string? description,
        decimal amount, string? store, string? street, string? postalCode, string? city)
    {
        if (IsDeleted) throw new InvalidOperationException("Deleted expenses cannot be modified.");
        if (date.Year != year || date.Month != month)
            throw new ArgumentException("Expense date must be in the report month.");
        if (string.IsNullOrWhiteSpace(description) || description.Trim().Length > 50)
            throw new ArgumentException("Description is required (max 50 characters).");
        if (amount <= 0 || decimal.Round(amount, 2) != amount || amount > 9999999999999999.99m)
            throw new ArgumentException("Amount must be positive EUR with at most 2 decimal places.");
        if (string.IsNullOrWhiteSpace(store) || store.Trim().Length > 200 ||
            string.IsNullOrWhiteSpace(street) || street.Trim().Length > 200 ||
            string.IsNullOrWhiteSpace(postalCode) || postalCode.Trim().Length > 20 ||
            string.IsNullOrWhiteSpace(city) || city.Trim().Length > 100)
            throw new ArgumentException("Billing address requires store, street, postal code and city.");
        Date = date; Description = description.Trim(); Amount = amount;
        Store = store.Trim(); Street = street.Trim(); PostalCode = postalCode.Trim(); City = city.Trim();
    }

    public void SoftDelete()
    {
        if (IsDeleted) throw new InvalidOperationException("Expense is already deleted.");
        IsDeleted = true;
    }
}
