using System.Text.RegularExpressions;
using Xunit;

namespace WebApi.Tests;

/// <summary>
/// Source-level guards because Users and Expenses currently share one WebApi assembly.
/// They detect explicit namespace dependencies, not all possible semantic coupling.
/// </summary>
public sealed class ArchitectureBoundaryTests
{
    private static readonly string WebApiSourceRoot = FindWebApiSourceRoot();

    [Fact]
    public void Expenses_Domain_does_not_depend_on_Users()
    {
        AssertNoReferences(
            Path.Combine(WebApiSourceRoot, "Modules", "Expenses", "Domain"),
            @"\bWebApi\.Modules\.Users\b",
            "Expenses.Domain must be independent of Users.");
    }

    [Fact]
    public void Expenses_does_not_access_Users_Domain_or_Infrastructure()
    {
        AssertNoReferences(
            Path.Combine(WebApiSourceRoot, "Modules", "Expenses"),
            @"\bWebApi\.Modules\.Users\.(?:Domain|Infrastructure|Api)\b",
            "Expenses may depend on Users.Contracts, not Users internals.");
    }

    [Fact]
    public void Users_does_not_depend_on_Expenses()
    {
        AssertNoReferences(
            Path.Combine(WebApiSourceRoot, "Modules", "Users"),
            @"\bWebApi\.Modules\.Expenses\b",
            "Users must not depend on Expenses.");
    }

    private static void AssertNoReferences(string directory, string pattern, string message)
    {
        Assert.True(Directory.Exists(directory), $"Missing source directory: {directory}");
        var failures = Directory.EnumerateFiles(directory, "*.cs", SearchOption.AllDirectories)
            .Where(file => Regex.IsMatch(File.ReadAllText(file), pattern))
            .Select(file => Path.GetRelativePath(WebApiSourceRoot, file))
            .ToArray();
        Assert.True(failures.Length == 0, $"{message} Violations: {string.Join(", ", failures)}");
    }

    private static string FindWebApiSourceRoot()
    {
        for (DirectoryInfo? dir = new(AppContext.BaseDirectory); dir is not null; dir = dir.Parent)
        {
            var candidate = Path.Combine(dir.FullName, "src", "WebApi");
            if (File.Exists(Path.Combine(candidate, "WebApi.csproj"))) return candidate;
        }
        throw new DirectoryNotFoundException(
            "Cannot locate backend/src/WebApi; run these source-structure tests from the repository.");
    }
}
