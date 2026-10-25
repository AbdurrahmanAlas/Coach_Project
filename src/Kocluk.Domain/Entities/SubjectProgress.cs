namespace Kocluk.Domain.Entities;

public sealed class SubjectProgress
{
    private SubjectProgress() { }
    public SubjectProgress(Guid tenantId, Guid studentId, string subject, string topic, int completionPercent = 0)
    {
        if (tenantId == Guid.Empty || studentId == Guid.Empty) throw new ArgumentException("Kurum ve öğrenci zorunludur.");
        if (string.IsNullOrWhiteSpace(subject) || string.IsNullOrWhiteSpace(topic)) throw new ArgumentException("Ders ve konu zorunludur.");
        Id = Guid.NewGuid(); TenantId = tenantId; StudentId = studentId; Subject = subject.Trim(); Topic = topic.Trim(); UpdatePercent(completionPercent); CreatedAtUtc = DateTime.UtcNow;
    }
    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public Guid StudentId { get; private set; }
    public string Subject { get; private set; } = string.Empty;
    public string Topic { get; private set; } = string.Empty;
    public int CompletionPercent { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }
    public void UpdatePercent(int percent) { if (percent is < 0 or > 100) throw new ArgumentOutOfRangeException(nameof(percent)); CompletionPercent = percent; }
    public void Update(string subject, string topic, int percent)
    {
        if (string.IsNullOrWhiteSpace(subject) || string.IsNullOrWhiteSpace(topic)) throw new ArgumentException("Ders ve konu zorunludur.");
        Subject = subject.Trim(); Topic = topic.Trim(); UpdatePercent(percent);
    }
}
