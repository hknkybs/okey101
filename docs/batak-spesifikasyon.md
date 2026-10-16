# Online Batak — İhaleli Tekli ve İhaleli Eşli Ana Spesifikasyonu

**Sürüm:** 1.0  
**Hedef:** Bu doküman, yazılımcının çevrimiçi, çok oyunculu ihaleli Batak oyununu uçtan uca geliştirmesi için ürün kurallarını ve teknik sözleşmeleri tanımlar. Kapsam yalnızca **ihaleli tekli** ve **ihaleli eşli** modlardır. Koz Maça, gömmeli, üç kişilik, eşli ihalesiz ve diğer Batak türleri kapsam dışıdır.

> **Kural notu:** Batak, tek bir resmî ve herkesçe uygulanan kurallar kitabına sahip değildir. Deste, kart sırası, renge uyma ve eli alma temelinde geniş uzlaşı vardır; minimum ihale, pas sonrası davranış, koz açma, yükseltme zorunluluğu, eşli oyun ihalecisinin eşi ve puanlama gibi konularda masa/platform farklılıkları görülür. Bu nedenle her masa başlangıçtan önce sürümlenmiş bir kural profiline bağlanır. Bu belgede “Ortak” yaygın temel kuralları; “Varsayılan” önerilen ilk ürün davranışını; “Varyant” yapılandırılabilir alternatifi belirtir.

## 1. Ürün özeti ve terimler

Batak dört oyunculu, 52 kartlı, tur ve el (trick) bazlı koz oyunudur. Her oyuncuya 13 kart dağıtılır. Oyuncular sırayla kaç el alabileceklerini söyler veya pas geçer. İhaleyi alan koz rengini seçer ve teklif ettiği sayıda eli almaya çalışır. Her el birer kartla oynanır; açılan renge uymak zorunludur. Renk yoksa koz atma ve koz açma kuralları uygulanır. Elin galibi bir sonraki eli başlatır.

- **El / trick:** Her oyuncunun birer kart oynadığı dört kartlık tur.
- **Dağıtım / el (hand):** 13 trick içeren oyun bölümü.
- **İhale:** Oyuncunun almayı taahhüt ettiği trick sayısı.
- **Pas:** İhale vermeme kararı.
- **İhaleci / declarer:** En yüksek geçerli teklifi veren ve kozu seçen oyuncu.
- **Koz:** Diğer renklere üstün gelen renk.
- **Renk / suit:** Maça, kupa, karo, sinek.
- **Eşli oyun:** Karşılıklı koltuklar aynı takımdır; takımın trick toplamı birlikte sayılır.
- **Batmak:** İhalecinin (veya takımın) teklifini karşılayamaması. Eşli modda rakip takım için ayrıca minimum trick şartı kullanılabilir.

## 2. Oyun modu ve varsayılan kural profilleri

İki mod aynı kart motorunu kullanır, ancak ihale ve puanlama hedefleri farklıdır.

| Ayar | İhaleli tekli varsayılan | İhaleli eşli varsayılan | Varyantlar |
|---|---|---|---|
| Oyuncu sayısı | 4 | 4 | Sabit |
| Deste | 52 standart kart, joker yok | Aynı | Jokersiz sabit |
| Kart dağıtımı | 13 kart/oyuncu | 13 kart/oyuncu | Sabit |
| Koltuk/takım | Her oyuncu bireysel | 0-2 ve 1-3 karşılıklı eş | Eşli koltuk yönü lobi ekranında gösterilir |
| İhale sırası | Dağıtıcının solundaki koltuktan | Aynı | Başlangıç yönü profiliyle değişebilir |
| Minimum ihale | 5 | 8 | Eşli için 7 veya başka masa değeri; tekli için 4/5 |
| Teklif artışı | 1 | 1 | Artış adımı profilden ayarlanabilir |
| Pas sonrası tekrar teklif | Pas geçen aynı ihalede dönemez | Aynı | Bazı masalarda son oyuncuya özel farklılıklar olabilir |
| Herkes pas derse | Son başlangıç oyuncusu minimum teklifle zorunlu ihaleci olur | Aynı | Alternatif: yeniden dağıt |
| Koz seçimi | İhaleci dört renkten birini seçer | Aynı | Koz seçimi ihale sonrası zorunlu |
| İlk eli başlatan | İhaleci | İhaleci | İhalecinin solundakiyle başlatma varyantı olabilir |
| Renge uyma | Elinde varsa uymak zorunlu | Aynı | Ortak |
| Koz açma | İlk koz çıkana kadar koz atılamaz; yalnızca elinde açılan renkten yoksa ve başka yasal yol yoksa açabilir | Aynı | İlk fırsatta koz atmaya izin veren masa ayarı |
| Yükseltme zorunluluğu | Kapalı | Kapalı | Açık/kapalı masa ayarı |
| Tekli skor | İhaleci teklifini tutarsa +teklif×10; tutmazsa −teklif×10; teklif dışı oyuncular aldıkları el×10 | — | Fazla el, sıfır el ve batma cezası ayarlanabilir |
| Eşli skor | — | İhaleci takım hedefi tutarsa +teklif×10; tutmazsa −teklif×10; rakip takım trick bonusu opsiyonel | Başarıya takımın gerçek trick sayısını ekleme varyantı |
| Maç | 10 dağıtım | 10 dağıtım | 5/7/11 veya hedef puan |
| Tur süresi | 30 sn | 30 sn | 15–60 sn |
| Timeout | Otomatik yasal kart; 3 ardışık timeout sonrası terk politikası | Aynı | Bot/forfeit/masa iptali konfigürasyonu |

