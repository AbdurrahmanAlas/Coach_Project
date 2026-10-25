using Kocluk.Domain.Entities;

var checks = new (string Name, Action Run)[]
{
    ("Öğrenci adı/soyadı kırpılır", () => { var item = new Student(Guid.NewGuid(), " Ada ", " Yılmaz "); Assert(item.FirstName == "Ada" && item.LastName == "Yılmaz", "Öğrenci adı normalize edilmedi."); }),
    ("Boş kurumlu öğrenci reddedilir", () => Throws<ArgumentException>(() => new Student(Guid.Empty, "Ada", "Yılmaz"))),
    ("Konu ilerlemesi yüzde sınırını uygular", () => { var item = new SubjectProgress(Guid.NewGuid(), Guid.NewGuid(), " Matematik ", " Fonksiyonlar ", 40); item.Update("Matematik", "Fonksiyonlar", 75); Assert(item.CompletionPercent == 75, "İlerleme güncellenmedi."); Throws<ArgumentOutOfRangeException>(() => item.UpdatePercent(101)); }),
    ("Soru zorluk seviyesi doğrulanır", () => Throws<ArgumentException>(() => new QuestionBankItem(Guid.NewGuid(), null, "Matematik", "Fonksiyonlar", "Soru?", "A", null, "Aşırı", "TYT"))),
    ("Soru yayın durumu ve cevap alanı korunur", () => { var item = new QuestionBankItem(Guid.NewGuid(), null, "Matematik", "Fonksiyonlar", "1+1?", "2", "Toplama", "Kolay", "TYT"); item.SetPublished(true); Assert(item.IsPublished && item.Answer == "2", "Soru yayımlanmadı veya cevap saklanmadı."); }),
    ("Plan değiştirmek abonelik limitlerini günceller", () => { var item = new TenantSubscription(Guid.NewGuid()); item.ChangePlan("Professional"); Assert(item.IsActive && item.MaxCoaches == 5 && item.MaxStudents == 200, "Paket limitleri doğru değil."); }),
    ("Ödeme başarısızlığı aboneliği pasife alır", () => { var item = new TenantSubscription(Guid.NewGuid()); item.MarkPaymentFailed(); Assert(!item.IsActive && item.Status == "PastDue", "Ödeme başarısız durumu uygulanmadı."); }),
    ("Boş mesaj reddedilir", () => Throws<ArgumentException>(() => new UserMessage(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "  ")))
};

foreach (var check in checks)
{
    check.Run();
    Console.WriteLine($"PASS {check.Name}");
}
Console.WriteLine($"{checks.Length} domain kontrolü başarılı.");

static void Assert(bool condition, string message)
{
    if (!condition) throw new InvalidOperationException(message);
}

static void Throws<TException>(Action action) where TException : Exception
{
    try { action(); }
    catch (TException) { return; }
    throw new InvalidOperationException($"{typeof(TException).Name} bekleniyordu.");
}
