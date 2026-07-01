import React, { useState, useEffect } from "react";

interface Match {
  id: number;
  filename: str;
  filepath: str;
  status: str;
  created_at: string;
}

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [matches, setMatches] = useState<Match[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const API_URL = "http://localhost:8000";

  // Fetch matches on mount
  const fetchMatches = async () => {
    try {
      const response = await fetch(`${API_URL}/matches`);
      if (response.ok) {
        const data = await response.json();
        setMatches(data);
      }
    } catch (err) {
      console.error("Failed to fetch matches:", err);
    }
  };

  useEffect(() => {
    fetchMatches();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      const validExtensions = [".mp4", ".mov", ".avi", ".mkv"];
      const hasValidExt = validExtensions.some(ext => selected.name.toLowerCase().endsWith(ext));
      
      if (!hasValidExt) {
        setError("Invalid video format. Supported: .mp4, .mov, .avi, .mkv");
        setFile(null);
        return;
      }

      setError(null);
      setSuccess(null);
      setFile(selected);
    }
  };

  const handleUpload = () => {
    if (!file) return;

    setIsUploading(true);
    setProgress(0);
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_URL}/upload-video`, true);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentComplete = Math.round((event.loaded / event.total) * 100);
        setProgress(percentComplete);
      }
    };

    xhr.onload = () => {
      setIsUploading(false);
      if (xhr.status === 200) {
        setSuccess(`Successfully uploaded ${file.name}!`);
        setFile(null);
        fetchMatches();
      } else {
        try {
          const resp = JSON.parse(xhr.responseText);
          setError(resp.detail || "Failed to upload video.");
        } catch {
          setError("Failed to upload video.");
        }
      }
    };

    xhr.onerror = () => {
      setIsUploading(false);
      setError("Network error occurred during upload.");
    };

    xhr.send(formData);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              VisionPlay AI
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 font-mono">
              BETA
            </span>
          </div>
          <nav className="flex space-x-6 text-sm text-slate-400">
            <a href="#" className="text-slate-100 hover:text-cyan-400 transition-colors">Upload</a>
            <a href="#" className="hover:text-cyan-400 transition-colors">Dashboard</a>
            <a href="#" className="hover:text-cyan-400 transition-colors">Analytics</a>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow max-w-4xl mx-auto w-full px-4 py-12">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-extrabold tracking-tight mb-3">
            AI-Powered Sports Intelligence
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            Upload football match footage to automatically track players, extract heatmaps, detect key events, and query using natural language.
          </p>
        </div>

        {/* Upload Container */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-8 backdrop-blur-sm shadow-xl mb-12">
          <h2 className="text-xl font-semibold mb-6">Upload Video</h2>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
              {success}
            </div>
          )}

          <div className="border-2 border-dashed border-slate-700 hover:border-cyan-500 transition-colors rounded-xl p-10 flex flex-col items-center justify-center cursor-pointer relative bg-slate-950/20 group">
            <input
              type="file"
              accept=".mp4,.mov,.avi,.mkv"
              onChange={handleFileChange}
              className="absolute inset-0 opacity-0 cursor-pointer"
              disabled={isUploading}
            />
            <svg
              className="w-12 h-12 text-slate-500 group-hover:text-cyan-400 transition-colors mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <span className="text-sm font-medium text-slate-300">
              {file ? file.name : "Drag & Drop video file here, or click to browse"}
            </span>
            <span className="text-xs text-slate-500 mt-1">
              Supports MP4, MOV, AVI, or MKV
            </span>
          </div>

          {file && !isUploading && (
            <div className="mt-6 flex justify-end">
              <button
                onClick={handleUpload}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 transition-all"
              >
                Start Upload
              </button>
            </div>
          )}

          {isUploading && (
            <div className="mt-6">
              <div className="flex justify-between text-sm text-slate-400 mb-2">
                <span>Uploading match footage...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-cyan-400 to-blue-500 h-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Matches List */}
        <div>
          <h2 className="text-xl font-semibold mb-6">Uploaded Matches</h2>
          {matches.length === 0 ? (
            <div className="text-center py-12 border border-slate-800 rounded-2xl bg-slate-900/20 text-slate-500 text-sm">
              No matches uploaded yet.
            </div>
          ) : (
            <div className="space-y-4">
              {matches.map((m) => (
                <div
                  key={m.id}
                  className="p-5 border border-slate-800 rounded-xl bg-slate-900/30 hover:bg-slate-900/50 transition-colors flex items-center justify-between"
                >
                  <div>
                    <h3 className="font-semibold text-slate-200">{m.filename}</h3>
                    <span className="text-xs text-slate-500">
                      Uploaded on {new Date(m.created_at).toLocaleString()}
                    </span>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      m.status === "completed"
                        ? "bg-green-500/10 text-green-400 border border-green-500/20"
                        : m.status === "processing"
                        ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 animate-pulse"
                        : m.status === "failed"
                        ? "bg-red-500/10 text-red-400 border border-red-500/20"
                        : "bg-slate-500/10 text-slate-400 border border-slate-500/20"
                    }`}
                  >
                    {m.status.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
