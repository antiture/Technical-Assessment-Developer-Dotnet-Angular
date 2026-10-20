using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace WebApi.Tests;

// Runs against an explicitly started development WebApi and PostgreSQL.
public sealed class ExpenseApiReviewTests
{
    private static HttpClient CreateClient()
    {
        var url = Environment.GetEnvironmentVariable("N2JSOFT_API_BASE_URL");
        if (string.IsNullOrWhiteSpace(url))
            throw new InvalidOperationException("Configure N2JSOFT_API_BASE_URL via N2JSoft.runsettings.");
        return new HttpClient(new HttpClientHandler { AllowAutoRedirect = false })
        {
            BaseAddress = new Uri(url.TrimEnd('/') + "/"),
            Timeout = TimeSpan.FromSeconds(90)
        };
    }

    private static async Task<JsonElement> ReadJson(HttpResponseMessage response)
    {
        using var document = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        return document.RootElement.Clone();
    }

    private static async Task<Guid> CreateUser(HttpClient client, int limit = 10)
    {
        using var response = await client.PostAsJsonAsync("users", new
        {
            firstName = "ExpensesReview", lastName = Guid.NewGuid().ToString("N"),
            postalAddress = "Paris", monthlyExpenseLimit = limit, isActive = true
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await ReadJson(response)).GetProperty("id").GetGuid();
    }

    private static async Task<Guid> CreateReport(HttpClient client, Guid userId)
    {
        using var response = await client.PostAsJsonAsync("expense-reports", new { userId, year = 2026, month = 10 });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await ReadJson(response)).GetProperty("id").GetGuid();
    }

    private static object Payload(string description = "Review expense", decimal amount = 12.34m, string date = "2026-10-15") => new
    {
        date, description, amount, store = "Shop", street = "Rue de Paris", postalCode = "75001", city = "Paris"
    };

    private static async Task<Guid> CreateExpense(HttpClient client, Guid reportId, string description = "Review expense")
    {
        using var response = await client.PostAsJsonAsync($"expense-reports/{reportId}/expenses", Payload(description));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await ReadJson(response)).GetProperty("id").GetGuid();
    }

    [Fact]
    [Trait("Category", "Integration")]
    public async Task Soft_deleted_expense_releases_quota()
    {
        using var client = CreateClient();
        var userId = await CreateUser(client, limit: 2);
        var reportId = Guid.Empty;
        try
        {
            reportId = await CreateReport(client, userId);
            var firstId = await CreateExpense(client, reportId, "First");
            await CreateExpense(client, reportId, "Second");
            using (var blocked = await client.PostAsJsonAsync($"expense-reports/{reportId}/expenses", Payload("Third")))
                Assert.Equal(HttpStatusCode.Conflict, blocked.StatusCode);
            using (var removed = await client.DeleteAsync($"expense-reports/{reportId}/expenses/{firstId}"))
                Assert.Equal(HttpStatusCode.NoContent, removed.StatusCode);
            await CreateExpense(client, reportId, "Replacement");
            using var page = await client.GetAsync($"expense-reports/{reportId}/expenses?page=1");
            Assert.Equal(HttpStatusCode.OK, page.StatusCode);
            Assert.Equal(2, (await ReadJson(page)).GetProperty("totalCount").GetInt32());
        }
        finally
        {
            if (reportId != Guid.Empty) { using var report = await client.DeleteAsync($"expense-reports/{reportId}"); }
            using var user = await client.DeleteAsync($"users/{userId}");
        }
    }

    [Fact]
    [Trait("Category", "Integration")]
    public async Task Deleting_report_removes_associated_expenses()
    {
        using var client = CreateClient();
        var userId = await CreateUser(client);
        var reportId = Guid.Empty;
        try
        {
            reportId = await CreateReport(client, userId);
            await CreateExpense(client, reportId);
            using (var deleted = await client.DeleteAsync($"expense-reports/{reportId}"))
                Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
            using (var getReport = await client.GetAsync($"expense-reports/{reportId}"))
                Assert.Equal(HttpStatusCode.NotFound, getReport.StatusCode);
            using (var listExpenses = await client.GetAsync($"expense-reports/{reportId}/expenses?page=1"))
                Assert.Equal(HttpStatusCode.NotFound, listExpenses.StatusCode);
            // The public API verifies removal of the report and loss of access to its expenses;
            // physical DB cascade can be confirmed separately using a database-level integration test.
        }
        finally
        {
            if (reportId != Guid.Empty) { using var report = await client.DeleteAsync($"expense-reports/{reportId}"); }
            using var user = await client.DeleteAsync($"users/{userId}");
        }
    }

    [Fact]
    [Trait("Category", "Integration")]
    public async Task Renaming_user_keeps_report_title_snapshot()
    {
        using var client = CreateClient();
        var userId = await CreateUser(client);
        var reportId = Guid.Empty;
        try
        {
            reportId = await CreateReport(client, userId);
            using var before = await client.GetAsync($"expense-reports/{reportId}");
            Assert.Equal(HttpStatusCode.OK, before.StatusCode);
            var originalTitle = (await ReadJson(before)).GetProperty("title").GetString();
            using (var changed = await client.PutAsJsonAsync($"users/{userId}", new
            {
                firstName = "Renamed", lastName = "User", postalAddress = "Paris", monthlyExpenseLimit = 10, isActive = true
            }))
                Assert.Equal(HttpStatusCode.OK, changed.StatusCode);
            using var after = await client.GetAsync($"expense-reports/{reportId}");
            Assert.Equal(HttpStatusCode.OK, after.StatusCode);
            Assert.Equal(originalTitle, (await ReadJson(after)).GetProperty("title").GetString());
            Assert.DoesNotContain("Renamed", originalTitle ?? "");
        }
        finally
        {
            if (reportId != Guid.Empty) { using var report = await client.DeleteAsync($"expense-reports/{reportId}"); }
            using var user = await client.DeleteAsync($"users/{userId}");
        }
    }
}
