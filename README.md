# Online 101 Okey & Batak

Dört kişilik, gerçek zamanlı, sunucu otoriteli iki oyun: **101 Okey** ve **ihaleli Batak** (tekli ve eşli). Web uygulaması olarak çalışır; telefondan tarayıcıyla açılır (dikey ve yatay ekran desteklenir, ana ekrana eklenebilir).

Ürün ve kural gereksinimleri: [docs/okey101-spesifikasyon.md](docs/okey101-spesifikasyon.md), [docs/batak-spesifikasyon.md](docs/batak-spesifikasyon.md)

Ana ekran 101 Okey'dir; **"Batak oyna"** ile Batak ana ekranına, oradan **"101 Okey'e dön"** ile geri geçilir (seçim cihazda hatırlanır). Giriş, lobi, davet kodu, bekleme odası, botlar, zaman aşımı ve yeniden bağlanma iki oyunda ortaktır.

## Hızlı başlangıç

```bash
npm install
npm run dev
```

- Bilgisayardan: http://localhost:5173
- **Telefondan:** bilgisayarla aynı Wi‑Fi ağındayken terminalde Vite'ın yazdığı `Network:` adresini açın (örn. `http://192.168.1.20:5173`).
- Tek başınıza denemek için lobide **"Botlarla hemen oyna"** (yanındaki seçimle tekli veya eşli; eşli modda karşınızdaki bot eşinizdir).
- Arkadaşlarla: **Masa oluştur** → davet kodunu/bağlantısını paylaşın → boş koltukları isterseniz botla doldurun → herkes hazır olunca başlatın.

Üretim derlemesi (tek port, sunucu web istemcisini de sunar):

```bash
npm run build
PORT=8080 npm start
```

Diğer komutlar: `npm test` (motor testleri), `npm run typecheck`.

## İnternette yayınlama

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/hknkybs/okey101)

Butona basıp Render hesabıyla giriş yapın; `render.yaml` tek bir web servisi kurar (`npm ci && npm run build`, ardından `npm start`, sağlık kontrolü `/health`). Ücretsiz planda servis 15 dk kullanılmazsa uyur, ilk açılış ~30–60 sn sürer ve uyuyunca süren maçlar silinir (durum bellek içinde).

Docker destekleyen başka bir platform (Fly.io, Railway vb.) için `Dockerfile` hazırdır; uygulama `PORT` (varsayılan 8080) üzerinden dinler.

## Görünüm temaları

Ana ekrandaki **Görünüm** seçimiyle **Klasik** (yeşil çuha) ve **8-bit** arasında geçilir; seçim cihazda hatırlanır. 8-bit tema yalnız görünümü değiştirir: Sweetie-16 paleti (kırmızı, yeşil, mavi ağırlıklı), keskin köşeler, piksel çerçeveli taş ve kartlar, basınca inen "arcade" butonlar. Piksel yazı tipi Press Start 2P uygulamaya gömülüdür (Türkçe harfleri içerir, SIL OFL lisanslı — `src/web/public/fonts/LICENSE.txt`); uzun metinler okunaklı kalsın diye normal yazı tipiyle gösterilir. Tema stilleri `src/web/theme-pixel.css` dosyasındadır ve yalnız `<html data-theme="pixel">` iken etkindir.

## Mimari

```
src/
  engine/   Saf, deterministik oyun motoru (sunucu ve istemci ortak kullanır)
    types.ts    Taş, per, komut, durum tipleri
    rules.ts    Kural profili (varsayılanlar §2/§17) ve masa seçenekleri
    tiles.ts    106 taşlık set, karıştırma, gösterge → okey
    melds.ts    Seri / grup / çift / işleme doğrulayıcıları
    game.ts     Dağıtım, durum makinesi, applyCommand, skor, zaman aşımı, oyuncuya özel görünüm
    bot.ts      Boş koltuk ve devralma için bot
    errors.ts   Kodlu hatalar + Türkçe mesajlar
  batak/    Saf, deterministik Batak motoru
    types.ts    Kart, ihale, el (trick), komut, durum tipleri
    rules.ts    Kural profili (tekli/eşli varsayılanları, varyantlar) ve masa seçenekleri
    cards.ts    52 kartlık deste, karıştırma, etiketler, el sıralama
    game.ts     Dağıtım, ihale, koz, oynanabilir kartlar, el kazananı, puan, zaman aşımı, görünüm
    bot.ts      Normal (el tahmini, patron kart takibi, eş farkındalığı) ve Kolay bot
  server/   Node + ws; bellek içi modüler monolit
    adapters.ts Oyun modülleri: maç yöneticisi oyundan bağımsız, her oyun bir adaptörle bağlanır
    index.ts    HTTP (statik dosya + /health) ve WebSocket (/ws), origin kontrolü, hız limiti, heartbeat
    hub.ts      Misafir kimliği (token SHA‑256 ile saklanır), lobi, davet kodu, hızlı eşleşme
    room.ts     Maç başına tekil yazma otoritesi: sıra, idempotency, sürüm kontrolü, zamanlayıcı, bot
  shared/protocol.ts  İstemci ↔ sunucu mesaj sözleşmesi
  web/      React + Vite istemci (mobil öncelikli)
tests/engine.test.ts  101 kabul testleri (§15 birim/özellik)
tests/batak.test.ts   Batak kabul testleri (§14.1)
tests/rack.test.ts    Istaka dizme testleri
```

