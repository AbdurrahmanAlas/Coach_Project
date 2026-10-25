# SaaS abonelik entegrasyon planı

Ödeme sağlayıcısı hesabı ve webhook adresi olmadan gerçek tahsilat yapılamaz. Üretimde aşağıdaki environment değişkenleri tanımlanmalıdır:

```text
BILLING_PROVIDER=iyzico|stripe
BILLING_API_KEY=...
BILLING_SECRET=...
BILLING_WEBHOOK_SECRET=...
```

Önerilen paketler:

- Başlangıç: 1 koç, 20 öğrenci
- Profesyonel: 5 koç, 200 öğrenci
- Kurumsal: özel limit ve destek

Webhook işlemleri idempotent olmalı; başarılı ödeme, iptal, başarısız ödeme ve abonelik yenileme olayları audit log’a yazılmalıdır. Gerçek sağlayıcı seçimi ve ticari sözleşme tamamlanmadan tahsilat endpoint’i production’da açılmamalıdır.

## Ortak webhook sözleşmesi

API, sağlayıcı adaptörlerinin çağırabileceği `POST /api/billing/webhook` uç noktasını sunar. Gönderim gövdesi:

```json
{
  "eventId": "provider-event-123",
  "eventType": "payment_succeeded",
  "tenantId": "00000000-0000-0000-0000-000000000000",
  "planCode": "Professional",
  "periodEndUtc": "2027-01-25T00:00:00Z"
}
```

`X-Billing-Signature` başlığı, ham JSON gövdesinin `BILLING_WEBHOOK_SECRET` ile HMAC-SHA256 hex imzasıdır. `payment_succeeded`, `subscription_renewed`, `payment_failed` ve `subscription_cancelled` olayları desteklenir. `provider + eventId` benzersizliği sayesinde tekrar gönderilen webhook ikinci kez uygulanmaz.
