using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using WebApi.Infrastructure.Persistence;

namespace WebApi.Infrastructure.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20261020122000_AddExpenses")]
public partial class AddExpenses : Migration
{
    protected override void Up(MigrationBuilder m)
    {
        m.CreateTable(name: "expense_reports", columns: t => new
        {
            Id = t.Column<Guid>(type: "uuid", nullable: false),
            UserId = t.Column<Guid>(type: "uuid", nullable: false),
            Year = t.Column<int>(type: "integer", nullable: false),
            Month = t.Column<int>(type: "integer", nullable: false),
            UserDisplayName = t.Column<string>(type: "character varying(201)", maxLength: 201, nullable: false)
        }, constraints: t => t.PrimaryKey("PK_expense_reports", x => x.Id));
        m.CreateTable(name: "expenses", columns: t => new
        {
            Id = t.Column<Guid>(type: "uuid", nullable: false),
            ExpenseReportId = t.Column<Guid>(type: "uuid", nullable: false),
            Date = t.Column<DateOnly>(type: "date", nullable: false),
            Description = t.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
            Amount = t.Column<decimal>(type: "numeric(18,2)", nullable: false),
            Store = t.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
            Street = t.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
            PostalCode = t.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
            City = t.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
            IsDeleted = t.Column<bool>(type: "boolean", nullable: false)
        }, constraints: t =>
        {
            t.PrimaryKey("PK_expenses", x => x.Id);
            t.ForeignKey("FK_expenses_expense_reports_ExpenseReportId", x => x.ExpenseReportId,
                "expense_reports", "Id", onDelete: ReferentialAction.Cascade);
        });
        m.CreateIndex(name: "IX_expense_reports_UserId_Year_Month", table: "expense_reports",
            columns: new[] { "UserId", "Year", "Month" }, unique: true);
        m.CreateIndex(name: "IX_expenses_ExpenseReportId_Date_Id", table: "expenses",
            columns: new[] { "ExpenseReportId", "Date", "Id" });
    }
    protected override void Down(MigrationBuilder m)
    {
        m.DropTable(name: "expenses");
        m.DropTable(name: "expense_reports");
    }
}
