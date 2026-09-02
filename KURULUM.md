# WX Shot Universal 1.2.0 — Hızlı Kurulum

Tek `WX-Shot-Universal-v1.2.0.zip` paketi Brave, Chrome, Edge, Opera, Vivaldi ve Firefox'u destekler.

## Başlamadan önce

ZIP dosyasını doğrudan seçmeyin. Önce **Tümünü ayıkla** ile klasöre çıkarın. Seçeceğiniz klasörde doğrudan `manifest.json`, `src` ve `assets` bulunmalıdır.

## Chromium tarayıcıları

| Tarayıcı | Eklenti adresi |
|---|---|
| Brave | `brave://extensions/` |
| Chrome | `chrome://extensions/` |
| Edge | `edge://extensions/` |
| Opera | `opera://extensions/` |
| Vivaldi | `vivaldi://extensions/` |

1. Yukarıdaki eklenti adresini açın.
2. **Geliştirici modu** seçeneğini etkinleştirin.
3. **Paketlenmemiş öğe yükle** düğmesine basın.
4. ZIP'ten çıkardığınız WX Shot klasörünü seçin.
5. Normal bir web sayfasında eklenti düğmesini veya `Alt + Shift + S` kısayolunu kullanın.

## Firefox

1. `about:debugging#/runtime/this-firefox` adresini açın.
2. **Geçici Eklenti Yükle** düğmesine basın.
3. Aynı Universal klasördeki `manifest.json` dosyasını seçin.

Geçici eklenti Firefox yeniden başlatılınca kaldırılır. Kalıcı dağıtım Mozilla imzası gerektirir.

## Safari

macOS üzerinde Universal klasörü paketleyin:

```sh
xcrun safari-web-extension-packager /WX-Shot-Universal-klasoru
```

Oluşturulan Xcode projesini Apple geliştirici kimliğiyle imzalayın.

## Sorun giderme

- **Manifest bulunamadı:** ZIP'i değil, çıkarılan ve `manifest.json` içeren klasörü seçin.
- **Düğme çalışmıyor:** `brave://`, `chrome://`, `edge://` veya `about:` sayfasında olmayın; normal web sayfasını yenileyin.
- **Kısayol çalışmıyor:** Tarayıcının eklenti kısayolları sayfasından çakışmayı kontrol edin.
- **PrtSc başka uygulamayı açıyor:** WX Shot düğmesini veya `Alt + Shift + S` kullanın.

Tüm özellikler, izin açıklamaları, kısayollar ve teknik ayrıntılar için `README.md` dosyasına bakın.
