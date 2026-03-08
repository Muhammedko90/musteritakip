# Telegram Webhook Kurulumu – Adım Adım Rehber

Bu rehber, uygulama kapalıyken de Telegram’dan `/start`, `/ekle`, `/tamamla` vb. komutlara yanıt alabilmeniz için **webhook**’u sıfırdan nasıl kuracağınızı anlatır.

---

## Webhook nedir, neden gerekli?

- **Polling:** Uygulama açıkken tarayıcı sürekli “yeni mesaj var mı?” diye Telegram’a sorar. Uygulama kapanınca bu durur, yanıt alamazsınız.
- **Webhook:** Telegram, her yeni mesajda **sizin sunucunuza (Firebase Cloud Function)** bir istek atar. Uygulama kapalı olsa bile sunucu çalışır, komutları işler ve cevabı Telegram’a gönderir.

Webhook kurulumu **tek seferlik** yapılır; sonrasında tüm kullanıcılar uygulama kapalıyken de bot ile konuşabilir.

---

## Genel akış (özet)

1. Telegram’da bir bot oluşturup **Bot Token** alacaksınız.
2. Projeyi Firebase’e bağlayıp **Cloud Functions**’ı deploy edeceksiniz.
3. Firebase’de bu bot’un token’ını **ortam değişkeni** olarak tanımlayacaksınız.
4. **Webhook URL**’yi (Cloud Function adresi) alıp Telegram’a “mesajları bu adrese gönder” diyeceksiniz.
5. Uygulama ayarlarında **Chat ID** ve **Webhook modu**nu ayarlayacaksınız.

Aşağıda her adım tek tek anlatılıyor.

---

# ADIM 1: Telegram Bot Oluşturma ve Token Alma

