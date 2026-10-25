namespace Kocluk.Domain.Entities;

public sealed class Tenant
{
    private Tenant() { }
    public Tenant(string name, string slug)
    {
        if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("Kurum adı zorunludur.", nameof(name));
        if (string.IsNullOrWhiteSpace(slug)) throw new ArgumentException("Kurum kısa adı zorunludur.", nameof(slug));
        Id = Guid.NewGuid(); Name = name.Trim(); Slug = slug.Trim().ToLowerInvariant(); CreatedAtUtc = DateTime.UtcNow;
    }
    public Guid Id { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string Slug { get; private set; } = string.Empty;
    public DateTime CreatedAtUtc { get; private set; }
}
