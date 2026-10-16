# Online 101 Okey — Ana Ürün ve Teknik Spesifikasyonu

**Sürüm:** 1.0  
**Durum:** Uygulamaya başlanabilir ürün gereksinimi  
**Dil:** Türkçe  
**Hedef:** Bu belgeyi kullanan bir ekip; kuralları, çevrimiçi oyun akışını, servisleri ve arayüzü başka bir ürün tanımına ihtiyaç duymadan uçtan uca geliştirebilmelidir.

> **Kural kesinliği:** 101 Okey'in tek bir resmî ve tüm masalarda bağlayıcı kural seti yoktur. Taş, per, 101 açma ve tur akışı geniş ölçüde ortaktır; çift açma, puan katsayıları, gösterge bonusu, yanlış bitiş, el bitince ceza ve benzeri ayrıntılar platform/masa kuralıdır. Bu belgede **Ortak** olarak işaretlenenler yaygın çekirdektir. **Varsayılan** bir ilk sürüm önerisidir; masa başlamadan önce sabitlenebilir. **Varyant** seçenek olarak sunulmalıdır. Tur başladıktan sonra kural profili değiştirilemez.

## 1. Ürün kapsamı ve sözlük

Oyun dört kişilik, sıralı, gerçek zamanlı bir taş oyunudur. Oyuncular taş çekerek veya önceki oyuncunun attığı taşı alarak per kurar; normal açılışta masaya açılan perlerin toplamı en az 101 olmalıdır. Açtıktan sonra masadaki uygun perlere taş işlenebilir. Elindeki taşları bitiren oyuncu eli kazanır. Maç birden çok elden oluşabilir; toplam ceza puanı düşük olan kazanır.

- **Taş:** Fiziksel kopyasıyla benzersiz kimlik taşıyan oyun nesnesi.
- **Per:** En az üç taştan oluşan geçerli seri veya grup.
- **Seri:** Aynı renkte artan ardışık sayılar.
- **Grup:** Aynı sayıdan, farklı renklerde üç veya dört taş.
- **Gösterge:** O elin gerçek okey taşını belirleyen açık taş.
- **Gerçek okey:** Göstergenin aynı rengindeki bir sonraki sayı; 13'ten sonra 1 gelir.
- **Sahte okey:** Görseli joker olan, fakat o elde gerçek okeyin temsil ettiği sayı ve renk değerinde davranan taş. Kendi başına her taş yerine geçmez.
- **Açmak:** Normal perleri (101 barajıyla) veya çift açma kuralıyla masaya indirmek.
- **İşlemek:** Açılmış bir oyuncunun masadaki kendi veya başkasının açık perine uygun taş eklemesi.
- **Yandan taş:** Önceki oyuncunun attığı açık ıskarta.
- **Elden bitmek:** Önceden açmadan, tek hamlede geçerli açılış yapıp son taşı atarak bitmek. Varyanttır.

## 2. Kural profili

Her masa `ruleset` sürüm numarasıyla saklanır. Önerilen başlangıç profili:

| Ayar | Varsayılan | Varyantlar / açıklama |
|---|---|---|
| Oyuncu sayısı | 4 | İlk sürümde 4 sabit; 2/3 kişilik masa ayrı özellik |
| Taş seti | 106 | 4 renk × 1–13 × iki kopya + 2 sahte okey |
| Dağıtım | 21 taş; başlayan oyuncu 22 | Yaygın standart |
| İlk oyuncu | Dağıtıcıdan sonraki koltuk | Koltuk yönü sabit; UI'da saat yönü gösterilebilir |
| Normal açılış | En az 101 | Bazı masalarda katlamalı baraj; konfigüre edilir |
| Çift açma | En az 5 çift | Yaygın uygulama; bazı masalar 6 çift veya farklı açılma/işleme şartı kullanır |
| Seri 12-13-1 | Kapalı | Yaygın kuralda çevrim yoktur; seçenek olarak açılabilir |
| Sahte okey | Gerçek okeyin temsil ettiği normal taş | Herhangi bir taş yerine geçen joker değildir |
| Yandan taş alma | Alınan taşla o tur açmak zorunlu | Alınan taş açılışta kullanılmalı; açamıyorsa hamle reddedilir. Bazı masalar farklı uygular |
| Açılış şekli | Açılış perleri aynı hamlede topluca sunulur | İstemci önizler; sunucu atomik doğrular |
| Açtıktan sonra işleme | Kendi ve diğer oyuncuların açık perlerine işleyebilir | Bazı masalarda yalnızca kendi perine işleme seçeneği |
| Tur sonu eli | Son taş atılınca biter | Taş havuzu bitince el kapanır; puanlama ayrıca ayarlanır |
| Açmayan oyuncu cezası | 202 | Yaygın seçeneklerden biri; ıskarta cezası ayrı eklenebilir |
| Açan oyuncu cezası | Elde kalan taşların sayı toplamı | Gerçek okey elde kalırsa ek ceza açarı uygulanabilir |
| Bitiren | -101 | Yaygın platform seçeneği; puanlama profiline bağlı |
| Okeyle bitiş | Herkese ait el sonu cezası ×2 | Yaygın, fakat zorunlu değil |
| Çiftten bitiş | Herkese ait ceza ×2 | Varyant; okeyle çarpanla birleşimi ayarlanır |
| Gösterge bonusu | Kapalı | İlk turda gösterge taşını elde tutup gösterme gibi platform özelidir |
| Yanlış bitiş/açış | Hamle reddedilir; ceza yok | Alternatif: sabit ceza / açılmış taşları geri alma. Varsayılan geri alınamaz yan etkisiz reddir |
| Maç uzunluğu | 10 el | 5/7/11 el veya hedef ceza sınırı seçilebilir |
| Eşli oyun | Kapalı | Eşler karşılıklı oturur; takım puanı iki oyuncunun toplamıdır |
| Süre | Hamle başına 30 sn | 15–60 sn; otomatik hamle profili ayrıca seçilir |
| Bağlantı kopması | 30 sn yeniden bağlanma penceresi | Masa ayarı; sonra bot/boş koltuk davranışı belirlenir |

