using WebApi.Modules.Expenses.Domain;
using WebApi.Modules.Users.Domain;
using Xunit;

namespace WebApi.Tests;

public sealed class DomainTests
{
    [Fact]
    [Trait("Category", "Unit")]
    public void User_creates_and_changes_status()
    {
        var user = User.Create(" Marc ", " Assin ", "Paris", 10, true);
        Assert.Equal("Marc", user.FirstName);
        Assert.Equal(10, user.MonthlyExpenseLimit);
        user.Deactivate();
        Assert.False(user.IsActive);
        user.ChangeMonthlyExpenseLimit(3);
        Assert.Equal(3, user.MonthlyExpenseLimit);
        user.SoftDelete();
        Assert.True(user.IsDeleted);
        Assert.Throws<InvalidOperationException>(() => user.Activate());
    }

    [Theory]
    [InlineData("", "Last", 10)]
    [InlineData("First", "", 10)]
    [InlineData("First", "Last", -1)]
    [Trait("Category", "Unit")]
    public void Invalid_user_is_rejected(string first, string last, int limit) =>
        Assert.Throws<ArgumentException>(() => User.Create(first, last, "Paris", limit, true));

    [Fact]
    [Trait("Category", "Unit")]
    public void Report_requires_valid_month() =>
        Assert.Throws<ArgumentException>(() => ExpenseReport.Create(Guid.NewGuid(), 2026, 13, "Marc Assin"));

    [Theory]
    [InlineData(2026, 11, 10, "Valid", 1.00)]
    [InlineData(2026, 10, 10, "", 1.00)]
    [InlineData(2026, 10, 10, "Valid", 0.00)]
    [InlineData(2026, 10, 10, "Valid", -1.00)]
    [InlineData(2026, 10, 10, "Valid", 1.001)]
    [Trait("Category", "Unit")]
    public void Invalid_expense_is_rejected(int year, int month, int day, string description, double amount)
    {
        Assert.Throws<ArgumentException>(() => Expense.Create(Guid.NewGuid(), 2026, 10,
            new DateOnly(year, month, day), description, (decimal)amount,
            "SNCF", "1 Rue Test", "75001", "Paris"));
    }

    [Fact]
    [Trait("Category", "Unit")]
    public void Deleted_expense_cannot_be_updated()
    {
        var expense = Expense.Create(Guid.NewGuid(), 2026, 10,
            new DateOnly(2026, 10, 15), "Train", 45.5m,
            "SNCF", "1 Rue Test", "75001", "Paris");
        expense.SoftDelete();
        Assert.True(expense.IsDeleted);
        Assert.Throws<InvalidOperationException>(() => expense.Update(2026, 10,
            new DateOnly(2026, 10, 16), "Train", 50m,
            "SNCF", "1 Rue Test", "75001", "Paris"));
    }
}
