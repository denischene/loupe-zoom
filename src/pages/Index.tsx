import { Search, Download, Keyboard } from "lucide-react";
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
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="max-w-lg text-center space-y-8 p-8">
        <div className="mx-auto w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Search className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-3xl font-bold text-foreground">Loupe Zoom ×5</h1>
        <p className="text-muted-foreground">
          Extension Firefox : appuyez sur{" "}
          <kbd className="px-2 py-1 rounded bg-muted text-foreground text-sm font-mono border border-border">
            Ctrl+L
          </kbd>{" "}
          pour activer une loupe ×5 sur votre curseur. Appuyez à nouveau pour désactiver.
        </p>
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
  );
};

export default Index;
