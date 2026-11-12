import { story } from './stories';

export function viewer(author = 'Autore del Reel', poster = 'first') {
  // Reduced DOM from the supplied rendered body: dialog > main > video + author h2.
  return `<div role="dialog"><div role="main"><section class="player">
    <video playsinline poster="/poster-${poster}.png"></video>
    <div class="footer"><div class="author-row"><div class="author">
      <h2><span><a href="/profile.php?id=10001">${author}</a></span></h2>
    </div><div></div><div><button>Segui</button></div></div>
    <p>Descrizione del Reel</p></div>
  </section><section hidden><video></video></section></div></div>`;
}

export function pageHtml(inline = false, body = viewer(), publication = story()) {
  return `<!doctype html><html lang="it"><head><meta charset="UTF-8">
    <style>
      body { margin: 0; background: #242526; color: white; font-family: system-ui; }
      [role="dialog"] { display: flex; justify-content: center; }
      .player { width: 400px; height: 680px; position: relative; margin: 12px; }
      video { display: block; width: 100%; height: 100%; background: #31383b; }
      .footer { position: absolute; bottom: 50px; left: 16px; right: 16px; }
      .author-row { display: flex; align-items: center; gap: 8px; }
      h2 { font-size: 17px; margin: 0; } a { color: inherit; }
      button { color: white; background: none; border: none; }
    </style>
    ${inline ? `<script type="application/json">${JSON.stringify({ require: [[{ __bbox: { result: { data: publication } } }]] })}</script>` : ''}
    </head><body>${body}</body></html>`;
}