Bu ayarlar masa kurucusuna JSON olarak gösterilmek zorunda değildir; anlaşılır etiketler sunulur, fakat sunucuda aşağıdaki kanonik anahtarlar kullanılır. Her değişiklik lobi audit kaydına girer.

```json
{
  "rulesetVersion": 1,
  "opening": {"type":"points_or_pairs", "minPoints":101, "minPairs":5, "allow12_13_1":false, "requireDiscardAfterOpening":true},
  "discard": {"mustUseTakenDiscardToOpen":true, "penalizeUnusableDiscard":false},
  "joker": {"fakeIsIndicatorValue":true, "finishMultiplier":2, "heldPenalty":101},
  "scoring": {"unopenedPenalty":202, "winnerDelta":-101, "openedPenalty":"remaining_tile_values", "doubleOnOkeyFinish":true, "doubleOnPairFinish":true, "combineMultipliers":"multiply"},
  "round": {"emptyStock":"end_round", "emptyStockScoring":"opened_remaining_unopened_fixed", "maxTurnSeconds":30},
  "match": {"roundLimit":10, "teamMode":false},
  "reconnect": {"graceSeconds":30, "afterGrace":"auto_play_then_forfeit"}
}
```

## 3. Taş modeli ve kurallı değerler

Sette toplam 106 fiziksel taş vardır. Her taşın `tileId`'si benzersizdir; aynı renk/sayıdaki iki kopya ayrı kimlik taşır.

```text
Tile = { tileId, kind: NORMAL | FAKE_JOKER, color?: RED|YELLOW|BLUE|BLACK, number?: 1..13 }
```

`NORMAL` taşların sayısal yüz değeri 1–13'tür. `FAKE_JOKER` için renk/sayı tutulmaz; okey belirlendikten sonra `effectiveValue` hesaplanır. Gösterge normal taş olmak zorundadır; gösterge çekiminde sahte okey çıkarsa, üründeki varsayılan yöntem: onu destenin içine geri koyup göstergeyi tekrar çekmek. Alternatif olarak gösterge çekimi set-up sırasında ayrılmış normal taştan yapılabilir. Gösterge taşının kendisi oyuna geri konmaz ve oyuncuya dağıtılmaz.

Gösterge `c:n` ise gerçek okey `c:(n % 13 + 1)` olur. Göstergenin 13 olması aynı renkte 1'i okey yapar. İki fiziksel kopya da gerçek okeydir. Sahte okey, gerçek okeyin temsil ettiği `color/number` değerinde doğal taş sayılır; per içinde fazladan joker gibi kullanılamaz. Gerçek okey bir per içinde eksik taşı temsil edebilir ve açılış hesabında temsil ettiği sayı değerini alır. Okeyin hangi taşı temsil ettiği per yerleşimine bağlı olduğundan istemci bunu açıkça seçer, sunucu doğrular.

## 4. Per tanımı ve açılış

### 4.1 Seri

Aynı renkte, ardışık en az üç sayıdan oluşur. Varsayılan aralık 1–13 içinde düz artıştır; `12-13-1` geçersizdir. Örnek: Mavi 4-5-6 ve Siyah 10-11-12-13. Bir per içinde fiziksel aynı taş kopyası tekrar kullanılamaz. Gerçek okey eksik sayı yerine geçebilir; sahte okey, gerçek okeyin yüz değerinde doğal taş olarak kullanılabilir.

### 4.2 Grup

Aynı sayıdan, farklı renklerden 3 veya 4 taş. Aynı renkten iki kopya tek grupta kullanılamaz. Grupta en fazla bir renk başına bir taş olur. Örnek: kırmızı 8, mavi 8, siyah 8. Gerçek okey eksik renk/sayı kombinasyonunun yerine geçebilir. Dört doğal renk zaten mevcutsa fazladan okey eklenemez.

### 4.3 Normal açılış (101)

Oyuncu aynı hamlede bir veya daha fazla geçerli per açar. Perlerdeki taşların **etkin değerlerinin toplamı ≥ 101** olmalıdır. Birden fazla per açılıyorsa tüm perlerin değerleri toplanır; açılışta her fiziksel taş yalnızca bir kez kullanılır. Gerçek okey temsil ettiği sayının değeriyle sayılır; sahte okey kendi etkin doğal değeriyle sayılır. Açılışın sunucuya gönderilen her perinde jokerin temsil ettiği değer açıkça bulunmalıdır.

