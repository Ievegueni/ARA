import { useCallback, useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { AlertCircle, CheckCircle2, FileText, FileUp, Loader2, Trash2, UploadCloud, X } from "lucide-react";
import { api, uploadManual, type DocumentInfo, type IngestJob } from "../lib/api";

const MAX_MB = 100;

const STAGES: { key: IngestJob["stage"] | "upload"; label: string }[] = [
  { key: "upload", label: "A enviar ficheiro" },
  { key: "extracting", label: "A extrair texto do PDF" },
  { key: "chunking", label: "A dividir por secções" },
  { key: "embedding", label: "A indexar para pesquisa" },
  { key: "saving", label: "A guardar na base de dados" },
];

type Upload =
  | { phase: "upload"; fraction: number }
  | { phase: "job"; job: IngestJob }
  | { phase: "error"; error: string };

const titleFromFile = (name: string) =>
  name
    .replace(/\.pdf$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const fmtSize = (b: number) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(b / 1024)} KB`);

export function ManualsView({ onChanged }: { onChanged: () => void }) {
  const [docs, setDocs] = useState<DocumentInfo[] | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [version, setVersion] = useState("1.0");
  const [fileError, setFileError] = useState<string | null>(null);
  const [upload, setUpload] = useState<Upload | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    api.documents().then((r) => setDocs(r.documents)).catch(() => setDocs([]));
  }, []);
  useEffect(load, [load]);

  // Acompanha o processamento no servidor
  const jobId = upload?.phase === "job" && upload.job.status === "running" ? upload.job.id : null;
  useEffect(() => {
    if (!jobId) return;
    const t = setInterval(async () => {
      try {
        const { job } = await api.job(jobId);
        setUpload({ phase: "job", job });
        if (job.status !== "running") {
          clearInterval(t);
          if (job.status === "done") {
            load();
            onChanged();
          }
        }
      } catch {
        clearInterval(t);
        setUpload({ phase: "error", error: "Perdeu-se o acompanhamento do processamento. Atualize a lista." });
      }
    }, 800);
    return () => clearInterval(t);
  }, [jobId, load, onChanged]);

  function pick(f: File | undefined) {
    setFileError(null);
    setUpload(null);
    if (!f) return;
    if (!/\.pdf$/i.test(f.name) && f.type !== "application/pdf") return setFileError("Só são aceites ficheiros PDF.");
    if (f.size > MAX_MB * 1024 * 1024) return setFileError(`O ficheiro excede ${MAX_MB} MB.`);
    setFile(f);
    setTitle(titleFromFile(f.name));
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    pick(e.dataTransfer.files[0]);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    const exists = docs?.some((d) => d.title === title.trim() && d.version === version.trim());
    if (exists && !confirm(`Já existe "${title} v${version}". Substituir?`)) return;
    setUpload({ phase: "upload", fraction: 0 });
    try {
      const job = await uploadManual(file, title.trim(), version.trim(), (fraction) => setUpload({ phase: "upload", fraction }));
      setUpload({ phase: "job", job });
    } catch (err) {
      setUpload({ phase: "error", error: err instanceof Error ? err.message : "Erro no upload" });
    }
  }

  async function remove(d: DocumentInfo) {
    if (!confirm(`Apagar "${d.title} v${d.version}"? O assistente deixa de usar este manual.`)) return;
    await api.deleteDocument(d.id).catch(() => {});
    load();
    onChanged();
  }

  function reset() {
    setFile(null);
    setTitle("");
    setVersion("1.0");
    setUpload(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  const busy = upload?.phase === "upload" || (upload?.phase === "job" && upload.job.status === "running");

  return (
    <div className="scroll-thin flex-1 overflow-y-auto">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-navy-950">Manuais</h1>
          <p className="mt-1 text-sm text-ink-500">
            Carregue o manual do técnico em PDF. O assistente passa a usá-lo assim que o processamento terminar.
          </p>
        </div>

        {/* Upload */}
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink-100 sm:p-6">
          {!file ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition ${
                dragging ? "border-brand-500 bg-brand-50" : "border-ink-200 hover:border-brand-300 hover:bg-brand-50/40"
              }`}
            >
              <span className={`grid size-14 place-items-center rounded-2xl transition ${dragging ? "bg-brand-500 text-white" : "bg-brand-50 text-brand-600"}`}>
                <UploadCloud className="size-7" />
              </span>
              <p className="mt-4 font-medium text-ink-800">
                Arraste o PDF para aqui ou <span className="text-brand-600 underline underline-offset-2">escolha um ficheiro</span>
              </p>
              <p className="mt-1 text-xs text-ink-400">Apenas PDF com texto selecionável · máx. {MAX_MB} MB</p>
            </div>
          ) : (
            <form onSubmit={submit}>
              <div className="flex items-center gap-3 rounded-xl bg-ink-50 p-3 ring-1 ring-ink-100">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-red-50 text-red-600">
                  <FileText className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink-800">{file.name}</div>
                  <div className="text-xs text-ink-400">{fmtSize(file.size)}</div>
                </div>
                {!busy && (
                  <button type="button" onClick={reset} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700" aria-label="Remover ficheiro">
                    <X className="size-4" />
                  </button>
                )}
              </div>

              {!upload || upload.phase === "error" ? (
                <>
                  <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_140px]">
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-medium text-ink-600">Título</span>
                      <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                        minLength={2}
                        maxLength={150}
                        className="w-full rounded-xl border border-ink-200 px-3.5 py-2.5 text-base outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-100 sm:text-sm"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-medium text-ink-600">Versão</span>
                      <input
                        value={version}
                        onChange={(e) => setVersion(e.target.value)}
                        required
                        maxLength={30}
                        className="w-full rounded-xl border border-ink-200 px-3.5 py-2.5 text-base outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-100 sm:text-sm"
                      />
                    </label>
                  </div>
                  {upload?.phase === "error" && <ErrorBox msg={upload.error} />}
                  <div className="mt-5 flex justify-end">
                    <button className="flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand-500/25 transition hover:bg-brand-600">
                      <FileUp className="size-4" /> Carregar manual
                    </button>
                  </div>
                </>
              ) : (
                <Progress upload={upload} onReset={reset} />
              )}
            </form>
          )}
          {fileError && <ErrorBox msg={fileError} />}
          <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        </section>

        {/* Lista */}
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-ink-700">
            Manuais carregados {docs && <span className="font-normal text-ink-400">({docs.length})</span>}
          </h2>
          {docs === null ? (
            <div className="h-24 animate-pulse rounded-2xl bg-white" />
          ) : docs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-ink-200 px-6 py-10 text-center text-sm text-ink-500">
              Ainda não há manuais. Carregue o primeiro acima.
            </div>
          ) : (
            <ul className="divide-y divide-ink-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-ink-100">
              {docs.map((d) => (
                <li key={d.id} className="flex items-center gap-4 px-4 py-3.5">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-navy-50 text-navy-700">
                    <FileText className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium text-ink-900">{d.title}</span>
                      <span className="rounded-md bg-brand-50 px-1.5 py-0.5 text-[11px] font-semibold text-brand-700 ring-1 ring-brand-200 ring-inset">
                        v{d.version}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-ink-400">
                      {d.pages} páginas · {d._count.chunks} secções indexadas · {new Date(d.createdAt).toLocaleDateString("pt-PT")} · {d.fileName}
                    </div>
                  </div>
                  <button
                    onClick={() => remove(d)}
                    className="rounded-lg p-2 text-ink-400 transition hover:bg-red-50 hover:text-red-600"
                    aria-label={`Apagar ${d.title}`}
                    title="Apagar"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
      <AlertCircle className="mt-0.5 size-4 shrink-0" /> {msg}
    </div>
  );
}

function Progress({ upload, onReset }: { upload: Exclude<Upload, { phase: "error" }>; onReset: () => void }) {
  const job = upload.phase === "job" ? upload.job : null;
  const current = job ? job.stage : "upload";
  const idx = STAGES.findIndex((s) => s.key === current);

  if (job?.status === "done" && job.result) {
    return (
      <div role="status" className="mt-4 flex flex-col items-start gap-3 rounded-xl bg-emerald-50 p-4 ring-1 ring-emerald-200 sm:flex-row sm:items-center">
        <CheckCircle2 className="size-6 shrink-0 text-emerald-600" />
        <div className="flex-1 text-sm text-emerald-900">
          <div className="font-semibold">Manual pronto a usar</div>
          {job.result.pages} páginas processadas · {job.result.chunks} secções indexadas
        </div>
        <button type="button" onClick={onReset} className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-100">
          Carregar outro
        </button>
      </div>
    );
  }
  if (job?.status === "error") {
    return (
      <>
        <ErrorBox msg={job.error ?? "Erro no processamento"} />
        <button type="button" onClick={onReset} className="mt-3 text-sm font-medium text-brand-600 hover:underline">
          Tentar com outro ficheiro
        </button>
      </>
    );
  }

  const pct =
    upload.phase === "upload"
      ? Math.round(upload.fraction * 100)
      : job && job.total > 0 && (job.stage === "embedding" || job.stage === "saving")
        ? Math.round((job.done / job.total) * 100)
        : null;

  return (
    <ol className="mt-5 space-y-3">
      {STAGES.map((s, i) => {
        const state = i < idx ? "done" : i === idx ? "active" : "todo";
        return (
          <li key={s.key} className="flex items-center gap-3 text-sm">
            <span
              className={`grid size-6 shrink-0 place-items-center rounded-full ${
                state === "done" ? "bg-emerald-500 text-white" : state === "active" ? "bg-brand-500 text-white" : "bg-ink-100 text-ink-400"
              }`}
            >
              {state === "done" ? (
                <CheckCircle2 className="size-4" />
              ) : state === "active" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <span className="text-[11px]">{i + 1}</span>
              )}
            </span>
            <span className={state === "todo" ? "text-ink-400" : "font-medium text-ink-800"}>{s.label}</span>
            {state === "active" && pct !== null && (
              <span className="ml-auto flex items-center gap-2">
                <span className="h-1.5 w-20 overflow-hidden rounded-full bg-ink-100 sm:w-28">
                  <span className="block h-full rounded-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} />
                </span>
                <span className="w-9 text-right text-xs tabular-nums text-ink-500">{pct}%</span>
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