**Otorite:** Karıştırma (`crypto.randomInt`), dağıtım, sıra, doğrulama ve skor yalnız sunucuda. İstemci yalnız komut önerir; aynı motor fonksiyonlarını sadece önizleme (açılış toplamı, işlenebilir perlerin vurgulanması) için kullanır.

**Gizlilik:** Her oyuncuya kişiye özel görünüm gider: yalnız kendi eli, rakiplerin taş sayısı ve açık bilgiler. Stok sırası ve rakip elleri hiçbir mesajda bulunmaz (el bitince sonuç ekranında eller açılır).

**Komutlar:** `draw_stock`, `take_discard` (açmamış oyuncu için açılışla birlikte atomik), `open_melds`, `open_pairs`, `layoff`, `swap_joker`, `discard`. Her komut `commandId` (idempotency) ve `expectedVersion` taşır; eski sürümde `STALE_STATE` + güncel snapshot döner. Geçersiz komut durumu değiştirmez.

## 101 Okey kural profili (varsayılan)

| Konu | Değer |
|---|---|
| Dağıtım | 106 taş; başlayan 22, diğerleri 21; gösterge normal taş; 20 taş deste |
| Okey | Göstergenin aynı renkte bir üstü (13 → 1); sahte okey okeyin değerinde doğal taş |
| Açılış | Perler toplamı ≥ 101 veya ≥ 5 çift (masa ayarıyla kapatılabilir) |
| Seri | Aynı renk ardışık ≥ 3; 12‑13‑1 geçersiz |
| Yandan alma | Açmamış oyuncu aldığı taşla o hamlede açmak zorunda ("Al ve Aç") |
| Açtıktan sonra | Yeni per indirme serbest (baraj yok); tüm açık perlere işleme (ayar: sadece kendi perine) |
| Çift açan | Yeni çift indirebilir, seri/gruplara işleyebilir, çiftlere işleyemez |
| Okeyi masadan alma | Açmış oyuncu, açık perdeki gerçek okeyin yerine temsil ettiği taşı koyup okeyi eline alır (seride tam o renk/sayı; grupta perde olmayan herhangi bir renk). Varsayılan: alınan okey elde tutulabilir. Ayar **"Masadan alınan okey aynı tur kullanılmalı"** açıksa okey o tur işlenmeden ya da yeni perde kullanılmadan taş atılamaz (koyacak per yoksa tur kilitlenmez; zaman aşımında okey otomatik işlenir). Kural masa ayarıyla tamamen kapatılabilir |
| Bitiş | Son taşı atarak; bitiren −101, açan elde kalan toplamı (+101/okey), açmayan +202 |
| Çarpanlar | Okeyle bitiş ×2, çiftten bitiş ×2, birlikte ×4 |
| Deste biterse | El kapanır, bitiren yok (açan elde kalan, açmayan 202) |
| Süre | Hamle başına 60 sn (15, 20, 30, 45, 60, 90, 120); süre dolunca otomatik çek + en düşük taşı at; 3 ardışık zaman aşımında bot devralır ("Kontrolü al" ile geri alınır) |
| Kopma | 30 sn pencere; sonra koltuğu bot oynar, geri bağlanınca kontrol oyuncuya döner |
| Maç | 10 el (1–11); düşük toplam ceza kazanır, eşitlikte galibiyet sayısı |
| Eşli oyun (ayar) | Karşılıklı oturanlar takım (1–3 ve 2–4. koltuk); takım puanı iki oyuncunun toplamı, bireysel puanlar da gösterilir. Varsayılan: bitirenin eşi ceza almaz (ayarla kapatılabilir). "Sadece kendi perine işleme" eşli oyunda eşin perlerini de kapsar. Sıralama takım toplamına göre |

## Batak kural profili (varsayılan)

