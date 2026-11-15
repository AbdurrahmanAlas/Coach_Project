namespace Kocluk.Domain.Entities;

public class Exam
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string FullName { get; set; } = "";

    public ICollection<Subject> Subjects { get; set; } = new List<Subject>();
}
