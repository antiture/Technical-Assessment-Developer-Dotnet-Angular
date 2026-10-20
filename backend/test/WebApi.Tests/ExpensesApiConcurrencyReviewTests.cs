
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace WebApi.Tests;

// These tests use the real WebApi and PostgreSQL. Start Aspire first.
public sealed class ExpensesApiConcurrencyReviewTests
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
        using var doc = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        return doc.RootElement.Clone();
    }

    private static async Task<Guid> CreateUser(HttpClient client, int limit)
    {
        using var response = await client.PostAsJsonAsync("users", new
        {
            firstName = "ConcurrencyReview", lastName = Guid.NewGuid().ToString("N"),
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

    private static object Expense(string description, string date = "2026-10-15") => new
    {
        date, description, amount = 12.34m,
        store = "Review Store", street = "Rue de Paris", postalCode = "75001", city = "Paris"
    };

    private static async Task<Guid> CreateExpense(HttpClient client, Guid reportId, string name, string date = "2026-10-15")
    {
        using var response = await client.PostAsJsonAsync($"expense-reports/{reportId}/expenses", Expense(name, date));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await ReadJson(response)).GetProperty("id").GetGuid();
    }

    private static async Task Cleanup(HttpClient client, Guid userId, Guid reportId)
    {
        if (reportId != Guid.Empty)
        {
            using var deletedReport = await client.DeleteAsync($"expense-reports/{reportId}");
        }
        if (userId != Guid.Empty)
        {
            using var deletedUser = await client.DeleteAsync($"users/{userId}");
        }
    }

    [Fact]
    [Trait("Category", "Integration")]
    public async Task Concurrent_creates_allow_only_one_remaining_slot()
    {
        using var client = CreateClient();
        var userId = await CreateUser(client, 2);
        var reportId = Guid.Empty;
        try
        {
            reportId = await CreateReport(client, userId);
            await CreateExpense(client, reportId, "First");
            var path = $"expense-reports/{reportId}/expenses";
            // Start two requests together, not one after another.
            using var gate = new ManualResetEventSlim(false);
            async Task<HttpStatusCode> Attempt(string name)
            {
                await Task.Yield();
                gate.Wait(TimeSpan.FromSeconds(5));
                using var response = await client.PostAsJsonAsync(path, Expense(name));
                return response.StatusCode;
            }
            var a = Task.Run(() => Attempt("Race A"));
            var b = Task.Run(() => Attempt("Race B"));
            gate.Set();
            var statuses = await Task.WhenAll(a, b);
            Assert.Equal(1, statuses.Count(s => s == HttpStatusCode.Created));
            Assert.Equal(1, statuses.Count(s => s == HttpStatusCode.Conflict));
            using var page = await client.GetAsync(path + "?page=1");
            Assert.Equal(HttpStatusCode.OK, page.StatusCode);
            Assert.Equal(2, (await ReadJson(page)).GetProperty("totalCount").GetInt32());
        }
        finally { await Cleanup(client, userId, reportId); }
    }

    [Fact]
    [Trait("Category", "Integration")]
    public async Task Concurrent_report_deletion_and_expense_creation_remain_consistent()
    {
        using var client = CreateClient();
        var userId = await CreateUser(client, 10);
        var reportId = Guid.Empty;
        try
        {
            reportId = await CreateReport(client, userId);
            var path = $"expense-reports/{reportId}";
            using var gate = new ManualResetEventSlim(false);
            async Task<HttpStatusCode> Post()
            {
                await Task.Yield();
                gate.Wait(TimeSpan.FromSeconds(5));
                using var response = await client.PostAsJsonAsync(path + "/expenses", Expense("Concurrent delete"));
                return response.StatusCode;
            }
            async Task<HttpStatusCode> Delete()
            {
                await Task.Yield();
                gate.Wait(TimeSpan.FromSeconds(5));
                using var response = await client.DeleteAsync(path);
                return response.StatusCode;
            }
            var createTask = Task.Run(Post);
            var deleteTask = Task.Run(Delete);
            gate.Set();
            var createStatus = await createTask;
            var deleteStatus = await deleteTask;
            Assert.Equal(HttpStatusCode.NoContent, deleteStatus);
            Assert.True(createStatus is HttpStatusCode.Created or HttpStatusCode.NotFound or HttpStatusCode.Conflict,
                $"Unexpected concurrent create status: {(int)createStatus} ({createStatus}).");
            using var report = await client.GetAsync(path);
            Assert.Equal(HttpStatusCode.NotFound, report.StatusCode);
            using var expenses = await client.GetAsync(path + "/expenses?page=1");
            Assert.Equal(HttpStatusCode.NotFound, expenses.StatusCode);
        }
        finally { await Cleanup(client, userId, reportId); }
    }

    [Fact]
    [Trait("Category", "Integration")]
    public async Task Expenses_with_same_date_have_stable_pagination()
    {
        using var client = CreateClient();
        var userId = await CreateUser(client, 10);
        var reportId = Guid.Empty;
        try
        {
            reportId = await CreateReport(client, userId);
            for (var i = 0; i < 7; i++)
                await CreateExpense(client, reportId, $"Same Date {i}");
            var path = $"expense-reports/{reportId}/expenses";
            async Task<Guid[]> PageIds(int page)
            {
                using var response = await client.GetAsync(path + $"?page={page}");
                Assert.Equal(HttpStatusCode.OK, response.StatusCode);
                var json = await ReadJson(response);
                Assert.Equal(7, json.GetProperty("totalCount").GetInt32());
                Assert.Equal(5, json.GetProperty("pageSize").GetInt32());
                return json.GetProperty("items").EnumerateArray()
                    .Select(x => x.GetProperty("id").GetGuid()).ToArray();
            }
            var first = await PageIds(1);
            var second = await PageIds(2);
            Assert.Equal(5, first.Length);
            Assert.Equal(2, second.Length);
            Assert.Equal(7, first.Concat(second).Distinct().Count());
            Assert.Equal(first, await PageIds(1));
            Assert.Equal(second, await PageIds(2));
        }
        finally { await Cleanup(client, userId, reportId); }
    }

    [Fact]
    [Trait("Category", "Integration")]
    public async Task Updating_expense_does_not_consume_additional_quota()
    {
        using var client = CreateClient();
        var userId = await CreateUser(client, 1);
        var reportId = Guid.Empty;
        try
        {
            reportId = await CreateReport(client, userId);
            var expenseId = await CreateExpense(client, reportId, "Original");
            var path = $"expense-reports/{reportId}/expenses";
            using (var updated = await client.PutAsJsonAsync($"{path}/{expenseId}", Expense("Updated", "2026-10-16")))
            {
                Assert.Equal(HttpStatusCode.OK, updated.StatusCode);
                Assert.Equal("Updated", (await ReadJson(updated)).GetProperty("description").GetString());
            }
            using (var blocked = await client.PostAsJsonAsync(path, Expense("Second")))
                Assert.Equal(HttpStatusCode.Conflict, blocked.StatusCode);
            using var list = await client.GetAsync(path + "?page=1");
            Assert.Equal(HttpStatusCode.OK, list.StatusCode);
            var json = await ReadJson(list);
            Assert.Equal(1, json.GetProperty("totalCount").GetInt32());
            Assert.Equal(expenseId, json.GetProperty("items")[0].GetProperty("id").GetGuid());
            Assert.Equal("Updated", json.GetProperty("items")[0].GetProperty("description").GetString());
        }
        finally { await Cleanup(client, userId, reportId); }
    }
}