| Konu | Değer |
|---|---|
| Deste | 52 kart, joker yok; 13'er kart; ihale dağıtıcının solundan başlar, oyun saat yönünde |
| İhale | Tekli en az 5, eşli en az 8 (masa ayarı: 4–5 / 7–8); artış 1; pas geçen tekrar teklif veremez; 13 ihaleyi hemen kapatır |
| Herkes pas | Son oyuncu en az minimum teklifle ihaleyi almak zorunda (ayar: yeniden dağıt) |
| Koz | İhaleci seçer, ilk eli o açar; koz açılmadan kozla çıkılamaz (elde yalnız koz kaldıysa serbest) |
| Renk kalmadı ipucu (ayar, varsayılan kapalı) | Açılırsa renge uymayan oyuncunun kartında "♥ yok" rozeti çıkar; kapalıyken bu bilgi istemciye gönderilmez, oyuncular kendisi takip eder |
| Açık eş (eşli, ayar — varsayılan açık) | Koz seçilince ihalecinin eşi kartlarını açar, herkes görür; eşin sırası gelince o eli ihaleci oynar, eş yalnız izler ("el açma"; bkz. [Joker Games eşli ihaleli batak kuralları](https://joker.games/support-center/esli-ihaleli-batak-oyun-kurallari/)) |
| Oyun | Renge uymak zorunlu; renk yoksa koz atmak zorunlu, koz da yoksa istenen kart (ayar: kapatılabilir); yükseltme zorunluluğu yok (ayar: eli geçebiliyorsan geç — geçen herhangi bir kart) |
| Tekli puan | İhaleci tutarsa +ihale×10, batarsa −ihale×10; diğerleri aldıkları el×10; fazla ele bonus yok |
| Eşli puan | İhaleci takım (iki eşin toplam eli) tutarsa +ihale×10, batarsa −ihale×10; rakip takıma puan yok |
| En az el (ayar, varsayılan kapalı) | 1–4 seçilir. Eşli: rakip takım toplamda bu kadar el alamazsa −ihale×10. Tekli: ihaleye girmeyen her oyuncu bu kadar el alamazsa −ihale×10 |
| Maç | 10 dağıtım (1–11); yüksek puan kazanır, eşitlik beraberlik |
| Süre | Kart 60 sn (15–120 arası seçilir), ihale/koz bunun yarısı, en az 20 sn; zaman aşımında pas (zorunluysa minimum teklif), en uzun renk koz, en küçük oynanabilir kart; 3 ardışık zaman aşımında bot devralır |

Batak botu Normal seviyede elini ve koz adaylarını el tahminiyle değerlendirir, oynanmış kartları takip ederek "patron" kartları bilir, eşli oyunda eşinin teklifini ve eşi eli alıyorken kart harcamamayı hesaba katar. Ölçümde (5 dağıtımlık 300'er maç) Normal, Kolay'ı tekli maçların %82'sinde, eşli maçların %91'inde yendi.

## 101 Okey botu

Botlar yalnız herkesin gördüğü bilgiyi kullanır (eşinin veya rakiplerin elini görmez).

- **Açılış:** sınırlı aramayla en yüksek toplamlı ayrık per kümesini bulur; 101'e ulaşınca açar, yetmezse 5 çift dener.
- **Atış:** her serbest taş puanlanır. Açmamışken yüksek taşlar 101 için tutulur, düşük ve per olma ihtimali olmayan taş atılır; açtıktan sonra ceza büyütmesin diye yüksek taşlar elden çıkarılır.
- **Savunma:** atılan taşı yalnız sıradaki oyuncu alabilir (eşli oyunda o hep rakiptir); bot onun işleyebileceği taşı atmaz, rakip bitmeye yaklaştıkça bu daha sıkı uygulanır.
- **Eşli oyun:** önce kendi/eşinin perlerine işler; eşi bitmeye yakınsa ve bitirenin eşi ceza almıyorsa güvenli atışa öncelik verir; rakip bitmeye yakınsa yüksek taşları elden çıkarır.
- Masadaki okeyi uygun taşla her zaman alır, okeyi elde tutar.
- **Seviye:** her bot koltuğu için ayrı seçilir. Hızlı oyunda ve masa oluştururken seçilen seviye eklenecek botların varsayılanıdır; bekleme odasında masa sahibi her botun kartından ayrı ayrı ya da "Tüm botlar" ile hepsini birden değiştirebilir. **Normal** yukarıdaki mantıkla, **Kolay** eski basit mantıkla oynar: açmamışken bile en yüksek taşı atar ve sıradaki rakibe taş verip vermediğine bakmaz (açılış, işleme ve okey alma aynıdır). Zaman aşımı veya kopma nedeniyle bir insanın yerine geçici oynayan bot her zaman Normal seviyededir.

Ölçüm (5 ellik maçlar, taraflar dönüşümlü, önceki basit bota karşı): eşli oyunda maçların %66'sı (sadece kendi perine işleme ayarında %70), tekli oyunda %66'sı kazanıldı. Kazancın büyük kısmı açılışa göre taş tutmaktan geliyor; eşli oyuna özgü kurallar tek başına küçük bir fark yaratıyor (~%54, istatistiksel olarak sınırda).

## Bilinçli basitleştirmeler / sonraki adımlar

- **Kalıcılık yok:** Tüm durum bellek içinde; sunucu yeniden başlarsa maçlar ve misafir oturumları sıfırlanır (geliştirmede dosya kaydedince `tsx watch` sunucuyu yeniden başlatır). Spesifikasyon §10 şeması için PostgreSQL + event log sonraki faz.
- **Olay akışı:** Her değişiklikte kişiye özel tam snapshot gönderiliyor; `lastEventSeq` ile event replay henüz yok.
- **Deste bitişi:** Spesifikasyon §5.3'teki "son ıskartayı alma hakkı" yerine, çekilecek taş kalmayınca el doğrudan kapanır.
- 12‑13‑1 varyantı, sohbet, hesap/şifreli giriş ve istatistik henüz yok.
- **Mobil sürükle‑bırak:** Dokunmatikte dokun‑seç / dokun‑hedef kullanılır; sürükle‑bırak masaüstünde çalışır.