1. **Telegram**’ı açın (telefon veya masaüstü).
2. Arama çubuğuna **@BotFather** yazıp açın.
3. **Start** veya **/start** gönderin.
4. **Yeni bot:** `/newbot` yazıp Enter’a basın.
5. Bot’a bir **isim** verin (örn: `Müşteri Takip Asistanım`). Bu isim kullanıcıya görünür.
6. **Kullanıcı adı (username)** isteyecek; **bot** ile bitmeli (örn: `musteri_takip_bot`). Benzersiz olmalı.
7. BotFather size uzun bir **token** verecek. Örnek format:
   ```text
   7123456789:AAHxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
8. Bu token’ı **kopyalayıp güvenli bir yere** (not defteri, şifre yöneticisi) kaydedin. **Kimseyle paylaşmayın.**

Bu token = **Bot Token**. Webhook ve uygulama ayarlarında **aynı bot** kullanılacak.

---

# ADIM 2: Bilgisayarınızda Gerekenler

- **Node.js** (örn. v18 veya v20) yüklü olsun. Kontrol:  
  `node -v`
- **Firebase CLI** yüklü olsun:
  ```bash
  npm install -g firebase-tools
  ```
  Kontrol: `firebase --version`
- Proje klasörü: `musteritakip` (içinde `functions` klasörü olan).

---

# ADIM 3: Firebase Projesine Giriş ve Functions Deploy

1. **Tarayıcıda** [Firebase Console](https://console.firebase.google.com/) açın.
2. Müşteri Takip uygulamasının **projesini** seçin (veya yeni proje oluşturup bu uygulamayı bağlayın).
3. Sol menüden **Build → Functions** girin. (İlk kez kullanıyorsanız “Upgrade” / Blaze plana geçmeniz istenebilir; webhook için Blaze gerekir.)
4. **Bilgisayarda** terminal (PowerShell veya CMD) açın.
5. Proje klasörüne gidin:
   ```bash
   cd c:\Users\kocm9\OneDrive\Desktop\musteritakip
   ```
6. Firebase’e giriş (henüz giriş yapmadıysanız):
   ```bash
   firebase login
   ```
   Tarayıcı açılır; Google hesabınızla giriş yapın.
7. Bu klasörün hangi Firebase projesine bağlı olduğunu kontrol edin:
   ```bash
   firebase use
   ```
   Farklı proje kullanacaksanız:
   ```bash
   firebase use PROJE_ID
   ```
   (Proje ID’yi Firebase Console → Proje ayarlarından görebilirsiniz.)
8. **Functions’ı deploy edin:**
   ```bash
   cd functions
   npm install
   cd ..
   firebase deploy --only functions
   ```
9. Deploy bitince çıktıda şuna benzer satırlar görürsünüz:
   ```text
   ✔  functions[telegramWebhook(us-central1)]: Successful create or update.
   ```
   **telegramWebhook** satırını not alın; fonksiyon yayında demektir.

Bu adımla webhook’un çalışacağı **sunucu (Cloud Function)** hazır.

---

# ADIM 4: Bot Token’ı Firebase’e Verme (Ortam Değişkeni)

Webhook kodu, bot’un kimliği için **TELEGRAM_WEBHOOK_BOT_TOKEN** değişkenini kullanır. Bunu Firebase’e tanıtmanız gerekir.

## Yöntem A: Firebase Console (kolay)

1. [Firebase Console](https://console.firebase.google.com/) → projeniz → **Build → Functions**.
2. **telegramWebhook** fonksiyonuna tıklayın.
3. Üstte **Configuration** / **Ayarlar** sekmesine gidin (veya “Environment variables” / “Ortam değişkenleri” bölümünü bulun).
4. **Environment variables** kısmında **Add variable** / **Değişken ekle** deyin.
5. **Name:** `TELEGRAM_WEBHOOK_BOT_TOKEN`  
   **Value:** Adım 1’de kopyaladığınız bot token (örn. `7123456789:AAHxxx...`).
6. Kaydedin. **Önemli:** Değişkeni ekledikten sonra fonksiyonu **yeniden deploy** etmeniz gerekebilir:
   ```bash
   firebase deploy --only functions:telegramWebhook
   ```

## Yöntem B: Firebase CLI ile

1. Proje kökünde (musteritakip içinde) `.env` veya Firebase’in beklediği yapıda bir dosya kullanıyorsanız, dokümantasyona göre token’ı orada tanımlayabilirsiniz.  
2. Ya da yine **Firebase Console → Functions → telegramWebhook → Environment variables** üzerinden ekleyip kaydedin.

Token’ı doğru yazdığınızdan emin olun; başında/sonunda boşluk olmamalı.

---

# ADIM 5: Webhook URL’yi Bulma

Telegram’a “mesajları nereye göndereyim?” demek için **tam webhook URL**’ye ihtiyacınız var.

## 5a) Firebase Console’dan (en net yöntem)

1. **Firebase Console** → **Build → Functions**.
2. **telegramWebhook** satırına tıklayın.
3. Sayfada **Trigger** / tetikleyici bilgisi görünür. **URL** kısmında şuna benzer bir adres olur:
   ```text
   https://us-central1-PROJE_ID.cloudfunctions.net/telegramWebhook
   ```
   veya (2. nesil Cloud Run formatında):
   ```text
   https://telegramwebhook-xxxxx-xx.a.run.app
   ```
4. Bu **tam URL’yi** kopyalayın. Sonunda `/` olmasın, tek satır olsun.  
   Örnek: `https://us-central1-musteritakip-12345.cloudfunctions.net/telegramWebhook`

## 5b) Proje ID’yi biliyorsanız (tahmini URL)

Varsayılan bölge **us-central1** ise URL genelde şöyledir:

```text
https://us-central1-PROJE_ID.cloudfunctions.net/telegramWebhook
```

`PROJE_ID` yerine Firebase proje ID’nizi yazın (Console → Dişli → Proje ayarları).

**Önemli:** URL mutlaka **https** olmalı. Telegram **http** kabul etmez.

