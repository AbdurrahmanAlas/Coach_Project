using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Options;

namespace Kocluk.Infrastructure.Email;

public interface IEmailSender
{
    Task SendAsync(string recipient, string subject, string body, CancellationToken cancellationToken = default);
}

public sealed class SmtpEmailSender(IOptions<EmailOptions> options) : IEmailSender
{
    public async Task SendAsync(string recipient, string subject, string body, CancellationToken cancellationToken = default)
    {
        var settings = options.Value;
        if (string.IsNullOrWhiteSpace(settings.Host) || string.IsNullOrWhiteSpace(settings.From)) return;
        using var client = new SmtpClient(settings.Host, settings.Port) { EnableSsl = true };
        if (!string.IsNullOrWhiteSpace(settings.Username)) client.Credentials = new NetworkCredential(settings.Username, settings.Password);
        using var message = new MailMessage(settings.From, recipient, subject, body);
        await client.SendMailAsync(message, cancellationToken);
    }
}
