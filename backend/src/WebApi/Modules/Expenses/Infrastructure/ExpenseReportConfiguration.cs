using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WebApi.Modules.Expenses.Domain;

namespace WebApi.Modules.Expenses.Infrastructure;

internal sealed class ExpenseReportConfiguration : IEntityTypeConfiguration<ExpenseReport>
{
    public void Configure(EntityTypeBuilder<ExpenseReport> b)
    {
        b.ToTable("expense_reports");
        b.HasKey(x => x.Id);
        b.Property(x => x.UserDisplayName).HasMaxLength(201).IsRequired();
        b.HasIndex(x => new { x.UserId, x.Year, x.Month }).IsUnique();
        b.HasMany(x => x.Expenses).WithOne().HasForeignKey(x => x.ExpenseReportId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
