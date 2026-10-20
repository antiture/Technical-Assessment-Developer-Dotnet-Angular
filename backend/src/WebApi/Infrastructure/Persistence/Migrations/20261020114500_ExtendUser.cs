using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace WebApi.Infrastructure.Persistence.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20261020114500_ExtendUser")]
public partial class ExtendUser : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(name: "PostalAddress", table: "users",
            type: "character varying(500)", maxLength: 500, nullable: false, defaultValue: "");
        migrationBuilder.AddColumn<int>(name: "MonthlyExpenseLimit", table: "users",
            type: "integer", nullable: false, defaultValue: 10);
        migrationBuilder.AddColumn<bool>(name: "IsActive", table: "users",
            type: "boolean", nullable: false, defaultValue: true);
        migrationBuilder.AddColumn<bool>(name: "IsDeleted", table: "users",
            type: "boolean", nullable: false, defaultValue: false);
        migrationBuilder.AlterColumn<string>(name: "FirstName", table: "users",
            type: "character varying(100)", maxLength: 100, nullable: false,
            oldClrType: typeof(string), oldType: "text");
        migrationBuilder.AlterColumn<string>(name: "LastName", table: "users",
            type: "character varying(100)", maxLength: 100, nullable: false,
            oldClrType: typeof(string), oldType: "text");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name: "PostalAddress", table: "users");
        migrationBuilder.DropColumn(name: "MonthlyExpenseLimit", table: "users");
        migrationBuilder.DropColumn(name: "IsActive", table: "users");
        migrationBuilder.DropColumn(name: "IsDeleted", table: "users");
        migrationBuilder.AlterColumn<string>(name: "FirstName", table: "users", type: "text",
            nullable: false, oldClrType: typeof(string), oldType: "character varying(100)", oldMaxLength: 100);
        migrationBuilder.AlterColumn<string>(name: "LastName", table: "users", type: "text",
            nullable: false, oldClrType: typeof(string), oldType: "character varying(100)", oldMaxLength: 100);
    }
}