Örnek: Kırmızı 11-12-13 (36), iki farklı renkten 9-10-11 (30+30) ve 5-5-5 grubu (15) toplam 111; taşlar ve renk farklılığı geçerliyse açılabilir. UI açılış toplamını taş sürükleme sırasında canlı hesaplar; kesin karar sunucudadır.

### 4.4 Çift açma

Bir çift, aynı renk ve aynı sayıdan iki fiziksel taş demektir. Bir oyuncu varsayılan olarak en az 5 farklı çifti aynı hamlede açar. Çift açma 101 puan toplamı istemez ve normal per açılışı değildir. Gerçek okeyin çiftte kullanılması masa kuralına bağlıdır; varsayılan **kapalı** (çiftler iki eş doğal/yüz değeri aynı taş ister), varyant olarak okey çifti tamamlayabilir. Aynı fiziksel taş iki kez kullanılamaz. Çift açan oyuncunun daha sonra serilere taş işleyip işleyemeyeceği ve çiftlerine taş ekleyip ekleyemeyeceği kural anahtarı olmalıdır; varsayılan: açık seri/gruplara işleyebilir, çiftlere işleyemez. Çiftten bitiş, oyuncunun son taşını geçerli bitiş hareketiyle atmasıdır; bitiş çarpanı yalnızca masa ayarında açıksa uygulanır.

### 4.5 Açılışın atomikliği ve taş işleme

Açılış denemesi bir bütün olarak doğrulanır. Geçerli değilse hiçbir taş masaya taşınmaz. Açmış oyuncu, kendi turunda çektikten sonra ve turunu bitirmeden, taşını açık perin uç noktasına ekler. Seri için doğru komşu sayı; grup için eksik renk gerekir. Per sınırları ve jokerin temsil ettiği taş korunur. Oyuncu perini bölemez, taş silemez veya başka oyuncunun taşını değiştiremez. Açılmış taşlar tur içinde düzenlenebilir, ancak sunucuya gönderilen son düzenleme kurallı ve atomik olmalıdır.

- Normal açmış oyuncu yeni per açabilir; yeni per açma eşiği varsayılan olarak yine 101 değil, **tek tek geçerli per açmaya izin verilmez**, çünkü normalde 101 açma yalnız ilk açılışa uygulanır. Açtıktan sonra masaya yeni per koyma izin anahtarı `allowNewMeldAfterOpening` ile kontrol edilir; varsayılan açık, 101 eşiği aranmaz.
- Yandan alınan taşı açılışta kullanma şartı varsa alınan taş açılış perlerinden birinde yer almalıdır. Açmış oyuncu için yandan taş alımı serbestse bu koşul uygulanmaz; varsayılan koşul, ilk kez açacak oyuncuya yöneliktir.
- Taş işlemek için oyuncu açmış olmalı; çift açma durumu `canMeldAfterPairs` ile ayrıca kontrol edilir.

## 5. Dağıtım, gösterge ve tur

1. Sunucu 106 taşlık seti oluşturur ve güvenli rastgele karıştırır. Rastgelelik sunucu tarafında kriptografik kaynak kullanır; seed istemciye gösterilmez.
2. Başlayan oyuncu (dağıtıcıdan sonraki koltuk) 22, diğer üç oyuncu 21 taş alır. Toplam 85 taş dağıtılır.
3. Bir normal taş gösterge olarak ayrılır. Kalan 20 taş kapalı çekme destesidir. Başlangıç oyuncusu 22 taşla, çekmeden bir taş atarak başlar. Desteyi tüketen oyuncu çekemez; ıskartadan taş alabilir.
4. Oyun sırası tek yönlü sabittir. Her oyuncunun turu, başlangıç oyuncusunun ilk ıskartası hariç, **bir taş alma → opsiyonel açma/işleme → bir taş atma** aşamalarından oluşur.
5. Bir oyuncunun tur başı elinde normalde 21 taş bulunur (22 taşla başlayan ilk atış öncesi hariç). Çekimden sonra 22 olur; atıştan sonra 21'e döner. Açılışta masaya koyulan taşlar oyuncunun el sayısını azaltır; tur bitiminde bir taş atılır. Bitiş için son taş atışı zorunludur veya masa ayarı açıkça son taşı masaya işleme ile bitişe izin vermelidir.

### 5.1 Çekme / yandan alma

Sırası gelen oyuncu iki kaynaktan tam bir taş alır:

- Kapalı stoktan en üst taş; veya
- Önceki oyuncunun en son ıskartası (yandan taş).

Başka oyuncunun daha eski ıskartası alınamaz. Yandan taş almak, alınan fiziksel taşın sahipliğini oyuncuya geçirir. Zorunlu açış kullanım koşulu varsa açmamış oyuncu ya aynı aksiyonda geçerli açılışa dahil eder ya da sunucu reddeder. Ürün, yandan taş alınca oyuncunun açamamasını önceden tahmin ederek butonu kapatabilir; bu yalnız UX yardımıdır, otorite değildir.

### 5.2 Atış ve bitiş

