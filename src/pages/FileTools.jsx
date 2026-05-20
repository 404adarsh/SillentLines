import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Download, File, ImagePlus, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

const readableBytes = (bytes) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

async function compressImage(file, quality, maxWidth) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(1, maxWidth / img.width || 1);
        const width = Math.round(img.width * ratio);
        const height = Math.round(img.height * ratio);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error("Compression failed"));
            resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
          },
          "image/jpeg",
          quality
        );
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function FileTools() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [outputFile, setOutputFile] = useState(null);
  const [selectedFilePreviewUrl, setSelectedFilePreviewUrl] = useState(null);
  const [outputFilePreviewUrl, setOutputFilePreviewUrl] = useState(null);
  const [quality, setQuality] = useState(0.75);
  const [maxWidth, setMaxWidth] = useState(1200);
  const [message, setMessage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!selectedFile) {
      setSelectedFilePreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(selectedFile);
    setSelectedFilePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  useEffect(() => {
    if (!outputFile) {
      setOutputFilePreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(outputFile);
    setOutputFilePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [outputFile]);

  const fileInfo = useMemo(() => {
    if (!selectedFile) return null;
    return {
      name: selectedFile.name,
      type: selectedFile.type || "Unknown",
      size: readableBytes(selectedFile.size),
    };
  }, [selectedFile]);

  const handleFileChange = (event) => {
    setOutputFile(null);
    setMessage("");
    const file = event.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
  };

  const handleCompress = async () => {
    if (!selectedFile) return;
    setIsProcessing(true);
    setMessage("");

    try {
      if (selectedFile.type.startsWith("image/")) {
        const compressed = await compressImage(selectedFile, quality, maxWidth);
        setOutputFile(compressed);
        setMessage(`Image compressed successfully: ${readableBytes(compressed.size)}`);
      } else {
        setOutputFile(selectedFile);
        setMessage("This tool supports browser image compression. For PDFs and documents, use the download button to save the uploaded file.");
      }
    } catch (err) {
      console.error(err);
      setMessage("Could not compress the selected file. Please try a different image or lower the quality.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#fff8f2] py-10 px-4 sm:px-6">
      <div className="mx-auto max-w-5xl rounded-3xl border border-stone-200 bg-white p-8 shadow-xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.3em] text-rose-500">File tools</p>
            <h1 className="mt-3 text-4xl font-black text-stone-950">Compress, resize, and preview files</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
              Upload an image, PDF, or document and use the tool to compress or export it. Image compression is available directly in the browser.
            </p>
          </div>
          <Link to="/" className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-stone-50 px-4 py-2 text-sm font-bold text-stone-700 transition hover:bg-stone-100">
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="space-y-6 rounded-3xl border border-stone-100 bg-[#fdf8f1] p-6 shadow-sm">
            <div className="rounded-3xl bg-white p-6 shadow-inner shadow-stone-100/80">
              <div className="flex items-center gap-3 text-stone-900">
                <ImagePlus className="h-6 w-6 text-rose-500" />
                <h2 className="text-lg font-bold">Upload a file</h2>
              </div>
              <p className="mt-2 text-sm text-stone-600">
                Choose an image, PDF, or document. For images, you can compress and resize directly. For PDFs and docs, this tool keeps them available for download.
              </p>
              <input type="file" onChange={handleFileChange} className="mt-5 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-800" />
            </div>

            {selectedFile && (
              <div className="rounded-3xl bg-white p-6 shadow-inner shadow-stone-100/80">
                <h2 className="text-lg font-bold text-stone-900">Preview</h2>
                {selectedFile.type.startsWith("image/") ? (
                  <img src={selectedFilePreviewUrl} alt="Selected file preview" className="mt-4 h-auto w-full rounded-3xl border border-stone-200 object-contain" />
                ) : selectedFile.type === "application/pdf" ? (
                  <embed src={selectedFilePreviewUrl} type="application/pdf" className="mt-4 h-[420px] w-full rounded-3xl border border-stone-200" />
                ) : (
                  <div className="mt-4 min-h-[220px] rounded-3xl border border-dashed border-stone-200 bg-stone-50 p-6 text-center text-sm text-stone-600">
                    Preview is not available for this file type, but the file is ready to download.
                  </div>
                )}
              </div>
            )}

            {selectedFile && selectedFile.type.startsWith("image/") && (
              <div className="rounded-3xl bg-white p-6 shadow-inner shadow-stone-100/80">
                <div className="flex items-center gap-3 text-stone-900">
                  <Sparkles className="h-6 w-6 text-amber-500" />
                  <h2 className="text-lg font-bold">Image options</h2>
                </div>
                <div className="mt-5 space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-stone-700">Compression quality</label>
                    <input type="range" min="0.3" max="1" step="0.05" value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="w-full" />
                    <div className="mt-1 text-sm text-stone-600">Quality: {Math.round(quality * 100)}%</div>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-stone-700">Max width</label>
                    <input type="number" min="300" max="3000" value={maxWidth} onChange={(e) => setMaxWidth(Number(e.target.value))} className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm" />
                    <div className="mt-1 text-sm text-stone-600">Resizing can reduce file size further.</div>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-3xl bg-white p-6 shadow-inner shadow-stone-100/80">
              <button onClick={handleCompress} disabled={!selectedFile || isProcessing} className="inline-flex min-h-12 w-full items-center justify-center rounded-3xl bg-rose-600 px-5 py-3 text-sm font-black text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60">
                {selectedFile ? "Compress / Save file" : "Choose a file first"}
              </button>
              <p className="mt-4 text-sm text-stone-600">Tip: Image files work best for browser compression. PDF and document processing is available as upload/download support.</p>
            </div>
          </section>

          <aside className="space-y-6 rounded-3xl border border-stone-100 bg-[#fff9f4] p-6 shadow-sm">
            <div className="rounded-3xl bg-white p-6 shadow-inner shadow-stone-100/80">
              <h2 className="text-lg font-bold text-stone-900">File details</h2>
              {!fileInfo ? (
                <p className="mt-4 text-sm text-stone-600">No file selected.</p>
              ) : (
                <div className="mt-4 space-y-3 text-sm text-stone-700">
                  <div className="flex items-center justify-between gap-2"><span className="font-semibold">Name</span><span>{fileInfo.name}</span></div>
                  <div className="flex items-center justify-between gap-2"><span className="font-semibold">Type</span><span>{fileInfo.type}</span></div>
                  <div className="flex items-center justify-between gap-2"><span className="font-semibold">Size</span><span>{fileInfo.size}</span></div>
                </div>
              )}
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-inner shadow-stone-100/80">
              <h2 className="text-lg font-bold text-stone-900">Result</h2>
              {outputFile ? (
                <div className="mt-4 space-y-3 text-sm text-stone-700">
                  <div className="flex items-center justify-between gap-2"><span className="font-semibold">Output name</span><span>{outputFile.name}</span></div>
                  <div className="flex items-center justify-between gap-2"><span className="font-semibold">Output size</span><span>{readableBytes(outputFile.size)}</span></div>
                  <a href={outputFilePreviewUrl} download={outputFile.name} className="inline-flex items-center gap-2 rounded-full bg-rose-600 px-4 py-2 text-sm font-black text-white transition hover:bg-rose-700">
                    <Download className="h-4 w-4" /> Download
                  </a>
                </div>
              ) : (
                <p className="mt-4 text-sm text-stone-600">No output generated yet.</p>
              )}
              {message && <p className="mt-3 text-sm text-rose-700">{message}</p>}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
