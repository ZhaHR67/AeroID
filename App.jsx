import React, { useState, useCallback, useEffect, useRef } from 'react';
import { 
  Plane, Upload, FileSearch, Info, History, ShieldCheck, 
  AlertCircle, Loader2, ChevronRight, ChevronDown, Cpu,
  LogOut, User, Trash2, Mail, Lock, ArrowLeft
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInAnonymously, signInWithCustomToken, 
  onAuthStateChanged, signOut, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, sendPasswordResetEmail
} from 'firebase/auth';
import { 
  getFirestore, collection, doc, onSnapshot, 
  deleteDoc, addDoc, serverTimestamp 
} from 'firebase/firestore';

// --- CONFIGURATION ---
// When you deploy to GitHub, replace these with your own keys from the Firebase Console
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
  apiKey: "YOUR_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'aeroid-app';
const GEMINI_KEY = typeof __api_key !== 'undefined' ? __api_key : "YOUR_GEMINI_API_KEY";

const MODELS = [
  { id: "gemini-2.5-flash-preview-09-2025", name: "Gemini 2.5 Flash", desc: "Fast & optimized for vision" },
  { id: "gemini-2.0-pro-preview", name: "Gemini 2.0 Pro", desc: "Advanced reasoning", disabled: true }
];

const App = () => {
  const [view, setView] = useState('dashboard');
  const [user, setUser] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [image, setImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);
  const [selectedModel, setSelectedModel] = useState(MODELS[0]);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u && !u.isAnonymous) {
        setView('dashboard');
        setAuthError(null);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const historyRef = collection(db, 'artifacts', appId, 'users', user.uid, 'history');
    const unsubscribe = onSnapshot(historyRef, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setHistory(items.slice(0, 10));
    });
    return () => unsubscribe();
  }, [user]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    const email = e.target.email.value;
    const password = e.target.password.value;
    try { await signInWithEmailAndPassword(auth, email, password); } 
    catch (err) { setAuthError("Invalid email or password."); }
    finally { setAuthLoading(false); }
  };

  const analyzeAircraft = async () => {
    if (!image || !user) return;
    setLoading(true);
    setError(null);
    const prompt = `Identify this aircraft. Use dashes (-) for each:
    - Aircraft Model:
    - Manufacturer:
    - Operator:
    - Registration:
    - Estimated Age:
    - Summary:`;

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${selectedModel.id}:generateContent?key=${GEMINI_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: "image/png", data: image } }] }] })
      });
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        setResult(text);
        const historyRef = collection(db, 'artifacts', appId, 'users', user.uid, 'history');
        await addDoc(historyRef, { text, image: previewUrl, model: selectedModel.name, createdAt: serverTimestamp() });
      }
    } catch (err) { setError("Analysis failed. Please try again."); }
    finally { setLoading(false); }
  };

  const AuthLayout = ({ children, title, subtitle }) => (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 border border-slate-100">
        <button onClick={() => setView('dashboard')} className="mb-6 text-slate-400 flex items-center gap-2 text-sm"><ArrowLeft className="w-4 h-4" /> Back</button>
        <h1 className="text-2xl font-black text-slate-900">{title}</h1>
        <p className="text-slate-500 text-sm mb-6">{subtitle}</p>
        {children}
      </div>
    </div>
  );

  if (view === 'login') return (
    <AuthLayout title="Sign In" subtitle="Keep your plane spotting history safe.">
      <form onSubmit={handleLogin} className="space-y-4">
        <input required name="email" type="email" placeholder="Email" className="w-full p-3 bg-slate-50 border rounded-xl" />
        <input required name="password" type="password" placeholder="Password" className="w-full p-3 bg-slate-50 border rounded-xl" />
        {authError && <p className="text-red-500 text-xs">{authError}</p>}
        <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl">Sign In</button>
      </form>
    </AuthLayout>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b h-16 flex items-center px-4 justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2 font-bold text-xl"><Plane className="text-blue-600" /> AeroID</div>
        {!user || user.isAnonymous ? (
          <button onClick={() => setView('login')} className="bg-slate-900 text-white px-4 py-2 rounded-full text-sm">Sign In</button>
        ) : (
          <button onClick={() => signOut(auth)} className="text-slate-500 text-sm">Sign Out</button>
        )}
      </nav>

      <main className="max-w-5xl mx-auto p-4 md:py-12 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-6">
          <section className="bg-white p-6 rounded-3xl shadow-sm border">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Upload className="text-blue-600" /> Identify Aircraft</h2>
            {!previewUrl ? (
              <div onClick={() => document.getElementById('file-input').click()} className="border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer hover:bg-slate-50">
                <input type="file" id="file-input" className="hidden" onChange={(e) => {
                  const file = e.target.files[0];
                  const reader = new FileReader();
                  reader.onloadend = () => { setPreviewUrl(reader.result); setImage(reader.result.split(',')[1]); };
                  reader.readAsDataURL(file);
                }} />
                <FileSearch className="w-10 h-10 mx-auto text-blue-500 mb-2" />
                <p className="font-bold">Click to upload a plane photo</p>
              </div>
            ) : (
              <div className="space-y-4">
                <img src={previewUrl} className="rounded-2xl w-full aspect-video object-contain bg-slate-900" />
                {!result && !loading && <button onClick={analyzeAircraft} className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl">Start AI Analysis</button>}
              </div>
            )}
            {loading && <div className="text-center py-8 animate-pulse font-bold">AI is looking at the tail number...</div>}
          </section>

          {result && (
            <section className="bg-white p-6 rounded-3xl shadow-sm border">
              <h2 className="font-bold mb-4">Results</h2>
              <div className="space-y-3">
                {result.split('\n').filter(l => l.includes(':')).map((line, i) => (
                  <div key={i} className="border-b pb-2">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">{line.split(':')[0].replace('-', '')}</span>
                    <p className="font-bold">{line.split(':')[1]}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="lg:col-span-5 space-y-6">
          <section className="bg-white p-6 rounded-3xl shadow-sm border">
            <h3 className="font-bold flex items-center gap-2 mb-4"><History className="text-slate-400" /> History</h3>
            {(!user || user.isAnonymous) ? (
              <p className="text-sm text-slate-500 text-center py-4">Sign in to save your history!</p>
            ) : (
              <div className="space-y-4">
                {history.map(item => (
                  <div key={item.id} className="flex gap-3 items-center">
                    <img src={item.image} className="w-16 h-12 rounded object-cover" />
                    <p className="text-sm font-bold truncate">{item.text.split('\n')[0]}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};

export default App;