Oyuncu elinden bir fiziksel taşı ıskartaya atar. Atış, turdaki son zorunlu aksiyondur. Atıştan sonra el boşsa oyuncu kazanır; yalnızca masaya taş işlemekle otomatik bitiş varsayılan olarak kapalıdır. Atılan taşın okey olup olmadığı bitiş sınıflandırmasına etki eder. Normal oynanışta oyuncu elinde taş varken okey atabilir; bunun cezası bir varyanttır. Taşını yanlışlıkla seçme ihtimaline karşı istemci onay/geri almayı yalnız sunucunun hamleyi henüz sıralamadığı kısa süre içinde destekleyebilir; varsayılan olarak sunucu onayından sonra geri alma yoktur.

### 5.3 Stok bittiğinde

Kapalı stok boşsa, sıradaki oyuncu yalnızca varsa son ıskartayı alabilir. Oyuncunun yasal çekim seçeneği kalmadığında el kapanır. Varsayılan puanlama: açanlar elde kalan taşlarının toplamını, açmayanlar sabit açmama cezasını alır; bitiren yoktur ve kazanan bonusu uygulanmaz. Alternatif profil: son ıskarta da alınamayınca eli puansız berabere kapat. Bu durum `emptyStockScoring` ile seçilir.

## 6. Oyun motoru: durum makinesi

```text
WAITING_FOR_PLAYERS
  → READY_CHECK
  → DEALING
  → ACTIVE_TURN (DRAW_REQUIRED | ACTIONS | DISCARD_REQUIRED)
  → ROUND_SETTLEMENT
  → NEXT_ROUND veya MATCH_SETTLEMENT
  → CLOSED
```

Tur alanı `phase`, `activeSeat`, `turnNumber`, `deadlineAt` içerir. Sadece sıra sahibi ve geçerli faz için izin verilen komut kabul edilir.

| Faz | İzinli aksiyon | Başarılı sonuç |
|---|---|---|
| `INITIAL_DISCARD` | Başlangıç 22 taşından birini at | Sonraki koltuğa `DRAW_REQUIRED` |
| `DRAW_REQUIRED` | `draw_stock` veya `take_discard` | `ACTIONS`; el 22 olur |
| `ACTIONS` | `open_melds`, `open_pairs`, `layoff`, isteğe bağlı `sort` istemci tarafında | `ACTIONS`; sunucu durumu sürüm artırır |
| `ACTIONS` | `discard` | El 21 olursa sonraki oyuncu `DRAW_REQUIRED`; el biterse settlement |
| Her faz | Geçerli `resign` / zaman aşımı | Profilde tanımlı bot/forfeit akışı |

Her hamle `commandId` (idempotency), `expectedVersion`, `matchId`, `roundId` ve ilgili tile ID'lerini taşır. Sunucu önce kimlik/koltuk/faz/sürüm kontrolü yapar, sonra komutu oyun motorunda saf ve deterministik doğrular; işlem ve event yazımı aynı transaction/tekil sıra içinde tamamlanır. Aynı `commandId` tekrar gelirse önceki yanıt döner. Eski `expectedVersion` için güncel snapshot ve `STALE_STATE` hatası verilir.

### 6.1 Önerilen doğrulama sırası

1. Kullanıcı oturumunun eşleştiği oyuncu ve maç koltuğu doğrulanır.
2. Maç aktif ve oyuncu sırası mı kontrol edilir.
3. Hamle doğru fazda mı, deadline aşılmış mı kontrol edilir.
4. İstemcinin bildirdiği her `tileId` o oyuncunun elinde mi; tekrar veya çakışma var mı kontrol edilir.
5. Perler etkin kuralla doğrulanır; 101/çift şartı ve yandan taş zorunluluğu uygulanır.
6. Durum tek atomik değişiklik olarak uygulanır; event sıra numarası artırılır, event log ve snapshot kaydedilir.
7. İlgili oyunculara ayrı görünürlük filtreleriyle olay yayınlanır.

### 6.2 Kural doğrulayıcı sözleşmesi

Motor en az şu fonksiyonları sağlar: `effectiveTile(tile, round)`, `validateRun(tiles, jokerAssignments, rules)`, `validateGroup(...)`, `validateMeld`, `validateOpening`, `validatePairs`, `validateLayoff`, `validateDiscard`, `calculateRoundScore`, `nextSeat`, `reduce(state, command)`. Aynı girdi daima aynı sonucu üretmelidir. Saat, RNG, DB veya WebSocket bu fonksiyonların içinde kullanılmaz; dış bağımlılıklar enjekte edilir.

## 7. Skor ve maç

Skor ceza puanı toplamı olarak tutulur; düşük skor iyidir. Her tur için oyuncu bazlı ham puan, çarpanlar ve nedenler saklanır; yalnız net toplam saklamak açıklanabilirlik için yetersizdir.

Varsayılan settlement örneği:

- Kazanan: `-101`.
- Açmış kaybeden: elde kalan normal taşların sayı toplamı; sahte okey, etkin değeriyle sayılır. Gerçek okey elde kaldıysa varsayılan ek `+101` (ayar ile kapatılır).
- Açmamış kaybeden: `+202` sabit ceza. `unopenedPenalty` seçeneği 202/101/elde kalan + sabit şeklinde belirlenebilir.
- Okeyle bitiş veya çiftten bitiş gibi katsayılar, kural profilindeki `combineMultipliers` uyarınca uygulanır. Varsayılan çarpma yöntemi: her oyuncunun o turdaki bütün net delta değerlerini çarpanla çarp.
- Takım modunda bireysel tur puanları takım hanesine toplanır; istatistiklerde bireysel dağılım da kalır.

