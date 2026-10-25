namespace Kocluk.Domain.Entities;

public sealed class ExamAttempt
{
    private ExamAttempt() { }

    public ExamAttempt(Guid tenantId, Guid studentId, string title, DateOnly examDate,
        int correct, int wrong, int blank, decimal score)
    {
        if (tenantId == Guid.Empty || studentId == Guid.Empty) throw new ArgumentException("Koçluk alanı ve öğrenci zorunludur.");
        if (string.IsNullOrWhiteSpace(title)) throw new ArgumentException("Deneme adı zorunludur.");
        if (correct < 0 || wrong < 0 || blank < 0 || score < 0) throw new ArgumentOutOfRangeException(nameof(correct));
        Id = Guid.NewGuid(); TenantId = tenantId; StudentId = studentId; Title = title.Trim();
        ExamDate = examDate; Correct = correct; Wrong = wrong; Blank = blank; Score = score; CreatedAtUtc = DateTime.UtcNow;
    }

    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public Guid StudentId { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public DateOnly ExamDate { get; private set; }
    public int Correct { get; private set; }
    public int Wrong { get; private set; }
    public int Blank { get; private set; }
    public decimal Score { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }

    public void Update(string title, DateOnly examDate, int correct, int wrong, int blank, decimal score)
    {
        if (string.IsNullOrWhiteSpace(title)) throw new ArgumentException("Deneme adı zorunludur.");
        if (correct < 0 || wrong < 0 || blank < 0 || score < 0) throw new ArgumentOutOfRangeException(nameof(correct));
        Title = title.Trim(); ExamDate = examDate; Correct = correct; Wrong = wrong; Blank = blank; Score = score;
    }
}
