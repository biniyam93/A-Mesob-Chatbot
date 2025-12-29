
import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, Send, FileText, Trash2, Loader2, Info, X, MessageSquare,
  LogOut, ShieldCheck, BarChart3, Database, Activity, TrendingUp, 
  Cpu, Mic, Square, Settings, Menu, ChevronRight, StopCircle
} from 'lucide-react';
import { AppState, ChatMessage, MessageRole, DocumentInfo, User as UserType, UserRole, ViewType } from './types';
import { extractTextFromFile, chunkText } from './documentProcessor';
import { llmService } from './llmService';
import { docDB } from './db';

const STORAGE_KEY_USER = 'amesob_current_user';

/**
 * High-fidelity SVG recreation of the official A-Mesob logo provided by the user.
 * Design: Blue circular base, yellow arc segments, traditional pattern blocks, 
 * and a central biometric-circuit fingerprint node.
 */
const MesobLogo = ({ className = "w-10 h-10" }: { className?: string }) => (
  <div className={`relative flex items-center justify-center rounded-full overflow-hidden ${className}`}>
    <svg viewBox="0 0 100 100" className="w-full h-full shadow-lg">
      {/* Outer Blue Circle */}
      <circle cx="50" cy="50" r="50" fill="#0047BB" />
      
      {/* Yellow Peripheral Arc Segments */}
      <path d="M32 6 A44 44 0 0 1 68 6 L64 16 A34 34 0 0 0 36 16 Z" fill="#FFD700" />
      <path d="M94 32 A44 44 0 0 1 94 68 L84 64 A34 34 0 0 0 84 36 Z" fill="#FFD700" />
      <path d="M68 94 A44 44 0 0 1 32 94 L36 84 A34 34 0 0 0 64 84 Z" fill="#FFD700" />
      <path d="M6 68 A44 44 0 0 1 6 32 L16 36 A34 34 0 0 0 16 64 Z" fill="#FFD700" />

      {/* Traditional Pattern Blocks (Greek Key / Meander approximation) */}
      <g stroke="white" strokeWidth="1.5" fill="none" opacity="0.9">
        {/* Top Right Pattern */}
        <path d="M75 12 L82 12 L82 19 L78 19 L78 15 L80 15" />
        <path d="M85 22 L92 22 L92 29 L88 29 L88 25 L90 25" />
        {/* Bottom Right Pattern */}
        <path d="M82 81 L82 74 L75 74 L75 78 L79 78 L79 76" />
        <path d="M92 92 L92 85 L85 85 L85 89 L89 89 L89 87" />
        {/* Bottom Left Pattern */}
        <path d="M25 88 L18 88 L18 81 L22 81 L22 85 L20 85" />
        <path d="M15 78 L8 78 L8 71 L12 71 L12 75 L10 75" />
        {/* Top Left Pattern */}
        <path d="M18 19 L18 12 L25 12 L25 16 L21 16 L21 14" />
        <path d="M8 29 L8 22 L15 22 L15 26 L11 26 L11 24" />
      </g>

      {/* Central White Node Container */}
      <circle cx="50" cy="50" r="28" fill="white" />
      
      {/* Fingerprint / Neural Circuit Motif */}
      <g stroke="#0047BB" strokeWidth="0.8" fill="none">
        {/* Radiating lines with terminals */}
        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(deg => (
          <g key={deg} transform={`rotate(${deg}, 50, 50)`}>
            <line x1="50" y1="36" x2="50" y2="28" />
            <circle cx="50" cy="28" r="1.5" fill="#0047BB" stroke="none" />
          </g>
        ))}
        
        {/* Fingerprint Arcs */}
        <path d="M42 50 Q50 35 58 50" strokeWidth="1.2" />
        <path d="M38 50 Q50 30 62 50" strokeWidth="1.2" />
        <path d="M45 50 Q50 40 55 50" strokeWidth="1.2" />
        <path d="M48 50 Q50 46 52 50" strokeWidth="1.2" />
        <path d="M35 50 Q50 25 65 50" strokeWidth="0.8" opacity="0.5" />
      </g>
    </svg>
  </div>
);

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    user: null,
    currentView: 'login',
    messages: [],
    documents: [],
    isProcessing: false,
    activeDocumentId: null
  });

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [input, setInput] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadSession = async () => {
      const savedUserStr = localStorage.getItem(STORAGE_KEY_USER);
      if (savedUserStr) {
        try {
          const user = JSON.parse(savedUserStr) as UserType;
          const savedDocs = await docDB.getAllDocuments();
          const historyKey = `amesob_history_${user.id}`;
          const savedMessages = JSON.parse(localStorage.getItem(historyKey) || '[]');
          
          setState(prev => ({
            ...prev,
            user,
            currentView: 'chat',
            documents: savedDocs,
            messages: savedMessages,
            activeDocumentId: savedDocs.length > 0 ? (prev.activeDocumentId || savedDocs[0].id) : null
          }));
        } catch (e) {
          localStorage.removeItem(STORAGE_KEY_USER);
        }
      }
    };
    loadSession();
  }, []);

  useEffect(() => {
    if (state.user && state.messages.length > 0) {
      const historyKey = `amesob_history_${state.user.id}`;
      localStorage.setItem(historyKey, JSON.stringify(state.messages));
    }
  }, [state.messages, state.user]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [state.messages, state.isProcessing, isTranscribing]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorderRef.current?.mimeType || 'audio/webm' });
        processAudioInput(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setError(null);
    } catch (err) {
      setError("Microphone access denied.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const processAudioInput = async (blob: Blob) => {
    setIsTranscribing(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64Data = (reader.result as string).split(',')[1];
        const transcription = await llmService.transcribeAudio(base64Data, blob.type);
        if (transcription.trim()) {
          setInput(transcription);
          await handleSendMessage(undefined, transcription);
        } else {
          setError("No clear speech detected.");
        }
        setIsTranscribing(false);
      };
    } catch (err: any) {
      setError(err.message || "Transcription failed.");
      setIsTranscribing(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    let user: UserType | null = null;
    if (loginEmail === 'admin@amesob.com' && loginPassword === 'admin123') {
      user = { id: 'admin-001', email: loginEmail, role: UserRole.ADMIN, name: 'Senior Administrator' };
    } else if (loginEmail === 'user@amesob.com' && loginPassword === 'user123') {
      user = { id: 'user-772', email: loginEmail, role: UserRole.USER, name: 'Enterprise Analyst' };
    }

    if (user) {
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
      window.location.reload(); 
    } else {
      setError("Invalid credentials.");
    }
  };

  const handleLogout = () => {
    if (confirm("Disconnect and clear secure session?")) {
      localStorage.removeItem(STORAGE_KEY_USER);
      window.location.reload();
    }
  };

  const handleInterrupt = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setState(prev => ({ ...prev, isProcessing: false }));
    setError("Analysis interrupted by user.");
  };

  const handleDeleteDocument = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this context?')) return;
    try {
      await docDB.deleteDocument(id);
      setState(prev => {
        const updatedDocuments = prev.documents.filter(d => d.id !== id);
        return {
          ...prev,
          documents: updatedDocuments,
          activeDocumentId: prev.activeDocumentId === id ? (updatedDocuments[0]?.id || null) : prev.activeDocumentId
        };
      });
    } catch (err) {
      setError("Deletion failed.");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setState(prev => ({ ...prev, isProcessing: true, error: null }));
    try {
      const file = files[0];
      const text = await extractTextFromFile(file);
      const chunks = chunkText(text);
      const newDoc: DocumentInfo = {
        id: Math.random().toString(36).substring(7),
        name: file.name,
        type: file.type || 'text/plain',
        content: text,
        size: file.size,
        uploadDate: Date.now(),
        chunkCount: chunks.length
      };
      await docDB.saveDocument(newDoc);
      setState(prev => ({
        ...prev,
        documents: [...prev.documents, newDoc],
        activeDocumentId: newDoc.id,
        isProcessing: false
      }));
    } catch (err: any) {
      setError(err.message || "Ingestion error.");
      setState(prev => ({ ...prev, isProcessing: false }));
    }
  };

  const handleSendMessage = async (e?: React.FormEvent, overrideInput?: string) => {
    e?.preventDefault();
    const finalInput = overrideInput || input;
    if (!finalInput.trim() || state.isProcessing || !state.activeDocumentId) return;

    const activeDoc = state.documents.find(d => d.id === state.activeDocumentId);
    if (!activeDoc) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: MessageRole.USER,
      content: finalInput,
      timestamp: Date.now()
    };

    setState(prev => ({ ...prev, messages: [...prev.messages, userMessage], isProcessing: true, error: null }));
    setInput('');
    setError(null);

    abortControllerRef.current = new AbortController();

    try {
      const response = await llmService.generateResponse(
        finalInput, 
        activeDoc.content, 
        state.messages.slice(-5),
        abortControllerRef.current.signal
      );

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: MessageRole.ASSISTANT,
        content: response.text,
        timestamp: Date.now(),
        sources: [activeDoc.name]
      };

      setState(prev => ({ ...prev, messages: [...prev.messages, assistantMessage], isProcessing: false }));
    } catch (err: any) {
      if (err.message !== "AbortError") {
        setError(err.message || "Neural engine error.");
      }
      setState(prev => ({ ...prev, isProcessing: false }));
    } finally {
      abortControllerRef.current = null;
    }
  };

  if (!state.user) {
    return (
      <div className="app-height bg-white flex flex-col items-center justify-center px-8">
        <div className="w-full max-sm text-center">
          <MesobLogo className="w-32 h-32 mx-auto mb-10" />
          <h1 className="text-4xl font-black tracking-tighter text-slate-900 uppercase">A-MESOB</h1>
          <p className="text-[10px] font-black tracking-widest text-indigo-500 uppercase mt-2 mb-12">Security Terminal v3.5</p>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <input 
              type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-3xl py-5 px-8 outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-semibold text-sm" 
              placeholder="Analyst Identity" required
            />
            <input 
              type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-3xl py-5 px-8 outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-semibold text-sm" 
              placeholder="Authorization Token" required
            />
            {error && <p className="text-red-500 text-[10px] font-black uppercase mt-2">{error}</p>}
            <button type="submit" className="w-full bg-indigo-600 text-white py-5 rounded-3xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-100 active:scale-95 transition-all mt-6">
              Establish Connection
            </button>
          </form>
        </div>
      </div>
    );
  }

  const activeDoc = state.documents.find(d => d.id === state.activeDocumentId);

  return (
    <div className="app-height bg-[#F8F9FC] flex flex-col overflow-hidden text-slate-800">
      
      <header className="h-16 px-6 glass-effect border-b border-slate-100 flex items-center justify-between sticky top-0 z-40 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => setIsSidebarOpen(true)} className="p-1 active-tap">
            <MesobLogo className="w-10 h-10" />
          </button>
          <div className="min-w-0">
            <h2 className="text-[9px] font-black text-slate-400 uppercase tracking-widest truncate leading-none mb-1">
              {state.currentView === 'chat' ? (activeDoc?.name || 'Session') : 'System Ops'}
            </h2>
            <div className="flex items-center gap-1.5">
               <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
               <p className="text-xs font-bold text-slate-900 truncate uppercase tracking-tight">
                A-MESOB Pro
               </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
           <button onClick={handleLogout} className="p-2.5 active-tap bg-slate-100 text-slate-600 rounded-xl">
              <LogOut className="w-4 h-4" />
           </button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden flex flex-col relative">
        {state.currentView === 'chat' && (
          <div className="h-full flex flex-col">
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 custom-scrollbar bg-[#FBFBFE]">
              {state.messages.length === 0 && !state.isProcessing && (
                <div className="h-full flex flex-col items-center justify-center text-center max-w-[240px] mx-auto opacity-30 mt-20">
                  <div className="w-16 h-16 bg-slate-100 rounded-[1.8rem] flex items-center justify-center mb-4">
                     <MessageSquare className="w-8 h-8 text-slate-400" />
                  </div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Analytic Stream Idle</h3>
                  <p className="text-[10px] font-bold text-slate-500 mt-1">Initialize with document context to begin query mapping.</p>
                </div>
              )}

              {state.messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.role === MessageRole.USER ? 'justify-end' : 'justify-start'} animate-in`}>
                  <div className={`max-w-[88%] p-5 rounded-[1.8rem] shadow-sm border ${msg.role === MessageRole.USER ? 'bg-indigo-600 text-white border-indigo-500 rounded-tr-none' : 'bg-white border-slate-100 text-slate-800 rounded-tl-none'}`}>
                    <span className={`text-[8px] font-black uppercase tracking-widest mb-2 block ${msg.role === MessageRole.USER ? 'text-indigo-200' : 'text-indigo-600'}`}>
                      {msg.role === MessageRole.USER ? 'Analyst' : 'Neural Core'}
                    </span>
                    <div className="text-[13px] font-medium leading-relaxed whitespace-pre-wrap">{msg.content}</div>
                  </div>
                </div>
              ))}
              {(state.isProcessing || isTranscribing) && (
                <div className="flex justify-start">
                  <div className="bg-white border border-slate-100 rounded-[1.5rem] p-4 flex items-center gap-3 shadow-sm">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                      {isTranscribing ? 'Decoding Audio...' : 'Mapping Context...'}
                    </span>
                  </div>
                </div>
              )}
              {error && (
                <div className="mx-auto max-w-xs p-4 bg-red-50 text-red-600 rounded-2xl border border-red-100 text-center font-bold text-[10px] uppercase tracking-widest animate-in">
                  {error}
                </div>
              )}
              <div className="h-4 w-full" />
            </div>

            <div className="p-4 bg-white/80 backdrop-blur-md border-t border-slate-100 shrink-0">
               <form onSubmit={handleSendMessage} className="max-w-xl mx-auto flex items-end gap-2 relative">
                  <div className="flex-1 relative">
                    <textarea
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      placeholder={state.activeDocumentId ? "Submit secure query..." : "Context required..."}
                      disabled={!state.activeDocumentId || state.isProcessing || isTranscribing}
                      className="w-full bg-slate-50 border border-slate-100 rounded-[1.8rem] px-5 py-4 pr-12 focus:border-indigo-300 outline-none resize-none min-h-[56px] max-h-[120px] shadow-inner font-semibold text-sm transition-all"
                      rows={1}
                    />
                    <button 
                      type="button" onClick={isRecording ? stopRecording : startRecording}
                      disabled={!state.activeDocumentId || state.isProcessing || isTranscribing}
                      className={`absolute right-1.5 bottom-1.5 w-10 h-10 rounded-full shadow-lg transition-all flex items-center justify-center active-tap ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-white text-slate-400'}`}
                    >
                      {isRecording ? <Square className="w-4 h-4" /> : <Mic className="w-5 h-5" />}
                    </button>
                  </div>
                  
                  {state.isProcessing ? (
                    <button 
                      type="button" onClick={handleInterrupt}
                      className="w-14 h-14 bg-red-50 text-red-600 rounded-full shadow-xl shadow-red-100 hover:bg-red-100 transition-all flex items-center justify-center shrink-0 active-tap"
                      title="Interrupt Analysis"
                    >
                      <StopCircle className="w-7 h-7" />
                    </button>
                  ) : (
                    <button 
                      type="submit" disabled={!input.trim() || !state.activeDocumentId || isTranscribing} 
                      className="w-14 h-14 bg-indigo-600 text-white rounded-full shadow-xl shadow-indigo-200 hover:bg-indigo-700 disabled:bg-slate-200 transition-all flex items-center justify-center shrink-0 active-tap"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  )}
               </form>
            </div>
          </div>
        )}

        {state.currentView === 'admin_dashboard' && (
          <div className="h-full overflow-y-auto p-6 bg-[#FBFBFE] custom-scrollbar">
             <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none mb-1">Knowledge Vault</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Document Management Terminal</p>
                </div>
                <button onClick={() => fileInputRef.current?.click()} className="p-4 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-100 active-tap">
                  <Plus className="w-6 h-6" />
                </button>
             </div>
             <div className="space-y-4 pb-24">
                {state.documents.map(doc => (
                  <div key={doc.id} className="bg-white border border-slate-100 p-5 rounded-3xl shadow-sm flex items-center gap-4 animate-in">
                     <div className="bg-indigo-50 p-3 rounded-xl text-indigo-600">
                        <FileText className="w-6 h-6" />
                     </div>
                     <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-slate-900 truncate text-sm">{doc.name}</h4>
                        <p className="text-[9px] font-black text-slate-400 uppercase mt-0.5">{Math.round(doc.size/1024)}KB • {doc.chunkCount} Nodes</p>
                     </div>
                     <button onClick={() => handleDeleteDocument(doc.id)} className="p-3 text-red-400 bg-red-50 rounded-xl hover:bg-red-100 active:scale-90 transition-all">
                        <Trash2 className="w-4 h-4" />
                     </button>
                  </div>
                ))}
                {state.documents.length === 0 && (
                  <div className="py-20 text-center border-2 border-dashed border-slate-100 rounded-[2rem] text-slate-300 font-black uppercase text-[10px]">Vault Library Empty</div>
                )}
             </div>
             <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} accept=".pdf,.docx,.txt" />
          </div>
        )}

        {state.currentView === 'admin_reports' && (
          <div className="h-full overflow-y-auto p-6 bg-[#FBFBFE] custom-scrollbar">
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-8">Security Metrics</h3>
              <div className="grid grid-cols-2 gap-4 mb-24">
                {[
                  { label: 'Vault Load', val: state.documents.length, icon: Database, color: 'indigo' },
                  { label: 'Token Flow', val: '24k', icon: Activity, color: 'emerald' },
                  { label: 'Core Status', val: 'Secure', icon: ShieldCheck, color: 'amber' },
                  { label: 'Inference', val: '1.2ms', icon: Cpu, color: 'purple' },
                ].map(stat => (
                  <div key={stat.label} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                    <stat.icon className={`w-5 h-5 text-indigo-600 mb-4`} />
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
                    <h4 className="text-xl font-black text-slate-900">{stat.val}</h4>
                  </div>
                ))}
              </div>
          </div>
        )}
      </div>

      <nav className="h-16 shrink-0 bg-white/95 backdrop-blur-xl border-t border-slate-100 flex items-center justify-around px-4 mobile-bottom-nav z-50">
        <button onClick={() => setState(prev => ({ ...prev, currentView: 'chat' }))} className={`flex flex-col items-center gap-1 w-1/4 active-tap ${state.currentView === 'chat' ? 'text-indigo-600' : 'text-slate-400'}`}>
          <MessageSquare className="w-5 h-5" />
          <span className="text-[8px] font-black uppercase">Stream</span>
        </button>
        {state.user.role === UserRole.ADMIN && (
          <>
            <button onClick={() => setState(prev => ({ ...prev, currentView: 'admin_dashboard' }))} className={`flex flex-col items-center gap-1 w-1/4 active-tap ${state.currentView === 'admin_dashboard' ? 'text-indigo-600' : 'text-slate-400'}`}>
              <Database className="w-5 h-5" />
              <span className="text-[8px] font-black uppercase">Vault</span>
            </button>
            <button onClick={() => setState(prev => ({ ...prev, currentView: 'admin_reports' }))} className={`flex flex-col items-center gap-1 w-1/4 active-tap ${state.currentView === 'admin_reports' ? 'text-indigo-600' : 'text-slate-400'}`}>
              <BarChart3 className="w-5 h-5" />
              <span className="text-[8px] font-black uppercase">Stats</span>
            </button>
          </>
        )}
        <button onClick={() => setIsSidebarOpen(true)} className="flex flex-col items-center gap-1 w-1/4 text-slate-400 active-tap">
          <Menu className="w-5 h-5" />
          <span className="text-[8px] font-black uppercase">More</span>
        </button>
      </nav>

      {isSidebarOpen && (
        <div className="fixed inset-0 z-[100] flex">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm animate-in" onClick={() => setIsSidebarOpen(false)} />
          <aside className="relative w-[85%] max-w-sm bg-white h-full shadow-2xl flex flex-col animate-in" style={{ animationName: 'slideRight' }}>
            <div className="p-8 border-b border-slate-50">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2">
                  <MesobLogo className="w-8 h-8" />
                  <h1 className="font-black text-xl tracking-tighter">A-MESOB</h1>
                </div>
                <button onClick={() => setIsSidebarOpen(false)} className="p-2 bg-slate-50 rounded-xl"><X className="w-5 h-5" /></button>
              </div>
              <div className="bg-indigo-50 p-4 rounded-3xl flex items-center gap-4 border border-indigo-100">
                <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-indigo-600 font-black shadow-sm text-lg uppercase">{state.user.name[0]}</div>
                <div className="min-w-0">
                  <p className="text-xs font-black truncate">{state.user.name}</p>
                  <p className="text-[9px] font-black text-indigo-500 uppercase">{state.user.role} Analyst</p>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
              <div>
                <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-4 px-2">Knowledge Index</h4>
                <div className="space-y-2">
                  {state.documents.map(doc => (
                    <button key={doc.id} onClick={() => { setState(prev => ({ ...prev, activeDocumentId: doc.id, currentView: 'chat' })); setIsSidebarOpen(false); }} className={`w-full flex items-center justify-between p-4 rounded-2xl text-left transition-all active-tap ${state.activeDocumentId === doc.id ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-50 text-slate-600'}`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="w-4 h-4 shrink-0" />
                        <span className="text-xs font-bold truncate">{doc.name}</span>
                      </div>
                      <ChevronRight className="w-4 h-4 opacity-50" />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-4 px-2">Secure Link</h4>
                <div className="space-y-2">
                  <button className="w-full flex items-center gap-3 p-4 bg-slate-50 rounded-2xl text-xs font-bold text-slate-600 active-tap"><Activity className="w-4 h-4" /> Neural Pulse</button>
                  <button className="w-full flex items-center gap-3 p-4 bg-slate-50 rounded-2xl text-xs font-bold text-slate-600 active-tap"><Settings className="w-4 h-4" /> Access Rules</button>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-slate-50">
              <button onClick={handleLogout} className="w-full py-5 bg-red-50 text-red-600 rounded-3xl text-[10px] font-black uppercase tracking-widest active-tap flex items-center justify-center gap-2">
                <LogOut className="w-3.5 h-3.5" /> Terminate Link
              </button>
            </div>
          </aside>
        </div>
      )}

      <style>{`
        @keyframes slideRight { from { transform: translateX(-100%); } to { transform: translateX(0); } }
      `}</style>
    </div>
  );
};

export default App;
