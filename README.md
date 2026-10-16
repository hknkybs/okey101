# Online 101 Okey

Dört kişilik, gerçek zamanlı, sunucu otoriteli 101 Okey. Web uygulaması olarak çalışır; telefondan tarayıcıyla açılır (dikey ve yatay ekran desteklenir, ana ekrana eklenebilir).

Ürün ve kural gereksinimleri: [docs/spesifikasyon.md](docs/spesifikasyon.md)

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
  server/   Node + ws; bellek içi modüler monolit
    index.ts    HTTP (statik dosya + /health) ve WebSocket (/ws), origin kontrolü, hız limiti, heartbeat
    hub.ts      Misafir kimliği (token SHA‑256 ile saklanır), lobi, davet kodu, hızlı eşleşme
    room.ts     Maç başına tekil yazma otoritesi: sıra, idempotency, sürüm kontrolü, zamanlayıcı, bot
  shared/protocol.ts  İstemci ↔ sunucu mesaj sözleşmesi
  web/      React + Vite istemci (mobil öncelikli)
tests/engine.test.ts  Kabul testleri (§15 birim/özellik)
```

**Otorite:** Karıştırma (`crypto.randomInt`), dağıtım, sıra, doğrulama ve skor yalnız sunucuda. İstemci yalnız komut önerir; aynı motor fonksiyonlarını sadece önizleme (açılış toplamı, işlenebilir perlerin vurgulanması) için kullanır.

**Gizlilik:** Her oyuncuya kişiye özel görünüm gider: yalnız kendi eli, rakiplerin taş sayısı ve açık bilgiler. Stok sırası ve rakip elleri hiçbir mesajda bulunmaz (el bitince sonuç ekranında eller açılır).

**Komutlar:** `draw_stock`, `take_discard` (açmamış oyuncu için açılışla birlikte atomik), `open_melds`, `open_pairs`, `layoff`, `swap_joker`, `discard`. Her komut `commandId` (idempotency) ve `expectedVersion` taşır; eski sürümde `STALE_STATE` + güncel snapshot döner. Geçersiz komut durumu değiştirmez.

## Uygulanan kural profili (varsayılan)

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
| Süre | Hamle başına 30 sn (15–60); süre dolunca otomatik çek + en düşük taşı at; 3 ardışık zaman aşımında bot devralır ("Kontrolü al" ile geri alınır) |
| Kopma | 30 sn pencere; sonra koltuğu bot oynar, geri bağlanınca kontrol oyuncuya döner |
| Maç | 10 el (1–11); düşük toplam ceza kazanır, eşitlikte galibiyet sayısı |
| Eşli oyun (ayar) | Karşılıklı oturanlar takım (1–3 ve 2–4. koltuk); takım puanı iki oyuncunun toplamı, bireysel puanlar da gösterilir. Varsayılan: bitirenin eşi ceza almaz (ayarla kapatılabilir). "Sadece kendi perine işleme" eşli oyunda eşin perlerini de kapsar. Sıralama takım toplamına göre |

## Bot

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
