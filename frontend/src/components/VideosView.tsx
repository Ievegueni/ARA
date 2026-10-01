import { useCallback, useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { AlertCircle, Check, CheckCircle2, Film, Loader2, Pencil, Play, Trash2, UploadCloud, X } from "lucide-react";
import { api, uploadVideo, type VideoInfo } from "../lib/api";
import { fmtDuration, fmtSize } from "../lib/format";
import { VideoPlayer } from "./VideoPlayer";

const MAX_MB = 500;
const ACCEPT = ".mp4,.m4v,.webm,.mov,video/mp4,video/webm,video/quicktime";

const titleFromFile = (name: string) =>
  name
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Lê a duração do vídeo no próprio navegador, antes do upload (sem processamento no servidor). */
function readDuration(file: File): Promise<number | undefined> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    const done = (d?: number) => {
      URL.revokeObjectURL(url);
      resolve(d);
    };
    v.onloadedmetadata = () => done(Number.isFinite(v.duration) ? v.duration : undefined);
    v.onerror = () => done(undefined);
    setTimeout(() => done(undefined), 5000);
    v.src = url;
  });
}

type Upload = { phase: "upload"; fraction: number } | { phase: "done"; video: VideoInfo } | { phase: "error"; error: string };

export function VideosView() {
  const [videos, setVideos] = useState<VideoInfo[] | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState<number | undefined>();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);
  const [upload, setUpload] = useState<Upload | null>(null);
  const [dragging, setDragging] = useState(false);
  const [playing, setPlaying] = useState<VideoInfo | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    api.videos().then((r) => setVideos(r.videos)).catch(() => setVideos([]));
  }, []);
  useEffect(load, [load]);

  async function pick(f: File | undefined) {
    setFileError(null);
    setUpload(null);
    if (!f) return;
    if (!/\.(mp4|m4v|webm|mov)$/i.test(f.name)) return setFileError("Formato não suportado. Use MP4 (recomendado), WebM ou MOV.");
    if (f.size > MAX_MB * 1024 * 1024) return setFileError(`O vídeo excede ${MAX_MB} MB.`);
    setFile(f);
    setTitle(titleFromFile(f.name));
    setDuration(await readDuration(f));
  }

  function reset() {
    setFile(null);
    setTitle("");
    setDescription("");
    setDuration(undefined);
    setUpload(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUpload({ phase: "upload", fraction: 0 });
    try {
      const video = await uploadVideo(file, { title: title.trim(), description: description.trim(), durationSec: duration }, (fraction) =>
        setUpload({ phase: "upload", fraction }),
      );
      setUpload({ phase: "done", video });
      load();
    } catch (err) {
      setUpload({ phase: "error", error: err instanceof Error ? err.message : "Erro no upload" });
    }
  }

  async function remove(v: VideoInfo) {
    if (!confirm(`Apagar o vídeo "${v.title}"? Deixa de aparecer nas pesquisas.`)) return;
    await api.deleteVideo(v.id).catch(() => {});
    load();
  }

  const uploading = upload?.phase === "upload";

  return (
    <>
      <p className="mb-5 text-sm text-ink-500">
        Carregue vídeos de procedimentos. Aparecem nas respostas quando a pesquisa corresponde ao <strong className="font-medium text-ink-700">título</strong> ou à
        descrição — use títulos com os termos que os técnicos vão procurar (alarme, equipamento, procedimento).
      </p>

      {/* Upload */}
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink-100 sm:p-6">
        {!file ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e: DragEvent) => {
              e.preventDefault();
              setDragging(false);
              pick(e.dataTransfer.files[0]);
            }}
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
              Arraste o vídeo para aqui ou <span className="text-brand-600 underline underline-offset-2">escolha um ficheiro</span>
            </p>
            <p className="mt-1 text-xs text-ink-400">MP4 (recomendado), WebM ou MOV · máx. {MAX_MB} MB</p>
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="flex items-center gap-3 rounded-xl bg-ink-50 p-3 ring-1 ring-ink-100">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-navy-50 text-navy-700">
                <Film className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-ink-800">{file.name}</div>
                <div className="text-xs text-ink-400">
                  {fmtSize(file.size)}
                  {duration != null && ` · ${fmtDuration(Math.round(duration))}`}
                </div>
              </div>
              {!uploading && (
                <button type="button" onClick={reset} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700" aria-label="Remover ficheiro">
                  <X className="size-4" />
                </button>
              )}
            </div>

            {upload?.phase === "done" ? (
              <div role="status" className="mt-4 flex flex-col items-start gap-3 rounded-xl bg-emerald-50 p-4 ring-1 ring-emerald-200 sm:flex-row sm:items-center">
                <CheckCircle2 className="size-6 shrink-0 text-emerald-600" />
                <div className="flex-1 text-sm text-emerald-900">
                  <div className="font-semibold">Vídeo publicado</div>
                  Já aparece nas pesquisas por “{upload.video.title}”.
                </div>
                <button type="button" onClick={reset} className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-100">
                  Carregar outro
                </button>
              </div>
            ) : (
              <>
                <div className="mt-4 space-y-4">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-ink-600">Título</span>
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                      minLength={2}
                      maxLength={200}
                      disabled={uploading}
                      placeholder="ex.: Medição de VSWR com analisador de antenas"
                      className="w-full rounded-xl border border-ink-200 px-3.5 py-2.5 text-base outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-100 disabled:bg-ink-50 sm:text-sm"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-ink-600">
                      Descrição <span className="font-normal text-ink-400">(opcional — mais palavras-chave para a pesquisa)</span>
                    </span>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      maxLength={2000}
                      rows={2}
                      disabled={uploading}
                      placeholder="ex.: jumper, feeder, função DTF, setor bloqueado"
                      className="w-full resize-y rounded-xl border border-ink-200 px-3.5 py-2.5 text-base outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-100 disabled:bg-ink-50 sm:text-sm"
                    />
                  </label>
                </div>

                {upload?.phase === "error" && (
                  <div role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                    <AlertCircle className="mt-0.5 size-4 shrink-0" /> {upload.error}
                  </div>
                )}

                <div className="mt-5 flex items-center justify-end gap-4">
                  {uploading && (
                    <span className="flex flex-1 items-center gap-3 text-sm text-ink-600">
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-ink-100">
                        <span className="block h-full rounded-full bg-brand-500 transition-all" style={{ width: `${Math.round(upload.fraction * 100)}%` }} />
                      </span>
                      <span className="w-10 text-right tabular-nums">{Math.round(upload.fraction * 100)}%</span>
                    </span>
                  )}
                  <button
                    disabled={uploading}
                    className="flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand-500/25 transition hover:bg-brand-600 disabled:opacity-70"
                  >
                    {uploading ? <Loader2 className="size-4 animate-spin" /> : <UploadCloud className="size-4" />}
                    {uploading ? "A enviar…" : "Carregar vídeo"}
                  </button>
                </div>
              </>
            )}
          </form>
        )}
        {fileError && (
          <div role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            <AlertCircle className="mt-0.5 size-4 shrink-0" /> {fileError}
          </div>
        )}
        <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      </section>

      {/* Lista */}
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-ink-700">
          Vídeos carregados {videos && <span className="font-normal text-ink-400">({videos.length})</span>}
        </h2>
        {videos === null ? (
          <div className="h-24 animate-pulse rounded-2xl bg-white" />
        ) : videos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink-200 px-6 py-10 text-center text-sm text-ink-500">
            Ainda não há vídeos. Carregue o primeiro acima.
          </div>
        ) : (
          <ul className="divide-y divide-ink-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-ink-100">
            {videos.map((v) => (
              <VideoRow key={v.id} v={v} onPlay={() => setPlaying(v)} onDelete={() => remove(v)} onSaved={load} />
            ))}
          </ul>
        )}
      </section>

      {playing && <VideoPlayer videoId={playing.id} title={playing.title} onClose={() => setPlaying(null)} />}
    </>
  );
}

