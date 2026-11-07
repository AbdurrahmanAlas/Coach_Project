namespace Kocluk.Domain.Entities;

/// <summary>
/// Bir kaynak dosyasının (PDF, görsel) optik form tanımı: soru sayısı, şık sayısı ve
/// isteğe bağlı cevap anahtarı. Cevap anahtarı yalnızca sunucuda tutulur ve öğrenciye
/// çalışmayı gönderene kadar gösterilmez.
///
/// Cevap dizgesi biçimi: her soru için tek karakter. A, B, C... işaretlenen şık;
/// '-' boş bırakılan soru (anahtarda ise puanlanmayan/iptal soru).
/// </summary>
public sealed class ResourceWorksheet
{
    public const int MaxQuestions = 200;
    public const int MaxDurationMinutes = 600;

    private ResourceWorksheet() { }

    public ResourceWorksheet(Guid tenantId, Guid resourceId, int questionCount, int optionCount, string? answerKey, int? durationMinutes)
    {
        if (tenantId == Guid.Empty) throw new ArgumentException("Kurum bilgisi zorunludur.", nameof(tenantId));
        if (resourceId == Guid.Empty) throw new ArgumentException("Kaynak bilgisi zorunludur.", nameof(resourceId));
        Id = Guid.NewGuid();
        TenantId = tenantId;
        ResourceId = resourceId;
        CreatedAtUtc = DateTime.UtcNow;
        Update(questionCount, optionCount, answerKey, durationMinutes);
    }

    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public Guid ResourceId { get; private set; }
    public int QuestionCount { get; private set; }
    public int OptionCount { get; private set; }
    public string? AnswerKey { get; private set; }
    public int? DurationMinutes { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }
    public DateTime UpdatedAtUtc { get; private set; }

    public bool HasKey => !string.IsNullOrEmpty(AnswerKey);

    public void Update(int questionCount, int optionCount, string? answerKey, int? durationMinutes)
    {
        if (questionCount < 1 || questionCount > MaxQuestions)
            throw new ArgumentException($"Soru sayısı 1 ile {MaxQuestions} arasında olmalıdır.", nameof(questionCount));
        if (optionCount < 2 || optionCount > 5)
            throw new ArgumentException("Şık sayısı 2 ile 5 arasında olmalıdır.", nameof(optionCount));
        if (durationMinutes is < 1 or > MaxDurationMinutes)
            throw new ArgumentException($"Süre 1 ile {MaxDurationMinutes} dakika arasında olmalıdır.", nameof(durationMinutes));
        var key = string.IsNullOrWhiteSpace(answerKey) ? null : NormalizeSheet(answerKey, questionCount, optionCount);
        QuestionCount = questionCount;
        OptionCount = optionCount;
        AnswerKey = key;
        DurationMinutes = durationMinutes;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    /// <summary>
    /// Cevap dizgesini doğrular ve büyük harfe çevirir. Uzunluk soru sayısına eşit olmalı,
    /// her karakter '-' veya geçerli bir şık harfi olmalıdır.
    /// </summary>
    public static string NormalizeSheet(string? raw, int questionCount, int optionCount)
    {
        var value = (raw ?? string.Empty).Trim().ToUpperInvariant();
        if (value.Length != questionCount)
            throw new ArgumentException($"Cevap sayısı {questionCount} olmalıdır (gönderilen: {value.Length}).");
        var last = (char)('A' + optionCount - 1);
        foreach (var c in value)
        {
            if (c != '-' && (c < 'A' || c > last))
                throw new ArgumentException($"Geçersiz işaret '{c}'. Yalnızca A-{last} veya boş için '-' kullanılabilir.");
        }
        return value;
    }
}

public sealed record WorksheetResult(bool Graded, int Correct, int Wrong, int Blank, double Net);

public static class WorksheetGrader
{
    /// <summary>
    /// Türkiye sınav usulü net: doğru sayısı − yanlış sayısı / (şık sayısı − 1).
    /// 5 şıklı sınavlarda 4 yanlış 1 doğruyu, 4 şıklı sınavlarda 3 yanlış 1 doğruyu götürür.
    /// Cevap anahtarı yoksa puanlama yapılmaz, yalnızca boş sayısı hesaplanır.
    /// </summary>
    public static WorksheetResult Grade(ResourceWorksheet sheet, string answers)
    {
        var normalized = ResourceWorksheet.NormalizeSheet(answers, sheet.QuestionCount, sheet.OptionCount);
        if (!sheet.HasKey)
            return new WorksheetResult(false, 0, 0, normalized.Count(c => c == '-'), 0);
        var key = sheet.AnswerKey!;
        int correct = 0, wrong = 0, blank = 0;
        for (var i = 0; i < key.Length; i++)
        {
            if (key[i] == '-') continue;
            if (normalized[i] == '-') blank++;
            else if (normalized[i] == key[i]) correct++;
            else wrong++;
        }
        var net = Math.Round(correct - wrong / (double)(sheet.OptionCount - 1), 2);
        return new WorksheetResult(true, correct, wrong, blank, net);
    }
}
