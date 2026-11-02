# ZENITH İniş Tezgâhı

ZENITH takımının dikey inişli roketinin (TEKNOFEST Dikey İnişli Roket Yarışması)
inişini tarayıcıda 3 boyutlu ve etkileşimli olarak gösteren simülasyon.

### ▶ Simülasyonu açın: <https://emreyaman1.github.io/zenith-inis-tezgahi/>

Kurulum gerekmez; bağlantıyı bilgisayarda ya da telefonda tarayıcıyla açmanız yeter.

## Neler yapabilirsiniz

- Bırakma yüksekliğini, eğimi, rüzgârı, tüp basıncını ve aviyonik ayarlarını
  kaydırıcılardan değiştirip roketi indirirsiniz.
- Hazır senaryolardan birini seçersiniz: başarılı iniş, tıkalı lüle, yetersiz gaz,
  fırtına ve diğerleri. Başarısız inişler de gösterilir.
- İnişi 3B görünümde, iniş takımının canlı kesitinde ve grafiklerde izlersiniz.

> **Bu bir anlama ve gösterme aracıdır, mühendislik doğrulaması değildir.**
> Gerçek doğrulama ancak düşürme testiyle olur.

## Dosyalar

| Dosya | Ne yapar |
|---|---|
| `index.html` | Sayfanın kendisi: 3B sahne, kumandalar, grafikler, açıklamalar |
| `fizik.js` | Fizik motoru: 6 serbestlik dereceli çözücü ve soğuk gaz itki sistemi |
| `geometri.js` | Ölçüler, amortisör modeli ve bacak kinematiği |
| `dogrula.mjs`, `referans.json`, `dogrulama.json` | Fizik motorunu takımın Python modeliyle karşılaştıran test ve sonuçları |
| `python_referans.py` | `referans.json`'u üreten betik; takımın bu depoda olmayan Python hesap koduna ihtiyaç duyar |
| `SIMULASYONU_AC.bat` | Windows'ta indirilen kopyayı çift tıklamayla açar |
| `BENIOKU.md` | Ayrıntılı kılavuz: fizik modeli, doğrulama, bilinen sınırlar |

## Kendi bilgisayarınızda açmak

Depoyu indirin (**Code → Download ZIP**), klasörde şunu çalıştırın:

```bash
python -m http.server 8777
```

Sonra tarayıcıda `http://127.0.0.1:8777/` adresini açın. Windows'ta
`SIMULASYONU_AC.bat` bunu sizin yerinize yapar. `index.html` dosyasına doğrudan
çift tıklamak çalışmaz: sayfa, tarayıcının yalnızca bir sunucu üzerinden yüklediği
JavaScript modülleri kullanıyor.

Fizik motorunun doğrulaması (Node.js gerekir):

```bash
node dogrula.mjs
```
