<div align="center">
  <img src="assets/icon-128.png" width="112" height="112" alt="WX Shot logosu">
  <h1>WX Shot</h1>
  <p><strong>Seç. İşaretle. Paylaş.</strong></p>
  <p>Hızlı, modern ve gizlilik odaklı tarayıcı ekran görüntüsü aracı.</p>

  <p>
    <img src="https://img.shields.io/badge/version-1.2.0-6D5FE8?style=for-the-badge" alt="Sürüm 1.2.0">
    <img src="https://img.shields.io/badge/Manifest-V3-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Manifest V3">
    <img src="https://img.shields.io/badge/paket-Universal-10B981?style=for-the-badge" alt="Tek universal paket">
    <img src="https://img.shields.io/badge/lisans-MIT-F59E0B?style=for-the-badge" alt="MIT lisansı">
  </p>

  <p>
    <img src="https://img.shields.io/badge/Brave-destekleniyor-FB542B?style=flat-square&logo=brave&logoColor=white" alt="Brave desteği">
    <img src="https://img.shields.io/badge/Chrome-destekleniyor-4285F4?style=flat-square&logo=googlechrome&logoColor=white" alt="Chrome desteği">
    <img src="https://img.shields.io/badge/Edge-destekleniyor-0078D7?style=flat-square&logo=microsoftedge&logoColor=white" alt="Edge desteği">
    <img src="https://img.shields.io/badge/Firefox-destekleniyor-FF7139?style=flat-square&logo=firefoxbrowser&logoColor=white" alt="Firefox desteği">
    <img src="https://img.shields.io/badge/Safari-paketlenebilir-006CFF?style=flat-square&logo=safari&logoColor=white" alt="Safari desteği">
  </p>
</div>

---

## WX Shot nedir?

WX Shot, açık tarayıcı sekmesinin görünür bölümünden istediğiniz alanı seçmenizi, seçimi kaydetmeden önce düzenlemenizi ve sonucu panoya ya da PNG dosyasına aktarmanızı sağlayan bir WebExtension'dır.

Görüntüler bir sunucuya yüklenmez. Yakalama, kırpma, çizim ve dışa aktarma işlemlerinin tamamı tarayıcınızda yerel olarak gerçekleştirilir.

## Öne çıkan özellikler

| Alan | Özellikler |
|---|---|
| Yakalama | Görünür sekmeden fareyle serbest alan seçimi, anlık piksel ölçüsü, yüksek DPI desteği |
| Çizim | Yumuşatılmış kalem, vurgulayıcı, düz çizgi, ok, dikdörtgen ve elips |
| Giriş | Fare, dokunma ve grafik tablet; desteklenen kalemlerde basınç hassasiyeti |
| Düzenleme | Metin, silgi, renk paleti, çizgi kalınlığı, geri al ve yinele |
| Hassasiyet | `Shift` ile 45° çizgi/ok, kare ve daire sabitleme |
| Dışa aktarma | PNG olarak farklı kaydetme veya doğrudan panoya kopyalama |
| Gizlilik | Sunucusuz çalışma; telemetri, hesap, reklam ve takip kodu yok |
| Uyumluluk | Tek paketle Brave, Chrome, Edge, Opera, Vivaldi ve Firefox |

## Akıcı çizim motoru

WX Shot 1.2.0 çizim motoru, büyük ve yüksek çözünürlüklü görüntülerde gecikmeyi azaltmak üzere tasarlanmıştır:

- Canlı kalem hareketleri ayrı bir GPU dostu önizleme katmanında işlenir.
- İşaretçi olayları ekran yenileme hızına göre gruplanır.
- Tarayıcının yüksek frekanslı birleştirilmiş giriş noktaları kullanılır.
- Çizgi noktaları bitişte sadeleştirilip yumuşak eğrilere dönüştürülür.
- Normal çizimlerde geçmiş eylemler her hareket veya kalem bırakmada yeniden oluşturulmaz.
- Çok büyük ekran görüntülerinde düzenleme katmanı otomatik optimize edilir; dışa aktarım orijinal görüntü boyutunda yapılır.
- Silgi, çalışma katmanının hızlı bir kopyası üzerinde canlı çalışır ve sonuç tek işlemde birleştirilir.

## Desteklenen tarayıcılar

