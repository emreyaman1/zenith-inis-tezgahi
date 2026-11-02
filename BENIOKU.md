# ZENITH İniş Tezgâhı

ZENITH IV'ün inişini 3 boyutlu, etkileşimli olarak gösteren web sayfası.
Parametreleri kaydırıcılardan değiştirip roketi indirirsiniz; başarılı inişleri
de başarısız olanları da görürsünüz. "Tezgâh" adı bilerek seçildi: bu, üstünde
deneme yapılan bir tezgâh — tasarımı değiştirmeden önce sonucunu görmek için.

> **Bu bir anlama ve gösterme aracıdır, mühendislik doğrulaması değildir.**
> Gerçek doğrulama ancak düşürme testiyle olur. Simülasyon o testi
> *tasarlamanıza* yardım eder, yerini almaz.

---

## Simülasyondaki iniş takımı (1 Kasım 2026 son tasarımı)

Simülasyon iniş takımının son halini kullanıyor: gerçek bir ürün olan **Airtac ACA2020-2**
kendini ayarlayan hidrolik amortisör, onu taşıyan iki ucu pimli kartuş ve kartuşa göre
yeniden kurulan bacak. (Öhlins TTX25'li önceki sürüm `../ohlins_eski/` içinde.)
Sayıların kaynağı `hesaplar/param.py`, `hesaplar/geometri.json` ve
`hesaplar/amortisor.json`; `geometri.js` bunların kopyasını tutar ve
`dogrula.mjs` her koşuda kopyanın kaynakla birebir aynı olduğunu denetler.

| Ne | Değer |
|---|---|
| Bacak noktaları (yatay, düşey mm) | D (215, 20) · A (215, 295) · C (301,34, 114,60) · ayak pimi F (560, −67) |
| Zemin teması | z = −112 mm (pimin 45 mm altı) |
| Amortisör | Airtac ACA2020-2, strok 20 mm; kartuşun içinde (pim-pim açık boy 200 mm) |
| Amortisör modeli | F = K·v² / (1 − x/S_h) + 8–20 N geri dönüş yayı; K = 3333 N·s²/m², S_h = 18 mm (katalogdan) |
| Dip tamponu | poliüretan halka (Shore 95A, 515 N/mm) 14 mm'de devreye girer; metal durak 19 mm'de |
| Ayağın düşey yolu | 57 mm metal durağa kadar (bacak 9,67° döner); temas noktası 16,3 mm içeri kayar |
| Kuvvet oranı (MA) | 2,906 → 3,125; fizik, sim.py gibi strok boyunca değişen oranı (polinom) kullanır |
| Duran roket | halkaya oturur: amortisör 14,59 mm sıkışık, ayak 43,4 mm yukarıda |
| Ayak pabucu | POM, Ø100, üstü düz, tabanı R200 kubbe, ortada 14 mm; bacağa **sabit** (mafsalsız) |

---

## Nasıl açılır, nasıl kapatılır

### 1. En kolayı — internetten (hiçbir kurulum gerekmez)

<https://emreyaman1.github.io/zenith-inis-tezgahi/>

Bağlantıyı tarayıcıda açın, yeter. Kapatmak = sekmeyi kapatmak. Site herkese
açık: bağlantıyı alan herkes simülasyonu açabilir, hesap gerekmez. Sayfanın
dosyaları da herkese açık bir GitHub deposunda durur:
<https://github.com/emreyaman1/zenith-inis-tezgahi>.

> İnternetteki sürüm bu klasörün bir kopyasıdır; buradaki dosyalar değişince
> kendiliğinden güncellenmez. Aşağıdaki "İnternetteki sürümü güncellemek"
> bölümüne bakın.

### 2. Kendi bilgisayarınızda — çift tıklayın

Bu klasördeki **`SIMULASYONU_AC.bat`** dosyasına çift tıklayın.

- Siyah bir pencere açılır ve tarayıcı kendiliğinden simülasyonu açar.
- **Kapatmak için o siyah pencereyi kapatın** (sağ üstteki X). Pencere açık
  kaldığı sürece simülasyon çalışır, kapanınca durur.
- Dosya boş bir kapı (port) arar, yani başka bir şey 8777'yi kullanıyorsa
  kendisi 8778'e geçer.
- Python kurulu değilse uyarı verir ve internetteki bağlantıyı gösterir.

### 3. Elle (terminalden)

```bash
cd inis_takimi_2027/simulasyon
python -m http.server 8777
```

Sonra `http://127.0.0.1:8777/index.html`. Durdurmak için terminalde Ctrl+C.

> Sayfa ES modülü kullandığı için `index.html` dosyasına doğrudan çift tıklamak
> **çalışmaz** — tarayıcı güvenlik gereği `fizik.js` ve `geometri.js`
> dosyalarını `file://` üzerinden yüklemiyor. Bu yüzden ya 1. yol ya 2. yol.

### İnternetteki sürümü güncellemek

Site, GitHub'daki `emreyaman1/zenith-inis-tezgahi` deposunun `main` dalından
GitHub Pages ile yayınlanır. Depoda bu klasördeki dosyaların kopyası, ziyaretçiler
için kısa bir `README.md`, `.nojekyll` ve `.gitattributes` vardır. Bu klasör
değişince (örneğin tasarım değişip `geometri.js` yenilenince):

1. `node dogrula.mjs` ile bütün testlerin geçtiğini görün.
2. Depoyu klonlayın, bu klasördeki dosyaları üstüne kopyalayın, commit edip
   `main`'e gönderin.
3. GitHub Pages siteyi bir iki dakika içinde yeniler.

---

## Dosyalar

| Dosya | Ne yapar |
|---|---|
| `SIMULASYONU_AC.bat` | Çift tıklayınca simülasyonu açar; pencere kapanınca durur |
| `index.html` | Sayfanın kendisi: 3B sahne (three.js), kumandalar, grafikler, açıklamalar |
| `fizik.js` | Fizik motoru — `hesaplar/sim.py` dosyasının birebir JavaScript karşılığı + soğuk gaz itki sistemi |
| `geometri.js` | Bütün ölçüler (`param.py`, `geometri.json`, `amortisor.json`'dan), kartuş ve amortisör ölçüleri (Airtac'ın resmî 2B resminden) ve bacak kinematiği |
| `python_referans.py` | `sim.py`'yi tasarım dosyalarındaki değerlerle koşup `referans.json` üretir |
| `dogrula.mjs` | `fizik.js` ile `sim.py`'yi karşılaştırır; ölçülerin tasarım dosyalarıyla aynı olduğunu da denetler (Node ile) |
| `referans.json` | Python'un verdiği referans sayılar |
| `dogrulama.json` | Son doğrulama koşusunun sonucu |

---

## Fizik nereden geliyor

Fizik modeli yeniden yazılmadı; `hesaplar/sim.py` dosyasındaki **doğrulanmış**
6 serbestlik dereceli çözücü satır satır JavaScript'e taşındı. Aynı denklemler,
aynı katsayılar, aynı RK4 integrasyonu, aynı kabuller.

Buna **soğuk gaz itki sistemi** eklendi — `sim.py`'de yoktu, çünkü o dosya
yalnızca temas anıyla ilgileniyordu (itki = 0).

### Eklenen dört katman — hepsi geçen seneki KTR'den

İtki sistemi **ZENITH'in geçen seneki KTR raporunun sayılarına ve CAD
montajına** dayanıyor.

1. **Gaz: AZOT** (KTR s.13), hava değil. γ = 1,4, **R = 296,8 J/kg·K**,
   T₀ = 298 K. 9 litre / 300 bar = **3,05 kg** (KTR'nin verdiği değer).
2. **Lüle: gerçek De Laval** (KTR s.14). Giriş Ø14, **boğaz Ø3**,
   **çıkış Ø10 mm**, yakınsak 45°, ıraksak 15°. Alan oranı 11,11'den çıkış Mach
   sayısı, çıkış sıcaklığı ve çıkış hızı *hesaplanıyor* — elle verilmiyor.
   Çıkan değerler KTR ile birebir: Me 4,04 (KTR 4,03), Te 69,9 K (70,1),
   Ve 688 m/s (688), debi 0,488 kg/s (0,488).
   İtki `F = λ·ṁ·Ve + (Pe−Pa)·Ae`. **KTR'nin 344 N'u 15°'lik ıraksak koni
   kaybını (λ = 0,983) içermiyor**; kayıp uygulanınca lüle başına 337 N,
   üçü birden 1011 N çıkıyor (KTR 1032 N yazıyor).
3. **Valf: oransal iğne valf** (KTR s.22, s.30). ÖTR'de aç-kapa selenoid vardı;
   KTR'de step motorla sürülen iğne valfe geçildi. İğne *anlık efektif boğaz
   alanını* sürekli ayarlar — musluk gibi. Zaafı: step motor iğneyi kapalıdan
   tam açığa ~150 ms'de götürür, selenoid ise 10 ms'de açılır. Her iki valf tipi
   de simülasyonda seçilebiliyor; farkı sayıyla görebilirsiniz.
4. **Kontrol yasası.** Üç kademeli hedef hız profili (tepe hız sınırı → sabit
   yavaşlama → son yaklaşma), ileri beslemeli ve anti-windup'lı PID, ve üç lüle
   arasındaki itki farkıyla eğim düzeltmesi — KTR s.51'deki moment denklemiyle
   aynı yapı. Örnekleme 100 Hz (KTR'nin 6 serbestlik dereceli benzetimi gibi).

### Lüle ve gövde yerleşimi — CAD'den okundu

Geçen seneki KTR'nin CAD montajındaki (`Zenith_3.step`) 166 katı parçanın sınır
kutuları ölçüldü (gmsh/OpenCASCADE), eksen basınç tüpünün merkezi alındı. Çıkan
yerleşim `geometri.js` içindeki `KTR` bloğunda.

| Parça | Yarıçap | z aralığı |
|---|---|---|
| Karbon gövde boruları (3) | 128,5 mm | 0 – 935 mm |
| Basınç tüpü (kompozit, 9 L) | 87,5 mm | 170 – 740 mm |
| Hizalama yüzükleri (2) | 137,6 mm | 207 / 684 mm |
| Manifold (Al 7075) | eksende | 746 – 837 mm |
| Üst plaka (Top_Block, 3 kollu) | 291 mm | 918 – 930 mm |
| **Lüleler (3)** | **300 mm** | 928 – 947 mm |
| İğne valfler (3) | 291 mm | 938 – 991 mm |
| Step motorlar (3, ESS24) | 258 mm | 937 – 993 mm |
| Vinç gözü (U-bolt) | eksende | 943 – 1049 mm |
| TF02 Pro lazer ölçer | eksende | 4 – 30 mm |

**Öne çıkanlar:** roket açık bir kafes (burun konisi yok); lüleler **üst plakanın
kollarının ucunda**, r = 300 mm'de; lüleler bacaklarla aynı hizada değil, **60°
kaymış** (CAD: bacak 345°, lüle 45°); tüp **Ø175 × 570 mm**.

**Kütle:** iniş takımı şartnamenin üst sınırı olan 32 kg ile tasarlandığı için
varsayılan o; kaydırıcıdan değiştirilebiliyor.

---

## Doğrulama

```bash
python python_referans.py   # sim.py'yi koşar, referans.json üretir
node dogrula.mjs            # fizik.js ile karşılaştırır
```

Beklenen çıktı: **bütün testler geçer, en büyük sapma %0,004** (1 Kasım 2026
koşusu, `dogrulama.json`).

Koşulan testler:

| # | Test | Neyi denetler |
|---|---|---|
| 0 | Parametre eşleşmesi | `geometri.js`'teki ölçüler `hesaplar/geometri.json` ile, `fizik.js`'in kurduğu model (amortisör sabitleri K ve S_h, geri dönüş yayı, halka, metal durak, kuvvet oranı polinomu, dışa eğim, zemin yüksekliği…) Python'un `sim.py`'ye verdiği modelle birebir aynı mı. Tasarım değişip simülasyon eski kalırsa burada yakalanır |
| 1 | Bacak kinematiği | Üçgen çerçevenin dönmesi `hesaplar/geometri.json` ile aynı mı (dönme açısı, MA başta ve sonda, kartuş boyları, dışa eğim) |
| 2 | Soğuk gaz sistemi | **Geçen seneki KTR s.13–15 ile**: boğaz/çıkış çapı, alan oranı, çıkış Mach sayısı, çıkış sıcaklığı, çıkış hızı, debi, gaz kütlesi, ideal itki, lüle yarıçapı, 5 s hover sonrası basınç ve sıcaklık — hepsi **%0,5'in altında** |
| 3 | Statik denge | Roket dururken 3 bacağın tepkisi = ağırlık (**%0,0000 hata**); halkaya oturan amortisörün sıkışması analitik değerle aynı |
| 4 | Yük durumları T1–T8 | Raporda kullanılan sekiz iniş senaryosu (**en büyük sapma %0,004**) |
| 5 | Enerji dengesi | Serbest düşüşte toplam enerji korunuyor mu (10⁻¹² mertebesinde) |

Aynı doğrulama **sayfanın içinde de** çalışır: "Doğrulama" bölümündeki düğme
sekiz testi tarayıcıda koşup Python'un sayılarıyla yan yana gösterir. Başlıktaki
rozet de sayfa açılırken hızlı bir denetim yapar.

### Öne çıkan sonuçlar (itki kapalı, düz zemin, 32 kg)

Tarayıcı ve Python aynı sayıyı veriyor; son sütun ana hesabın çıktısı
(`analiz/03_cikti.txt`, ACA2020-2 satırları).

| İniş | Amortisör sıkışması | En büyük ivme | Kartuş kuvveti | 03_cikti |
|---|---|---|---|---|
| 0,2 m/s (şartname) | 16,03 mm | 3,75 g | 1203 N | 16,03 mm · 3,75 g · 1203 N |
| 1,5 m/s | 16,50 mm | 5,49 g | 1759 N | 16,50 mm · 5,49 g · 1759 N |
| 2,0 m/s (tasarım) | 16,75 mm | 6,90 g | 2209 N | 16,75 mm · 6,90 g · 2209 N |
| 3,0 m/s (nihai yük) | 17,18 mm | 11,77 g | 3580 N | 17,18 mm · 11,77 g · 3580 N |

Duran roket halkaya oturur: amortisör 14,59 mm sıkışık, ayak 43,4 mm yukarıda
(Python ile aynı, analitik beklentiyle aynı).

---

## 3B model

Roket geometrisi hazır STL'den okunmaz; `geometri.js` içindeki ölçülerden
(yani `param.py`'den) three.js ile kurulur. Sebebi: **bacakların hareket etmesi
gerekiyor.** Tek parça bir STL donuk kalırdı.

Bacak, D mafsalı etrafında dönen rijit bir üçgendir (D–C–F). Yan plakalar
gerçek parça (P01) gibi üç koldan ve üç gözden oluşur. Ayağın `s` kadar düşey
yükselmesine karşılık gelen dönme açısı kapalı formülle çözülür; kartuş A
(gövdede) ile C (bacakta) arasında olduğu için her karede yeniden yönlendirilip
boyu güncellenir — itici kovanın içinde kayar.

Kartuş `param.py`'deki ölçülerle, amortisör Airtac'ın resmî 2B teknik resmindeki
ölçülerle çizildi: kovan (P11), itici (P12) ve iki gözdeki küresel yataklar. 2B
kesitte amortisör, poliüretan halka ve metal durak da görünür.

Pabuç bacağa sabittir: bacakla birlikte döner ve kubbeli tabanı zeminde
yuvarlanır. 2B kesitte zemin çizgisi kubbenin gerçekten değdiği noktaya oturur,
zemin kuvveti de o noktada gösterilir.

Ekrandaki bacak hareketi **tam kinematikle** çizilir. Fizik de `sim.py` gibi kuvvet
oranının strok boyunca 2,906'dan 3,125'e çıkışını bir polinomla izler ve ayağı
kubbenin zemine değdiği noktadan takip eder.

Tüp de ölçeğindedir: r = 72 mm, gövde 500 mm, küresel kapaklarla ≈ 9,1 litre.

---

## Kullanıcının seçebildikleri

**Bırakma:** yükseklik (5–12 m), eğim (0–15°), eğimin yönü (tek bacağa /
iki bacağın ortasına), aviyoniğin devreye girme anı (0–1,3 s), başlangıç yanal
hızı, yanal rüzgâr.

**İtki:** tüp basıncı (40–300 bar), basınç regülatörü, valf frekansı (5–100 Hz),
valf açılma süresi (2–40 ms), her lüle için tıkanma arızası.

**Aviyonik:** kontrolü tamamen kapatma, en yüksek iniş hızı, frenleme ivmesi,
hız düzeltme gücü (PID'in P kazancı), eğim düzeltme gücü, ölçüm frekansı,
sensör gürültüsü, yükseklik sensörünün sabit hatası, yanal hızı eğilerek
düzeltme, temasta itkiyi kesme.

**Zemin:** sürtünme katsayısı.

Amortisör ve halka **değiştirilemez** — takımın seçtiği ürün ve ayar: Airtac ACA2020-2,
Shore 95A poliüretan halka (`hesaplar/amortisor.py`, `hesaplar/amortisor.json`).

---

## Hazır senaryolar

| Senaryo | Sonuç |
|---|---|
| Başarılı yumuşak iniş | **0,10 m/s** — şartname sınırı içinde |
| Eğik bırakma 12°, tek bacak | **0,09 m/s** — aviyonik eğimi düzeltiyor |
| Aviyonik geç devreye girdi (1,15 s) | **8,84 m/s** — amortisör dibe oturuyor |
| Gaz yetersiz (90 bar) | **9,30 m/s** — itki/ağırlık 1'e yakın, frenleyemiyor |
| 1 numaralı lüle tıkalı | **Takla atıyor**, gövde 12,63 m/s ile çarpıyor |
| Kontrol tamamen kapalı | **13,25 m/s** — tam serbest düşüş |
| Sensör 0,5 m yanılıyor | **2,57 m/s** — frenleme geç başlıyor |
| Fırtına, 12 m/s rüzgâr + 8° | **0,80 m/s** — yana kayarak iniyor |
| Regülatörlü sistem (150 bar) | **3,46 m/s** — 8 m/s² frenleme artık mümkün değil |
| ÖTR'deki aç-kapa selenoid valf | **0,88 m/s** — oransal valfe göre 9 kat sert |

Tablo 31 Ekim 2026'da Öhlins amortisörüyle koşuldu; hidrolik amortisörle **yeniden
koşulmadı**. Temas hızlarını aviyonik belirler, iniş takımı neredeyse hiç etkilemez
(31 Ekim'de eski ve yeni amortisör aynı sayıları vermişti). "Amortisör dibe oturuyor"
gibi sonuç yorumları için sayfadaki sonuç kartına bakın.

Son üç senaryo birer ders:

- Üç lüle de aşağı baktığı için roket **yanal hızını durduramaz** (ancak eğilerek
  durdurur, o da ayrı bir seçenek).
- Regülatör takınca itki/ağırlık 3,2'den 1,6'ya düştüğü için frenleme ivmesini de
  düşürmek gerekir — 5 m/s² yaparsanız iniş yine yumuşaklaşır.
- **KTR'de aç-kapa selenoidden oransal iğne valfe geçmek doğru bir karardı:**
  aynı koşullarda aç-kapa valf 0,88 m/s ile inerken oransal valf 0,10 m/s ile
  iniyor. Lülenin r = 300 mm'de olması da eğim düzeltme gücünü iki katına
  çıkarıyor.

### Geri sekme (itki kapalı, düz zemin)

| Temas hızı | Amortisör sıkışması | Metal durak | Geri sekme |
|---|---|---|---|
| 0,2 m/s (şartname) | 16,0 mm | hayır | 0,000 m/s |
| 1,5 m/s | 16,5 mm | hayır | 0,000 m/s |
| 2,0 m/s (tasarım) | 16,7 mm | hayır | 0,000 m/s |
| 3,0 m/s (nihai yük) | 17,2 mm | hayır | 0,000 m/s |
| 4,4 m/s | 17,6 mm | hayır | 0,000 m/s |
| 5,0 m/s | 17,8 mm | hayır | 0,000 m/s |

Hidrolik amortisörde enerji depolayan yay olmadığı için 5 m/s'ye kadar bütün düz
inişlerde geri sekme sıfır ve amortisör metal durağa değmiyor (Öhlins sürümünde
sekme 2,8 m/s civarında başlıyordu).

---

## Arayüzde ne var

- **3B uçuş penceresi** — dört kamera (genel, yandan, ayak detayı, üstten),
  sürükleyerek döndürme, tekerlekle yakınlaşma. Kamera roketi yatayda da takip
  eder (takla atıp kayan roket kadrajdan çıkmasın diye).
- **Canlı teknik kesit (2B)** — iniş takımının ölçekli yan kesiti: bacak üçgeni
  dönerken, amortisör sıkışırken, strok ölçü çizgisi dolarken izlenir. Yanında
  o anki strok, çerçeve dönmesi, amortisör boyu ve sıkışması, amortisör
  kuvveti, ayak düşey/yanal kuvveti sayı olarak yazar. Bacak seçilebilir
  ("en yüklü" seçeneği o an en çok ezilen bacağı takip eder).
- **Yedi grafik** — irtifa, düşey hız (hedefle birlikte), eğim, lüle itkileri,
  tüp basıncı, bacak strokları, valf açıklığı. Üzerinde gezinince o andaki
  değerler görünür; tıklayınca grafik büyür ve en büyük/en küçük/temas anı
  değerleri listelenir.
- **Dokuz hazır senaryo** ve dört grup kaydırıcı.

---

## Bilinen sınırlar

- Bacak kütlesi ihmal (üç bacağın dönen parçaları ≈ 2,2 kg), zemin rijit, amortisör
  modeli kendini ayarlayan amortisörün ideal hali (üretici iç yapıyı yayımlamıyor;
  katalogdan kalibre edildi) — hepsi `sim.py`'den devralındı ve `index.html` içindeki
  "Modelin sınırları" bölümünde açıkça yazılı.
- **Ayak, kubbenin zemine değdiği noktadan izlenir** (`sim.py` de böyle): metal durağa
  kadar temas noktası 57 mm yükselir ve 16,3 mm içeri kayar; kuvvet oranının değişimi
  de bu noktaya göre hesaplanır. (Önceki sürüm ayağı pimden izliyordu.)
- Aerodinamik sürükleme yalnızca rüzgâr sıfırdan büyükken hesaba katılır;
  böylece varsayılan ayar doğrulanmış modelle birebir aynı kalır.
- **Devrildikten sonraki kuvvetler bacak tasarım yükü değildir.** Gövdenin
  zemine çarpmasından gelirler. Sonuç kartındaki kuvvetler bu yüzden yalnızca
  roket ayaktayken ölçülen değerlerdir (`04_senaryolar.py` aynı uyarıyı veriyor).
- **Devrilme sonrası çözüm kaotiktir.** Ölçüldü: Python ile tarayıcı, tıkalı
  lüle senaryosunda **1,6 saniye boyunca dokuz ondalık basamak aynı** sonucu
  veriyor; ayrışma ancak gövde yere çarpıp sektikten sonra başlıyor (ondan
  sonra 1,61 m/s'ye karşı 2,63 m/s gibi farklar çıkıyor). Yani "devrildi"
  sonucu güvenilirdir, devrilme *sonrasındaki* tek tek sayılar değildir.
  Sebebi kodda bir hata değil, kaymalı nokta aritmetiğinin son basamağındaki
  farkın sert temas rejiminde büyümesidir.
- **Temas hızı, roketin herhangi bir parçasının yere ilk değdiği andaki hızdır.**
  Roket devrilirse gövde bacaklardan önce çarpar; o durumda kart "gövde çarpma
  hızı" yazar. (Önceki sürüm ilk *bacak* temasını bildiriyordu ve devrilmiş bir
  roket için 9,5 m/s'lik çarpmayı 1,6 m/s gibi gösteriyordu.)
- **Aviyoniğin irtifa ölçümü en alçak ayağın yerden yüksekliğidir.** Gövde
  12° yatıkken ayaklar açıldığı için bu değer, ağırlık merkezi yüksekliğinden
  10 cm kadar farklıdır; kontrolcü bunu görmezse eğik inişlerde son yaklaşmayı
  geç başlatır. Gerçekte bu ölçümü gövdenin altındaki TF02 Pro lazer mesafe
  ölçer sağlıyor.
- **Bacak çerçevesinin ve üst plakanın zemin teması sonradan eklendi.**
  `sim.py` yalnızca ayak ucunu ve gövdeyi (r = 138–141 mm) temas ettiriyordu;
  bacak kollarının ve üst plakanın (r = 291 mm, gövdenin en dış parçası) hiç
  temas noktası yoktu ve roket devrilince bunlar zeminin **içine giriyordu**.
  Eklenen noktalar pabuç düzleminden en az 88 mm yukarıda, yani roket ayaktayken
  hiçbiri devreye girmez — bacak yayıyla çift sayım olmaz. Pabuçların kendisi
  ise yalnızca bacak artık yay gibi davranamadığında (75°'den fazla yatıkken)
  devreye girer. Doğrulama koşuları bu eklemeyi kapatarak koşar, böylece sim.py
  karşılaştırması bozulmaz.
  Ölçülen batma (çizimdeki plaka gözleri, ayak sapı ve kubbeli pabuç) 31 Ekim
  geometrisiyle ölçülmüştü (duran roket 0 mm, takla atarken en çok −8,5 mm); yeni
  bacakta yeniden ölçülmedi.
- **Oransal valfte lüle çıkışı hesaba katılmıyor.** İğne boğazı kıstığında akış
  artık lülenin kendi boğazında değil iğnede boğulur, lüle aşırı genleşmiş
  çalışır ve çıkış hızı bir miktar düşer. KTR'nin kendi denklemi gibi burada da
  itki, efektif boğaz alanıyla doğru orantılı kabul edildi.
- **Egzoz hüzmesi ile iniş takımı çakışabilir.** Lüleler r = 300 mm'de ve aşağı
  bakıyor; bacağın üst bağlantısı (A) r = 215 mm'de, kartuşun alt ucu (C)
  r = 301 mm'de. 3B görünümde bunu gözle takip edebilirsiniz. İniş takımı
  raporunda da açık madde olarak duruyor.
- Çözüm, parametre her değiştiğinde baştan koşar (yaklaşık 0,2 saniye) ve
  kareler kaydedilip oynatılır. Böylece kaydırıcıyı oynatınca sonuç anında
  görünür, fizik de tam çözünürlükte kalır.