---

# ADIM 6: Telegram’a Webhook’u Söyleme (setWebhook)

Telegram’a “Bu bot’a gelen mesajları şu adrese POST et” demek için tek bir istek atmanız yeterli.

## 6a) Tarayıcıdan (en pratik)

Aşağıdaki adresi **kendi bilgilerinizle** doldurup tarayıcı adres çubuğuna yapıştırın:

```text
https://api.telegram.org/bot BOT_TOKEN /setWebhook?url= WEBHOOK_URL
```

- **BOT_TOKEN:** Adım 1’deki token (örn. `7123456789:AAHxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`).
- **WEBHOOK_URL:** Adım 5’te kopyaladığınız tam URL (örn. `https://us-central1-musteritakip-12345.cloudfunctions.net/telegramWebhook`).

**Örnek (gerçek değil, kendi değerlerinizi yazın):**

```text
https://api.telegram.org/bot7123456789:AAHxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx/setWebhook?url=https://us-central1-musteritakip-12345.cloudfunctions.net/telegramWebhook
```

Dikkat:

- `bot` ile token arasında **tek boşluk yok**, doğrudan token yazılır: `bot7123456789:AAH...`
- `url=` sonrası **tek parça**; boşluk olmamalı. URL’de özel karakter varsa (genelde yok) kodlanmış (encode) olmalı.

Tarayıcıda açınca Telegram’dan bir **JSON** cevabı görürsünüz. Örnek:

```json
{"ok":true,"result":true,"description":"Webhook was set"}
```

`"ok":true` ve `"result":true` ise webhook **ayarlanmış** demektir.

## 6b) PowerShell’den (Windows)

Token ve URL’i değişkene alıp çağırabilirsiniz (kendi değerlerinizi yazın):

```powershell
$token = "7123456789:AAHxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
$webhookUrl = "https://us-central1-PROJE_ID.cloudfunctions.net/telegramWebhook"
Invoke-RestMethod -Uri "https://api.telegram.org/bot$token/setWebhook?url=$webhookUrl"
```

Yine `"ok":true` dönmeli.

## 6c) Webhook’u kaldırmak (gerekirse)

Polling’e geri dönmek isterseniz:

```text
https://api.telegram.org/bot BOT_TOKEN /deleteWebhook
```

Tarayıcıda açmanız yeterli.

---

# ADIM 7: Uygulama Ayarlarında Chat ID ve Webhook Modu

Webhook artık “sunucuda” çalışıyor; sizin hesabınızın bot ile eşleşmesi için **Chat ID** ve **Webhook modu** gerekiyor.

1. **Uygulamanızı** açın (tarayıcıda `http://localhost:3000` veya yayındaki adres).
2. **Giriş yapın** (Telegram’da kullanacağınız hesap ile).
3. **Ayarlar** (dişli ikonu) → **Telegram Bot Yönetimi** bölümüne gidin.
4. **Bot Token:** Webhook’ta kullandığınız **aynı** bot’un token’ını buraya yapıştırın (Adım 1’deki token).
5. **Chat ID’yi almak:**
   - Telegram’ı açın, **kendi oluşturduğunuz bota** gidin (BotFather’dan aldığınız bot).
   - Bota şunu yazın: **/id**
   - Bot size bir sayı verecek (örn. `123456789`). Bu sizin **Chat ID**’niz.
6. Bu sayıyı kopyalayıp uygulama ayarlarındaki **Chat ID** kutusuna yapıştırın. Birden fazla yere bildirim istiyorsanız virgülle ayırarak yazabilirsiniz (örn. `123456789, -1001234567890`).
7. **Bot Aktif** kutusunu **açın** (yeşil).
8. **Webhook modu** kutusunu **açın**. Açıklama: “Uygulama kapalıyken /start, /ekle, /tamamla vb. yanıtlanır”.
9. Ayarları **kaydedin** (sayfadan çıkmadan önce değişikliklerin yazıldığından emin olun).