Bu formüller evrensel kural değildir; lobi özetinde oyuncular tur başlamadan görebilmelidir. Maç sonunda önce toplam ceza, eşitse galibiyet sayısı, sonra daha az el kaybetme gibi sıralama ölçütleri seçilir; varsayılan eşitlik beraberliktir. Hedef puan sınırı kullanılıyorsa sınırı geçen maç sonu davranışı (hemen kapat / el tamamlanınca kapat) açıkça konfigüre edilir.

Skor kaydı örneği:

```json
{"seat":2,"baseDelta":35,"modifiers":[{"code":"OKEY_HELD","delta":101}],"multiplier":2,"finalDelta":272,"reason":"Açmış oyuncu; elde kalan taşlar + okey elde"}
```

## 8. Lobi, masa ve eşleştirme

### Ekranlar

1. **Giriş/kimlik:** misafir veya hesap; görünen ad, avatar; hesap güvenliği ve yaş/ülke gereklilikleri ürün politikasına göre.
2. **Ana lobi:** hızlı oyun, masa oluştur, özel davet, masa listesi, filtreler (hız, el sayısı, eşli/tekli, açılış tipi), bağlantı durumu.
3. **Masa bekleme odası:** dört koltuk, hazır durumu, masa kuralları özeti, sahibi/izinler, davet kodu, sohbeti susturma/şikâyet.
4. **Oyun masası:** kendi ıstakası, çekme destesi, gösterge ve okey bildirimi, ıskarta yığını, oyuncu koltukları ve durumları, kalan taş sayısı, sıra/süre göstergesi, açılmış perler, skor, eylem alanı.
5. **Tur sonucu:** kazanan, bitiş türü, per ve elde kalan taşlar, her oyuncunun puan hesabı, itiraz/yeniden oynatma için hamle özeti.
6. **Maç sonucu:** final sıralaması, tur dökümü, tekrar oyna, lobiye dön.
7. **Bağlantı/yeniden katıl:** kopma durumu ve yeniden bağlanma; oyun ekranı sunucudan snapshot ile yeniden kurulur.

Mobilde taşlar yatay kaydırmalı ve dokunma hedefleri erişilebilir olmalı; seçili taş, geçerli hedef ve joker ataması görünür. Sürükle-bırak yanında dokun-seç/dokun-hedef etkileşimi de sunulmalı. Animasyon asla oyun durumunun kaynağı değildir.

### Masa yaşam döngüsü

- Özel masa sahibi kural profilini belirler; davet link/kodu tahmin edilemez, süreli ve iptal edilebilir olmalıdır.
- Her oyuncu koltuk alır, hazır olur. Dört koltuk dolu ve hazır olduğunda kural özeti son kez gösterilir; oyunu sunucu başlatır.
- Hızlı eşleştirme yalnız uyumlu profil ve uygun bölge/ping havuzundaki oyuncuları eşler. Eşleştirme öncelikleri: bekleme süresi, bağlantı kalitesi, beceri puanı (üründe varsa), tekrar eşleşme önleme.
- Oyuncu lobi sırasında ayrılırsa koltuk boşalır. Oyun başladıktan sonra ayrılırsa koltuk rezerve kalır; grace süresince tekrar bağlanabilir.

## 9. Gerçek zamanlı mimari ve gizlilik

Önerilen bileşenler: Web/mobile istemcisi; kimlik servisi; lobby/matchmaking; stateless HTTP API; WebSocket gateway; maç başına tekil yazma otoritesi (actor/partition/DB kilidi); kalıcı DB; event/outbox; cache/presence; telemetri. İlk sürümde servisleri modüler monolit olarak kurmak kabul edilebilir; maç yazma sıralaması yine tek otoriteli olmalıdır.

- Sunucu tüm kuralları, sıra geçişini, dağıtımı, karıştırmayı ve skoru belirler. İstemci yalnız komut önerir.
- Her oyuncuya yalnız kendi taşlarının kimlikleri ve yüzleri gönderilir. Diğer oyuncular için yalnız taş sayısı ve açık taşlar yayınlanır. Stok taş sırası, diğer eller ve RNG seed hiçbir istemci mesajında bulunmaz.
- Sıra dışı ve tekrar mesajlar idempotency/version ile yönetilir. WebSocket yeniden bağlanınca `lastEventSeq` ile eksik event replay edilir; pencere aşılmışsa kişiye özel tam snapshot alınır.
- Mesaj boyutu, sıklığı ve komut türü sınırlandırılır. İstemci zaman damgası otorite kabul edilmez.
- Masa sohbeti ilk sürümde kapalı olabilir; açılırsa raporlama, susturma, hız limiti ve saklama süresi gerekir.

## 10. Veri modeli

Önerilen ilişkisel şema (JSONB alanları yalnız yapılandırma/snapshot için):