function VideoRow({ v, onPlay, onDelete, onSaved }: { v: VideoInfo; onPlay: () => void; onDelete: () => void; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(v.title);
  const [description, setDescription] = useState(v.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.updateVideo(v.id, { title: title.trim(), description: description.trim() || null });
      setEditing(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="flex items-start gap-4 px-4 py-3.5">
      <button
        onClick={onPlay}
        className="group relative grid aspect-video w-32 shrink-0 place-items-center overflow-hidden rounded-lg bg-gradient-to-br from-navy-800 to-navy-950"
        aria-label={`Ver ${v.title}`}
      >
        <video src={`${v.streamUrl}#t=0.5`} preload="metadata" muted playsInline className="absolute inset-0 size-full object-cover" />
        <span className="relative grid size-8 place-items-center rounded-full bg-brand-500 text-white shadow-lg transition group-hover:scale-110">
          <Play className="ml-0.5 size-3.5" fill="currentColor" />
        </span>
        {v.durationSec != null && (
          <span className="absolute right-1 bottom-1 rounded bg-black/70 px-1 text-[10px] font-medium tabular-nums text-white">{fmtDuration(v.durationSec)}</span>
        )}
      </button>

      {editing ? (
        <form onSubmit={save} className="min-w-0 flex-1 space-y-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            minLength={2}
            maxLength={200}
            autoFocus
            aria-label="Título"
            className="w-full rounded-lg border border-ink-200 px-3 py-1.5 text-base font-medium outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-100 sm:text-sm"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            rows={2}
            placeholder="Descrição (opcional)"
            aria-label="Descrição"
            className="w-full resize-y rounded-lg border border-ink-200 px-3 py-1.5 text-base outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-100 sm:text-sm"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button disabled={saving} className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-70">
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Guardar
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setTitle(v.title);
                setDescription(v.description ?? "");
              }}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink-600 hover:bg-ink-100"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="min-w-0 flex-1">
            <div className="font-medium text-ink-900">{v.title}</div>
            {v.description && <div className="mt-0.5 line-clamp-2 text-sm text-ink-500">{v.description}</div>}
            <div className="mt-1 truncate text-xs text-ink-400">
              {fmtSize(v.size)} · {new Date(v.createdAt).toLocaleDateString("pt-PT")} · {v.fileName}
            </div>
          </div>
          <div className="flex shrink-0 gap-0.5">
            <button onClick={() => setEditing(true)} className="rounded-lg p-2 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700" aria-label={`Editar ${v.title}`} title="Editar título e descrição">
              <Pencil className="size-4" />
            </button>
            <button onClick={onDelete} className="rounded-lg p-2 text-ink-400 transition hover:bg-red-50 hover:text-red-600" aria-label={`Apagar ${v.title}`} title="Apagar">
              <Trash2 className="size-4" />
            </button>
          </div>
        </>
      )}
    </li>
  );
}