### 2.1 Kanonik `ruleset` örneği

```json
{
  "rulesetVersion": 1,
  "mode": "INDIVIDUAL_BID",
  "players": 4,
  "deck": {"jokers": 0, "cardsPerPlayer": 13},
  "turn": {"direction": "CLOCKWISE", "firstSeatOffsetFromDealer": 1},
  "bidding": {
    "minimumBid": 5,
    "minimumBidStep": 1,
    "allowPass": true,
    "passedPlayerCanRebid": false,
    "allPass": "FORCE_MIN_BID_LAST_PLAYER",
    "allPassForcedBidSeat": "LAST_TO_ACT"
  },
  "play": {
    "mustFollowSuit": true,
    "mustTrumpIfVoid": false,
    "mustBeatIfPossible": false,
    "mustLeadTrumpBeforeBroken": true,
    "allowTrumpLeadWhenOnlyTrump": true
  },
  "scoring": {
    "contractMade": "BID_TIMES_10",
    "contractFailed": "NEGATIVE_BID_TIMES_10",
    "nonBidderPerTrick": 10,
    "overtricks": "NO_BONUS",
    "zeroTrickPenalty": 0
  },
  "match": {"roundLimit": 10, "targetScore": null},
  "timers": {"bidSeconds": 20, "playSeconds": 30, "reconnectGraceSeconds": 30}
}
```

Eşli modda `mode: PARTNERSHIP_BID`; `minimumBid: 8`; scoring profili `teamContractMade: BID_TIMES_10`, `teamContractFailed: NEGATIVE_BID_TIMES_10`, `opponentsPerTrick: 0` önerilir. Bu puan sistemi bir varsayılandır, evrensel kural değildir. Tüm masa ayarları maç başlarken dondurulur ve oyun boyunca değiştirilemez.

## 3. Kart modeli ve destenin hazırlanması

Standart destede dört renkten (♠ maça, ♥ kupa, ♦ karo, ♣ sinek) 13'er kart bulunur. Her renkte sıralama As, Papaz, Kız, Vale, 10, 9, …, 2 şeklindedir. Joker kullanılmaz.

```text
Card = { cardId: opaque unique id, suit: SPADES|HEARTS|DIAMONDS|CLUBS, rank: TWO..ACE }
```

İç değer önerisi `2=2 … 10=10, J=11, Q=12, K=13, A=14`. Bu değer, aynı renkteki kartları karşılaştırma içindir; oyun puanı değildir. Kartların Türkçe ve sembol etiketleri arayüzde görünür. Renkleri yalnızca renkle ayırt etmeyen ikon/etiket/kontrast seçenekleri sağlanır.

Tur başında sunucu 52 fiziksel kart üretir ve kriptografik rastgelelikle karıştırır. Dört oyuncuya 13'er kart verilir. Dağıtıcı her elde sırayla bir kart dağıtır veya eşdeğer, dengeli random shuffle sonrası 13'er kartlık bölümlere ayırır. Her kart tek bir oyuncunun elindedir; kartlar açık oynandıkça trick geçmişine geçer. Oyunda çekme destesi, atık yığını veya gömme yoktur.

## 4. İhale akışı

