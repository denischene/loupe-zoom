import { Download, Eye, MousePointerClick } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const Index = () => {
  const handleDownload = () => {
    fetch("/loupe-extension.zip")
      .then((res) => {
        if (!res.ok) throw new Error("Échec du téléchargement");
        return res.blob();
      })
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "loupe-extension.zip";
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch((err) => alert(err.message));
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <header className="pt-16 pb-10 px-6 text-center space-y-6 max-w-3xl mx-auto">
        <img
          src="/logo-loupe.png"
          alt="Loupe-Zoom"
          width={80}
          height={80}
          className="mx-auto drop-shadow-md"
        />
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">
          Loupe-Zoom
        </h1>
        <p className="text-lg max-w-xl mx-auto" style={{ color: "#3b1f0a" }}>
          Extension Firefox de loupe souris et loupe clavier (
          <kbd className="px-2 py-0.5 rounded bg-muted text-foreground text-sm font-mono border border-border">
            Ctrl+Maj+Z
          </kbd>
          ).
        </p>

        {/* Badges */}
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-sm font-medium border-border">
            <Eye className="w-4 h-4 text-primary" />
            Accessibilité
          </Badge>
          <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-sm font-medium border-border">
            <span className="text-base leading-none">🇫🇷</span>
            Français
          </Badge>
          <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-sm font-medium border-border">
            <MousePointerClick className="w-4 h-4 text-primary" />
            Clavier &amp; souris
          </Badge>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 pb-20 space-y-16">
        {/* Loupe illustrations */}
        <section className="flex flex-col md:flex-row items-center justify-center gap-8 bg-muted/40 rounded-2xl p-8">
          <img
            src="/loupe-souris.png"
            alt="Une loupe à utiliser à la souris"
            className="max-w-[280px] w-full drop-shadow-lg rounded-lg"
          />
          <img
            src="/loupe-clavier.png"
            alt="Une loupe à utiliser au clavier"
            className="max-w-[420px] w-full drop-shadow-lg rounded-lg"
          />
        </section>

        {/* Comment l'utiliser */}
        <section className="space-y-6">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground">
            Comment l'utiliser
          </h2>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Mode Souris */}
            <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
              <h3 className="font-semibold flex items-center gap-2 text-base" style={{ color: "#3b1f0a" }}>
                <span aria-hidden="true">🔎</span> Mode Souris
              </h3>
              <ol className="list-decimal list-inside space-y-2 text-sm" style={{ color: "#3b1f0a" }}>
                <li>Cliquer sur l'icône Loupe dans la barre d'outils pour activer/désactiver la loupe.</li>
                <li>Clic droit pour faire disparaître la loupe. Elle reste disponible au bout de la souris. Il suffit de faire un 1<sup>er</sup> clic pour la faire réapparaître.</li>
                <li>Un 2<sup>e</sup> clic depuis la loupe visible valide l'élément (hyperlien, bouton…)</li>
                <li>
                  <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono border border-border" style={{ color: "#3b1f0a" }}>Ctrl+molette haut-bas</kbd>{" "}
                  permet de changer de niveau de zoom.
                </li>
              </ol>
            </div>

            {/* Mode Focus-loupe */}
            <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
              <h3 className="font-semibold flex items-center gap-2 text-base" style={{ color: "#3b1f0a" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b1f0a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="2" y="5" width="20" height="14" rx="2.5"/>
                  <path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M18 13h.01M7 17h10"/>
                </svg>
                Mode Focus-loupe
              </h3>
              <ol className="list-decimal list-inside space-y-2 text-sm" style={{ color: "#3b1f0a" }}>
                <li>
                  <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono border border-border" style={{ color: "#3b1f0a" }}>Tab</kbd> /{" "}
                  <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono border border-border" style={{ color: "#3b1f0a" }}>Maj.+Tab</kbd>{" "}
                  pour naviguer entre les éléments.
                </li>
                <li>
                  <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono border border-border" style={{ color: "#3b1f0a" }}>Entrée</kbd>{" "}
                  pour faire apparaître la loupe.
                </li>
                <li>
                  Si l'élément est activable (lien, bouton), un 2<sup>e</sup>{" "}
                  <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono border border-border" style={{ color: "#3b1f0a" }}>Entrée</kbd>{" "}
                  le valide.
                </li>
                <li>
                  <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono border border-border" style={{ color: "#3b1f0a" }}>+</kbd> et{" "}
                  <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono border border-border" style={{ color: "#3b1f0a" }}>-</kbd>{" "}
                  pour changer le niveau de zoom.
                </li>
                <li>
                  <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono border border-border" style={{ color: "#3b1f0a" }}>Échap.</kbd>{" "}
                  pour faire disparaître le Focus-loupe.{" "}
                  <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono border border-border" style={{ color: "#3b1f0a" }}>Entrée</kbd>{" "}
                  pour le faire réapparaître.
                </li>
              </ol>
            </div>

            {/* Mode Agrandisseur */}
            <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
              <h3 className="font-semibold flex items-center gap-2 text-base" style={{ color: "#3b1f0a" }}>
                <svg width="24" height="18" viewBox="0 0 28 20" fill="none" stroke="#3b1f0a" strokeWidth="2" aria-hidden="true">
                  <rect x="1.5" y="1.5" width="25" height="17" rx="3.5"/>
                  <text x="14" y="15" textAnchor="middle" fontFamily="system-ui,sans-serif" fontSize="13" fontWeight="800" fill="#3b1f0a" stroke="none">A</text>
                </svg>
                Mode Agrandisseur
              </h3>
              <ol className="list-decimal list-inside space-y-2 text-sm" style={{ color: "#3b1f0a" }}>
                <li>
                  <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono border border-border" style={{ color: "#3b1f0a" }}>▲</kbd>{" "}
                  <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono border border-border" style={{ color: "#3b1f0a" }}>▼</kbd>{" "}
                  <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono border border-border" style={{ color: "#3b1f0a" }}>◄</kbd>{" "}
                  <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono border border-border" style={{ color: "#3b1f0a" }}>►</kbd>{" "}
                  pour naviguer dans la page.
                </li>
                <li>
                  <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono border border-border" style={{ color: "#3b1f0a" }}>Ctrl</kbd>+
                  <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono border border-border" style={{ color: "#3b1f0a" }}>▲</kbd>{" "}
                  <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono border border-border" style={{ color: "#3b1f0a" }}>▼</kbd>{" "}
                  <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono border border-border" style={{ color: "#3b1f0a" }}>◄</kbd>{" "}
                  <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono border border-border" style={{ color: "#3b1f0a" }}>►</kbd>{" "}
                  pour naviguer plus finement.
                </li>
                <li>
                  <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono border border-border" style={{ color: "#3b1f0a" }}>Entrée</kbd>{" "}
                  pour valider un élément.
                </li>
                <li>
                  <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono border border-border" style={{ color: "#3b1f0a" }}>+</kbd> et{" "}
                  <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono border border-border" style={{ color: "#3b1f0a" }}>-</kbd>{" "}
                  pour changer le niveau de zoom.
                </li>
                <li>
                  <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono border border-border" style={{ color: "#3b1f0a" }}>Échap.</kbd>{" "}
                  pour faire disparaître l'agrandisseur et{" "}
                  <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono border border-border" style={{ color: "#3b1f0a" }}>Ctrl+Maj+Z</kbd>{" "}
                  pour le faire réapparaître.
                </li>
              </ol>
            </div>
          </div>
        </section>

        {/* Download */}
        <section className="text-center space-y-4">
          <Button size="lg" onClick={handleDownload} className="gap-2">
            <Download className="w-4 h-4" />
            Télécharger Loupe Zoom
          </Button>
          <div className="text-sm space-y-2 text-left bg-card rounded-xl border p-5 shadow-sm max-w-lg mx-auto" style={{ color: "#3b1f0a" }}>
            <p className="font-semibold" style={{ color: "#3b1f0a" }}>Installation :</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>
                Ouvrez <code className="text-primary">about:debugging#/runtime/this-firefox</code>
              </li>
              <li>Cliquez « Charger un module complémentaire temporaire »</li>
              <li>
                Sélectionnez le fichier <code className="text-primary">manifest.json</code> dans le dossier dézippé
              </li>
            </ol>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Index;