- `users(id, handle, display_name, avatar_id, created_at, status)`
- `sessions(id, user_id, token_hash, expires_at, revoked_at)`
- `lobbies(id, owner_user_id, visibility, invite_hash, ruleset_json, status, created_at)`
- `matches(id, mode, ruleset_json, ruleset_version, status, current_round_id, created_at, ended_at)`
- `match_seats(match_id, seat_no, user_id, team_no, status, connected_at, disconnect_deadline)`
- `rounds(id, match_id, round_no, dealer_seat, starting_seat, indicator_tile_id, joker_color, joker_number, phase, active_seat, turn_no, deadline_at, state_version, status)`
- `round_tiles(round_id, tile_id, kind, color, number, zone, owner_seat, discard_order, meld_id)` — `zone`: STOCK/INDICATOR/HAND/DISCARD/MELD.
- `melds(id, round_id, owner_seat, kind, opened_at, pair_opening, ordinal)`
- `meld_tiles(meld_id, tile_id, position, joker_as_color, joker_as_number)`
- `game_events(round_id, seq, actor_seat, command_id, event_type, public_payload, private_payload_by_seat, created_at)`
- `round_scores(round_id, seat_no, base_delta, modifiers_json, multiplier, final_delta, explanation)`
- `match_scores(match_id, seat_no, team_no, total_penalty, wins, rounds_played)`
- `audit_events(id, actor_user_id, match_id, action, metadata_redacted, created_at)`

DB kısıtları: aynı turda bir `tile_id` yalnız bir zoneda bulunur; aynı `(round_id,seq)` tektir; aynı maçta koltuk numarası tektir; aynı round event `command_id` için tekrar kayıt yoktur. Tur state snapshot ile event log aynı transaction içinde güncellenir. Üretimde event geçmişi saklama süresi ve kullanıcı verisi silme/anonymize politikası tanımlanmalıdır.

## 11. API ve olay sözleşmeleri

HTTP örnek uçlar:

- `POST /v1/lobbies` → masa ve kurallar oluştur.
- `POST /v1/lobbies/{id}/join`, `POST /v1/lobbies/{id}/ready`, `POST /v1/lobbies/{id}/start`.
- `POST /v1/matchmaking/tickets`, `DELETE /v1/matchmaking/tickets/{id}`.
- `GET /v1/matches/{id}` → çağıranın görebileceği snapshot.
- `POST /v1/matches/{id}/commands` → WebSocket yoksa komut taşıyıcısı.
- `POST /v1/matches/{id}/reconnect-token` veya session yenileme.

WebSocket istemci komutları:

```json
{"type":"game.command","matchId":"m1","roundId":"r1","commandId":"uuid","expectedVersion":24,"command":{"type":"draw_stock"}}
{"type":"game.command","matchId":"m1","roundId":"r1","commandId":"uuid","expectedVersion":25,"command":{"type":"open_melds","melds":[{"tileIds":["t1","t2","t3"],"jokerAssignments":[]}]}}
{"type":"game.command","matchId":"m1","roundId":"r1","commandId":"uuid","expectedVersion":26,"command":{"type":"discard","tileId":"t4"}}
```

Komut türleri: `draw_stock`, `take_discard`, `open_melds`, `open_pairs`, `layoff`, `discard`, `resign`, `ping`. Taş sıralama ve yerel seçim oyun komutu değildir.

Sunucu olayları: `lobby.updated`, `match.started`, `round.started`, `turn.started`, `tile.drawn` (yalnız sahibine yüz/ID; diğerlerine taş sayısı değişimi), `discard.pile_changed`, `meld.opened`, `meld.extended`, `tile.discarded`, `player.disconnected`, `player.reconnected`, `turn.timeout_warning`, `turn.auto_action`, `round.ended`, `score.updated`, `match.ended`, `command.rejected`.

Her event `matchId`, `roundId`, monoton `seq`, `stateVersion`, `serverTime`, `type`, `payload` içerir. Gizli payload per-seat filtrelenir. Hata kodları en az: `NOT_YOUR_TURN`, `WRONG_PHASE`, `STALE_STATE`, `TILE_NOT_OWNED`, `INVALID_MELD`, `OPENING_BELOW_THRESHOLD`, `PAIR_COUNT_TOO_LOW`, `MUST_USE_DISCARD_TO_OPEN`, `STOCK_EMPTY`, `DEADLINE_EXPIRED`, `MATCH_NOT_ACTIVE`, `RATE_LIMITED`. Hata mesajı kullanıcıya Türkçe, istemci için kodlu olmalıdır.

## 12. Kopma, zaman aşımı ve terk

- WebSocket heartbeat ile bağlantı durumu ölçülür; kısa ağ kesintisi oyun saatini otomatik uzatmaz, ancak sunucunun belirlediği `disconnectGrace` varsa süre dondurma/uzatma politikası masa kuralıdır.
- Yeniden bağlanan kullanıcı kimlik doğrulamasından sonra koltuğuna bağlanır; sunucu son görünür eventlerden devam veya tam snapshot döner. Diğer oyunculara bağlandı/ayrıldı olayı yayınlanır.
- Süre bitince başlangıç hamlesinde varsayılan otomatik davranış: stoktan çek, yasal işlem yapmadan en düşük yüz değerli taşı at; eşitlikte deterministik seçim. Başlangıç 22 taşlı ilk atış için de aynı seçim. Bu bot hamlesi açıkça `AUTO_TIMEOUT` olarak loglanır.
- `N` ardışık timeout sonrası (varsayılan 3) koltuk bot tarafından kontrol edilir veya oyuncu hükmen kaybeder. İlk sürüm için: süre sonunda otomatik hamle; 3 ardışık timeoutta hükmen ayrılma ve önceden belirlenmiş terk puanı. Kalan oyuncular el/maç akışını sürdürebilir; 4 kişilik masa eksik oyuncu botla doldurulur veya maç iptal edilir. Bu seçim `disconnectPolicy` olarak konfigüre edilmeli.
- Kullanıcı çıkışına tıklayınca etkisi açıkça bildirilir. Çıkış, devam eden eli sessizce silmez.