1. Dağıtıcı her dağıtımda bir koltuk ilerler.
2. İhale dağıtıcının solundaki oyuncudan başlar ve oyun yönünde devam eder.
3. Teklif sırası gelen oyuncu `pass` veya geçerli bir sayı söyler. İlk teklif minimum ihale değerine eşit veya büyük; sonraki teklif mevcut en yüksek tekliften en az `minimumBidStep` daha büyük olmalıdır.
4. Pas geçen oyuncu o dağıtımda tekrar teklif veremez. Teklifler en az bir oyuncu kalana veya herkes pas geçene kadar sürer.
5. Bir teklifin üstüne kimse çıkmazsa en yüksek teklifi veren ihaleci olur. Eşit teklif kabul edilmez; bu nedenle ihaleci tekil belirlenir.
6. İhaleci dört renkten birini koz seçer. Koz seçimi gelmeden kart oyunu başlamaz.
7. Varsayılan olarak ihaleci ilk trick'i başlatır. (Masalar, ihalecinin solunun başlamasını seçebilecek bir `leadAfterBid` ayarı sunabilir.)

### 4.1 Herkes pas geçerse

Bu durum açık bir kural seçimi gerektirir. Varsayılan davranış `FORCE_MIN_BID_LAST_PLAYER`: ihalede son sırayı alan oyuncu, minimum teklifi zorunlu alır ve koz seçer. Bu oyuncu teklif verebilecek bir karar ekranı görür; pas aksiyonu kabul edilmez. Alternatifler:

- `REDEAL`: kartlar yeniden karıştırılıp dağıtılır; dağıtıcı ilerler veya aynı kalır (ayrı ayar).
- `FORCE_MIN_BID_FIRST_PLAYER`: ihaleye ilk başlayan oyuncuya zorunlu minimum teklif verilir.

Bu davranış maç başında masada açıklanır. Dağıtımın yeniden yapılması, istemci tarafında kartların açığa çıkmasına yol açmamalıdır; eski el durumu tamamen iptal edilir.

### 4.2 Teklif doğrulaması

Sunucu yalnızca aktif ihale oyuncusundan, ihale fazındayken, süresi dolmamış ve kurala göre geçerli teklifi kabul eder. Pas geçmiş oyuncu tekrar teklif veremez. İstemci teklif kısayollarını sınırlar fakat sunucu otoritedir. İhale ve koz seçimi event loguna yazılır.

## 5. Kart oynama ve trick kazananı

### 5.1 Renge uyma

İlk oynanan kartın rengi trick'in açılan rengidir. Her takip eden oyuncu elinde bu renkten en az bir kart varsa aynı renkten kart oynamalıdır. Yoksa yasal kaçış ve koz kuralları uygulanır. Geçersiz renkten kaçış sunucuda reddedilir.

### 5.2 Koz ve koz açma

Trick'te koz kartı varsa en yüksek koz eli alır. Koz yoksa açılan renkteki en yüksek kart eli alır. Diğer renkler, koz değillerse, açılan rengin kartını geçemez.

Varsayılan `mustLeadTrumpBeforeBroken=true`: İlk trick'te veya koz henüz oynanmamışken oyuncu kozla başlayamaz; ancak elinde yalnızca koz kartları varsa koz oynamasına izin verilir. `mustTrumpIfVoid=false` varsayılanında, açılan renkten kartı olmayan oyuncu koz atmak zorunda değildir, elindeki herhangi bir kartı oynayabilir. Bu nokta özellikle masa varyantıdır ve UI kural özetinde görünmelidir. `mustTrumpIfVoid=true` seçilirse, oyuncuda koz varsa renkten kaçınca koz atmak zorunlu olur.

### 5.3 Yükseltme (eli geçme) zorunluluğu

Varsayılan olarak oyuncunun elindeki kartlarla mevcut en yüksek kartı geçme imkânı olsa bile geçme zorunluluğu yoktur. `mustBeatIfPossible=true` varyantında oyuncu, renge uyma şartını yerine getirerek el geçebilen en düşük kartı oynamak zorundadır; kozla geçme ancak mevcut sözleşmede koz kullanımı yasal olduğunda uygulanır. Bu kural algoritmik ve tartışmalı olduğundan ürün ilk sürümünde varsayılan kapalı olmalıdır.

### 5.4 Trick kapanışı

Dört oyuncu da bir kart oynayınca sunucu kazananı hesaplar. Kazanan dört kartı alır (açık geçmiş olarak saklanır), kendi `tricksWon` sayısını artırır ve sonraki trick'i başlatır. Oynanmış kartlar tüm oyunculara açıktır. Son trick tamamlanınca 13 trick toplamı doğrulanır ve skor hesaplanır.

### 5.5 Bitiş şartı

Her dağıtımda tam 13 trick tamamlanır; ara bitiş yoktur. Oyuncu kartlarını tüketip oyun dışı kalmaz; her oyuncu her trick'te bir kart oynar. Maç, dağıtım sayısı veya hedef puan koşulu sağlandığında kapanır.