Bu adımlarla “bu Chat ID = bu kullanıcı” eşleşmesi Firestore’a yazılır; webhook gelen her mesajda bu Chat ID’ye göre kullanıcıyı bulup cevabı o hesaba gönderir.

---

# ADIM 8: Test Etme

1. **Tarayıcıdaki uygulama sekmesini kapatın** veya bilgisayarı kapatın; sadece Telegram’ı açık bırakın.
2. Telegram’da **bota** gidin.
3. Şunları deneyin:
   - **/start** → Ana menü ve butonlar gelmeli.
   - **/id** → Sizin Chat ID’niz yazmalı.
   - **/randevular** → Bekleyen randevular (veya “liste boş”) gelmeli.
4. Yanıt geliyorsa **webhook çalışıyor** demektir; uygulama kapalıyken de komutlar sunucuda işleniyor.

---

# Sık Karşılaşılan Sorunlar

## “Yetkisiz erişim” / “Chat ID kaydedin”

- Webhook çalışıyor ama **Chat ID** uygulama ayarlarında **kayıtlı değil** veya yanlış.
- Çözüm: Bota **/id** yazıp gelen sayıyı ayarlardaki **Chat ID** alanına aynen yapıştırın, **Bot Aktif** ve **Webhook modu** açık olsun, kaydedin.

## Bot hiç yanıt vermiyor

- **setWebhook** cevabında `"ok":true` gördünüz mü? Kontrol:  
  `https://api.telegram.org/bot BOT_TOKEN /getWebhookInfo`  
  Burada `"url":"https://..."` sizin fonksiyon URL’niz olmalı.
- Firebase Console → **Functions → telegramWebhook → Logs** kısmına bakın. Hata varsa (ör. 500, timeout) log’da görünür.
- **TELEGRAM_WEBHOOK_BOT_TOKEN** doğru ve güncel mi? Console’da ortam değişkenini kontrol edin; değiştirdiyseniz fonksiyonu tekrar deploy edin.

## Webhook URL 404 / 403 veriyor

- URL’yi tekrar kontrol edin: sonunda eğik çizgi veya ek kelime olmamalı.
- Sadece **telegramWebhook** fonksiyonunun URL’si kullanılmalı; başka fonksiyon adı kullanmayın.
- Firebase projesi **Blaze** planında mı kontrol edin; yoksa Cloud Functions çalışmayabilir.

## Yanıt gecikmeli veya bazen gelmiyor

- İlk istekte Cloud Function “soğuk başlangıç” yapabilir; 5–10 saniye sürebilir.
- Firebase / Google tarafında geçici bir kesinti olabilir; bir süre sonra tekrar deneyin.

---

# Özet kontrol listesi

- [ ] Telegram’da bot oluşturuldu, token alındı ve güvenli yerde saklandı.
- [ ] `firebase deploy --only functions` çalıştırıldı, **telegramWebhook** başarıyla deploy edildi.
- [ ] Firebase’de **TELEGRAM_WEBHOOK_BOT_TOKEN** ortam değişkeni bu bot’un token’ı olarak ayarlandı.
- [ ] **telegramWebhook** fonksiyonunun tam **https** URL’si kopyalandı.
- [ ] `https://api.telegram.org/botTOKEN/setWebhook?url=URL` çağrıldı ve cevapta `"ok":true` görüldü.
- [ ] Uygulama ayarlarında aynı **Bot Token**, **Chat ID** (bota /id yazarak alınan) girildi; **Bot Aktif** ve **Webhook modu** açıldı.
- [ ] Uygulama kapalıyken bota **/start** veya **/randevular** gönderilerek test edildi, yanıt alındı.

Bu adımlar tamamsa, webhook kurulumu tamamlanmış demektir; uygulama kapalıyken de Telegram komutlarına yanıt alırsınız.
