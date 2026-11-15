namespace Kocluk.Domain.Entities;

public class Subject
{
    public string Id { get; set; } = "";
    public string ExamId { get; set; } = "";
    public string Name { get; set; } = "";
    public int SortOrder { get; set; }

    public Exam? Exam { get; set; }
    public ICollection<Topic> Topics { get; set; } = new List<Topic>();
}