## 6. Oyun motoru ve durum makinesi

```text
WAITING_FOR_PLAYERS
  → READY_CHECK
  → DEALING
  → BIDDING
  → TRUMP_SELECTION
  → PLAYING_TRICK (LEAD_CARD | FOLLOW_CARDS)
  → ROUND_SETTLEMENT
  → NEXT_ROUND veya MATCH_SETTLEMENT
  → CLOSED
```

`round` state en az `dealerSeat`, `firstBidSeat`, `activeSeat`, `phase`, `highBid`, `bidderSeat`, `passedSeats`, `trumpSuit`, `trumpBroken`, `trickNumber`, `currentTrickCards`, `tricksWonBySeat`, `deadlineAt`, `stateVersion` içerir.

| Faz | Geçerli komut | Başarılı geçiş |
|---|---|---|
| `BIDDING` | `bid(value)` / `pass` | Sonraki geçerli teklif koltuğu; ihale kapandıysa `TRUMP_SELECTION` |
| `TRUMP_SELECTION` | `choose_trump(suit)` | `PLAYING_TRICK`, ilk çıkış koltuğu aktif |
| `PLAYING_TRICK` | `play_card(cardId)` | Aynı trick'te sonraki oyuncu; 4. karttan sonra kazanan hesaplanır |
| `PLAYING_TRICK` / trick 13 kapanışı | sistem `settle_round` | `ROUND_SETTLEMENT` |
| `ROUND_SETTLEMENT` | sistem | Yeni dağıtım veya `MATCH_SETTLEMENT` |

Her komut `commandId`, `matchId`, `roundId`, `expectedVersion` ve komut gövdesi taşır. Aynı `commandId` tekrarında önceki yanıt dönülür. Eski sürüm için `STALE_STATE` ve güncel görünür snapshot gönderilir. Kartın oyuncuya aitliği, faz, koltuk ve kurallı kart seçimi DB/event commit'i öncesi atomik doğrulanır.

### 6.1 Oyun motoru fonksiyonları

Saf/deterministik çekirdek en az şu fonksiyonları sağlar:

- `createDeck()` / `shuffleDeck(rng)` / `deal(deck, seats)`
- `validateBid(state, seat, bidOrPass, rules)`
- `resolveAuction(state, rules)` / `validateTrumpChoice(suit)`
- `legalCards(hand, trick, rules)`
- `validatePlayCard(state, seat, cardId, rules)`
- `resolveTrick(cards, trumpSuit)`
- `reduce(state, command)`
- `calculateRoundScore(state, rules)`

RNG, saat, DB, WebSocket motor fonksiyonlarının içine gömülmez; dış bağımlılıklar parametreyle sağlanır. Aynı state ve command aynı sonuç üretir.

## 7. Puanlama

Puan sistemleri Batak masaları ve platformlarında farklıdır. Ürün puanlaması kural profiliyle belirtilmeli ve oyuncuya ihale başlamadan gösterilmelidir.

### 7.1 İhaleli tekli varsayılan puanlama

İhaleci `B` teklif vermiş, `T` trick almış olsun:

- `T >= B`: ihaleciye `+B × 10`.
- `T < B`: ihaleciye `−B × 10`.
- Her ihale dışı oyuncuya `+10 × kendi aldığı trick sayısı`.
- İhalecinin fazla aldığı trick varsayılanda ek puan getirmez.
- Teklif dışı oyuncunun sıfır trick alması varsayılanda ceza doğurmaz.

Bu puan sistemi basit, şeffaf bir başlangıç profilidir; bazı masalarda ihale dışı hiç el alamayana eksi ceza, fazla trick'e bonus, ihalecinin gerçek aldığı trick sayısını puanlama veya farklı çarpan kullanılır.

### 7.2 İhaleli eşli varsayılan puanlama

Karşılıklı iki oyuncu bir takımdır. İhaleci takımın teklifi `B`, takımın kazandığı trick toplamı `Tteam` olsun:

- `Tteam >= B`: ihaleci takıma `+B × 10`.
- `Tteam < B`: ihaleci takıma `−B × 10`.
- Rakip takımın bireysel veya takım trick puanı varsayılanda ayrıca yazılmaz (`0`).

Varyantlar: hedef tutarsa `+10 × Tteam`; batarsa `−10 × B`; rakip takıma `+10 × aldığı her trick`; ihale dışı takımın en az 2 trick alması/alamaması cezası. Kaynaklarda ve uygulamalarda farklılaşan eşli ceza kuralları bu nedenle otomatik varsayım yapılmamalıdır.

