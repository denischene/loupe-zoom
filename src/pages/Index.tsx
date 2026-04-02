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
        <p className="text-lg text-muted-foreground max-w-xl mx-auto">
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

          <div className="grid md:grid-cols-2 gap-6">
            {/* Mode Clavier */}
            <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
              <h3 className="font-semibold text-foreground flex items-center gap-2 text-base">
                ⌨️ Mode Clavier
              </h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                <li>
                  <kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground text-xs font-mono border border-border">Ctrl+Maj+Z</kbd>{" "}
                  pour activer/désactiver l'extension loupe. Une fois activée, un petit logo apparaît au-dessus du focus.
                </li>
                <li>
                  <kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground text-xs font-mono border border-border">Entrée</kbd>{" "}
                  pour faire apparaître la loupe.
                </li>
                <li>
                  Si l'élément est activable (lien, bouton), un 2<sup>e</sup>{" "}
                  <kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground text-xs font-mono border border-border">Entrée</kbd>{" "}
                  le valide.
                </li>
                <li>
                  <kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground text-xs font-mono border border-border">Tab</kbd> /{" "}
                  <kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground text-xs font-mono border border-border">Maj.+Tab</kbd>{" "}
                  pour naviguer entre les éléments.
                </li>
                <li>
                  <kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground text-xs font-mono border border-border">+</kbd> et{" "}
                  <kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground text-xs font-mono border border-border">-</kbd>{" "}
                  permettent de changer le niveau de zoom.
                </li>
                <li>
                  <kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground text-xs font-mono border border-border">Échap.</kbd>{" "}
                  pour faire disparaître la loupe.{" "}
                  <kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground text-xs font-mono border border-border">Entrée</kbd>{" "}
                  permet de la faire réapparaître.
                </li>
              </ol>
            </div>

            {/* Mode Souris */}
            <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
              <h3 className="font-semibold text-foreground flex items-center gap-2 text-base">
                🖱️ Mode Souris
              </h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                <li>
                  Cliquer sur l'icône Loupe dans la barre d'outils pour activer/désactiver la loupe.
                </li>
                <li>
                  Clic droit pour faire disparaître la loupe. Elle reste disponible au bout de la souris. Il suffit de faire un 1<sup>er</sup> clic pour la faire réapparaître.
                </li>
                <li>
                  Un 2<sup>e</sup> clic depuis la loupe visible valide l'élément (hyperlien, bouton…)
                </li>
                <li>
                  <kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground text-xs font-mono border border-border">Ctrl+molette haut-bas</kbd>{" "}
                  permet de changer de niveau de zoom.
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
          <div className="text-sm text-muted-foreground space-y-2 text-left bg-card rounded-xl border p-5 shadow-sm max-w-lg mx-auto">
            <p className="font-semibold text-foreground">Installation :</p>
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
