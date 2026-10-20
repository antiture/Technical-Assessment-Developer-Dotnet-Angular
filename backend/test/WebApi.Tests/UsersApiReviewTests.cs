using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace WebApi.Tests;

/// <summary>Regression tests for Users API review. Requires running WebApi and N2JSOFT_API_BASE_URL.</summary>
public sealed class UsersApiReviewTests
{
    private static HttpClient CreateClient()
    {
        var url = Environment.GetEnvironmentVariable("N2JSOFT_API_BASE_URL");
        if (string.IsNullOrWhiteSpace(url))
            throw new InvalidOperationException("Set N2JSOFT_API_BASE_URL via N2JSoft.runsettings.");
        return new HttpClient(new HttpClientHandler { AllowAutoRedirect = false })
        {
            BaseAddress = new Uri(url.TrimEnd('/') + "/"),
            Timeout = TimeSpan.FromSeconds(90)
        };
    }

    private static object UserBody(string firstName, string lastName, int limit, bool active) => new
    {
        firstName, lastName, postalAddress = "Paris", monthlyExpenseLimit = limit, isActive = active
    };

    private static async Task<Guid> CreateUser(HttpClient client, bool active = true)
    {
        using var response = await client.PostAsJsonAsync("users", UserBody("Review", Guid.NewGuid().ToString("N"), 10, active));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        using var document = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        return document.RootElement.GetProperty("id").GetGuid();
    }

    [Fact]
    [Trait("Category", "Integration")]
    public async Task Create_inactive_user_persists_false()
    {
        using var client = CreateClient();
        var id = await CreateUser(client, active: false);
        try
        {
            using var get = await client.GetAsync($"users/{id}");
            Assert.Equal(HttpStatusCode.OK, get.StatusCode);
            using var document = await JsonDocument.ParseAsync(await get.Content.ReadAsStreamAsync());
            Assert.False(document.RootElement.GetProperty("isActive").GetBoolean());
        }
        finally { using var cleanup = await client.DeleteAsync($"users/{id}"); }
    }

    [Fact]
    [Trait("Category", "Integration")]
    public async Task Invalid_user_update_does_not_persist_partial_changes()
    {
        using var client = CreateClient();
        var id = await CreateUser(client);
        try
        {
            using var before = await client.GetAsync($"users/{id}");
            Assert.Equal(HttpStatusCode.OK, before.StatusCode);
            using var beforeJson = await JsonDocument.ParseAsync(await before.Content.ReadAsStreamAsync());
            var oldFirst = beforeJson.RootElement.GetProperty("firstName").GetString();
            var oldLast = beforeJson.RootElement.GetProperty("lastName").GetString();
            var oldAddress = beforeJson.RootElement.GetProperty("postalAddress").GetString();
            var oldLimit = beforeJson.RootElement.GetProperty("monthlyExpenseLimit").GetInt32();
            var oldActive = beforeJson.RootElement.GetProperty("isActive").GetBoolean();

            using var put = await client.PutAsJsonAsync($"users/{id}", UserBody("Changed", "Name", -1, false));
            Assert.Equal(HttpStatusCode.BadRequest, put.StatusCode);

            using var after = await client.GetAsync($"users/{id}");
            Assert.Equal(HttpStatusCode.OK, after.StatusCode);
            using var afterJson = await JsonDocument.ParseAsync(await after.Content.ReadAsStreamAsync());
            var root = afterJson.RootElement;
            Assert.Equal(oldFirst, root.GetProperty("firstName").GetString());
            Assert.Equal(oldLast, root.GetProperty("lastName").GetString());
            Assert.Equal(oldAddress, root.GetProperty("postalAddress").GetString());
            Assert.Equal(oldLimit, root.GetProperty("monthlyExpenseLimit").GetInt32());
            Assert.Equal(oldActive, root.GetProperty("isActive").GetBoolean());
        }
        finally { using var cleanup = await client.DeleteAsync($"users/{id}"); }
    }

    [Fact]
    [Trait("Category", "Integration")]
    public async Task Soft_deleted_user_cannot_be_read_or_updated()
    {
        using var client = CreateClient();
        var id = await CreateUser(client);
        using var deleted = await client.DeleteAsync($"users/{id}");
        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
        using var get = await client.GetAsync($"users/{id}");
        Assert.Equal(HttpStatusCode.NotFound, get.StatusCode);
        using var put = await client.PutAsJsonAsync($"users/{id}", UserBody("Restored", "Attempt", 10, true));
        Assert.Equal(HttpStatusCode.NotFound, put.StatusCode);
    }
}
