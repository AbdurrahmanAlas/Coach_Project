namespace Kocluk.Domain.Entities;

public sealed class StudentGuardian
{
    private StudentGuardian() { }

    public StudentGuardian(Guid tenantId, Guid studentId, string firstName, string lastName, string? email, string phoneNumber)
    {
        if (tenantId == Guid.Empty || studentId == Guid.Empty) throw new ArgumentException("Öğrenci ve koçluk alanı zorunludur.");
        if (string.IsNullOrWhiteSpace(firstName)) throw new ArgumentException("Veli adı zorunludur.", nameof(firstName));
        if (string.IsNullOrWhiteSpace(lastName)) throw new ArgumentException("Veli soyadı zorunludur.", nameof(lastName));
        if (string.IsNullOrWhiteSpace(phoneNumber)) throw new ArgumentException("Veli telefon numarası zorunludur.", nameof(phoneNumber));
        Id = Guid.NewGuid(); TenantId = tenantId; StudentId = studentId;
        FirstName = firstName.Trim(); LastName = lastName.Trim();
        Email = string.IsNullOrWhiteSpace(email) ? null : email.Trim(); PhoneNumber = phoneNumber.Trim();
        CreatedAtUtc = DateTime.UtcNow;
    }

    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public Guid StudentId { get; private set; }
    public Guid? ParentUserId { get; private set; }
    public string FirstName { get; private set; } = string.Empty;
    public string LastName { get; private set; } = string.Empty;
    public string? Email { get; private set; }
    public string PhoneNumber { get; private set; } = string.Empty;
    public DateTime CreatedAtUtc { get; private set; }

    public void LinkUser(Guid userId) => ParentUserId = userId;

    public void UpdateProfile(string firstName, string lastName, string? email, string phoneNumber)
    {
        if (string.IsNullOrWhiteSpace(firstName) || string.IsNullOrWhiteSpace(lastName) || string.IsNullOrWhiteSpace(phoneNumber))
            throw new ArgumentException("Veli adı, soyadı ve telefon numarası zorunludur.");
        FirstName = firstName.Trim(); LastName = lastName.Trim();
        Email = string.IsNullOrWhiteSpace(email) ? null : email.Trim(); PhoneNumber = phoneNumber.Trim();
    }
}