### 7.3 Skor hesabının sunumu

Her dağıtım sonrası her oyuncu/takım için puan nedeni gösterilir: ihale, alınan trick sayısı, söz tutuldu/batıldı, kullanılan formül, dağıtım puanı ve maç toplamı. İçeride `baseScore`, `modifiers`, `finalScore` ayrı saklanır. Negatif puan ve hedef puanlı maç eşitlik davranışı profilde tanımlanır. Varsayılan maç kazananı, maç bitiminde en yüksek toplam puana sahip oyuncu/takım; eşitlik beraberliktir.

## 8. Lobi, eşleştirme ve arayüz

### 8.1 Ekranlar

1. **Ana lobi:** hızlı oyun, tekli/eşli seçimi, özel masa oluşturma, masa listesi, filtre, davet kodu.
2. **Bekleme odası:** 4 koltuk; eşlide takım renkleri/ortaklar karşılıklı gösterilir; hazır durumu; kural profili ve tüm puan ayarlarının okunabilir özeti; masa sahibi/başlatma yetkisi.
3. **İhale ekranı:** mevcut sıra, önceki teklifler, minimum geçerli teklif, pas butonu, teklif seçici, süre göstergesi. Eşlide takım arkadaşının kartları gizlidir.
4. **Koz seçme ekranı:** yalnız ihaleci için etkin; diğer oyuncular “koz seçiliyor” durumunu görür.
5. **Oyun masası:** oyuncu kartları, trick ortası, koz göstergesi, koz açıldı göstergesi, sıra/geri sayım, bid ve trick skorları, dağıtım ve maç toplamı.
6. **Dağıtım sonucu:** dört oyuncunun aldığı trick, söz, puan formülü; eşlide takım toplamı.
7. **Maç sonucu:** sıralama, tur dökümü, yeniden oyna/lobiye dön.
8. **Kopma/yeniden bağlanma:** bağlantı durumu, rejoin işlemi ve oyun snapshot'ı.

Kart elinde sıralama/suit filtreleri, mobil yatay/dikey düzen, büyük dokunma alanları ve klavye erişimi bulunmalıdır. Oyuncu kendi kartlarını görür; rakiplerin kartları yalnız trick'te oynanınca açığa çıkar. İstemci kartları sıralayabilir; bu yerel görünüm sunucudaki kart sırasını değiştirmez.

### 8.2 Masa yaşam döngüsü

- Masa kurucusu `INDIVIDUAL_BID` veya `PARTNERSHIP_BID` seçer; kural profilini ayarlar.
- Özel masada davet kodu tahmin edilemez, iptal edilebilir ve tercihen süreli olmalıdır.
- Dört koltuk dolu/hazır olduğunda son kural özeti onaylanır ve sunucu maçı başlatır.
- Eşli modda koltuk 0 ile 2 bir takım; 1 ile 3 diğer takımdır (veya aynı anlamda karşılıklı koltuklar). Eşler gizli bilgi paylaşamaz.
- Hızlı eşleştirme yalnız mod ve kural profili uyumlu oyuncuları eşler. Beceriyi eşleştirmeye katmak isteğe bağlıdır; ilk sürümde zorunlu değildir.
- Başladıktan sonra koltuk ayrılırsa rejoin süresi boyunca rezerve edilir.

## 9. Çevrimiçi mimari, API ve olaylar

Önerilen mimari: Web/mobile client; kimlik; lobi/eşleştirme; HTTP API; WebSocket gateway; maç başına tek yazma otoritesi (actor/partition/transaction lock); kalıcı DB; event/outbox; presence/cache. İlk sürüm modüler monolit olabilir. Her dağıtım sıralı tek otorite tarafından yürütülmelidir.

### 9.1 HTTP uçları

- `POST /v1/lobbies` — mod ve kurallarla oda oluştur.
- `POST /v1/lobbies/{id}/join`, `POST /v1/lobbies/{id}/ready`, `POST /v1/lobbies/{id}/start`.
- `POST /v1/matchmaking/tickets`, `DELETE /v1/matchmaking/tickets/{id}`.
- `GET /v1/matches/{id}` — çağıranın yetkisine göre görünür snapshot.
- `POST /v1/matches/{id}/commands` — WebSocket bulunmayan istemciler için komut.
- `POST /v1/matches/{id}/reconnect` — kimliği doğrulanmış koltuk için devam.

### 9.2 WebSocket istemci komutları

