using WebApi.Modules.Expenses.Domain;
using Xunit;

namespace WebApi.Tests;

public sealed class ExpenseDomainReviewTests
{
    private static Expense Create(decimal amount = 12.50m) => Expense.Create(
        Guid.NewGuid(), 2026, 10, new DateOnly(2026, 10, 15),
        "Original description", amount, "Store", "Street", "75001", "Paris");

    [Fact]
    [Trait("Category", "Unit")]
    public void Expense_accepts_minimum_amount()
    {
        var expense = Create(0.01m);
        Assert.Equal(0.01m, expense.Amount);
    }

    [Fact]
    [Trait("Category", "Unit")]
    public void Expense_rejects_amount_above_numeric_limit()
    {
        Assert.Throws<ArgumentException>(() => Create(10000000000000000m));
        Assert.Equal(9999999999999999.99m, Create(9999999999999999.99m).Amount);
    }

    [Fact]
    [Trait("Category", "Unit")]
    public void Expense_update_does_not_mutate_on_validation_failure()
    {
        var expense = Create();
        var initialDate = expense.Date;
        var initialDescription = expense.Description;
        var initialAmount = expense.Amount;
        var initialStore = expense.Store;
        var initialStreet = expense.Street;
        var initialPostalCode = expense.PostalCode;
        var initialCity = expense.City;

        Assert.Throws<ArgumentException>(() => expense.Update(
            2026, 10, new DateOnly(2026, 10, 20),
            "Changed", -1m, "Other", "New street", "69001", "Lyon"));
        Assert.Equal(initialDate, expense.Date);
        Assert.Equal(initialDescription, expense.Description);
        Assert.Equal(initialAmount, expense.Amount);
        Assert.Equal(initialStore, expense.Store);
        Assert.Equal(initialStreet, expense.Street);
        Assert.Equal(initialPostalCode, expense.PostalCode);
        Assert.Equal(initialCity, expense.City);
    }
}