![Chrome 121+](https://img.shields.io/badge/Chrome-121%2B-4285F4?style=flat-square&logo=googlechrome&logoColor=white)
![Firefox 121+](https://img.shields.io/badge/Firefox-121%2B-FF7139?style=flat-square&logo=firefoxbrowser&logoColor=white)

| Tarayıcı | Durum | Kurulum yöntemi |
|---|---|---|
| Brave | Test edildi | Universal klasörü paketlenmemiş eklenti olarak yüklenir |
| Google Chrome | Destekleniyor | Universal klasörü paketlenmemiş eklenti olarak yüklenir |
| Microsoft Edge | Destekleniyor | Universal klasörü paketlenmemiş eklenti olarak yüklenir |
| Opera / Opera GX | Destekleniyor | Universal klasörü paketlenmemiş eklenti olarak yüklenir |
| Vivaldi | Destekleniyor | Universal klasörü paketlenmemiş eklenti olarak yüklenir |
| Firefox | Destekleniyor | Aynı klasördeki `manifest.json` geçici eklenti olarak seçilir |
| Safari | Dönüştürülebilir | Aynı klasör Safari Web Extension paketleyicisiyle paketlenir |

> Tek ZIP ve tek `manifest.json` kullanılır. Ayrı Chrome veya Firefox paketi yoktur.

## Kurulum

### Paketi hazırlayın

1. `WX-Shot-Universal-v1.2.0.zip` dosyasını indirin.
2. ZIP'e sağ tıklayıp **Tümünü ayıkla** seçeneğini kullanın.
3. Çıkan klasörde doğrudan `manifest.json`, `src` ve `assets` bulunduğunu kontrol edin.

> ZIP dosyasını doğrudan **Paketlenmemiş öğe yükle** penceresinde seçmeyin. Önce klasöre çıkarılmalıdır.

### Brave

1. `brave://extensions/` adresini açın.
2. Sağ üstten **Geliştirici modu** seçeneğini etkinleştirin.
3. **Paketlenmemiş öğe yükle** düğmesine basın.
4. İçinde `manifest.json` bulunan WX Shot klasörünü seçin.
5. Eklentiyi araç çubuğuna sabitleyin ve normal bir web sayfasında deneyin.

### Google Chrome

1. `chrome://extensions/` adresini açın.
2. **Geliştirici modu** seçeneğini açın.
3. **Paketlenmemiş öğe yükle** ile WX Shot klasörünü seçin.

### Microsoft Edge

1. `edge://extensions/` adresini açın.
2. **Geliştirici modu** seçeneğini açın.
3. **Paketlenmemiş öğe yükle** ile WX Shot klasörünü seçin.

### Opera, Opera GX ve Vivaldi

1. Opera için `opera://extensions/`, Vivaldi için `vivaldi://extensions/` adresini açın.
2. **Geliştirici modu** seçeneğini açın.
3. Aynı WX Shot klasörünü paketlenmemiş eklenti olarak yükleyin.

### Firefox

1. `about:debugging#/runtime/this-firefox` adresini açın.
2. **Geçici Eklenti Yükle** düğmesine basın.
3. Universal klasördeki `manifest.json` dosyasını seçin.

Firefox yeniden başlatıldığında geçici kurulum kaldırılır. Kalıcı dağıtım için eklentinin Mozilla Add-ons üzerinden imzalanması gerekir.

### Safari

Safari, WebExtension klasörünü bir uygulama eklentisi olarak paketler. macOS üzerinde:

```sh
xcrun safari-web-extension-packager /WX-Shot-Universal-klasoru
```

Oluşturulan Xcode projesi Apple geliştirici kimliğiyle imzalanır. App Store dağıtımı için Apple Developer Program üyeliği gerekir.

## Kullanım

1. Yakalamak istediğiniz normal web sayfasını açın.
2. Araç çubuğundaki WX Shot düğmesine basın veya `Alt + Shift + S` kullanın.
3. Fareyle yakalamak istediğiniz alanı sürükleyerek seçin.
4. Düzenleyicide bir araç, renk ve çizgi kalınlığı belirleyin.
5. Görseli işaretleyin.
6. **Kopyala** ile panoya aktarın veya **Farklı kaydet** ile PNG olarak kaydedin.

Herhangi bir aşamada `Esc` ile çıkabilirsiniz.

## Araçlar ve kısayollar

| Araç | Tuş | Açıklama |
|---|---:|---|
| Kalem | `P` | Yumuşatılmış serbest çizim; tabletlerde basınç destekli |
| Vurgulayıcı | `H` | Yarı saydam geniş işaretleme |
| Çizgi | `L` | Düz çizgi; `Shift` ile 45° açı sabitleme |
| Ok | `A` | Açıklama oku; `Shift` ile 45° açı sabitleme |
| Dikdörtgen | `R` | Çerçeve; `Shift` ile kare |
| Elips | `O` | Oval çerçeve; `Shift` ile daire |
| Metin | `T` | Görüntü üzerine yazı ekleme |
| Silgi | `E` | Eklenen çizim ve işaretleri silme |
| Geri al | `Ctrl/Cmd + Z` | Son düzenlemeyi geri alır |
| Yinele | `Ctrl/Cmd + Shift + Z` | Geri alınan düzenlemeyi yeniden uygular |

## İzinler ve gizlilik

![Yerel işleme](https://img.shields.io/badge/işleme-%25100%20yerel-10B981?style=flat-square)
![Telemetri yok](https://img.shields.io/badge/telemetri-yok-10B981?style=flat-square)
![Takip yok](https://img.shields.io/badge/takip-yok-10B981?style=flat-square)

| İzin | Kullanım amacı |
|---|---|
| `activeTab` | Kullanıcının başlattığı işlemde etkin sekmeyi yakalamak |
| `clipboardWrite` | Düzenlenen PNG görselini panoya kopyalamak |
| `downloads` | Görseli kullanıcının seçtiği konuma kaydetmek |
| `<all_urls>` | Normal web sayfalarında `PrtSc` olayını ve seçim arayüzünü çalıştırmak |

WX Shot ekran görüntülerini ağ üzerinden göndermez, kalıcı depolamaz ve analiz etmez. Shields.io görselleri yalnızca bu GitHub README dosyası görüntülendiğinde yüklenir; eklenti kodunda Shields.io veya başka bir harici servis bağlantısı bulunmaz.

## Tarayıcı güvenlik sınırları

- WebExtension API'leri işletim sistemi genelindeki `PrtSc` tuşunu garanti ederek devralamaz.
- `PrtSc`, web sayfası odaktayken dinlenir; en güvenilir yöntem eklenti düğmesi veya `Alt + Shift + S` kısayoludur.
- `brave://`, `chrome://`, `edge://`, `about:` ve eklenti mağazaları gibi korumalı sayfalarda içerik betikleri çalıştırılamaz.
- Eklenti yalnızca tarayıcı sekmesinin görünür alanını yakalar; başka masaüstü uygulamalarını yakalayamaz.

## Teknik yapı

```text
wx-shot/
├── assets/                    # Eklenti ikonları
├── src/
│   ├── background.js          # Yakalama, komut ve indirme akışı
│   └── content.js             # Alan seçimi ve çizim düzenleyicisi
├── tools/create-icons.ps1     # İkon üretim aracı
├── build.ps1                  # Universal ZIP üretim betiği
├── manifest.json              # Tüm tarayıcılar için ortak Manifest V3
├── README.md                  # Proje belgesi
├── KURULUM.md                 # Kısa kurulum ve sorun giderme rehberi
└── LICENSE                    # MIT lisansı
```

Ortak manifest hem `background.service_worker` hem `background.scripts` tanımlar. Chromium 121+ service worker ortamını, Firefox 121+ arka plan script ortamını kullanır. Safari desteklediği belge tabanlı ortamı seçer.

## Geliştirme

Projede derleme bağımlılığı veya uzaktan çalıştırılan kod yoktur. Kaynak klasörü doğrudan tarayıcıya yüklenebilir.

Dağıtım ZIP'ini yeniden oluşturmak için Windows PowerShell'de:

```powershell
./build.ps1
```

İkonları yeniden üretmek için:

```powershell
./tools/create-icons.ps1
```

## Sorun giderme

### “Manifest dosyası eksik veya okunamıyor”

ZIP dosyası yerine ZIP'ten çıkarılan ve içinde doğrudan `manifest.json` bulunan klasörü seçin.

### Eklenti düğmesine basınca bir şey olmuyor

Normal bir `http://` veya `https://` sayfası açın ve sayfayı bir kez yenileyin. Tarayıcının dahili ayar ve eklenti sayfaları korumalıdır.

### Kısayol çalışmıyor

Chromium tarayıcılarda eklenti kısayolları sayfasını açıp WX Shot komutunu kontrol edin. Brave için adres `brave://extensions/shortcuts` şeklindedir.

### `PrtSc` Windows ekran alıntısı aracını da açıyor

Bu işletim sistemi davranışıdır. WX Shot düğmesini veya `Alt + Shift + S` kısayolunu kullanın.

### Firefox kurulumu yeniden başlatınca kayboldu

`about:debugging` üzerinden yüklenen eklentiler geçicidir. Kalıcı kullanım için Mozilla imzalı paket gerekir.

## Lisans

![MIT](https://img.shields.io/badge/license-MIT-F59E0B?style=flat-square)

WX Shot, [MIT Lisansı](LICENSE) ile sunulur.

---

<div align="center">
  <sub>WX Shot — hızlı ekran görüntüsü, akıcı düzenleme, yerel gizlilik.</sub>
</div>
