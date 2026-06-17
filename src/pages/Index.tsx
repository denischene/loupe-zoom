import { useEffect, useState } from "react";
import { Download, Eye, MousePointerClick, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import logoFirefox from "@/assets/logo-firefox.png";
import logoEdge from "@/assets/logo-edge.png";
import logoChrome from "@/assets/logo-chrome.png";

type Lang = "fr" | "en";

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-[#4f9bff] focus-visible:ring-offset-2 rounded";

const Index = () => {
  // ----- Langue : détection auto du navigateur + bouton manuel (mémorisé) -----
  const [lang, setLang] = useState<Lang>(() => {
    if (typeof window === "undefined") return "fr";
    const saved = window.localStorage.getItem("lang") as Lang | null;
    if (saved === "fr" || saved === "en") return saved;
    return navigator.language?.toLowerCase().startsWith("fr") ? "fr" : "en";
  });
  const en = lang === "en";

  const toggleLang = () => {
    const next: Lang = en ? "fr" : "en";
    setLang(next);
    try {
      window.localStorage.setItem("lang", next);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = en
      ? "Magnifying glass-Zoom — Browser magnifier extension"
      : "Loupe-Zoom — Extension loupe pour navigateur";
  }, [lang, en]);

  // ----- Détection du zoom navigateur (>= 175 %) pour l'ordre de tabulation -----
  const [highZoom, setHighZoom] = useState(false);
  useEffect(() => {
    const update = () => setHighZoom(window.devicePixelRatio >= 1.75);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // tabIndex helpers selon le niveau de zoom
  const lowOnly = highZoom ? -1 : 0; // visibles à la tabulation en zoom < 175 %
  const highOnly = highZoom ? 0 : -1; // visibles à la tabulation en zoom >= 175 %

  const downloadFile = (url: string, filename: string) => {
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(en ? "Download failed" : "Échec du téléchargement");
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
    <div className="min-h-screen bg-background">
      {/* Skip link for keyboard users (WCAG 2.4.1) */}
      <a
        href="#switch-title"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded"
      >
        {en ? "Skip to main content" : "Aller au contenu principal"}
      </a>

      {/* Sélecteur de langue */}
      <div className="flex justify-end px-6 pt-4">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={toggleLang}
          className={`gap-1.5 font-semibold border-border text-foreground ${focusRing}`}
          aria-label={en ? "Passer en français" : "Switch to English"}
        >
          <Languages className="w-4 h-4" aria-hidden="true" />
          {en ? "Français" : "English"}
        </Button>
      </div>

      {/* Hero */}
      <header className="pt-16 pb-10 px-6 text-center space-y-6 max-w-3xl mx-auto">
        <div
          role="img"
          aria-label={en ? "Magnifying glass-Zoom logo" : "Logo Loupe-Zoom"}
          className="logo-mask mx-auto drop-shadow-md"
        />

        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-primary">
          {en ? "Magnifying glass-Zoom" : "Loupe-Zoom"}
        </h1>
        <p className="text-lg max-w-xl mx-auto text-foreground">
          {en ? (
            <>
              Firefox, Edge and Chrome extension: mouse and keyboard magnifier (
              <kbd className="key-hint text-sm">Ctrl+Shift+Z</kbd>).
            </>
          ) : (
            <>
              Extension Firefox, Edge et Chrome de loupe souris et clavier (
              <kbd className="key-hint text-sm">Ctrl+Maj.+Z</kbd>).
            </>
          )}
        </p>

        {/* Badges */}
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-sm font-medium border-border text-foreground">
            <Eye className="w-4 h-4 text-primary" aria-hidden="true" />
            {en ? "Accessibility" : "Accessibilité"}
          </Badge>
          <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-sm font-medium border-border text-foreground">
            <span className="text-base leading-none" aria-hidden="true">{en ? "🇬🇧" : "🇫🇷"}</span>
            {en ? "English / Français" : "Français"}
          </Badge>
          <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-sm font-medium border-border text-foreground">
            <MousePointerClick className="w-4 h-4 text-primary" aria-hidden="true" />
            {en ? "Keyboard & mouse" : "Clavier & souris"}
          </Badge>
        </div>
      </header>

      <main id="main" className="max-w-3xl mx-auto px-6 pb-20 space-y-16">
        {/* Illustration des loupes + description */}
        <section
          aria-labelledby="switch-title"
          className="space-y-8 bg-muted/40 rounded-2xl p-8"
        >
          <div className="flex flex-col md:flex-row items-center justify-center gap-8">
            <img
              src="/loupe-souris.png"
              alt={en ? "Magnifier used with the mouse" : "Loupe à utiliser à la souris"}
              className="max-w-[280px] w-full drop-shadow-lg rounded-lg"
              loading="lazy"
            />
            <img
              src="/loupe-clavier.png"
              alt={en ? "Magnifier used with the keyboard" : "Loupe à utiliser au clavier"}
              className="max-w-[420px] w-full drop-shadow-lg rounded-lg"
              loading="lazy"
            />
          </div>

          <div className="space-y-4 max-w-2xl mx-auto">
            <h2
              id="switch-title"
              tabIndex={0}
              className={`text-2xl md:text-3xl font-bold text-center text-primary ${focusRing}`}
            >
              {en
                ? "Switch between three types of magnifiers"
                : "Basculez entre trois types de loupes"}
            </h2>

            <ul className="space-y-4 text-base text-foreground">
              <li className="flex flex-wrap items-center gap-1.5">
                {en ? (
                  <span>– a round Mouse magnifier</span>
                ) : (
                  <span>– une Loupe souris ronde</span>
                )}
                <span className="mode-picto inline-flex items-center" aria-hidden="true">🔎</span>
                {en ? (
                  <span> which moderately enlarges whatever the mouse points at.</span>
                ) : (
                  <span> qui grossit modérément ce qui est pointé à la souris.</span>
                )}
              </li>

              <li className="flex flex-wrap items-center gap-1.5">
                {en ? (
                  <span>– a rectangular Focus-magnifier</span>
                ) : (
                  <span>– un Focus-loupe rectangle</span>
                )}
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="mode-picto inline-block"
                >
                  <rect x="2" y="5" width="20" height="14" rx="2.5" />
                  <path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M18 13h.01M7 17h10" />
                </svg>
                {en ? (
                  <span> which clearly enlarges items tabbed through with the keyboard (using the Tab key).</span>
                ) : (
                  <span> qui grossit bien les éléments tabulés au clavier (via la touche Tabulation).</span>
                )}
              </li>

              <li className="flex flex-wrap items-center gap-1.5">
                {en ? (
                  <span>– a full-screen Magnifier</span>
                ) : (
                  <span>– un Agrandisseur, qui prend tout l'écran</span>
                )}
                <svg
                  width="24"
                  height="18"
                  viewBox="0 0 28 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                  className="mode-picto inline-block"
                >
                  <rect x="1.5" y="1.5" width="25" height="17" rx="3.5" />
                  <text
                    x="14"
                    y="15"
                    textAnchor="middle"
                    fontFamily="system-ui,sans-serif"
                    fontSize="13"
                    fontWeight="800"
                    fill="currentColor"
                    stroke="none"
                  >
                    A
                  </text>
                </svg>
                {en ? (
                  <span>, which strongly enlarges the page elements (navigate with the keyboard arrow keys).</span>
                ) : (
                  <span>, et grossit très fort les éléments de la page (à naviguer via les flèches du clavier).</span>
                )}
              </li>
            </ul>
          </div>
        </section>

        {/* Comment l'utiliser */}
        <section className="space-y-6" aria-labelledby="usage-title">
          <h2
            id="usage-title"
            tabIndex={lowOnly}
            className={`text-2xl md:text-3xl font-bold text-center text-primary ${focusRing}`}
          >
            {en ? "How to use it" : "Comment l'utiliser"}
          </h2>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Mode Souris */}
            <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
              <h3
                tabIndex={highOnly}
                className={`font-semibold flex items-center gap-2 text-base text-primary ${focusRing}`}
              >
                <span className="mode-picto" aria-hidden="true">🔎</span>{" "}
                {en ? "Mouse mode" : "Mode Souris"}
              </h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-foreground">
                {en ? (
                  <>
                    <li>Click the Loupe icon in the toolbar to turn the magnifier on/off.</li>
                    <li>Right-click to hide the magnifier. It stays available at the mouse tip. A first click brings it back.</li>
                    <li>A 2<sup>nd</sup> click from the visible magnifier activates the element (link, button…).</li>
                  </>
                ) : (
                  <>
                    <li>Cliquer sur l'icône Loupe dans la barre d'outils pour activer/désactiver la loupe.</li>
                    <li>Clic droit pour faire disparaître la loupe. Elle reste disponible au bout de la souris. Il suffit de faire un 1<sup>er</sup> clic pour la faire réapparaître.</li>
                    <li>Un 2<sup>e</sup> clic depuis la loupe visible valide l'élément (hyperlien, bouton…)</li>
                  </>
                )}
              </ol>
            </div>

            {/* Mode Focus-loupe */}
            <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
              <h3
                tabIndex={highOnly}
                className={`font-semibold flex items-center gap-2 text-base text-primary ${focusRing}`}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mode-picto">
                  <rect x="2" y="5" width="20" height="14" rx="2.5"/>
                  <path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M18 13h.01M7 17h10"/>
                </svg>
                {en ? "Focus-magnifier mode" : "Mode Focus-loupe"}
              </h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-foreground">
                {en ? (
                  <>
                    <li>
                      <kbd className="key-hint text-xs">Tab</kbd> /{" "}
                      <kbd className="key-hint text-xs">Shift+Tab</kbd> to move between elements.
                    </li>
                    <li>
                      <kbd className="key-hint text-xs">Enter</kbd> to show the magnifier.
                    </li>
                    <li>
                      If the element is activable (link, button), a 2<sup>nd</sup>{" "}
                      <kbd className="key-hint text-xs">Enter</kbd> activates it.
                    </li>
                  </>
                ) : (
                  <>
                    <li>
                      <kbd className="key-hint text-xs">Tab</kbd> /{" "}
                      <kbd className="key-hint text-xs">Maj.+Tab</kbd>{" "}
                      pour naviguer entre les éléments.
                    </li>
                    <li>
                      <kbd className="key-hint text-xs">Entrée</kbd>{" "}
                      pour faire apparaître la loupe.
                    </li>
                    <li>
                      Si l'élément est activable (lien, bouton), un 2<sup>e</sup>{" "}
                      <kbd className="key-hint text-xs">Entrée</kbd>{" "}
                      le valide.
                    </li>
                  </>
                )}
              </ol>
            </div>

            {/* Mode Agrandisseur */}
            <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
              <h3
                tabIndex={highOnly}
                className={`font-semibold flex items-center gap-2 text-base text-primary ${focusRing}`}
              >
                <svg width="24" height="18" viewBox="0 0 28 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="mode-picto">
                  <rect x="1.5" y="1.5" width="25" height="17" rx="3.5"/>
                  <text x="14" y="15" textAnchor="middle" fontFamily="system-ui,sans-serif" fontSize="13" fontWeight="800" fill="currentColor" stroke="none">A</text>
                </svg>
                {en ? "Magnifier mode" : "Mode Agrandisseur"}
              </h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-foreground">
                {en ? (
                  <>
                    <li>
                      <kbd className="key-hint text-xs">▲</kbd>{" "}
                      <kbd className="key-hint text-xs">▼</kbd>{" "}
                      <kbd className="key-hint text-xs">◄</kbd>{" "}
                      <kbd className="key-hint text-xs">►</kbd>{" "}
                      or the mouse to move around the page.
                    </li>
                    <li>
                      <kbd className="key-hint text-xs">Ctrl</kbd>+
                      <kbd className="key-hint text-xs">▲</kbd>{" "}
                      <kbd className="key-hint text-xs">▼</kbd>{" "}
                      <kbd className="key-hint text-xs">◄</kbd>{" "}
                      <kbd className="key-hint text-xs">►</kbd>{" "}
                      for finer panning.
                    </li>
                    <li>
                      <kbd className="key-hint text-xs">Enter</kbd> to activate an element.
                    </li>
                  </>
                ) : (
                  <>
                    <li>
                      <kbd className="key-hint text-xs">▲</kbd>{" "}
                      <kbd className="key-hint text-xs">▼</kbd>{" "}
                      <kbd className="key-hint text-xs">◄</kbd>{" "}
                      <kbd className="key-hint text-xs">►</kbd>{" "}
                      ou souris pour naviguer dans la page.
                    </li>
                    <li>
                      <kbd className="key-hint text-xs">Ctrl</kbd>+
                      <kbd className="key-hint text-xs">▲</kbd>{" "}
                      <kbd className="key-hint text-xs">▼</kbd>{" "}
                      <kbd className="key-hint text-xs">◄</kbd>{" "}
                      <kbd className="key-hint text-xs">►</kbd>{" "}
                      pour naviguer plus finement.
                    </li>
                    <li>
                      <kbd className="key-hint text-xs">Entrée</kbd>{" "}
                      pour valider un élément.
                    </li>
                  </>
                )}
              </ol>
            </div>
          </div>

          {/* Commun aux trois modes */}
          <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3 mt-2">
            <h3
              tabIndex={highOnly}
              className={`font-semibold text-base text-primary ${focusRing}`}
            >
              {en ? "Common to all three modes" : "Commun aux trois modes"}
            </h3>
            <ol start={4} className="list-decimal list-inside space-y-2 text-sm text-foreground">
              {en ? (
                <>
                  <li>
                    <kbd className="key-hint text-xs">Ctrl+wheel up/down</kbd> or{" "}
                    <kbd className="key-hint text-xs">+</kbd> and{" "}
                    <kbd className="key-hint text-xs">-</kbd> to change the zoom level.
                  </li>
                  <li>
                    <kbd className="key-hint text-xs">Esc</kbd> to hide the magnifier.{" "}
                    <kbd className="key-hint text-xs">Enter</kbd> to show it again.
                  </li>
                  <li>
                    <kbd className="key-hint text-xs">Ctrl+Shift+Z</kbd> to close the extension (or launch it).
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <kbd className="key-hint text-xs">Ctrl+molette haut-bas</kbd>{" "}
                    ou{" "}
                    <kbd className="key-hint text-xs">+</kbd> et{" "}
                    <kbd className="key-hint text-xs">-</kbd>{" "}
                    pour changer le niveau de zoom.
                  </li>
                  <li>
                    <kbd className="key-hint text-xs">Échap.</kbd>{" "}
                    pour faire disparaître la loupe.{" "}
                    <kbd className="key-hint text-xs">Entrée</kbd>{" "}
                    pour la faire réapparaître.
                  </li>
                  <li>
                    <kbd className="key-hint text-xs">Ctrl+Maj+Z</kbd>{" "}
                    pour fermer l'extension (ou la lancer).
                  </li>
                </>
              )}
            </ol>
          </div>
        </section>

        {/* Téléchargements */}
        <section className="space-y-8" aria-labelledby="download-title">
          <h2
            id="download-title"
            tabIndex={lowOnly}
            className={`text-2xl md:text-3xl font-bold text-center text-primary ${focusRing}`}
          >
            {en ? "Download" : "Télécharger"}
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Firefox */}
            <article className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <img src={logoFirefox} alt="" width={48} height={48} loading="lazy" />
                <h3 className="font-semibold text-lg text-primary">Firefox</h3>
              </div>
              <Button
                size="lg"
                onClick={() => downloadFile("/loupe-extension.zip", "loupe-extension.zip")}
                className="download-btn gap-2 w-full h-auto py-3 whitespace-normal text-center leading-tight"
                aria-label={en ? "Download Magnifying glass-Zoom for Firefox" : "Télécharger Loupe-Zoom pour Firefox"}
              >
                <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>
                  {en ? "Download Magnifying glass-Zoom" : "Télécharger Loupe-Zoom"}
                  <br />
                  {en ? "for Firefox" : "pour Firefox"}
                </span>
              </Button>
              <div className="text-sm space-y-2 text-left bg-background rounded-lg border p-4 text-foreground">
                <p tabIndex={highOnly} className={`font-semibold text-foreground ${focusRing}`}>
                  {en ? "Installation:" : "Installation :"}
                </p>
                {en ? (
                  <ol className="list-decimal list-inside space-y-1.5">
                    <li>
                      Open <code className="font-mono break-all text-foreground">about:debugging#/runtime/this-firefox</code>
                    </li>
                    <li>Click “Load Temporary Add-on”.</li>
                    <li>
                      Select the <code className="font-mono text-foreground">.zip</code> file (without unzipping it).
                    </li>
                    <li>Manage extensions and pin it to the toolbar.</li>
                    <li>
                      Open a web page and click the Magnifying glass-Zoom button, or use the shortcut{" "}
                      <kbd className="key-hint text-xs">Ctrl+Shift+Z</kbd> to launch the extension.
                    </li>
                  </ol>
                ) : (
                  <ol className="list-decimal list-inside space-y-1.5">
                    <li>
                      Ouvrez <code className="font-mono break-all text-foreground">about:debugging#/runtime/this-firefox</code>
                    </li>
                    <li>Cliquez « Charger un module complémentaire temporaire »</li>
                    <li>
                      Sélectionnez le fichier <code className="font-mono text-foreground">.zip</code> (sans le décompresser).
                    </li>
                    <li>Gérer les extensions et épingler à la barre d'outils.</li>
                    <li>
                      Ouvrez une page web et cliquez sur le bouton Loupe-Zoom, ou utilisez le raccourci{" "}
                      <kbd className="key-hint text-xs">Ctrl+Maj+Z</kbd>{" "}
                      pour lancer l'extension.
                    </li>
                  </ol>
                )}
              </div>
            </article>

            {/* Edge / Chrome */}
            <article className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <img src={logoEdge} alt="" width={48} height={48} loading="lazy" />
                <img src={logoChrome} alt="" width={48} height={48} loading="lazy" />
                <h3 className="font-semibold text-lg text-primary">Edge &amp; Chrome</h3>
              </div>
              <Button
                size="lg"
                onClick={() => downloadFile("/loupe-extension-chrome.zip", "loupe-extension-chrome.zip")}
                className="download-btn gap-2 w-full h-auto py-3 whitespace-normal text-center leading-tight"
                aria-label={en ? "Download Magnifying glass-Zoom for Edge and Chrome" : "Télécharger Loupe-Zoom pour Edge et Chrome"}
              >
                <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>
                  {en ? "Download Magnifying glass-Zoom" : "Télécharger Loupe-Zoom"}
                  <br />
                  {en ? "for Edge and Chrome" : "pour Edge et Chrome"}
                </span>
              </Button>
              <div className="text-sm space-y-2 text-left bg-background rounded-lg border p-4 text-foreground">
                <p tabIndex={highOnly} className={`font-semibold text-foreground ${focusRing}`}>
                  {en ? "Installation:" : "Installation :"}
                </p>
                {en ? (
                  <ol className="list-decimal list-inside space-y-1.5">
                    <li>Unzip the <code className="font-mono text-foreground">.zip</code> archive into a folder.</li>
                    <li>In Chrome or Edge, go to <strong>Extensions / Manage extensions</strong>.</li>
                    <li>Click the “Load unpacked” button.</li>
                    <li>Choose the folder where you unzipped the archive (do not go inside the folder, just select it).</li>
                    <li>Click the browser “Extensions” button and toggle the eye or pin on the Magnifying glass-Zoom line to add it to the toolbar.</li>
                    <li>
                      Open a web page and click the Magnifying glass-Zoom button, or use the shortcut{" "}
                      <kbd className="key-hint text-xs">Ctrl+Shift+Z</kbd> to launch the extension.
                    </li>
                  </ol>
                ) : (
                  <ol className="list-decimal list-inside space-y-1.5">
                    <li>Décompressez l'archive <code className="font-mono text-foreground">.zip</code> dans un dossier.</li>
                    <li>Dans Chrome ou Edge, allez dans <strong>Extensions / Gérer les extensions</strong>.</li>
                    <li>Actionnez le bouton « Charger l'extension décompressée ».</li>
                    <li>Choisissez le dossier dans lequel vous avez décompressé l'archive (ne pas rentrer dans le dossier, sélectionnez juste le dossier).</li>
                    <li>Cliquez sur le bouton « Extension » de la barre du navigateur et décochez l'œil ou l'épingle sur la ligne Loupe-Zoom pour l'ajouter à la barre.</li>
                    <li>
                      Ouvrez une page web et cliquez sur le bouton Loupe-Zoom, ou utilisez le raccourci{" "}
                      <kbd className="key-hint text-xs">Ctrl+Maj+Z</kbd>{" "}
                      pour lancer l'extension.
                    </li>
                  </ol>
                )}
              </div>
            </article>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Index;
