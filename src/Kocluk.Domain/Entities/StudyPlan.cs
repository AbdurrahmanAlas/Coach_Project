namespace Kocluk.Domain.Entities;

public sealed class StudyPlan
{
    private readonly List<StudyTask> _tasks = [];
    private StudyPlan() { }

    public StudyPlan(Guid tenantId, Guid studentId, string title, DateOnly weekStart)
    {
        if (tenantId == Guid.Empty) throw new ArgumentException("Kurum bilgisi zorunludur.", nameof(tenantId));
        if (studentId == Guid.Empty) throw new ArgumentException("Öğrenci bilgisi zorunludur.", nameof(studentId));
        if (string.IsNullOrWhiteSpace(title)) throw new ArgumentException("Plan adı zorunludur.", nameof(title));
        if (weekStart.DayOfWeek != DayOfWeek.Monday) throw new ArgumentException("Hafta başlangıcı pazartesi olmalıdır.", nameof(weekStart));
        Id = Guid.NewGuid(); TenantId = tenantId; StudentId = studentId;
        Title = title.Trim(); WeekStart = weekStart; CreatedAtUtc = DateTime.UtcNow;
    }

    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public Guid StudentId { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public DateOnly WeekStart { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }
    public IReadOnlyCollection<StudyTask> Tasks => _tasks.AsReadOnly();

    public StudyTask AddTask(string title, DateOnly dueDate, int targetQuestions)
    {
        if (dueDate < WeekStart || dueDate > WeekStart.AddDays(6))
            throw new ArgumentException("Görev tarihi plan haftasının içinde olmalıdır.", nameof(dueDate));
        var task = new StudyTask(Id, title, dueDate, targetQuestions);
        _tasks.Add(task);
        return task;
    }

    public StudyTask? FindTask(Guid taskId) => _tasks.FirstOrDefault(task => task.Id == taskId);
    public void Rename(string title)
    {
        if (string.IsNullOrWhiteSpace(title)) throw new ArgumentException("Plan adı zorunludur.", nameof(title));
        Title = title.Trim();
    }
    public bool RemoveTask(Guid taskId)
    {
        var task = FindTask(taskId);
        return task is not null && _tasks.Remove(task);
    }
}

public sealed class StudyTask
{
    private StudyTask() { }
    internal StudyTask(Guid studyPlanId, string title, DateOnly dueDate, int targetQuestions)
    {
        if (string.IsNullOrWhiteSpace(title)) throw new ArgumentException("Görev adı zorunludur.", nameof(title));
        if (targetQuestions < 0) throw new ArgumentOutOfRangeException(nameof(targetQuestions), "Soru hedefi negatif olamaz.");
        Id = Guid.NewGuid(); StudyPlanId = studyPlanId; Title = title.Trim(); DueDate = dueDate; TargetQuestions = targetQuestions;
    }
    public Guid Id { get; private set; }
    public Guid StudyPlanId { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public DateOnly DueDate { get; private set; }
    public int TargetQuestions { get; private set; }
    public int CompletedQuestions { get; private set; }
    public bool IsCompleted { get; private set; }

    public void UpdateProgress(int completedQuestions, bool isCompleted)
    {
        if (completedQuestions < 0) throw new ArgumentOutOfRangeException(nameof(completedQuestions));
        CompletedQuestions = completedQuestions;
        IsCompleted = isCompleted;
    }

    public void Update(string title, DateOnly dueDate, int targetQuestions)
    {
        if (string.IsNullOrWhiteSpace(title)) throw new ArgumentException("Görev adı zorunludur.", nameof(title));
        if (targetQuestions < 0) throw new ArgumentOutOfRangeException(nameof(targetQuestions));
        Title = title.Trim(); DueDate = dueDate; TargetQuestions = targetQuestions;
        if (CompletedQuestions > targetQuestions) CompletedQuestions = targetQuestions;
        IsCompleted = targetQuestions > 0 && CompletedQuestions >= targetQuestions;
    }
}
