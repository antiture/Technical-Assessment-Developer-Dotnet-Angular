using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WebApi.Modules.Expenses.Domain;

namespace WebApi.Modules.Expenses.Infrastructure;

internal sealed class ExpenseConfiguration : IEntityTypeConfiguration<Expense>
{
    public void Configure(EntityTypeBuilder<Expense> b)
    {
        b.ToTable("expenses");
        b.HasKey(x => x.Id);
        b.Property(x => x.Date).HasColumnType("date");
        b.Property(x => x.Description).IsRequired().HasMaxLength(50);
        b.Property(x => x.Amount).HasColumnType("numeric(18,2)");
        b.Property(x => x.Store).IsRequired().HasMaxLength(200);
        b.Property(x => x.Street).IsRequired().HasMaxLength(200);
        b.Property(x => x.PostalCode).IsRequired().HasMaxLength(20);
        b.Property(x => x.City).IsRequired().HasMaxLength(100);
        b.HasQueryFilter(x => !x.IsDeleted);
        b.HasIndex(x => new { x.ExpenseReportId, x.Date, x.Id });
    }
}
