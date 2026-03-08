# Müşteri Takip Pro - Telegram Bot Komutları

Uygulamanızı Telegram üzerinden yönetmek için aşağıdaki komutları kullanabilirsiniz.

---

### 📱 Uygulama kapalıyken Telegram’dan yanıt almak

Bu komutlara (**/start**, **/ekle**, **/tamamla**, **/randevular**, **/buhafta**, **/notlarim**, **/bul**, **/id** vb.) uygulama kapalıyken de yanıt alabilirsiniz. Bunun için:

1. **Firebase Cloud Functions** deploy edilmiş olmalı (`firebase deploy --only functions`).
2. **Webhook** ayarlanmış olmalı (aşağıdaki “Webhook kurulumu” bölümü).
3. Uygulama ayarlarında **Chat ID**’nizi girin ve **“Webhook modu”**nu açın. (Bot Token, webhook için sunucuda tanımlı bot ile aynı olmalı.)

**Webhook kurulumu (proje sahibi / tek seferlik):**  
👉 **Adım adım detaylı rehber:** [WEBHOOK_KURULUM.md](./WEBHOOK_KURULUM.md)

- Firebase’de `telegramWebhook` fonksiyonunun URL’sini alın (Firebase Console → Functions → telegramWebhook).
- Ortam değişkeni: `TELEGRAM_WEBHOOK_BOT_TOKEN` = Bot token’ınız.
- Telegram’da webhook’u ayarlayın (tarayıcıda veya curl ile):
  `https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=<FONKSIYON_URL>`
- Bu sayede tüm mesajlar sunucuya gider; uygulama kapalıyken de komutlar işlenir ve yanıtlar Telegram’a gider.

**Otomatik yedek:** Ayarlarda seçtiğiniz saatlerde (Türkiye saati) **günlük özet**, **haftalık özet** ve **otomatik yedek** Telegram’a gönderilir; uygulama kapalıyken de çalışır (sunucu tarafında zamanlanmış görev).

---

### 🚀 Hızlı İşlemler

| Komut | Kullanım | Örnek | Açıklama |
|-------|----------|-------|----------|
| **Hızlı Ekle** | `/ekle [İsim] [Tarih]` | `/ekle Ahmet Yılmaz 25.10.2023` | Belirtilen isim ve tarihe (varsayılan saat 09:00) yeni bir randevu oluşturur. |
| **Hızlı Tamamla** | `/tamamla [İsim]` | `/tamamla Ahmet` | İsmi geçen bekleyen randevuyu bulur ve "Tamamlandı" olarak işaretler. |

### 📋 Listeleme ve Sorgulama

| Komut | Açıklama |
|-------|----------|
| `/randevular` | Kayıtlı tüm tamamlanmamış randevuları tarih sırasına göre listeler. |
| `/buhafta` | İçinde bulunduğumuz haftanın tüm randevularını gün gün listeler. |
| `/tamamlananlar` | Son tamamlanan 10 işlemi listeler. |
| `/notlarim` | Yapışkan notlarınızı (TodoList) getirir. |

### 🔍 Arama ve Yardım

| Komut | Açıklama |
|-------|----------|
| `/bul [kelime]` | Müşteri adı veya not içeriğinde arama yapar. Örnek: `/bul Ahmet` |
| `/id` | Telegram Chat ID numaranızı gösterir. Özel mesajda veya kanalda kullanılabilir. |
| `/start`, `/menu`, `/yardim` | Ana menü butonlarını açar. |

---

### ⚙️ Ayarlar ve Çoklu Bildirim
Uygulama ayarlarındaki **Telegram Chat ID** kısmına birden fazla ID ekleyerek bildirimleri birden fazla yere gönderebilirsiniz:
* **Örnek:** `12345678, -100123456789` (Kendi ID'niz ve Kanal/Grup ID'si)
* ID'leri virgül (`,`) ile ayırmanız yeterlidir.

---

### 🤖 BotFather Ayarları (Komut Listesi)
Botunuzun menü tuşunda bu komutların çıkması için **BotFather**'a gidip `/setcommands` yazdıktan sonra aşağıdaki listeyi yapıştırabilirsiniz:

```text
start - Ana menüyü aç
ekle - Hızlı randevu ekle (Örn: /ekle İsim Tarih)
tamamla - İşlemi tamamla (Örn: /tamamla İsim)
randevular - Tüm bekleyen randevuları listele
buhafta - Bu haftalık program
tamamlananlar - Tamamlanan son işler
notlarim - Yapışkan notları göster
bul - Kayıtlar içinde arama yap
id - Chat ID numaranızı öğrenin
```

---

### 🔔 Otomatik Bildirimler
* **Bugünün Randevusu:** Kayıtlı bir randevunun saati geldiğinde bot otomatik olarak `🔔 BUGÜNÜN RANDEVUSU` başlığıyla size bildirim gönderir.
* **Durum Değişiklikleri:** Web üzerinden bir kayıt silindiğinde veya tamamlandığında bot size bilgi verir.
