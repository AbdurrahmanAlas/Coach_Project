namespace Kocluk.Domain.Entities;

public sealed class QuestionBankItem
{
    private QuestionBankItem() { }
    public QuestionBankItem(Guid tenantId, Guid? createdByUserId, string subject, string topic, string prompt, string? answer, string? explanation, string difficulty, string examType)
    {
        if (string.IsNullOrWhiteSpace(subject) || string.IsNullOrWhiteSpace(topic) || string.IsNullOrWhiteSpace(prompt)) throw new ArgumentException("Ders, konu ve soru metni zorunludur.");
        if (prompt.Trim().Length > 4000) throw new ArgumentException("Soru metni en fazla 4000 karakter olabilir.");
        if (difficulty is not ("Kolay" or "Orta" or "Zor")) throw new ArgumentException("Geçersiz zorluk seviyesi.");
        Id = Guid.NewGuid(); TenantId = tenantId; CreatedByUserId = createdByUserId; Subject = subject.Trim(); Topic = topic.Trim(); Prompt = prompt.Trim(); Answer = answer?.Trim(); Explanation = explanation?.Trim(); Difficulty = difficulty; ExamType = examType?.Trim() ?? string.Empty; CreatedAtUtc = DateTime.UtcNow;
    }
    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public Guid? CreatedByUserId { get; private set; }
    public string Subject { get; private set; } = string.Empty;
    public string Topic { get; private set; } = string.Empty;
    public string Prompt { get; private set; } = string.Empty;
    public string? Answer { get; private set; }
    public string? Explanation { get; private set; }
    public string Difficulty { get; private set; } = "Orta";
    public string ExamType { get; private set; } = string.Empty;
    public bool IsPublished { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }
    public string QuestionType { get; private set; } = "ShortAnswer";
    public string? OptionsJson { get; private set; }
    public Guid? ResourceId { get; private set; }
    public decimal Points { get; private set; } = 1;
    public void Configure(string questionType, string? optionsJson, Guid? resourceId, decimal points)
    {
        QuestionType = questionType is "MultipleChoice" or "TrueFalse" or "ShortAnswer" ? questionType : "ShortAnswer";
        OptionsJson = string.IsNullOrWhiteSpace(optionsJson) ? null : optionsJson.Trim();
        ResourceId = resourceId;
        Points = points <= 0 ? 1 : Math.Min(points, 100);
    }
    public void Update(string subject, string topic, string prompt, string? answer, string? explanation, string difficulty, string examType)
    {
        if (string.IsNullOrWhiteSpace(subject) || string.IsNullOrWhiteSpace(topic) || string.IsNullOrWhiteSpace(prompt)) throw new ArgumentException("Ders, konu ve soru metni zorunludur.");
        if (difficulty is not ("Kolay" or "Orta" or "Zor")) throw new ArgumentException("Geçersiz zorluk seviyesi.");
        Subject = subject.Trim(); Topic = topic.Trim(); Prompt = prompt.Trim(); Answer = answer?.Trim(); Explanation = explanation?.Trim(); Difficulty = difficulty; ExamType = examType?.Trim() ?? string.Empty;
    }
    public void SetPublished(bool published) => IsPublished = published;
}
