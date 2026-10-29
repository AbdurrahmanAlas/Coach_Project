namespace Kocluk.Domain.Entities;

public sealed class StudyResource
{
    private StudyResource() { }
    public StudyResource(Guid tenantId, Guid uploadedByUserId, string subject, string topic, string fileName, string storedFileName, string contentType, long size)
    {
        Id = Guid.NewGuid(); TenantId = tenantId; UploadedByUserId = uploadedByUserId; Subject = subject.Trim(); Topic = topic.Trim(); FileName = fileName; StoredFileName = storedFileName; ContentType = contentType; Size = size; CreatedAtUtc = DateTime.UtcNow;
    }
    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public Guid? UploadedByUserId { get; private set; }
    public string Subject { get; private set; } = string.Empty;
    public string Topic { get; private set; } = string.Empty;
    public string FileName { get; private set; } = string.Empty;
    public string StoredFileName { get; private set; } = string.Empty;
    public string ContentType { get; private set; } = "application/octet-stream";
    public long Size { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }
}
