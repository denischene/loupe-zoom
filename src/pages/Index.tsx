import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

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
      <div className="max-w-2xl mx-auto py-12 px-6 space-y-10">
        {/* Header with logo */}
        <div className="text-center space-y-4">
          <img
            src="/logo-loupe.png"
            alt="Loupe-Zoom"
            width={80}
            height={80}
            className="mx-auto"
          />
          <h1 className="text-3xl font-bold text-foreground">Loupe-Zoom</h1>
          <p className="text-muted-foreground text-lg">
            Extension Firefox de loupe souris et loupe clavier (<kbd className="px-2 py-0.5 rounded bg-muted text-foreground text-sm font-mono border border-border">Ctrl+Maj+Z</kbd>).
          </p>
        </div>

        {/* Loupe illustrations */}
        <div className="relative bg-muted/30 rounded-xl p-8">
          <p className="text-center text-2xl text-muted-foreground/40 font-serif mb-6">
            texte à lire
          </p>
          <div className="flex items-center justify-center gap-8 -mt-4">
            <img
              src="/loupe-round.png"
              alt="Loupe ronde"
              width={160}
              height={160}
              className="drop-shadow-lg"
            />
            <img
              src="/loupe-rect.png"
              alt="Loupe rectangulaire"
              width={260}
              height={166}
              className="drop-shadow-lg"
            />
          </div>
        </div>

        {/* Comment l'utiliser */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-foreground">Comment l'utiliser</h2>

          <div className="bg-muted/50 rounded-lg p-5 space-y-3">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              ⌨️ Mode Clavier
            </h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li><kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground text-xs font-mono border border-border">Ctrl+Maj+Z</kbd> pour activer/désactiver l'extension loupe. Une fois activée, un petit logo apparaît alors au-dessus du focus.</li>
              <li><kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground text-xs font-mono border border-border">Entrée</kbd> pour faire apparaître la loupe.</li>
              <li>Si l'élément est activable (lien, bouton), un 2<sup>e</sup> <kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground text-xs font-mono border border-border">Entrée</kbd> le valide.</li>
              <li><kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground text-xs font-mono border border-border">Tab</kbd> / <kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground text-xs font-mono border border-border">Maj.+Tab</kbd> pour naviguer entre les éléments.</li>
              <li><kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground text-xs font-mono border border-border">+</kbd> et <kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground text-xs font-mono border border-border">-</kbd> permettent de changer le niveau de zoom.</li>
              <li><kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground text-xs font-mono border border-border">Échap.</kbd> pour faire disparaître la loupe. <kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground text-xs font-mono border border-border">Entrée</kbd> permet de la faire réapparaître.</li>
            </ol>
          </div>

          <div className="bg-muted/50 rounded-lg p-5 space-y-3">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              🖱️ Mode Souris
            </h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>Cliquer sur l'icône Loupe dans la barre d'outils pour activer/désactiver la loupe.</li>
              <li>Clic droit pour faire disparaître la loupe. Elle reste disponible au bout de la souris. Il suffit de faire un 1<sup>er</sup> clic pour la faire réapparaître.</li>
              <li>Un 2<sup>e</sup> clic depuis la loupe visible valide l'élément (hyperlien, bouton…)</li>
              <li><kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground text-xs font-mono border border-border">Ctrl+molette haut-bas</kbd> permet de changer de niveau de zoom.</li>
            </ol>
          </div>
        </div>

        {/* Download */}
        <div className="text-center space-y-4">
          <Button size="lg" onClick={handleDownload} className="gap-2">
            <Download className="w-4 h-4" />
            Télécharger l'extension
          </Button>
          <div className="text-sm text-muted-foreground space-y-2 text-left bg-muted/50 rounded-lg p-4">
            <p className="font-semibold text-foreground">Installation :</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Ouvrez <code className="text-primary">about:debugging#/runtime/this-firefox</code></li>
              <li>Cliquez « Charger un module complémentaire temporaire »</li>
              <li>Sélectionnez le fichier <code className="text-primary">manifest.json</code> dans le dossier dézippé</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
