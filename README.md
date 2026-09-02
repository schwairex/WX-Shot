# WX Shot 1.1.0

WX Shot, açık tarayıcı sekmesinin görünür alanından seçim yapmanızı; seçimi çizim araçlarıyla düzenleyip panoya kopyalamanızı veya PNG olarak kaydetmenizi sağlayan, sunucusuz çalışan bir WebExtension projesidir.

## Özellikler

- Fareyle serbest alan seçimi ve anlık boyut göstergesi
- Akıcı ve yumuşatılmış kalem; tabletlerde basınç desteği
- Kalem, vurgulayıcı, çizgi, ok, dikdörtgen, elips, metin ve silgi
- Şekiller için `Shift` ile kare/daire ve 45° açı sabitleme
- Araç klavye kısayolları (`P`, `H`, `L`, `A`, `R`, `O`, `T`, `E`)
- Renk ve çizgi kalınlığı seçimi
- Geri al / yinele (`Ctrl/Cmd + Z`, `Ctrl/Cmd + Shift + Z`)
- PNG olarak “Farklı kaydet” ve panoya kopyalama
- Yüksek DPI / Retina ekran desteği
- Verileri dışarı göndermeyen, tamamen yerel çalışma
- Chromium ve Firefox için ayrı manifest dosyaları

## Kurulum — Chrome, Edge, Brave, Opera, Vivaldi

1. Bu klasörü bilgisayarınıza çıkarın.
2. Tarayıcınızın eklenti sayfasını açın (`chrome://extensions`, Edge için `edge://extensions`).
3. **Geliştirici modu** seçeneğini açın.
4. **Paketlenmemiş öğe yükle** düğmesine basıp bu klasörü seçin.
5. Araç çubuğundaki WX Shot düğmesine tıklayın veya `Alt + Shift + S` kullanın.

Tarayıcı bazında ayrıntılı ve sorun giderme adımları için `KURULUM.md` dosyasına bakın.

## Kurulum — Firefox

1. `manifest.json` dosyasını geçici olarak başka bir adla değiştirin.
2. `manifest.firefox.json` dosyasını `manifest.json` olarak adlandırın.
3. Firefox'ta `about:debugging#/runtime/this-firefox` adresini açın.
4. **Geçici eklenti yükle** seçeneğiyle `manifest.json` dosyasını seçin.

Kalıcı Firefox dağıtımı için paket Mozilla Add-ons üzerinden imzalanmalıdır.

## Kullanım

1. Araç çubuğundaki WX Shot düğmesine tıklayın, `Alt + Shift + S` kullanın veya sayfa odaktayken `PrtSc` tuşuna basın.
2. Fareyle istediğiniz alanı sürükleyerek seçin.
3. Alt araç çubuğundan çizim aracını seçin ve işaretlemelerinizi yapın.
4. **Kopyala** veya **Farklı kaydet** seçeneğini kullanın.
5. Herhangi bir aşamada `Esc` ile çıkabilirsiniz.

Çizgi ve ok çizerken `Shift` tuşu açıyı 45 derecelik adımlara sabitler. Dikdörtgen ve elipste `Shift`, kare veya daire oluşturur.

## Tarayıcı güvenlik sınırları

WebExtension güvenlik modeli nedeniyle bir eklenti işletim sistemi genelindeki `PrtSc` olayını garanti ederek devralamaz ve tarayıcı dışındaki uygulamaları yakalayamaz. WX Shot, `PrtSc` olayını web sayfası odaktayken dinler. Araç çubuğu düğmesi ile `Alt + Shift + S`, tarayıcılar arası güvenilir yöntemlerdir. Dahili tarayıcı sayfaları (`chrome://`, `edge://`, `about:`), eklenti mağazaları ve bazı korumalı sayfalar tarayıcı tarafından yakalamaya kapatılmıştır.

Safari aynı WebExtension kod tabanını kullanabilir; fakat Apple'ın `safari-web-extension-packager` aracıyla bir Xcode projesine paketlenmesi, imzalanması ve dağıtılması gerekir (bu aracın önceki adı `safari-web-extension-converter` idi).

## Dosya yapısı

```text
wx-shot/
├── build.ps1                  # Dağıtım paketlerini üretir
├── manifest.json              # Chromium MV3
├── manifest.firefox.json      # Firefox MV3
├── assets/                    # Tarayıcı ikonları
├── tools/create-icons.ps1     # İkon üretim aracı
└── src/
    ├── background.js          # Yakalama ve indirme akışı
    └── content.js             # Seçim ve düzenleyici arayüzü
```

Dağıtım paketlerini yeniden üretmek için PowerShell'de `./build.ps1` çalıştırılabilir.

## Gizlilik

Ekran görüntüleri ağ üzerinden gönderilmez, analiz edilmez ve saklanmaz. Görsel yalnızca geçici olarak aktif sekme ile eklentinin arka plan işlemi arasında aktarılır; kullanıcı kopyaladığında panoya, kaydettiğinde seçtiği dosyaya yazılır.

## Lisans

MIT
