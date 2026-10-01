import { useState } from "react";
import { FileText, Film } from "lucide-react";
import { ManualsView } from "./ManualsView";
import { VideosView } from "./VideosView";

type Tab = "manuals" | "videos";

/** Página de administração dos conteúdos pesquisáveis: manuais (PDF) e vídeos. */
export function LibraryView({ onChanged }: { onChanged: () => void }) {
  const [tab, setTab] = useState<Tab>(() => {
    try {
      return (localStorage.getItem("ara.library.tab") as Tab) || "manuals";
    } catch {
      return "manuals";
    }
  });
  const pick = (t: Tab) => {
    setTab(t);
    try {
      localStorage.setItem("ara.library.tab", t);
    } catch {
      /* armazenamento indisponível */
    }
  };

  return (
    <div className="scroll-thin flex-1 overflow-y-auto">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-semibold tracking-tight text-navy-950">Biblioteca</h1>
        <div role="tablist" className="mt-4 mb-6 inline-flex rounded-xl bg-ink-100 p-1 text-sm font-medium">
          {(
            [
              ["manuals", FileText, "Manuais"],
              ["videos", Film, "Vídeos"],
            ] as const
          ).map(([key, Icon, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              onClick={() => pick(key)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 transition ${
                tab === key ? "bg-white text-navy-950 shadow-sm" : "text-ink-500 hover:text-ink-800"
              }`}
            >
              <Icon className="size-4" /> {label}
            </button>
          ))}
        </div>
        {tab === "manuals" ? <ManualsView onChanged={onChanged} /> : <VideosView />}
      </div>
    </div>
  );
}
