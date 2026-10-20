namespace WebApi.Modules.Users.Domain;

internal sealed class User
{
    public Guid Id { get; private set; }
    public string FirstName { get; private set; } = string.Empty;
    public string LastName { get; private set; } = string.Empty;
    public string PostalAddress { get; private set; } = string.Empty;
    public int MonthlyExpenseLimit { get; private set; } = 10;
    public bool IsActive { get; private set; } = true;
    public bool IsDeleted { get; private set; }

    private User() { } // EF Core

    public static User Create(string firstName, string lastName, string postalAddress,
        int monthlyExpenseLimit, bool isActive)
    {
        Validate(firstName, lastName, postalAddress, monthlyExpenseLimit);
        return new User
        {
            Id = Guid.NewGuid(),
            FirstName = firstName.Trim(), LastName = lastName.Trim(),
            PostalAddress = postalAddress.Trim(), MonthlyExpenseLimit = monthlyExpenseLimit,
            IsActive = isActive
        };
    }

    public void UpdateProfile(string firstName, string lastName, string postalAddress)
    {
        EnsureNotDeleted();
        Validate(firstName, lastName, postalAddress, MonthlyExpenseLimit);
        FirstName = firstName.Trim(); LastName = lastName.Trim();
        PostalAddress = postalAddress.Trim();
    }

    public void ChangeMonthlyExpenseLimit(int limit)
    {
        EnsureNotDeleted();
        if (limit < 0) throw new ArgumentException("MonthlyExpenseLimit must be non-negative.");
        MonthlyExpenseLimit = limit;
    }

    public void Activate() { EnsureNotDeleted(); IsActive = true; }
    public void Deactivate() { EnsureNotDeleted(); IsActive = false; }
    public void SoftDelete() { EnsureNotDeleted(); IsDeleted = true; IsActive = false; }

    private void EnsureNotDeleted()
    {
        if (IsDeleted) throw new InvalidOperationException("Deleted users cannot be modified.");
    }

    private static void Validate(string firstName, string lastName, string postalAddress, int limit)
    {
        if (string.IsNullOrWhiteSpace(firstName) || firstName.Trim().Length > 100)
            throw new ArgumentException("FirstName is required (max 100 characters).");
        if (string.IsNullOrWhiteSpace(lastName) || lastName.Trim().Length > 100)
            throw new ArgumentException("LastName is required (max 100 characters).");
        if (postalAddress is null || postalAddress.Length > 500)
            throw new ArgumentException("PostalAddress is required (may be empty, max 500 characters).");
        if (limit < 0)
            throw new ArgumentException("MonthlyExpenseLimit must be non-negative.");
    }
}
