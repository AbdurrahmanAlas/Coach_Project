namespace Kocluk.Domain.Entities;

public class Topic
{
    public int Id { get; set; }
    public string SubjectId { get; set; } = "";
    public string Name { get; set; } = "";
    public int SortOrder { get; set; }

    public Subject? Subject { get; set; }
}