```json
{"type":"game.command","matchId":"m1","roundId":"r3","commandId":"uuid","expectedVersion":12,"command":{"type":"bid","value":8}}
{"type":"game.command","matchId":"m1","roundId":"r3","commandId":"uuid","expectedVersion":13,"command":{"type":"pass"}}
{"type":"game.command","matchId":"m1","roundId":"r3","commandId":"uuid","expectedVersion":20,"command":{"type":"choose_trump","suit":"HEARTS"}}
{"type":"game.command","matchId":"m1","roundId":"r3","commandId":"uuid","expectedVersion":21,"command":{"type":"play_card","cardId":"opaque-card-id"}}
```

### 9.3 Sunucu eventleri

`lobby.updated`, `match.started`, `round.started`, `auction.started`, `bid.placed`, `bid.passed`, `auction.resolved`, `trump.selected`, `turn.started`, `card.played`, `trick.completed`, `player.disconnected`, `player.reconnected`, `turn.timeout_warning`, `turn.auto_played`, `round.ended`, `score.updated`, `match.ended`, `command.rejected`.

Her event `matchId`, `roundId`, artan `seq`, `stateVersion`, `serverTime`, `type`, görünür `payload` içerir. Kart dağıtımı oyuncuya özel payload ile yapılır; diğer koltuklara yalnız “el dağıtıldı” bilgisi verilir. Event replay'de de aynı gizlilik süzgeci uygulanır.

Hata kodları: `NOT_YOUR_TURN`, `WRONG_PHASE`, `STALE_STATE`, `CARD_NOT_OWNED`, `INVALID_BID`, `PLAYER_ALREADY_PASSED`, `MUST_FOLLOW_SUIT`, `MUST_TRUMP`, `MUST_BEAT`, `TRUMP_NOT_BROKEN`, `INVALID_TRUMP`, `DEADLINE_EXPIRED`, `MATCH_NOT_ACTIVE`, `RATE_LIMITED`. Hata kodu kararlı makine sözleşmesi, hata metni Türkçe kullanıcı metnidir.

## 10. Veri modeli

Önerilen ilişkisel şema:

- `users(id, handle, display_name, avatar_id, status, created_at)`
- `sessions(id, user_id, token_hash, expires_at, revoked_at)`
- `lobbies(id, owner_user_id, visibility, invite_hash, ruleset_json, status, created_at)`
- `matches(id, mode, ruleset_json, ruleset_version, status, current_round_id, created_at, ended_at)`
- `match_seats(match_id, seat_no, user_id, team_no, status, connected_at, disconnect_deadline)`
- `rounds(id, match_id, round_no, dealer_seat, phase, active_seat, bidder_seat, high_bid, trump_suit, trump_broken, trick_no, state_version, deadline_at, status)`
- `round_cards(round_id, card_id, suit, rank, owner_seat, zone, played_trick_no, played_order)` — `zone`: HAND/TRICK/CAPTURED.
- `bids(id, round_id, seat_no, ordinal, value, is_pass, created_at)`
- `tricks(id, round_id, trick_no, winner_seat, lead_suit, cards_json, completed_at)`
- `game_events(round_id, seq, actor_seat, command_id, event_type, public_payload, private_payload_by_seat, created_at)`
- `round_scores(round_id, seat_no, team_no, bid, tricks_won, base_score, modifiers_json, final_score, explanation)`
- `match_scores(match_id, seat_no, team_no, total_score, rounds_won)`
- `audit_events(id, actor_user_id, match_id, action, metadata_redacted, created_at)`

Kısıtlar: aynı `card_id` bir dağıtımda yalnız tek zoneda; `(round_id, seq)` tektir; aynı maçta koltuk numarası eşsiz; aynı `command_id` tek kez uygulanır. State snapshot ve event aynı transaction/actor commit'inde yazılır. Kişisel veri ve oyun event saklama süresi tanımlanır.

## 11. Bağlantı kopması, timeout ve terk

- Heartbeat ile bağlantı izlenir; bağlantı kesintisi oyuncuyu anında oyundan düşürmez. Varsayılan 30 saniye rejoin penceresi.
- Rejoin sırasında oturum ve kullanıcı-koltuk ilişkisi doğrulanır. Son event sıra numarasından replay veya kişiye özel tam snapshot verilir.
- Teklif/play süresi bitince sunucu geçerli otomatik hamle yapar. İhale aşamasında varsayılan otomatik aksiyon `pass`; zorunlu son teklif durumunda minimum geçerli teklif otomatik verilir. Koz seçiminde deterministik olarak oyuncunun en uzun rengi, eşitlikte sabit suit sırası seçilir. Kart oyununda yasal kartlardan en düşük rank; `mustBeatIfPossible` açıksa en düşük geçerli kazanan kart seçilir.
- Otomatik aksiyon `AUTO_TIMEOUT` kaydıyla görünür event olur. Varsayılan olarak 3 ardışık timeoutta oyuncu terk etmiş sayılır. `afterTimeout` seçeneği: bot koltuğu devralır, hükmen sonuç uygulanır veya maç iptal edilir. İlk sürüm için rejoin penceresi sonrası bot devri ve auditli terk işareti önerilir.
- Ayrılma/terk, eşli takım arkadaşının gizli kartlarını görmesine veya hamle yapmasına izin vermez. Takım oyuncuları yalnız ortaklarının açık oynanmış kartlarını ve trick sayısını görür.

