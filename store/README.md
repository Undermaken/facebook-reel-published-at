# Guida alla pubblicazione sul Chrome Web Store

Questa cartella contiene testi, immagini e video per pubblicare la versione 0.3.1 dell'estensione. Le immagini dimostrative usano l'illustrazione originale del pannello; il box data e le impostazioni provengono dalla build reale. Non sono schermate di un Reel Facebook reale.

## Materiale pronto

| Materiale                                                     | File                                         |
| ------------------------------------------------------------- | -------------------------------------------- |
| Nome e descrizione breve nelle cinque lingue                  | `_locales/{en,it,es,de,fr}/messages.json`    |
| Descrizione dettagliata nelle cinque lingue                   | `store/listings/{en,it,es,de,fr}.md`         |
| Privacy policy nelle cinque lingue                            | `store/privacy-policy.md`                    |
| Testo per Privacy practices e istruzioni ai revisori          | `store/dashboard.md`                         |
| Icona dello store con margine trasparente                     | `store/assets/store-icon-128.png`            |
| Tre screenshot 1280×800 per lingua                            | `store/assets/{en,it,es,de,fr}/`             |
| Promo globale 440×280 e marquee 1400×560                      | `store/assets/promo-*.png`                   |
| Video silenzioso di 17 s con caption integrate, cinque lingue | `store/video/demo-*.mp4`                     |
| Sottotitoli modificabili                                      | `store/video/{en,it,es,de,fr}.srt`           |
| ZIP per l'upload                                              | `store/output/facebook-reel-dates-0.3.1.zip` |

Le immagini promo non hanno testo e sono condivise fra le lingue. Gli screenshot e i video sono localizzati. Puoi sostituire lo screenshot illustrativo con una tua schermata di un Reel reale, ottenuta con il permesso necessario e senza dati personali visibili.

## Cosa manca da parte tua

1. **Account sviluppatore Google:** registrazione al [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole), pagamento della quota una tantum, verifica dell'email, nome del publisher e verifica in due passaggi. Google richiede questi passaggi prima della pubblicazione.
2. **Repository definitivo:** la correzione della posizione è già in `main` tramite la [PR #2](https://github.com/Undermaken/facebook-reel-published-at/pull/2). Integra anche questo kit in `main` prima di usare il link pubblico alla privacy policy: `https://github.com/Undermaken/facebook-reel-published-at/blob/main/store/privacy-policy.md`.
3. **Reel di prova per i revisori:** scegli un URL pubblico che mostri davvero una data con questa build. Inseriscilo al posto del segnaposto in [dashboard.md](dashboard.md). Se Facebook richiede un login, fornisci l'accesso solo nel campo privato Test instructions della dashboard.
4. **Video facoltativo:** se vuoi usare il tuo video, registralo e caricalo su YouTube: la dashboard accetta un link YouTube, non il file MP4. Puoi anche caricare su YouTube i cinque video pronti. Nessun video è obbligatorio per la scheda.
5. **Scelta di distribuzione:** `Public` rende la scheda trovabile; `Unlisted` consente l'installazione a chi ha il link; `Private` è per i tester autorizzati. Scegli anche se pubblicare automaticamente dopo la revisione o approvare tu il rilascio.
6. **Schermata di un Reel reale:** gli screenshot del kit sono dimostrativi. Per la scheda finale consiglio di sostituire almeno la prima immagine con una cattura reale del box della data; Chrome chiede che le immagini facciano capire l'esperienza effettiva. Usa contenuti che puoi pubblicare e nascondi eventuali dati personali.

## Passi nella dashboard

1. Parti da un commit finale verificato. Usa Node 26 per questo workspace, poi esegui `npm ci`, `npm run check`, `npm run test:browser` e `npm run build`. I test non si avviano con il Node 23.7.0 presente anche su questa macchina, a causa di una dipendenza di test. Il manifest deve contenere una versione maggiore di qualsiasi versione già caricata. Il pacchetto aggiornato è la 0.3.1.
2. Rigenera lo ZIP con `npm run package:zip`. Controlla `store/output/SHA256.txt`. Nello ZIP `manifest.json` è alla radice.
3. In **Add new item**, carica lo ZIP. Nella scheda **Store listing**, scegli `en` come lingua principale e incolla la descrizione dettagliata da `store/listings/en.md`. Per `it`, `es`, `de`, `fr`, usa il menu delle lingue e incolla il file corrispondente. Il nome e la descrizione breve arrivano dal manifest.
4. Per ogni lingua, carica nell'ordine `01-date-on-reel.png`, `02-settings.png`, `03-below-reel.png`. Carica il promo 440×280 una sola volta; il marquee 1400×560 è facoltativo. Per l'icona dello store usa `store/assets/store-icon-128.png`; è anche inclusa nello ZIP come `icons/store-icon-128.png` e dichiarata nel manifest.
5. Nella scheda **Privacy practices**, usa i testi pronti in [dashboard.md](dashboard.md): scopo unico, giustificazione di `storage`, `scripting` e del sito Facebook, dichiarazione dei dati trattati e assenza di codice remoto. Inserisci l'URL pubblico della [privacy policy](privacy-policy.md). Anche i dati elaborati solo in locale vanno dichiarati.
6. Nella scheda **Distribution**, scegli visibilità e paesi. Nella scheda **Test instructions**, inserisci l'URL del Reel di prova e i passi per i revisori.
7. Controlla l'anteprima in tutte e cinque le lingue, poi usa **Submit for Review**. Se vuoi decidere tu il momento del rilascio, disattiva la pubblicazione automatica dopo la revisione. In quel caso Google indica 30 giorni per pubblicare la versione approvata.

Le schede e le schermate descrivono la funzione visibile. Non promettono che ogni Reel abbia una data, perché Facebook può non fornire metadati utilizzabili. L'estensione è indipendente e non usa il logo Facebook.

## Rigenerare immagini, video e ZIP

```sh
npm run build
node store/scripts/render-assets.mjs
node store/scripts/render-video.mjs
npm run package:zip
```

La generazione delle immagini richiede Chromium installato con Playwright; il video richiede `ffmpeg`; lo ZIP richiede `zip` e `unzip`. Questi strumenti sono già disponibili nel workspace attuale.

## Fonti ufficiali

- [Pubblicare un'estensione](https://developer.chrome.com/docs/webstore/publish)
- [Preparare il pacchetto ZIP](https://developer.chrome.com/docs/webstore/prepare)
- [Informazioni e lingue della scheda](https://developer.chrome.com/docs/webstore/cws-dashboard-listing)
- [Dimensioni delle immagini](https://developer.chrome.com/docs/webstore/images)
- [Campi privacy](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)
- [Dati elaborati solo in locale](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)
- [Distribuzione Public, Unlisted e Private](https://developer.chrome.com/docs/webstore/cws-dashboard-distribution)