## 13. Hile önleme ve güvenlik

- Her API TLS üzerinden; oturum tokenları kısa ömürlü, yenilenebilir ve sunucuda hash olarak saklanır. WebSocket origin ve oturum doğrulaması yapılır.
- Oyuncu yalnız kendi elindeki tile ID'lerini kullanabilir; ID tahmin edilemez (random UUID/opaque ID). Tile ID tek başına gizli yüz bilgisi açığa çıkarmaz.
- RNG kriptografik olarak güvenli olmalı. Audit için karıştırma taahhüdü (hash commitment) tur başında yayımlanıp tur sonunda seed açığa çıkarılabilir; adil doğrulama istenmiyorsa seed hiçbir zaman açılmaz. Seed açılımı hile tespitini destekler, ancak gelecekteki turları tahmin ettirmemelidir.
- İstemciye stok sırası, rakip taşları veya iç snapshot gönderilmez. Loglarda token, gizli el veya davet secret'ı tutulmaz.
- Komutlarda sıra, faz, tile ownership, kombinasyon, limit ve replay koruması sunucu tarafındadır. İstemci kodunu gizlemek hile önleme değildir.
- Rate limit: kullanıcı/IP/maç bazında; bağlantı açma, lobi arama, sohbet ve komut spam'ı kontrol edilir. Hata/deneme mesajı oyun durumunu sızdırmamalı.
- Moderasyon/rapor akışı, engelleme, susturma, masadan çıkarma yetkileri ve audit kaydı ürün gereksinimidir. Para/ödül varsa ayrı uyum, dolandırıcılık ve yaş gereklilikleri analiz edilmelidir.

## 14. Gözlemlenebilirlik ve işletim

Metrikler: aktif masa/oyuncu, matchmaking bekleme süresi, websocket bağlantı/kopma, komut gecikmesi ve reddedilme kodları, tur süresi, timeout, yeniden bağlanma başarısı, DB transaction gecikmesi, event kuyruğu gecikmesi, hata oranı, maç tamamlanma oranı. Loglar `matchId/roundId/seq/commandId` ile ilişkilendirilir; kullanıcı kişisel verisi maskelenir. Dağıtımda health/readiness, otomatik ölçekleme, DB yedekleme ve geri yükleme provası, migration geri dönüş planı ve kademeli sürümleme olmalıdır.

Maç otoritesi bir hata sonrası event logundan replay edilebilmeli; snapshot checksum farkı alarm vermelidir. Oyun sürümü ile `rulesetVersion` loglanmalı, eski maçlar geçmiş kurallarıyla incelenebilmelidir. Canlı müdahale araçları taş ekleme/silme yerine tercihen maçı durdurma, oyuncuyu çıkarma ve auditli sonuç düzeltmeyle sınırlanır.

## 15. Test planı ve kabul kriterleri

Kurallar tartışmalı olduğundan önce kural profili sabitlenir; her kabul testi o profilin anahtarlarını içerir. Testler için istenmediği durumda canlı sisteme yük testi veya üçüncü taraf entegrasyonu eklenmez.

### Birim / özellik testleri

- Taş seti 106 benzersiz fiziksel ID üretir: 104 normal, 2 sahte okey; her renk/sayıdan iki kopya.
- Gösterge 13 → aynı renk 1 okey; gösterge 4 → aynı renk 5; sahte okey gösterge politikası uygulanır.
- Seri uzunluğu en az 3, tek renk, artan ve kopyasızdır; 12-13-1 varsayılanda reddedilir.
- Grup 3/4 taş, aynı sayı ve benzersiz renk şartlarını uygular; çift renk/aynı sayı iki kopyası aynı gruba konamaz.
- Joker temsil ettiği sayı değerinde açılış toplamına eklenir; geçersiz joker ataması reddedilir.
- 100 puanlık açılış reddedilir, 101 kabul edilir; aynı taş iki perde kullanılırsa reddedilir.
- 5 çift kabul, 4 çift reddedilir; normal açılış ile çift açma profilleri birbirine karışmaz.
- Yandan alınan taş zorunlu kullanım anahtarında açılışta yoksa açılış reddedilir.
- İşlek taş yalnız doğru per/konuma eklenebilir; açmamış oyuncu işleyemez.
- Tur başı dağıtım 22/21/21/21, başlangıç ilk atışında çekim yok; sonraki turlar çek+at ile doğru taş sayısında kalır.
- Puan çarpanları, açan/açmayan cezası, elde okey ve beraberlik profili tablo bazlı test edilir.
- Stok bitişi ve maç final eşitliği konfigürasyonla doğrulanır.

### Entegrasyon / uçtan uca kabul

