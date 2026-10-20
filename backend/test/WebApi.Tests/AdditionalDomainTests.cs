using WebApi.Modules.Users.Domain;
using WebApi.Modules.Expenses.Domain;
using Xunit;

namespace WebApi.Tests;

public sealed class AdditionalDomainTests
{
    [Theory]
    [InlineData(0)]
    [InlineData(13)]
    [Trait("Category", "Unit")]
    public void ExpenseReport_rejects_invalid_month(int month) =>
        Assert.Throws<ArgumentException>(() => ExpenseReport.Create(Guid.NewGuid(), 2026, month, "Alice Test"));

    [Fact]
    [Trait("Category", "Unit")]
    public void ExpenseReport_requires_user_id() =>
        Assert.Throws<ArgumentException>(() => ExpenseReport.Create(Guid.Empty, 2026, 10, "Alice Test"));

    [Theory]
    [InlineData(0)]
    [InlineData(10000)]
    [Trait("Category", "Unit")]
    public void ExpenseReport_rejects_invalid_year(int year) =>
        Assert.Throws<ArgumentException>(() => ExpenseReport.Create(Guid.NewGuid(), year, 10, "Alice Test"));

    [Fact]
    [Trait("Category", "Unit")]
    public void User_can_have_zero_monthly_expense_limit()
    {
        var user = User.Create(" Alice ", " Test ", "Paris", 0, false);
        Assert.Equal(0, user.MonthlyExpenseLimit);
        Assert.False(user.IsActive);
        Assert.Equal("Alice", user.FirstName);
    }

    [Fact]
    [Trait("Category", "Unit")]
    public void Deleted_user_cannot_change_profile_or_limit()
    {
        var user = User.Create("Alice", "Test", "Paris", 10, true);
        user.SoftDelete();
        Assert.Throws<InvalidOperationException>(() => user.UpdateProfile("Bob", "Test", "Paris"));
        Assert.Throws<InvalidOperationException>(() => user.ChangeMonthlyExpenseLimit(5));
    }

    [Fact]
    [Trait("Category", "Unit")]
    public void Expense_accepts_decimal_cents_and_trims_fields()
    {
        var expense = Expense.Create(Guid.NewGuid(), 2026, 10,
            new DateOnly(2026, 10, 31), " Train ", 12.34m,
            " SNCF ", " Rue Test ", " 75001 ", " Paris ");
        Assert.Equal("Train", expense.Description);
        Assert.Equal(12.34m, expense.Amount);
        Assert.Equal("SNCF", expense.Store);
        Assert.Equal("Paris", expense.City);
    }

    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    [Trait("Category", "Unit")]
    public void Expense_rejects_missing_store(string store) =>
        Assert.Throws<ArgumentException>(() => Expense.Create(Guid.NewGuid(), 2026, 10,
            new DateOnly(2026, 10, 15), "Train", 1m,
            store, "Rue Test", "75001", "Paris"));

    [Fact]
    [Trait("Category", "Unit")]
    public void Expense_rejects_description_longer_than_50_chars() =>
        Assert.Throws<ArgumentException>(() => Expense.Create(Guid.NewGuid(), 2026, 10,
            new DateOnly(2026, 10, 15), new string('X', 51), 1m,
            "SNCF", "Rue Test", "75001", "Paris"));
}
