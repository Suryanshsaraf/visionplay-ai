import React, { useState, useEffect, useRef } from "react";

interface Match {
  id: number;
  filename: string;
  filepath: string;
  status: string;
  created_at: string;
}

interface MatchStats {
  possession_team_1: number;
  possession_team_2: number;
  distance_team_1: number;
  distance_team_2: number;
}

interface MatchEvent {
  id: number;
  timestamp: number;
  event_type: string;
  description: string;
}

interface ChatMessage {
  id: number;
  role: string;
  content: string;
  citations?: number[];
}

function App() {
  // Navigation & selection
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  
  // Dashboard states
  const [matches, setMatches] = useState<Match[]>([]);
  const [stats, setStats] = useState<MatchStats | null>(null);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [activeTab, setActiveTab] = useState<"stats" | "chat">("stats");
  
  // Upload states
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Chat states
  const [chatSessionId, setChatSessionId] = useState<number | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const API_URL = "http://localhost:8000";
  const videoRef = useRef<HTMLVideoElement>(null);

  // Fetch matches list
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

  // Poll processing match status
  useEffect(() => {
    const activeProcessing = matches.some((m) => m.status === "processing" || m.status === "uploaded");
    if (!activeProcessing) return;

    const interval = setInterval(() => {
      fetchMatches();
    }, 3000);

    return () => clearInterval(interval);
  }, [matches]);

  // Load detailed match dashboard data
  const handleSelectMatch = async (match: Match) => {
    setSelectedMatch(match);
    setChatSessionId(null);
    setChatMessages([]);
    setChatInput("");
    setActiveTab("stats");

    try {
      // 1. Fetch match stats
      const statsRes = await fetch(`${API_URL}/match/${match.id}/stats`);
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      // 2. Fetch match events (timeline)
      const eventsRes = await fetch(`${API_URL}/match/${match.id}/events`);
      if (eventsRes.ok) {
        const eventsData = await eventsRes.json();
        setEvents(eventsData);
      }

      // 3. Create or load chat session
      const sessionRes = await fetch(`${API_URL}/chat/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match_id: match.id }),
      });
      if (sessionRes.ok) {
        const sessionData = await sessionRes.json();
        setChatSessionId(sessionData.id);
        
        // Fetch session messages
        const msgsRes = await fetch(`${API_URL}/chat/session/${sessionData.id}/messages`);
        if (msgsRes.ok) {
          const msgsData = await msgsRes.json();
          setChatMessages(msgsData);
        }
      }
    } catch (err) {
      console.error("Failed to load match details:", err);
    }
  };

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
        setSuccess(`Successfully uploaded ${file.name}! Processing started...`);
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

  const seekVideo = (timestamp: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = timestamp;
      videoRef.current.play();
    }
  };

  const sendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !chatSessionId || isGenerating) return;

    const userMessageText = chatInput;
    setChatInput("");
    setIsGenerating(true);

    // Optimistically add user message locally
    const tempUserMsg: ChatMessage = {
      id: Date.now(),
      role: "user",
      content: userMessageText,
    };
    setChatMessages((prev) => [...prev, tempUserMsg]);

    try {
      const response = await fetch(`${API_URL}/chat/session/${chatSessionId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: userMessageText }),
      });

      if (response.ok) {
        const data = await response.json();
        setChatMessages((prev) => [...prev, data]);
      } else {
        console.error("Failed to generate response:", response.statusText);
      }
    } catch (err) {
      console.error("Chat message send failed:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  const getVideoSource = (filepath: string) => {
    // Extract filename from full absolute backend filepath
    const filename = filepath.split("/").pop() || "";
    return `${API_URL}/uploads/${filename}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setSelectedMatch(null)}>
            <span className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              VisionPlay AI
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 font-mono">
              PRO
            </span>
          </div>
          <nav className="flex space-x-6 text-sm text-slate-400">
            <button 
              onClick={() => setSelectedMatch(null)}
              className={`hover:text-cyan-400 transition-colors ${!selectedMatch ? "text-slate-100" : ""}`}
            >
              Upload
            </button>
            {selectedMatch && (
              <span className="text-slate-500">
                / {selectedMatch.filename}
              </span>
            )}
          </nav>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-grow max-w-7xl mx-auto w-full px-4 py-8 flex flex-col">
        {!selectedMatch ? (
          // Upload & Welcome Screen
          <div className="max-w-4xl mx-auto w-full">
            <div className="text-center mb-10">
              <h1 className="text-5xl font-extrabold tracking-tight mb-4 bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                AI-Powered Sports Intelligence
              </h1>
              <p className="text-slate-400 text-lg max-w-2xl mx-auto">
                Upload raw football match footage. Our computer vision pipeline tracks players, maps coordinates via homography, and indexes timeline events into ChromaDB RAG.
              </p>
            </div>

            {/* Upload Box */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-8 backdrop-blur-sm shadow-xl mb-12">
              <h2 className="text-xl font-semibold mb-6">Upload Match Footage</h2>

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
                    Start Analysis Pipeline
                  </button>
                </div>
              )}

              {isUploading && (
                <div className="mt-6">
                  <div className="flex justify-between text-sm text-slate-400 mb-2">
                    <span>Uploading and preparing footage...</span>
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

            {/* Matches Table */}
            <div>
              <h2 className="text-xl font-semibold mb-6">Match Database</h2>
              {matches.length === 0 ? (
                <div className="text-center py-12 border border-slate-800 rounded-2xl bg-slate-900/20 text-slate-500 text-sm">
                  No match recordings analyzed yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {matches.map((m) => (
                    <div
                      key={m.id}
                      onClick={() => m.status === "completed" && handleSelectMatch(m)}
                      className={`p-5 border border-slate-800 rounded-xl bg-slate-900/30 transition-all flex items-center justify-between ${
                        m.status === "completed" ? "hover:bg-slate-900/60 cursor-pointer border-cyan-500/30 hover:border-cyan-500/70" : ""
                      }`}
                    >
                      <div>
                        <h3 className="font-semibold text-slate-200">{m.filename}</h3>
                        <span className="text-xs text-slate-500">
                          Uploaded on {new Date(m.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center space-x-4">
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
                        {m.status === "completed" && (
                          <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          // Immersive detail dashboard view
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-grow">
            
            {/* Left Column (Video & Timeline) */}
            <div className="lg:col-span-7 flex flex-col space-y-6">
              
              {/* Video Player */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl aspect-video relative">
                <video
                  ref={videoRef}
                  src={getVideoSource(selectedMatch.filepath)}
                  controls
                  className="w-full h-full object-contain"
                />
              </div>

              {/* Chronological Event Timeline */}
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 flex flex-col flex-grow min-h-[300px]">
                <h3 className="text-lg font-semibold mb-4 text-cyan-400 flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Chronological Match Timeline
                </h3>
                
                <div className="space-y-3 overflow-y-auto max-h-[400px] pr-2">
                  {events.length === 0 ? (
                    <p className="text-slate-500 text-sm py-4 text-center">No key events detected in this clip.</p>
                  ) : (
                    events.map((ev) => (
                      <div
                        key={ev.id}
                        onClick={() => seekVideo(ev.timestamp)}
                        className="p-3 bg-slate-950/40 border border-slate-800 hover:border-cyan-500/50 rounded-xl cursor-pointer hover:bg-slate-900 transition-all flex items-center justify-between group"
                      >
                        <div className="flex items-center space-x-3">
                          <span className="font-mono text-cyan-400 bg-cyan-500/10 px-2.5 py-0.5 rounded text-sm font-semibold">
                            {ev.timestamp.toFixed(1)}s
                          </span>
                          <span className="text-slate-200 text-sm group-hover:text-white transition-colors">
                            {ev.description}
                          </span>
                        </div>
                        <span className="text-xs uppercase text-slate-500 font-semibold px-2 py-0.5 bg-slate-800 rounded group-hover:bg-cyan-500/20 group-hover:text-cyan-400 transition-all">
                          {ev.event_type}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Right Column (Analytics & Chat) */}
            <div className="lg:col-span-5 flex flex-col border border-slate-800 rounded-2xl bg-slate-900/30 backdrop-blur-sm overflow-hidden shadow-2xl h-[calc(100vh-120px)] min-h-[600px]">
              
              {/* Tab Header */}
              <div className="flex border-b border-slate-800 bg-slate-950/50">
                <button
                  onClick={() => setActiveTab("stats")}
                  className={`flex-1 py-4 text-sm font-semibold border-b-2 transition-all ${
                    activeTab === "stats"
                      ? "border-cyan-500 text-cyan-400 bg-cyan-500/5"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Match Telemetry & Heatmaps
                </button>
                <button
                  onClick={() => setActiveTab("chat")}
                  className={`flex-1 py-4 text-sm font-semibold border-b-2 transition-all ${
                    activeTab === "chat"
                      ? "border-cyan-500 text-cyan-400 bg-cyan-500/5"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  AI Assistant RAG Chat
                </button>
              </div>

              {/* Tab Content */}
              <div className="flex-grow overflow-y-auto p-6">
                {activeTab === "stats" ? (
                  // Telemetry Stats & Heatmaps
                  <div className="space-y-8">
                    
                    {/* Team Metrics Card */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-4 text-center">
                        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Possession Split</h4>
                        <div className="text-xl font-bold text-cyan-400">
                          {stats ? `${stats.possession_team_1.toFixed(0)}% / ${stats.possession_team_2.toFixed(0)}%` : "50% / 50%"}
                        </div>
                        <span className="text-[10px] text-slate-500">Team 1 / Team 2</span>
                      </div>
                      <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-4 text-center">
                        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Distance Covered</h4>
                        <div className="text-xl font-bold text-blue-400">
                          {stats ? `${(stats.distance_team_1 * 1000).toFixed(0)}m / ${(stats.distance_team_2 * 1000).toFixed(0)}m` : "0m / 0m"}
                        </div>
                        <span className="text-[10px] text-slate-500">Team 1 / Team 2</span>
                      </div>
                    </div>

                    {/* Seaborn Heatmaps */}
                    <div className="space-y-6">
                      <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Player Pitch Heatmaps</h4>
                      
                      <div className="grid grid-cols-1 gap-6">
                        {/* Team 1 Heatmap */}
                        <div className="bg-slate-950/30 border border-slate-800/80 rounded-xl p-3 flex flex-col items-center">
                          <span className="text-xs font-semibold text-slate-400 mb-2">Team 1 Occupancy Heatmap</span>
                          <div className="rounded-lg overflow-hidden border border-slate-800 aspect-[1.54] w-full bg-slate-950">
                            <img
                              src={`${API_URL}/uploads/analytics/heatmap_${selectedMatch.id}_team_1.png`}
                              alt="Team 1 Heatmap"
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                // hide or show placeholder if not generated
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          </div>
                        </div>

                        {/* Team 2 Heatmap */}
                        <div className="bg-slate-950/30 border border-slate-800/80 rounded-xl p-3 flex flex-col items-center">
                          <span className="text-xs font-semibold text-slate-400 mb-2">Team 2 Occupancy Heatmap</span>
                          <div className="rounded-lg overflow-hidden border border-slate-800 aspect-[1.54] w-full bg-slate-950">
                            <img
                              src={`${API_URL}/uploads/analytics/heatmap_${selectedMatch.id}_team_2.png`}
                              alt="Team 2 Heatmap"
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  // AI Conversational Chat
                  <div className="flex flex-col h-full">
                    
                    {/* Messages Container */}
                    <div className="flex-grow space-y-4 overflow-y-auto mb-4 pr-1 max-h-[calc(100vh-320px)] min-h-[300px]">
                      {chatMessages.length === 0 ? (
                        <div className="text-center py-12 text-slate-500 text-sm">
                          Ask me anything about the match events! (e.g., "Which player scored?", "Summarize the timeline")
                        </div>
                      ) : (
                        chatMessages.map((msg) => (
                          <div
                            key={msg.id}
                            className={`flex flex-col max-w-[85%] rounded-xl p-3.5 ${
                              msg.role === "user"
                                ? "bg-cyan-500/10 border border-cyan-500/20 self-end ml-auto text-slate-100"
                                : "bg-slate-950/60 border border-slate-800 self-start mr-auto text-slate-300"
                            }`}
                          >
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                              {msg.role === "user" ? "You" : "VisionPlay AI Analyst"}
                            </span>
                            <div className="text-sm whitespace-pre-wrap leading-relaxed">
                              {msg.content}
                            </div>
                            
                            {/* Render Citations */}
                            {msg.role === "assistant" && msg.citations && msg.citations.length > 0 && (
                              <div className="mt-3 pt-2 border-t border-slate-800/80 flex flex-wrap gap-1.5 items-center">
                                <span className="text-[10px] text-slate-500 mr-1 font-semibold uppercase">Video Citations:</span>
                                {msg.citations.map((time, idx) => (
                                  <button
                                    key={idx}
                                    onClick={() => seekVideo(time)}
                                    className="px-2 py-0.5 text-xs font-semibold bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 rounded font-mono border border-cyan-500/20 transition-all"
                                  >
                                    {time.toFixed(1)}s
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                      
                      {isGenerating && (
                        <div className="p-3 bg-slate-950/40 border border-slate-800 self-start mr-auto rounded-xl max-w-[85%] flex items-center space-x-2 text-slate-500 text-sm">
                          <div className="flex space-x-1">
                            <div className="w-2.5 h-2.5 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                            <div className="w-2.5 h-2.5 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                            <div className="w-2.5 h-2.5 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                          </div>
                          <span>Analyzing events timeline...</span>
                        </div>
                      )}
                    </div>

                    {/* Input form */}
                    <form onSubmit={sendChatMessage} className="flex space-x-2 border-t border-slate-800 pt-4 bg-slate-900/10">
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="Ask about goals, passes, or summaries..."
                        className="flex-grow bg-slate-950 border border-slate-800 focus:border-cyan-500/80 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition-all"
                        disabled={isGenerating}
                      />
                      <button
                        type="submit"
                        disabled={!chatInput.trim() || isGenerating}
                        className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-5 py-2.5 rounded-xl text-sm transition-all disabled:opacity-40 disabled:hover:bg-cyan-500 shadow-md shadow-cyan-500/10"
                      >
                        Send
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
