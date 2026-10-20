using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace WebApi.Tests;

// Requires running WebApi and a configured N2JSOFT_API_BASE_URL (via N2JSoft.runsettings).
public sealed class AdditionalApiIntegrationTests
{
    private static HttpClient CreateClient()
    {
        var baseUrl = Environment.GetEnvironmentVariable("N2JSOFT_API_BASE_URL");
        if (string.IsNullOrWhiteSpace(baseUrl))
            throw new InvalidOperationException("Set N2JSOFT_API_BASE_URL via N2JSoft.runsettings before integration tests.");
        return new HttpClient(new HttpClientHandler { AllowAutoRedirect = false })
        {
            BaseAddress = new Uri(baseUrl.TrimEnd('/') + "/"),
            Timeout = TimeSpan.FromSeconds(90)
        };
    }

    private static async Task<Guid> CreateUser(HttpClient client, int limit = 10, bool isActive = true)
    {
        using var response = await client.PostAsJsonAsync("users", new
        {
            firstName = "ExtraTests", lastName = Guid.NewGuid().ToString("N"),
            postalAddress = "Paris", monthlyExpenseLimit = limit, isActive
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        using var json = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        return json.RootElement.GetProperty("id").GetGuid();
    }

    private static async Task<Guid> CreateReport(HttpClient client, Guid userId)
    {
        using var response = await client.PostAsJsonAsync("expense-reports", new { userId, year = 2026, month = 10 });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        using var json = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        return json.RootElement.GetProperty("id").GetGuid();
    }

    private static object Expense(int index, string date = "2026-10-15", decimal amount = 12.34m) => new
    {
        date, description = $"Extra test {index}", amount,
        store = "SNCF", street = "Rue Test", postalCode = "75001", city = "Paris"
    };

    [Fact]
    [Trait("Category", "Integration")]
    public async Task Unknown_user_and_report_return_not_found()
    {
        using var client = CreateClient();
        using var userResponse = await client.GetAsync($"users/{Guid.NewGuid()}");
        using var reportResponse = await client.GetAsync($"expense-reports/{Guid.NewGuid()}");
        using var expenseResponse = await client.GetAsync($"expense-reports/{Guid.NewGuid()}/expenses?page=1");
        Assert.Equal(HttpStatusCode.NotFound, userResponse.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, reportResponse.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, expenseResponse.StatusCode);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(13)]
    [Trait("Category", "Integration")]
    public async Task Report_creation_rejects_invalid_month(int month)
    {
        using var client = CreateClient();
        var userId = await CreateUser(client);
        try
        {
            using var response = await client.PostAsJsonAsync("expense-reports", new { userId, year = 2026, month });
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }
        finally { using var cleanup = await client.DeleteAsync($"users/{userId}"); }
    }

    [Fact]
    [Trait("Category", "Integration")]
    public async Task Inactive_user_cannot_create_report()
    {
        using var client = CreateClient();
        var userId = await CreateUser(client, isActive: false);
        try
        {
            using var response = await client.PostAsJsonAsync("expense-reports", new { userId, year = 2026, month = 10 });
            Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        }
        finally { using var cleanup = await client.DeleteAsync($"users/{userId}"); }
    }

    [Fact]
    [Trait("Category", "Integration")]
    public async Task Zero_quota_blocks_first_expense()
    {
        using var client = CreateClient();
        var userId = await CreateUser(client, limit: 0);
        var reportId = Guid.Empty;
        try
        {
            reportId = await CreateReport(client, userId);
            using var response = await client.PostAsJsonAsync($"expense-reports/{reportId}/expenses", Expense(1));
            Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        }
        finally
        {
            if (reportId != Guid.Empty) { using var r = await client.DeleteAsync($"expense-reports/{reportId}"); }
            using var u = await client.DeleteAsync($"users/{userId}");
        }
    }

    [Fact]
    [Trait("Category", "Integration")]
    public async Task Invalid_expense_date_and_amount_return_bad_request()
    {
        using var client = CreateClient();
        var userId = await CreateUser(client);
        var reportId = Guid.Empty;
        try
        {
            reportId = await CreateReport(client, userId);
            using var wrongMonth = await client.PostAsJsonAsync($"expense-reports/{reportId}/expenses", Expense(1, date: "2026-11-15"));
            using var negative = await client.PostAsJsonAsync($"expense-reports/{reportId}/expenses", Expense(2, amount: -1m));
            Assert.Equal(HttpStatusCode.BadRequest, wrongMonth.StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, negative.StatusCode);
        }
        finally
        {
            if (reportId != Guid.Empty) { using var r = await client.DeleteAsync($"expense-reports/{reportId}"); }
            using var u = await client.DeleteAsync($"users/{userId}");
        }
    }

    [Fact]
    [Trait("Category", "Integration")]
    public async Task Pagination_has_five_items_and_rejects_invalid_parameters()
    {
        using var client = CreateClient();
        var userId = await CreateUser(client);
        var reportId = Guid.Empty;
        try
        {
            reportId = await CreateReport(client, userId);
            for (var i = 1; i <= 6; i++)
            {
                using var created = await client.PostAsJsonAsync($"expense-reports/{reportId}/expenses", Expense(i));
                Assert.Equal(HttpStatusCode.Created, created.StatusCode);
            }
            using var page1 = await client.GetAsync($"expense-reports/{reportId}/expenses?page=1");
            using var page2 = await client.GetAsync($"expense-reports/{reportId}/expenses?page=2");
            using var invalidPage = await client.GetAsync($"expense-reports/{reportId}/expenses?page=0");
            using var invalidSize = await client.GetAsync($"expense-reports/{reportId}/expenses?pageSize=20");
            Assert.Equal(HttpStatusCode.OK, page1.StatusCode);
            Assert.Equal(HttpStatusCode.OK, page2.StatusCode);
            using var j1 = await JsonDocument.ParseAsync(await page1.Content.ReadAsStreamAsync());
            using var j2 = await JsonDocument.ParseAsync(await page2.Content.ReadAsStreamAsync());
            Assert.Equal(6, j1.RootElement.GetProperty("totalCount").GetInt32());
            Assert.Equal(5, j1.RootElement.GetProperty("items").GetArrayLength());
            Assert.Equal(1, j2.RootElement.GetProperty("items").GetArrayLength());
            Assert.Equal(HttpStatusCode.BadRequest, invalidPage.StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, invalidSize.StatusCode);
        }
        finally
        {
            if (reportId != Guid.Empty) { using var r = await client.DeleteAsync($"expense-reports/{reportId}"); }
            using var u = await client.DeleteAsync($"users/{userId}");
        }
    }

    [Fact]
    [Trait("Category", "Integration")]
    public async Task Deleted_user_is_not_returned_by_get()
    {
        using var client = CreateClient();
        var userId = await CreateUser(client);
        using var deleted = await client.DeleteAsync($"users/{userId}");
        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
        using var get = await client.GetAsync($"users/{userId}");
        Assert.Equal(HttpStatusCode.NotFound, get.StatusCode);
    }
}
