# Müşteri Takip Pro - Telegram Bot Komutları

Uygulamanızı Telegram üzerinden yönetmek için aşağıdaki komutları kullanabilirsiniz.

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
| `/notlarım` | Yapışkan notlarınızı (TodoList) getirir. |

### 🔍 Arama ve Yardım

| Komut | Açıklama |
|-------|----------|
| `/bul [kelime]` | Müşteri adı veya not içeriğinde arama yapar. Örnek: `/bul Ahmet` |
| `/id` | Telegram Chat ID numaranızı gösterir. Özel mesajda veya kanalda kullanılabilir. |
| `/start` veya `menü` | Ana menü butonlarını açar. |

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
