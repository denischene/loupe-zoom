import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";



type Lang = "fr" | "en";

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-[#4f9bff] focus-visible:ring-offset-2 rounded";

const linkClass = `font-semibold text-primary underline break-words ${focusRing}`;

const About = () => {
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
    document.title = en ? "About — Magnifying glass-Zoom" : "À propos — Loupe-Zoom";
  }, [lang, en]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Barre supérieure : retour + langue */}
      <div className="flex items-center justify-between px-6 pt-4">
        <Button
          asChild
          variant="outline"
          size="sm"
          className={`gap-1.5 font-semibold border-border text-foreground ${focusRing}`}
        >
          <Link to="/">
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            {en ? "Back" : "Retour"}
          </Link>
        </Button>
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

      <main className="flex-1 max-w-3xl mx-auto px-6 py-12 w-full space-y-10">
        <h1 className="text-3xl md:text-4xl font-bold text-primary">
          {en ? "About" : "À propos"}
        </h1>

        <p className="text-base text-foreground">
          {en
            ? "Magnifying glass-Zoom is a browser extension that makes reading easier for people with visual constraints. Three different ways to enlarge pages are offered."
            : "Loupe-Zoom est une extension de navigateur facilitant la lecture des personnes ayant des contraintes visuelles. Trois façons différentes de grossir les pages sont proposées."}
        </p>

        <section className="space-y-3">
          <h2 className="text-xl md:text-2xl font-bold text-primary">
            {en ? "Why different usage modes?" : "Pourquoi des modes d'usages différents ?"}
          </h2>
          <p className="text-base text-foreground">
            {en
              ? "Each mode represents a specific way of using an interface — zooming a little and occasionally with the mouse, zooming a lot and using keyboard navigation, or zooming enormously. "
              : "Chaque mode représente une manière spécifique d'utiliser une interface — en zoomant peu et ponctuellement avec la souris, en zoomant beaucoup et en utilisant la navigation au clavier, ou en zoomant énormément. "}
            {en ? (
              <>
                For more information on usage modes, see{" "}
                <a
                  href="https://usage-modes.lovable.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkClass}
                >
                  https://usage-modes.lovable.app/
                </a>{" "}
                and, for an extension offering even more accessibility options, you can use Orange
                Confort+{" "}
                <a
                  href="https://confort-plus.orange.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkClass}
                >
                  https://confort-plus.orange.com/
                </a>
              </>
            ) : (
              <>
                Pour davantage d'informations sur les modes d'usages, consultez{" "}
                <a
                  href="https://usage-modes.lovable.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkClass}
                >
                  https://usage-modes.lovable.app/
                </a>{" "}
                et pour une extension proposant encore plus d'options d'accessibilité vous pouvez
                utiliser Orange Confort+{" "}
                <a
                  href="https://confort-plus.orange.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkClass}
                >
                  https://confort-plus.orange.com/
                </a>
              </>
            )}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl md:text-2xl font-bold text-primary">
            {en ? "WCAG 2.2 compliance" : "Conformité WCAG 2.2"}
          </h2>
          <p className="text-base text-foreground">
            {en
              ? "This site applies the WCAG 2.2 level AA criteria: sufficient contrast, keyboard navigation, text alternatives, semantic structure, pointer targets of at least 24×24 pixels and visible focus."
              : "Ce site applique les critères WCAG 2.2 niveau AA : contrastes suffisants, navigation clavier, alternatives textuelles, structure sémantique, cibles de pointage d'au moins 24×24 pixels et focus visible."}
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl md:text-2xl font-bold text-primary">
            {en ? "Origin of the project" : "Origine du projet"}
          </h2>
          <p className="text-base text-foreground">
            {en
              ? "Magnifying glass-Zoom stems from the research work of the Employee Accessibility Programme of Orange Labs (Disability Inclusion Mission)."
              : "Loupe-Zoom est issu des travaux de recherche du Programme Accessibilité Salariés d'Orange Labs (Mission Insertion Handicap)."}
          </p>
          <img
            src={logoOrange.url}
            alt="Orange"
            width={96}
            height={96}
            className="w-24 h-24"
            loading="lazy"
          />
        </section>

        <section className="space-y-4">
          <h2 className="text-xl md:text-2xl font-bold text-primary">
            {en ? "License" : "Licence"}
          </h2>
          <p className="text-base text-foreground">
            {en ? "Extension under the GPLv3 license." : "Extension sous licence GPLv3."}
          </p>
          <img
            src={logoGplv3.url}
            alt={en ? "GPLv3 or later" : "GPLv3 ou ultérieure"}
            width={189}
            height={80}
            className="h-20 w-auto"
            loading="lazy"
          />
          <p className="text-base text-foreground">
            {en ? (
              <>
                The extension code is available on GitHub:{" "}
                <a
                  href="https://github.com/denischene/loupe-zoom"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkClass}
                >
                  https://github.com/denischene/loupe-zoom
                </a>
              </>
            ) : (
              <>
                Le code de l'extension est disponible sur GitHub :{" "}
                <a
                  href="https://github.com/denischene/loupe-zoom"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkClass}
                >
                  https://github.com/denischene/loupe-zoom
                </a>
              </>
            )}
          </p>
          <p className="text-base text-foreground">
            {en ? (
              <>
                The Accessible-DfA font is available on GitHub:{" "}
                <a
                  href="https://github.com/Orange-OpenSource/font-accessible-dfa"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkClass}
                >
                  https://github.com/Orange-OpenSource/font-accessible-dfa
                </a>
              </>
            ) : (
              <>
                La police Accessible-DfA est disponible sur GitHub :{" "}
                <a
                  href="https://github.com/Orange-OpenSource/font-accessible-dfa"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkClass}
                >
                  https://github.com/Orange-OpenSource/font-accessible-dfa
                </a>
              </>
            )}
          </p>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="max-w-3xl mx-auto px-6 py-8 text-sm text-muted-foreground text-center">
          {en
            ? "The Orange logo is the property of Orange: Copyright © 2026 Orange SA All rights reserved."
            : "Le logo Orange est la propriété d'Orange : Copyright © 2026 Orange SA All rights reserved."}
        </div>
      </footer>
    </div>
  );
};

export default About;