1. Dört kullanıcı özel masa kurup katılır, kuralları görür, hazır olur ve oyun başlar.
2. Her istemci yalnız kendi elini görür; rakip ve stok taş yüzleri ağ yanıtlarında bulunmaz.
3. Doğru kullanıcı çekip açar/işler/atar; sıra ve event sırası tüm istemcilerde aynı görünür.
4. Geçersiz sıra, sahte tile ID, eski sürüm, çift komut ve geçersiz per oyunun durumunu değiştirmez.
5. Kopan kullanıcı grace içinde aynı koltuğa bağlanır ve yetkili snapshot alır.
6. Süre aşımında otomatik aksiyon deterministik, görünür ve denetlenebilir olur.
7. El bitince skor dökümü formül ve taş değerlerini açıklar; maç sonunda sıralama doğru oluşur.
8. Yenileme/reconnect, aynı command tekrar gönderimi ve sunucu yeniden başlatma sonrası event/snapshot tutarlılığı korunur.
9. Klavye erişimi, mobil dokunma, ekran okuyucu için sıra/taş sayısı bildirimi ve renkleri yalnız renkle ayırt etmeme kriterleri geçer.
10. Kural profili maç boyunca sabit kalır; farklı konfigürasyonlar ayrı test edilir.

## 16. Uygulama fazları

**Faz 0 — Kural kararı:** Ürün sahibi varsayılan profil tablosunu onaylar; her varyant kullanıcıya gösterilecek şekilde adlandırılır. Özellikle puanlama, gösterge, çift açma, son taşla bitiş, yanlış hamle ve bağlantı terk politikası netleştirilir.

**Faz 1 — Çekirdek motor:** Taş modeli, dağıtım, per doğrulama, açılış, çift, işleme, çekme/atma, bitiş ve skor; tamamen sunucuda deterministik modül. Olay replay ve fixture araçları.

**Faz 2 — Tek masa çevrimiçi:** Kimlik, özel lobi, WebSocket, sunucu otoritesi, kişiye özel snapshot/event, reconnect ve timeout.

**Faz 3 — Ürün arayüzü:** Lobi, masa, taş seçme/dizme, joker atama, açık perler, skor ekranı, mobil ve erişilebilirlik.

**Faz 4 — Eşleştirme ve sosyal:** Hızlı eşleştirme, davetler, eşli oyun, sohbet/moderasyon, istatistik ve raporlama.

**Faz 5 — Üretime hazırlık:** Yük/kopma senaryoları, güvenlik incelemesi, yedek/geri yükleme, metrik ve alarm, sürümleme, beta ve kademeli dağıtım.

Her fazın tamamlanması ilgili kabul testleriyle ölçülür. Görsel cilalama, oyun motorundaki kural doğrulamasının yerine geçmez.

## 17. Açık kararlar ve ilk sürüm varsayımları

Aşağıdakiler evrensel olmadığından ürün sahibi için karar listesidir. Karar gelene kadar önerilen değerler kullanılır ve `ruleset` içine yazılır:

1. Açmayan cezası 202 mi, başka değer mi? **Öneri: 202.**
2. Kazanana -101 yazılsın mı? **Öneri: evet.**
3. Elde gerçek okey kalırsa ek ceza? **Öneri: +101.**
4. Okeyle/çiftten bitiş katsayıları ve birleşimi? **Öneri: ayrı ayrı ×2, birlikte ×4.**
5. Çift açmak için okey kullanımı? **Öneri: kapalı.**
6. Gösterge gösterme bonusu veya risk eli? **Öneri: kapalı.**
7. Taş havuzu bitince ne olur? **Öneri: el kapanır, açanlar kalan taş toplamı, açmayanlar 202; kazanan bonusu yok.**
8. Oyun süresi ve maç uzunluğu? **Öneri: tur başına 30 sn, maç 10 el.**
9. Zaman aşımında kaç otomatik turdan sonra hükmen ayrılma? **Öneri: 3 ardışık timeout.**
10. Hatalı hamle cezası? **Öneri: reddet, state değiştirme.**

## 18. Kaynak ve kural doğrulama notu

Kurallar tek otoriteden gelmediği için belge, yaygın oyun anlatımları ve masa/turnuva kural örneklerini karşılaştırarak ortak çekirdeği ayırır. Dağıtım ve 101 açılışına ilişkin ortak örnekler [Yudum.NET 101 anlatımı](https://www.yudum.net/sayfa/yardim/okey101-nasil-oynanir) ve [Okey 101 kuralları](https://www.101okey.com.tr/kurallar) ile; puan ve taş cezası farkları [Okey Evi kuralları](https://www.okeyevi.com.tr/OyunKurallari.aspx) ve [eşli turnuva statüsü](https://medya.barobirlik.org.tr/Barowebsite/uploads/52/kural1.pdf) ile çapraz kontrol edilmiştir. Bunlar bağlayıcı resmî standart olarak kabul edilmemiş, platform farklarının bulunduğunu göstermek için kullanılmıştır. Üretim kural setini yayımlamadan önce gerçek hedef oyuncularla kısa kural onayı yapılmalıdır.

---

**Uygulama ilkesi:** Sunucu, gizli durumu ve kuralları belirleyen tek otoritedir. Her masa, oyuncular başlamadan önce görebildiği sürümlenmiş bir kural profiline bağlıdır. Kurallı durum geçişi event olarak saklanır; istemci yalnızca bu durumu anlaşılır ve hızlı biçimde sunar.
