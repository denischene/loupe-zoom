import { Download, Eye, MousePointerClick } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import logoFirefox from "@/assets/logo-firefox.png";
import logoEdge from "@/assets/logo-edge.png";
import logoChrome from "@/assets/logo-chrome.png";

const DARK_BROWN = "#3b1f0a";

const Index = () => {
  const downloadFile = (url: string, filename: string) => {
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error("Échec du téléchargement");
        return res.blob();
      })
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch((err) => alert(err.message));
  };

  return (
    <div className="min-h-screen bg-background browser-dark-text">
      {/* Skip link for keyboard users (WCAG 2.4.1) */}
      <a
        href="#usage-title"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded"
      >
        Aller au contenu principal
      </a>

      {/* Hero */}
      <header className="pt-16 pb-10 px-6 text-center space-y-6 max-w-3xl mx-auto">
        <img
          src="/logo-loupe.png"
          alt=""
          width={80}
          height={80}
          className="mx-auto drop-shadow-md browser-dark-invert"
        />
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">
          Loupe-Zoom
        </h1>
        <p className="text-lg max-w-xl mx-auto" style={{ color: DARK_BROWN }}>
          Extension Firefox, Edge et Chrome de loupe souris et loupe clavier (
          <kbd className="px-2 py-0.5 rounded bg-muted text-foreground text-sm font-mono border border-border">
            Ctrl+Maj+Z
          </kbd>
          ).
        </p>

        {/* Badges */}
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-sm font-medium border-border">
            <Eye className="w-4 h-4 text-primary" aria-hidden="true" />
            Accessibilité
          </Badge>
          <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-sm font-medium border-border">
            <span className="text-base leading-none" aria-hidden="true">🇫🇷</span>
            Français
          </Badge>
          <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-sm font-medium border-border">
            <MousePointerClick className="w-4 h-4 text-primary" aria-hidden="true" />
            Clavier &amp; souris
          </Badge>
        </div>
      </header>

      <main id="main" className="max-w-3xl mx-auto px-6 pb-20 space-y-16">
        {/* Loupe illustrations */}
        <section aria-label="Illustrations des loupes" className="flex flex-col md:flex-row items-center justify-center gap-8 bg-muted/40 rounded-2xl p-8">
          <img
            src="/loupe-souris.png"
            alt="Loupe à utiliser à la souris"
            className="max-w-[280px] w-full drop-shadow-lg rounded-lg"
            loading="lazy"
          />
          <img
            src="/loupe-clavier.png"
            alt="Loupe à utiliser au clavier"
            className="max-w-[420px] w-full drop-shadow-lg rounded-lg"
            loading="lazy"
          />
        </section>

        {/* Comment l'utiliser */}
        <section className="space-y-6" aria-labelledby="usage-title">
          <h2 id="usage-title" className="text-2xl md:text-3xl font-bold text-center text-foreground">
            Comment l'utiliser
          </h2>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Mode Souris */}
            <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
              <h3 className="font-semibold flex items-center gap-2 text-base" style={{ color: DARK_BROWN }}>
                <span aria-hidden="true">🔎</span> Mode Souris
              </h3>
              <ol className="list-decimal list-inside space-y-2 text-sm" style={{ color: DARK_BROWN }}>
                <li>Cliquer sur l'icône Loupe dans la barre d'outils pour activer/désactiver la loupe.</li>
                <li>Clic droit pour faire disparaître la loupe. Elle reste disponible au bout de la souris. Il suffit de faire un 1<sup>er</sup> clic pour la faire réapparaître.</li>
                <li>Un 2<sup>e</sup> clic depuis la loupe visible valide l'élément (hyperlien, bouton…)</li>
                <li>
                  <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono border border-border" style={{ color: DARK_BROWN }}>Ctrl+molette haut-bas</kbd>{" "}
                  permet de changer de niveau de zoom.
                </li>
              </ol>
            </div>

            {/* Mode Focus-loupe */}
            <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
              <h3 className="font-semibold flex items-center gap-2 text-base" style={{ color: DARK_BROWN }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="browser-dark-invert" style={{ color: DARK_BROWN }}>
                  <rect x="2" y="5" width="20" height="14" rx="2.5"/>
                  <path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M18 13h.01M7 17h10"/>
                </svg>
                Mode Focus-loupe
              </h3>
              <ol className="list-decimal list-inside space-y-2 text-sm" style={{ color: DARK_BROWN }}>
                <li>
                  <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono border border-border" style={{ color: DARK_BROWN }}>Tab</kbd> /{" "}
                  <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono border border-border" style={{ color: DARK_BROWN }}>Maj.+Tab</kbd>{" "}
                  pour naviguer entre les éléments.
                </li>
                <li>
                  <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono border border-border" style={{ color: DARK_BROWN }}>Entrée</kbd>{" "}
                  pour faire apparaître la loupe.
                </li>
                <li>
                  Si l'élément est activable (lien, bouton), un 2<sup>e</sup>{" "}
                  <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono border border-border" style={{ color: DARK_BROWN }}>Entrée</kbd>{" "}
                  le valide.
                </li>
                <li>
                  <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono border border-border" style={{ color: DARK_BROWN }}>+</kbd> et{" "}
                  <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono border border-border" style={{ color: DARK_BROWN }}>-</kbd>{" "}
                  pour changer le niveau de zoom.
                </li>
                <li>
                  <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono border border-border" style={{ color: DARK_BROWN }}>Échap.</kbd>{" "}
                  pour faire disparaître le Focus-loupe.{" "}
                  <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono border border-border" style={{ color: DARK_BROWN }}>Entrée</kbd>{" "}
                  pour le faire réapparaître.
                </li>
              </ol>
            </div>

            {/* Mode Agrandisseur */}
            <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
              <h3 className="font-semibold flex items-center gap-2 text-base" style={{ color: DARK_BROWN }}>
                <svg width="24" height="18" viewBox="0 0 28 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="browser-dark-invert" style={{ color: DARK_BROWN }}>
                  <rect x="1.5" y="1.5" width="25" height="17" rx="3.5"/>
                  <text x="14" y="15" textAnchor="middle" fontFamily="system-ui,sans-serif" fontSize="13" fontWeight="800" fill="currentColor" stroke="none">A</text>
                </svg>
                Mode Agrandisseur
              </h3>
              <ol className="list-decimal list-inside space-y-2 text-sm" style={{ color: DARK_BROWN }}>
                <li>
                  <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono border border-border" style={{ color: DARK_BROWN }}>▲</kbd>{" "}
                  <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono border border-border" style={{ color: DARK_BROWN }}>▼</kbd>{" "}
                  <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono border border-border" style={{ color: DARK_BROWN }}>◄</kbd>{" "}
                  <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono border border-border" style={{ color: DARK_BROWN }}>►</kbd>{" "}
                  pour naviguer dans la page.
                </li>
                <li>
                  <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono border border-border" style={{ color: DARK_BROWN }}>Ctrl</kbd>+
                  <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono border border-border" style={{ color: DARK_BROWN }}>▲</kbd>{" "}
                  <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono border border-border" style={{ color: DARK_BROWN }}>▼</kbd>{" "}
                  <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono border border-border" style={{ color: DARK_BROWN }}>◄</kbd>{" "}
                  <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono border border-border" style={{ color: DARK_BROWN }}>►</kbd>{" "}
                  pour naviguer plus finement.
                </li>
                <li>
                  <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono border border-border" style={{ color: DARK_BROWN }}>Entrée</kbd>{" "}
                  pour valider un élément.
                </li>
                <li>
                  <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono border border-border" style={{ color: DARK_BROWN }}>+</kbd> et{" "}
                  <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono border border-border" style={{ color: DARK_BROWN }}>-</kbd>{" "}
                  pour changer le niveau de zoom.
                </li>
                <li>
                  <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono border border-border" style={{ color: DARK_BROWN }}>Échap.</kbd>{" "}
                  pour faire disparaître l'agrandisseur et{" "}
                  <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono border border-border" style={{ color: DARK_BROWN }}>Ctrl+Maj+Z</kbd>{" "}
                  pour le faire réapparaître.
                </li>
              </ol>
            </div>
          </div>
        </section>

        {/* Téléchargements */}
        <section className="space-y-8" aria-labelledby="download-title">
          <h2 id="download-title" className="text-2xl md:text-3xl font-bold text-center text-foreground">
            Télécharger
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Firefox */}
            <article className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <img src={logoFirefox} alt="" width={48} height={48} loading="lazy" />
                <h3 className="font-semibold text-lg" style={{ color: DARK_BROWN }}>Firefox</h3>
              </div>
              <Button
                size="lg"
                onClick={() => downloadFile("/loupe-extension.zip", "loupe-extension.zip")}
                className="gap-2 w-full h-auto py-3 whitespace-normal text-center leading-tight browser-dark-link-outline"
                aria-label="Télécharger Loupe-Zoom pour Firefox"
              >
                <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>
                  Télécharger Loupe-Zoom
                  <br />
                  pour Firefox
                </span>
              </Button>
              <div className="text-sm space-y-2 text-left bg-background rounded-lg border p-4" style={{ color: DARK_BROWN }}>
                <p className="font-semibold" style={{ color: DARK_BROWN }}>Installation :</p>
                <ol className="list-decimal list-inside space-y-1.5">
                  <li>
                    Ouvrez <code className="text-primary break-all">about:debugging#/runtime/this-firefox</code>
                  </li>
                  <li>Cliquez « Charger un module complémentaire temporaire »</li>
                  <li>
                    Sélectionnez le fichier <code className="text-primary">.zip</code> (sans le décompresser).
                  </li>
                  <li>Gérer les extensions et épingler à la barre d'outils.</li>
                  <li>
                    Ouvrez une page web et cliquez sur le bouton Loupe-Zoom, ou utilisez le raccourci{" "}
                    <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono border border-border" style={{ color: DARK_BROWN }}>Ctrl+Maj+Z</kbd>{" "}
                    pour lancer l'extension.
                  </li>
                </ol>
              </div>
            </article>

            {/* Edge / Chrome */}
            <article className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <img src={logoEdge} alt="" width={48} height={48} loading="lazy" />
                <img src={logoChrome} alt="" width={48} height={48} loading="lazy" />
                <h3 className="font-semibold text-lg" style={{ color: DARK_BROWN }}>Edge &amp; Chrome</h3>
              </div>
              <Button
                size="lg"
                onClick={() => downloadFile("/loupe-extension-chrome.zip", "loupe-extension-chrome.zip")}
                className="gap-2 w-full h-auto py-3 whitespace-normal text-center leading-tight browser-dark-link-outline"
                aria-label="Télécharger Loupe-Zoom pour Edge et Chrome"
              >
                <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>
                  Télécharger Loupe-Zoom
                  <br />
                  pour Edge et Chrome
                </span>
              </Button>
              <div className="text-sm space-y-2 text-left bg-background rounded-lg border p-4" style={{ color: DARK_BROWN }}>
                <p className="font-semibold" style={{ color: DARK_BROWN }}>Installation :</p>
                <ol className="list-decimal list-inside space-y-1.5">
                  <li>Décompressez l'archive <code className="text-primary">.zip</code> dans un dossier.</li>
                  <li>Dans Chrome ou Edge, allez dans <strong>Extensions / Gérer les extensions</strong>.</li>
                  <li>Actionnez le bouton « Charger l'extension décompressée ».</li>
                  <li>Choisissez le dossier dans lequel vous avez décompressé l'archive (ne pas rentrer dans le dossier, sélectionnez juste le dossier).</li>
                  <li>Cliquez sur le bouton « Extension » de la barre du navigateur et décochez l'œil ou l'épingle sur la ligne Loupe-Zoom pour l'ajouter à la barre.</li>
                  <li>
                    Ouvrez une page web et cliquez sur le bouton Loupe-Zoom, ou utilisez le raccourci{" "}
                    <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono border border-border" style={{ color: DARK_BROWN }}>Ctrl+Maj+Z</kbd>{" "}
                    pour lancer l'extension.
                  </li>
                </ol>
              </div>
            </article>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Index;
