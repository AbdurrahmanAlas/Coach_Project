using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Kocluk.Infrastructure.Persistence;

public sealed class KoclukDbContextFactory : IDesignTimeDbContextFactory<KoclukDbContext>
{
    public KoclukDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<KoclukDbContext>()
            .UseNpgsql("Host=localhost;Port=5432;Database=kocluk;Username=kocluk;Password=kocluk_dev_password")
            .Options;
        return new KoclukDbContext(options);
    }
}
