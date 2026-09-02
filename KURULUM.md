# WX Shot — Tarayıcı Kurulum Rehberi

> Önemli: ZIP dosyası **doğrudan seçilmez**. Önce ZIP dosyasını bir klasöre çıkarın. Seçeceğiniz klasörün içinde doğrudan `manifest.json`, `src` ve `assets` bulunmalıdır.

## Brave

1. `WX-Shot-Brave-v1.1.0.zip` dosyasına sağ tıklayın ve **Tümünü ayıkla** seçeneğini kullanın.
2. Brave adres çubuğuna `brave://extensions/` yazın.
3. Sağ üstten **Geliştirici modu** seçeneğini açın.
4. **Paketlenmemiş öğe yükle** düğmesine basın.
5. ZIP'i çıkardığınız, içinde doğrudan `manifest.json` bulunan klasörü seçin.
6. WX Shot kartını araç çubuğuna sabitleyin.
7. Normal bir web sayfasında araç çubuğu düğmesini veya `Alt + Shift + S` kısayolunu deneyin.

Brave'in kendi sayfalarında (`brave://extensions/`, `brave://settings/` gibi) eklentiler çalıştırılamaz. Testi `https://example.com` gibi normal bir sayfada yapın.

### Brave hata kontrolü

- **Manifest dosyası eksik veya okunamıyor:** ZIP'i seçmiş ya da bir üst klasörü seçmişsinizdir. `manifest.json` dosyasının doğrudan seçilen klasörde olduğunu kontrol edin.
- **Uzantı yüklenemedi:** Firefox paketini değil, `WX-Shot-Brave-v1.1.0.zip` paketini kullandığınızdan emin olun.
- **Düğmeye basınca bir şey olmuyor:** `brave://` sayfasında olmayın; normal bir web sayfası açın ve sayfayı bir kez yenileyin.
- **Kısayol çalışmıyor:** `brave://extensions/shortcuts` sayfasından WX Shot kısayolunu kontrol edin. Başka bir uygulama kullanıyorsa farklı bir kısayol atayın.
- **PrtSc Windows aracını da açıyor:** Bu işletim sistemi davranışıdır. Kesin yöntem WX Shot düğmesi veya `Alt + Shift + S` kısayoludur.

## Google Chrome

1. `WX-Shot-Chromium-v1.1.0.zip` dosyasını bir klasöre çıkarın.
2. `chrome://extensions/` sayfasını açın.
3. **Geliştirici modu** seçeneğini açın.
4. **Paketlenmemiş öğe yükle** seçeneğine basın.
5. İçinde `manifest.json` bulunan çıkarılmış klasörü seçin.
6. Normal bir web sayfasında uzantı düğmesini veya `Alt + Shift + S` kısayolunu kullanın.

## Microsoft Edge

1. `WX-Shot-Chromium-v1.1.0.zip` dosyasını bir klasöre çıkarın.
2. `edge://extensions/` sayfasını açın.
3. **Geliştirici modu** seçeneğini açın.
4. **Paketlenmemiş öğe yükle** düğmesine basın.
5. İçinde `manifest.json` bulunan çıkarılmış klasörü seçin.

## Opera / Opera GX

1. `WX-Shot-Chromium-v1.1.0.zip` dosyasını bir klasöre çıkarın.
2. `opera://extensions/` sayfasını açın.
3. **Geliştirici modu** seçeneğini açın.
4. **Paketlenmemiş öğe yükle** ile çıkarılmış klasörü seçin.

## Vivaldi

1. `WX-Shot-Chromium-v1.1.0.zip` dosyasını bir klasöre çıkarın.
2. `vivaldi://extensions/` sayfasını açın.
3. **Geliştirici modu** seçeneğini açın.
4. **Paketlenmemiş öğe yükle** ile çıkarılmış klasörü seçin.

## Firefox

Geçici geliştirme kurulumu:

1. `WX-Shot-Firefox-v1.1.0.zip` dosyasını bir klasöre çıkarın.
2. Firefox'ta `about:debugging#/runtime/this-firefox` sayfasını açın.
3. **Geçici Eklenti Yükle** düğmesine basın.
4. Çıkarılmış klasördeki `manifest.json` dosyasını seçin.

Firefox yeniden başlatıldığında geçici kurulum kaldırılır. Kalıcı dağıtım için paketin Mozilla Add-ons üzerinden imzalanması gerekir.

## Safari

Safari doğrudan bu ZIP'i kurmaz. Chromium paketini Apple'ın Safari Web Extension paketleyicisiyle dönüştürmek gerekir:

```sh
xcrun safari-web-extension-packager /WX-Shot-klasoru
```

Oluşan Xcode projesi Apple geliştirici kimliğiyle imzalanıp çalıştırılır. App Store dağıtımı için Apple Developer Program gerekir.

## Kullanım

1. Normal bir web sayfası açın.
2. WX Shot düğmesine basın veya `Alt + Shift + S` kullanın.
3. Fareyle alan seçin.
4. Kalem, vurgulayıcı, çizgi, ok, dikdörtgen, elips, metin veya silgiyi kullanın.
5. **Kopyala** veya **Farklı kaydet** düğmesine basın.

Araçlara `P`, `H`, `L`, `A`, `R`, `O`, `T` ve `E` tuşlarıyla hızlı geçebilirsiniz. Şekil çizerken `Shift`, açı veya oranı sabitler.

Tarayıcı güvenliği nedeniyle dahili sayfalarda (`brave://`, `chrome://`, `edge://`, `about:`), eklenti mağazalarında ve bazı korumalı sayfalarda ekran yakalama çalışmaz.
