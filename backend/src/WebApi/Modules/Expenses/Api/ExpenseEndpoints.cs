
using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using WebApi.Infrastructure.Persistence;
using WebApi.Modules.Expenses.Domain;
using WebApi.Modules.Users.Contracts;

namespace WebApi.Modules.Expenses.Api;

internal static class ExpenseEndpoints
{
    private static readonly CultureInfo French = CultureInfo.GetCultureInfo("fr-FR");
    public sealed record CreateReportRequest(Guid UserId, int Year, int Month);
    public sealed record ReportDto(Guid Id, Guid UserId, int Year, int Month, string Title);
    public sealed record SaveExpenseRequest(DateOnly Date, string? Description, decimal Amount,
        string? Store, string? Street, string? PostalCode, string? City);
    public sealed record ExpenseDto(Guid Id, Guid ExpenseReportId, DateOnly Date, string Description,
        decimal Amount, string Store, string Street, string PostalCode, string City);
    public sealed record ExpensePage(int Page, int PageSize, int TotalCount, IReadOnlyList<ExpenseDto> Items);

    public static IEndpointRouteBuilder MapExpenseEndpoints(this IEndpointRouteBuilder app)
    {
        var reports = app.MapGroup("/expense-reports");
        reports.MapGet("", async (AppDbContext db, CancellationToken ct) =>
        {
            var rows = await db.Set<ExpenseReport>().AsNoTracking()
                .OrderByDescending(r => r.Year).ThenByDescending(r => r.Month)
                .ThenBy(r => r.Id).ToListAsync(ct);
            return Results.Ok(rows.Select(ToReport));
        });
        reports.MapGet("/{id:guid}", async (Guid id, AppDbContext db, CancellationToken ct) =>
        {
            var r = await db.Set<ExpenseReport>().AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, ct);
            return r is null ? Results.NotFound() : Results.Ok(ToReport(r));
        });
        reports.MapPost("", async (CreateReportRequest request, AppDbContext db,
            IUserPolicyReader policyReader, CancellationToken ct) =>
        {
            if (request.Year < 1 || request.Year > 9999 || request.Month is < 1 or > 12)
                return Results.BadRequest(new { error = "Invalid year or month." });
            var policy = await policyReader.GetAsync(request.UserId, ct);
            if (policy is null) return Results.NotFound(new { error = "User not found." });
            if (!policy.IsEligible) return Results.Conflict(new { error = "User is inactive or deleted." });
            var report = ExpenseReport.Create(request.UserId, request.Year, request.Month, policy.FullName);
            db.Set<ExpenseReport>().Add(report);
            try { await db.SaveChangesAsync(ct); }
            catch (DbUpdateException ex) when (IsUniqueViolation(ex))
            { return Results.Conflict(new { error = "A report already exists for this user and month." }); }
            return Results.Created($"/expense-reports/{report.Id}", ToReport(report));
        });
        reports.MapDelete("/{id:guid}", async (Guid id, AppDbContext db, CancellationToken ct) =>
        {
            var report = await db.Set<ExpenseReport>().FindAsync(new object[] { id }, ct);
            if (report is null) return Results.NotFound();
            db.Set<ExpenseReport>().Remove(report);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });
        reports.MapGet("/{reportId:guid}/expenses", async (Guid reportId, int? page,
            int? pageSize, AppDbContext db, CancellationToken ct) =>
        {
            if ((page ?? 1) < 1 || (pageSize.HasValue && pageSize != 5))
                return Results.BadRequest(new { error = "Page must be positive and pageSize must be 5." });
            if (!await db.Set<ExpenseReport>().AnyAsync(r => r.Id == reportId, ct))
                return Results.NotFound();
            var query = db.Set<Expense>().AsNoTracking().Where(e => e.ExpenseReportId == reportId);
            var count = await query.CountAsync(ct);
            var items = await query.OrderBy(e => e.Date).ThenBy(e => e.Id)
                .Skip(((page ?? 1) - 1) * 5).Take(5).ToListAsync(ct);
            return Results.Ok(new ExpensePage(page ?? 1, 5, count, items.Select(ToExpense).ToList()));
        });
        reports.MapPost("/{reportId:guid}/expenses", async (Guid reportId,
            SaveExpenseRequest request, AppDbContext db, IUserPolicyReader policyReader, CancellationToken ct) =>
        {
            // One EF execution strategy must own the transaction on the SAME DbContext.
            // Each retry discards tracked entities from a failed attempt.
            // Reuse the same primary key on every retry (including unknown COMMIT outcomes).
            // This protects this HTTP execution; it is not a cross-request idempotency key.
            var expenseId = Guid.NewGuid();
            var strategy = db.Database.CreateExecutionStrategy();
            return await strategy.ExecuteAsync(async () =>
            {
                db.ChangeTracker.Clear();
                await using var tx = await db.Database.BeginTransactionAsync(ct);

                var report = await db.Set<ExpenseReport>().AsNoTracking()
                    .SingleOrDefaultAsync(r => r.Id == reportId, ct);
                if (report is null) return Results.NotFound();

                Expense expense;
                try
                {
                    expense = Expense.Create(reportId, report.Year, report.Month, request.Date,
                        request.Description, request.Amount, request.Store, request.Street,
                        request.PostalCode, request.City, expenseId);
                }
                catch (ArgumentException ex)
                {
                    return Results.BadRequest(new { error = ex.Message });
                }

                // Serialize the quota check and insertion for one user/month.
                var key = $"expense-quota:{report.UserId:N}:{report.Year:D4}:{report.Month:D2}";
                await db.Database.ExecuteSqlInterpolatedAsync(
                    $"SELECT pg_advisory_xact_lock(hashtextextended({key}, 0))", ct);

                // If COMMIT succeeded but the acknowledgement was lost, a replay
                // must return the already-created expense instead of inserting twice.
                // Check under the same quota lock, before applying the quota limit.
                var existing = await db.Set<Expense>().AsNoTracking()
                    .SingleOrDefaultAsync(e => e.Id == expenseId, ct);
                if (existing is not null)
                    return Results.Created($"/expense-reports/{reportId}/expenses/{expenseId}", ToExpense(existing));

                var policy = await policyReader.GetAsync(report.UserId, ct);
                if (policy is null || !policy.IsEligible)
                    return Results.Conflict(new { error = "Report user is inactive or deleted." });

                var count = await db.Set<Expense>().CountAsync(e =>
                    db.Set<ExpenseReport>().Any(r => r.Id == e.ExpenseReportId &&
                        r.UserId == report.UserId && r.Year == report.Year && r.Month == report.Month), ct);
                if (count >= policy.MonthlyExpenseLimit)
                    return Results.Conflict(new { error = $"Monthly expense quota reached ({policy.MonthlyExpenseLimit})." });

                db.Set<Expense>().Add(expense);
                try
                {
                    await db.SaveChangesAsync(ct);
                }
                catch (DbUpdateException ex) when (IsReportForeignKeyViolation(ex))
                {
                    // The report may have been deleted after it was read by this transaction.
                    // Disposing the uncommitted transaction rolls it back.
                    return Results.Conflict(new { error = "The expense report was deleted concurrently." });
                }

                await tx.CommitAsync(ct);
                return Results.Created($"/expense-reports/{reportId}/expenses/{expense.Id}", ToExpense(expense));
            });
        });
        reports.MapPut("/{reportId:guid}/expenses/{expenseId:guid}", async (Guid reportId,
            Guid expenseId, SaveExpenseRequest request, AppDbContext db, CancellationToken ct) =>
        {
            var report = await db.Set<ExpenseReport>().SingleOrDefaultAsync(r => r.Id == reportId, ct);
            if (report is null) return Results.NotFound();
            var expense = await db.Set<Expense>().SingleOrDefaultAsync(
                e => e.Id == expenseId && e.ExpenseReportId == reportId, ct);
            if (expense is null) return Results.NotFound();
            try { expense.Update(report.Year, report.Month, request.Date, request.Description,
                    request.Amount, request.Store, request.Street, request.PostalCode, request.City); }
            catch (ArgumentException ex) { return Results.BadRequest(new { error = ex.Message }); }
            await db.SaveChangesAsync(ct);
            return Results.Ok(ToExpense(expense));
        });
        reports.MapDelete("/{reportId:guid}/expenses/{expenseId:guid}", async (Guid reportId,
            Guid expenseId, AppDbContext db, CancellationToken ct) =>
        {
            var expense = await db.Set<Expense>().SingleOrDefaultAsync(
                e => e.Id == expenseId && e.ExpenseReportId == reportId, ct);
            if (expense is null) return Results.NotFound();
            expense.SoftDelete();
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });
        return app;
    }

    private static bool IsUniqueViolation(DbUpdateException e) =>
        e.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation };
    private static bool IsReportForeignKeyViolation(DbUpdateException e) =>
        e.InnerException is PostgresException
        {
            SqlState: PostgresErrorCodes.ForeignKeyViolation,
            ConstraintName: "FK_expenses_expense_reports_ExpenseReportId"
        };
    private static ReportDto ToReport(ExpenseReport r) => new(r.Id, r.UserId, r.Year, r.Month,
        $"{r.UserDisplayName} - {French.DateTimeFormat.GetMonthName(r.Month).ToTitleCase(French)} {r.Year}");
    private static ExpenseDto ToExpense(Expense e) => new(e.Id, e.ExpenseReportId, e.Date,
        e.Description, e.Amount, e.Store, e.Street, e.PostalCode, e.City);
    private static string ToTitleCase(this string s, CultureInfo culture) => culture.TextInfo.ToTitleCase(s);
}