## 12. Güvenlik ve adil oyun

- HTTPS/WSS, kısa ömürlü erişim tokenı, güvenli yenileme ve sunucuda token hash saklama.
- Sunucu kartları karıştırır ve dağıtır; istemciye yalnız kendi eli gönderilir. Rakip elleri, destedeki sıra ve RNG seed hiçbir istemci snapshot/event'inde bulunmaz.
- CSPRNG kullanılır. İsteğe bağlı denetlenebilirlikte karıştırma seed hash'i dağıtım öncesi yayımlanıp el sonunda seed açıklanabilir; bu özellik sonraki ellerin seed'ini açığa çıkarmamalıdır.
- Her hamle için oturum, koltuk, faz, sıra, deadline, kart sahipliği ve oyun kuralı sunucu tarafında kontrol edilir. İstemci koduna güvenilmez.
- `commandId` idempotency ve `expectedVersion` concurrency/replay koruması sağlar. Kart ID'leri tahmin edilemez ve kart kimliğinden başka oyuncunun kart yüzü sorgulanamaz.
- Rate limit kullanıcı/IP/maç bazında; davet tokenı hash'li; loglardan kart gizli bilgisi ve tokenlar çıkarılır.
- Sohbet varsa susturma, engelleme, raporlama, spam limiti ve moderasyon audit'i gerekir. İlk sürümde sohbet opsiyonel.

## 13. İşletim ve gözlemlenebilirlik

İzlenecek ölçümler: aktif maç/oyuncu, eşleştirme bekleme, WebSocket kopma ve rejoin, komut gecikmesi/reddedilme kodu, ihale süresi, trick süresi, timeout, bot devir sayısı, maç tamamlama oranı, DB/event gecikmesi, hata oranı. Loglar `matchId/roundId/seq/commandId` ile bağlanır; gizli kartlar loglanmaz. Health/readiness, yedek/geri yükleme denemesi, DB migration geri dönüş planı ve kademeli deployment gerekir. Event logundan bir maç deterministik olarak replay edilebilmelidir.

## 14. Test ve kabul ölçütleri

### 14.1 Birim testleri

- Deste 52 benzersiz kart üretir; her suit-rank ikilisi bir kez bulunur; joker yoktur.
- 4 oyuncuya 13'er kart gider; kart kaybı/çoğalması olmaz.
- Tekli minimum 5, eşli minimum 8 ve teklif artış koşulları doğru uygulanır.
- Pas geçen oyuncu tekrar teklif veremez; herkes pas davranışı ruleset'e göre zorunlu ihale veya yeniden dağıtım olur.
- En yüksek teklif sahibi tekil ihaleci olur; koz seçimi ihale kapanmadan yapılamaz.
- Renge uyma zorunludur; renk yoksa `mustTrumpIfVoid` kuralı; koz açma yasağı/istisnası doğru işler.
- Trick kazananı: kozlar koz olmayanlardan; aynı renkte yüksek rank düşükten üstündür; koz yoksa lead suit kazanır.
- `mustBeatIfPossible` kapalı/açık testleri; yasal kart üretimi ve validasyon sonuçları tutarlıdır.
- 13 trick sonunda toplam trick sayısı 13; her oyuncu her trick'te bir kart oynamıştır.
- Tekli/eşli puan tabloları sınır durumları ve her varyantla test edilir.

### 14.2 Entegrasyon ve uçtan uca kabul

