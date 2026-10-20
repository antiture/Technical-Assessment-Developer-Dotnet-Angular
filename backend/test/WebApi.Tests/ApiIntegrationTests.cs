using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace WebApi.Tests;

// These tests use the real API + PostgreSQL, not an EF InMemory substitute.
// Set N2JSOFT_API_BASE_URL=http://localhost:<WebApi HTTP port> before running.
public sealed class ApiIntegrationTests
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private static HttpClient CreateClient()
    {
        var url = Environment.GetEnvironmentVariable("N2JSOFT_API_BASE_URL");
        if (string.IsNullOrWhiteSpace(url))
            throw new InvalidOperationException("Set N2JSOFT_API_BASE_URL to the running WebApi HTTP URL (e.g. http://localhost:5195).");
        return new HttpClient(new HttpClientHandler { AllowAutoRedirect = false }) { BaseAddress = new Uri(url.TrimEnd('/') + "/"), Timeout = TimeSpan.FromSeconds(90) };
    }

    private static async Task<Guid> CreateUser(HttpClient client, int limit)
    {
        using var response = await client.PostAsJsonAsync("users", new
        {
            firstName = "AutoTest", lastName = Guid.NewGuid().ToString("N"),
            postalAddress = "Paris", monthlyExpenseLimit = limit, isActive = true
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        using var json = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        return json.RootElement.GetProperty("id").GetGuid();
    }

    private static async Task<Guid> CreateReport(HttpClient client, Guid userId, int month = 10)
    {
        using var response = await client.PostAsJsonAsync("expense-reports", new { userId, year = 2026, month });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        using var json = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        return json.RootElement.GetProperty("id").GetGuid();
    }

    private static object ExpensePayload(int i, string date = "2026-10-15") => new
    {
        date, description = $"Automated expense {i}", amount = 10.50m,
        store = "SNCF", street = "1 Rue Test", postalCode = "75001", city = "Paris"
    };

    [Fact]
    [Trait("Category", "Integration")]
    public async Task Same_user_and_month_cannot_have_two_reports()
    {
        using var client = CreateClient();
        var userId = await CreateUser(client, 10);
        var reportId = await CreateReport(client, userId);
        try
        {
            using var duplicate = await client.PostAsJsonAsync("expense-reports", new { userId, year = 2026, month = 10 });
            Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);
        }
        finally { await client.DeleteAsync($"expense-reports/{reportId}"); await client.DeleteAsync($"users/{userId}"); }
    }

    [Fact]
    [Trait("Category", "Integration")]
    public async Task Expense_soft_delete_removes_it_from_listing()
    {
        using var client = CreateClient();
        var userId = await CreateUser(client, 10);
        var reportId = await CreateReport(client, userId);
        try
        {
            using var inserted = await client.PostAsJsonAsync($"expense-reports/{reportId}/expenses", ExpensePayload(1));
            Assert.Equal(HttpStatusCode.Created, inserted.StatusCode);
            using var createdJson = await JsonDocument.ParseAsync(await inserted.Content.ReadAsStreamAsync());
            var expenseId = createdJson.RootElement.GetProperty("id").GetGuid();
            using var deleted = await client.DeleteAsync($"expense-reports/{reportId}/expenses/{expenseId}");
            Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
            using var listed = await client.GetAsync($"expense-reports/{reportId}/expenses?page=1");
            Assert.Equal(HttpStatusCode.OK, listed.StatusCode);
            using var json = await JsonDocument.ParseAsync(await listed.Content.ReadAsStreamAsync());
            Assert.Equal(0, json.RootElement.GetProperty("totalCount").GetInt32());
        }
        finally { await client.DeleteAsync($"expense-reports/{reportId}"); await client.DeleteAsync($"users/{userId}"); }
    }

    [Fact]
    [Trait("Category", "Integration")]
    public async Task Concurrent_expenses_respect_quota_and_page_size()
    {
        using var client = CreateClient();
        var userId = await CreateUser(client, 10);
        var reportId = await CreateReport(client, userId);
        try
        {
            // Initiate all requests before awaiting any result.
            var requests = Enumerable.Range(1, 12)
                .Select(i => client.PostAsJsonAsync($"expense-reports/{reportId}/expenses", ExpensePayload(i)))
                .ToArray();
            var responses = await Task.WhenAll(requests);
            try
            {
                Assert.Equal(10, responses.Count(r => r.StatusCode == HttpStatusCode.Created));
                Assert.Equal(2, responses.Count(r => r.StatusCode == HttpStatusCode.Conflict));
                using var page1 = await client.GetAsync($"expense-reports/{reportId}/expenses?page=1");
                Assert.Equal(HttpStatusCode.OK, page1.StatusCode);
                using var json = await JsonDocument.ParseAsync(await page1.Content.ReadAsStreamAsync());
                Assert.Equal(10, json.RootElement.GetProperty("totalCount").GetInt32());
                Assert.Equal(5, json.RootElement.GetProperty("items").GetArrayLength());
            }
            finally { foreach (var response in responses) response.Dispose(); }
        }
        finally { await client.DeleteAsync($"expense-reports/{reportId}"); await client.DeleteAsync($"users/{userId}"); }
    }
}