1. Dört oyuncu özel masaya girer; tekli ve eşli mod doğru takım yerleşimiyle başlar.
2. Her oyuncu yalnız kendi elini görür; rakip kartları event/snapshot içinde sızmaz.
3. İhale turu, pas, en yüksek teklif, herkes pas ve koz seçimi doğru çalışır.
4. Geçersiz teklif, yanlış koltuk, kart sahibi olmadığı kart, yanlış renk ve timeout sonrası eski komut oyunu değiştirmez.
5. Dört kart oynanınca kazanan hesaplanır, yeni trick doğru oyuncudan başlar; 13. trick sonrası skor ve yeni dağıtım oluşur.
6. Eşli takım trick sayısı doğru iki koltuğun toplamıdır; takım arkadaşı gizli kart göremez ve onun adına hamle yapamaz.
7. Kopan oyuncu grace içinde geri bağlanır ve aynı el durumunu alır; event replay ve snapshot eşleşir.
8. Süre aşımı hamlesi yasal, deterministik, görünür ve event logunda izlenebilir olur.
9. Dağıtım sonucu, oyuncuya uygulanan formülü açıklayabilir; maç sonu doğru sıralama/eşitlik verir.
10. Mobil kart seçimi, ekran boyutu, klavye erişimi ve suit'leri yalnız renkle ayırt etmeyen görünüm çalışır.
11. Ruleset maç ortasında değiştirilmez; farklı ruleset profilleri ayrı kabul testlerinden geçer.

## 15. Uygulama fazları

**Faz 0 — Kural kararları:** Minimum teklifler, herkes pas, koz açma, renkten kaçınca koz, yükseltme, tekli/eşli puan, maç uzunluğu, timeout davranışı netleştirilir. Her masa kuralı başlamadan önce gösterilir.

**Faz 1 — Saf oyun motoru:** Deste, karıştırma/dağıtım, ihale, koz seçimi, yasal kartlar, trick çözümü ve puan. Event replay ve test fixture'ları.

**Faz 2 — Tek masalı çevrimiçi oyun:** Kimlik, özel lobi, WebSocket, server-authoritative komutlar, kişiye özel kart görünürlüğü, reconnect ve timeout.

**Faz 3 — Arayüz:** Lobi, ihale ve koz ekranları, oyun masası, trick animasyonu, skor/maç sonucu, mobil erişilebilirlik.

**Faz 4 — Eşleştirme ve operasyon:** Hızlı eşleştirme, davet, rapor/engelle, metrikler, alarm, yedekleme ve üretime hazırlık.

Her faz, ilgili kabul ölçütleri sağlandığında tamamlanmış sayılır. Animasyon veya istemci tahmini oyun kuralı doğrulamasının yerini tutmaz.

## 16. Açık karar listesi ve önerilen başlangıç değerleri

Kural sahibinin maç profiline yazması gereken tartışmalı seçimler:

1. Tekli minimum ihale 5 (alternatif 4).
2. Eşli minimum ihale 8 (alternatif 7).
3. Herkes pas: son sıradaki oyuncu minimum teklifle zorunlu ihaleci (alternatif yeniden dağıt).
4. Teklif geçişi: pas veren oyuncu geri dönemez.
5. Renge uymak zorunlu; renkten kaçınca koz atma zorunluluğu varsayılanda kapalı.
6. Koz ilk turdan önce açılamaz; yalnız koz kaldıysa kozla çıkılabilir.
7. Yükseltme zorunluluğu kapalı.
8. Tekli puan: ihaleci tutarsa `+ihale×10`, batarsa `−ihale×10`; diğerleri `+aldığı trick×10`.
9. Eşli puan: takım tutarsa `+ihale×10`, batarsa `−ihale×10`; karşı takım trick bonusu yok.
10. 10 dağıtım, yüksek puan kazanır, eşitlik beraberlik.
11. Süre: ihale 20 sn, kart hamlesi 30 sn; süre aşımında otomatik yasal hamle, 3 ardışık timeoutta bot devri.

## 17. Kaynak ve doğrulama notu

Bu doküman yaygın oyun anlatımlarını ve platform kurallarını karşılaştırarak ortak mekanikleri ayırmıştır. Dağıtım, ihale akışı ve tekli puan örnekleri [Boombala Batak rehberi](https://www.boombala.net/rehber/batak-nasil-oynanir), eşli oyun mekaniği [Akasoft Eşli Batak](https://eslibatak.net/) ve [Joker Games Eşli İhaleli Batak kuralları](https://www.jokergame.net/support-center/esli-ihaleli-batak-kurallari/) ile çapraz kontrol edilmiştir. Bunlar bağlayıcı resmî standart değildir; puanlama/özel kuralların değiştiğini gösteren kaynaklardır. Üretim kural seti hedef oyuncu kitlesiyle onaylanmalı ve her masa başlamadan önce gösterilmelidir.

---

**Uygulama ilkesi:** Sunucu kartların gizliliği, ihale, yasal oyun, trick sonucu ve puanın tek otoritesidir. Her maç sürümlenmiş bir kural profiliyle başlar; her hamle event olarak saklanır ve aynı durumdan deterministik biçimde yeniden üretilebilir.
