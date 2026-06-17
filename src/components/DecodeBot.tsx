import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Scene3D } from "./Scene3D";
import { useServerFn } from "@tanstack/react-start";
import { aiChat } from "@/lib/ai-chat.functions";

type Mode = "rule" | "ai";
type Theme = "light" | "dark";
type Msg = { role: "user" | "assistant"; content: string; pipeline?: string[] };

const RULES: Record<string, string> = {
  hello: "Hello there.",
  hi: "Hi.",
  hey: "Hi.",
  "good morning": "Good morning. Systems nominal.",
  "good evening": "Good evening. Systems nominal.",
  bye: "Goodbye.",
  goodbye: "Goodbye.",
  help: "Available commands: hello, hi, hey, bye, help, ping, time, date, name, version, about, joke, weather, status, clear, echo, whoami, thanks",
  ping: "pong",
  time: `Current time: ${new Date().toLocaleTimeString()}`,
  date: `Today is ${new Date().toLocaleDateString()}`,
  name: "I am DecodeBot a rule based engine.",
  whoami: "You are user_0001. Unverified.",
  version: "DecodeBot v0.1.0 rule engine build 2026.06",
  about: "A deterministic dictionary lookup. No memory, no learning, no context.",
  joke: "Why did the chatbot cross the road? It was following a rule.",
  weather: "I cannot perceive the weather. Try the AI mode.",
  status: "All systems operational. Latency ~12ms.",
  clear: "[ console cleared simulated ]",
  echo: "echo: (provide text after the command)",
  thanks: "You're welcome.",
  "thank you": "You're welcome.",
  matrix: "Wake up... The Matrix has you...",
  sudo: "User is not in the sudoers file. This incident will be reported.",
  hack: "Access denied. Security counter-measures deployed.",
  creator: "Built by the architects of Decode/Labs.",
  coffee: "Error 418: I'm a teapot.",
  "meaning of life": "42.",
  "open the pod bay doors": "I'm sorry Dave, I'm afraid I can't do that.",
  system: "Core temperature: 42C. Memory: 99% optimized. All subsystems functional.",
  xyzzy: "Nothing happens.",
  xyz: "Nothing happens.",
};

function ruleLookup(input: string) {
  const sanitized = input.toLowerCase().trim();
  const pipeline = [`input    →  "${input}"`, `sanitize →  "${sanitized}"`];
  const found = RULES[sanitized];
  pipeline.push(found ? `match    →  rules["${sanitized}"]` : `lookup   →  no match`);
  pipeline.push(`output   →  ${found ?? "Unknown command."}`);
  return { reply: found ?? "Unknown command.", pipeline };
}

export function DecodeBot() {
  const [theme, setTheme] = useState<Theme>("light");
  const [booted, setBooted] = useState(false);
  const [mode, setMode] = useState<Mode>("rule");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [autoVoice, setAutoVoice] = useState(true);
  const [listening, setListening] = useState(false);
  const [voiceIntensity, setVoiceIntensity] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [time, setTime] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const aiChatFn = useServerFn(aiChat);

  // Apply theme class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  }, [theme]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: 1e9, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      const hh = String(d.getUTCHours()).padStart(2, "0");
      const mm = String(d.getUTCMinutes()).padStart(2, "0");
      const ss = String(d.getUTCSeconds()).padStart(2, "0");
      setTime(`${hh}:${mm}:${ss} UTC`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const speak = async (text: string) => {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.slice(0, 800) }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play();
        setSpeaking(true);
        audioRef.current.onended = () => {
          setSpeaking(false);
          setVoiceIntensity(0);
        };
        const tick = () => {
          if (audioRef.current && !audioRef.current.paused) {
            setVoiceIntensity(0.3 + Math.random() * 0.7);
            requestAnimationFrame(tick);
          } else {
            setVoiceIntensity(0);
            setSpeaking(false);
          }
        };
        tick();
      }
    } catch (err) {
      console.error("Text-to-speech failed:", err);
    }
  };

  const sendUserText = async (text: string) => {
    const userMsg: Msg = { role: "user", content: text };
    setMessages((m) => [...m, userMsg]);
    setBusy(true);
    if (mode === "rule") {
      const { reply, pipeline } = ruleLookup(text);
      await new Promise((r) => setTimeout(r, 500));
      setMessages((m) => [...m, { role: "assistant", content: reply, pipeline }]);
      setBusy(false);
    } else {
      try {
        const history = [...messages, userMsg].map((m) => ({
          role: m.role,
          content: m.content,
        }));
        const res = await aiChatFn({ data: { messages: history } });
        const reply = res.content || "...";
        setMessages((m) => [...m, { role: "assistant", content: reply }]);
        if (autoVoice) speak(reply);
      } catch (e) {
        setMessages((m) => [
          ...m,
          { role: "assistant", content: e instanceof Error ? e.message : "Error" },
        ]);
      }
      setBusy(false);
    }
  };

  const handleSend = () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    sendUserText(text);
  };

  const startListening = () => {
    const SR =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).webkitSpeechRecognition ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).SpeechRecognition;
    if (!SR) return alert("Speech recognition not supported in this browser");
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      const t = e.results[0][0].transcript;
      sendUserText(t);
    };
    rec.start();
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden font-mono">
      <audio ref={audioRef} className="hidden" />

      {/* Quiet ambient grid */}
      <div className="fixed inset-0 z-0 grid-bg opacity-[0.35] pointer-events-none" />
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-background/0 via-background/0 to-background/40 pointer-events-none" />

      {/* Persistent top chrome (always visible) */}
      <TopChrome
        theme={theme}
        onToggleTheme={() => setTheme(theme === "light" ? "dark" : "light")}
        onAbout={() => setAboutOpen(true)}
        onHome={() => setBooted(false)}
        time={time}
        booted={booted}
        status={
          listening
            ? "listening"
            : speaking
              ? "speaking"
              : busy
                ? "thinking"
                : booted
                  ? "ready"
                  : "idle"
        }
      />

      {/* Landing */}
      <AnimatePresence>
        {!booted && (
          <Landing
            key="landing"
            theme={theme}
            voiceIntensity={voiceIntensity}
            onEnter={() => setBooted(true)}
            onAbout={() => setAboutOpen(true)}
          />
        )}
      </AnimatePresence>

      {/* Main App */}
      <AnimatePresence>
        {booted && (
          <motion.div
            key="app"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="relative z-10 mx-auto flex min-h-screen max-w-[1400px] flex-col px-6 pt-24 pb-10 md:px-10"
          >
            {/* Section header */}
            <div className="flex items-end justify-between gap-6 border-b border-border pb-5">
              <div className="flex items-baseline gap-5">
                <span className="text-[10px] tracking-[0.3em] text-muted-foreground">[ 02 ]</span>
                <h2 className="font-sans text-[13px] tracking-[0.18em] uppercase">
                  CONSOLE / {mode === "rule" ? "RULE ENGINE" : "AI ASSISTANT"}
                </h2>
              </div>
              <ModeToggle mode={mode} onChange={setMode} />
            </div>

            {/* Body grid */}
            <div className="mt-8 grid flex-1 gap-10 lg:grid-cols-[1fr_280px]">
              {/* Chat */}
              <section className="flex flex-col">
                <div
                  ref={listRef}
                  className="scrollbar-thin flex-1 overflow-y-auto pr-2 py-2 space-y-6 min-h-[420px] max-h-[58vh]"
                >
                  {messages.length === 0 && <EmptyState mode={mode} />}
                  {messages.map((m, i) => (
                    <MessageBubble key={i} m={m} mode={mode} index={i} />
                  ))}
                  {busy && <ThinkingBubble mode={mode} />}
                </div>

                <div className="mt-6 border-t border-border pt-5 flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] tracking-[0.3em] text-muted-foreground">
                      {mode === "rule" ? "CMD ›" : "ASK ›"}
                    </span>
                    <input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSend()}
                      placeholder={
                        mode === "rule"
                          ? "Type a command or select one below..."
                          : "Type anything Llama 3.3 on Groq…"
                      }
                      className="flex-1 bg-transparent py-2 outline-none placeholder:text-muted-foreground/60 text-[15px] font-sans"
                    />
                    {mode === "ai" && (
                      <button
                        onClick={startListening}
                        disabled={listening}
                        className={`text-[10px] tracking-[0.25em] uppercase px-2 py-1 border border-border hover:bg-foreground hover:text-background hover:scale-105 active:scale-95 transition-all ${listening ? "bg-foreground text-background animate-pulse" : ""}`}
                        title="Speak"
                      >
                        {listening ? "● Rec" : "Mic"}
                      </button>
                    )}
                    <button
                      onClick={handleSend}
                      disabled={busy || !input.trim()}
                      className="text-[10px] tracking-[0.3em] uppercase px-3 py-1.5 border border-foreground bg-foreground text-background disabled:opacity-30 hover:opacity-90 hover:scale-105 active:scale-95 transition-all"
                    >
                      Send ↵
                    </button>
                  </div>

                  {mode === "rule" && (
                    <div className="flex flex-wrap gap-2 max-h-[120px] overflow-y-auto scrollbar-thin pr-2">
                      {Object.keys(RULES).map((cmd) => (
                        <button
                          key={cmd}
                          onClick={() => sendUserText(cmd)}
                          className="px-2 py-1 text-[9px] tracking-[0.1em] uppercase font-mono rounded bg-muted/20 text-muted-foreground border border-border/50 hover:bg-foreground hover:text-background hover:scale-105 active:scale-95 transition-all"
                        >
                          {cmd}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              {/* Sidebar */}
              <aside className="space-y-8 lg:border-l lg:border-border lg:pl-8">
                <SideBlock label="Pipeline" index="A">
                  <Pipeline mode={mode} />
                </SideBlock>
                <SideBlock label="Telemetry" index="B">
                  <div className="space-y-2.5 text-[11px]">
                    <Stat label="Status" value="Online" accent />
                    <Stat label="Latency" value={mode === "rule" ? "~12ms" : "~420ms"} />
                    <Stat
                      label="Context"
                      value={mode === "rule" ? "Stateless" : `${messages.length} msgs`}
                    />
                    <Stat
                      label="Voice"
                      value={mode === "ai" ? (autoVoice ? "On" : "Muted") : " "}
                    />
                  </div>
                  {mode === "ai" && (
                    <button
                      onClick={() => setAutoVoice((v) => !v)}
                      className="mt-4 text-[10px] tracking-[0.3em] uppercase text-muted-foreground hover:text-foreground hover:scale-105 active:scale-95 transition-all"
                    >
                      {autoVoice ? "Mute voice" : "Enable voice"}
                    </button>
                  )}
                </SideBlock>
                <SideBlock label="Note" index="C">
                  <p className="text-[12px] leading-relaxed text-muted-foreground">
                    {mode === "rule"
                      ? "Deterministic. The engine sanitizes input and queries a fixed dictionary. Predictable, brittle, fast."
                      : "Probabilistic. The model reasons over context with memory and synthesized voice. Flexible, generative, slower."}
                  </p>
                </SideBlock>
              </aside>
            </div>

            <Footer time={time} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* About modal */}
      <AnimatePresence>
        {aboutOpen && <AboutPanel onClose={() => setAboutOpen(false)} />}
      </AnimatePresence>
    </div>
  );
}

function TopChrome({
  theme,
  onToggleTheme,
  onAbout,
  onHome,
  time,
  booted,
  status,
}: {
  theme: Theme;
  onToggleTheme: () => void;
  onAbout: () => void;
  onHome: () => void;
  time: string;
  booted: boolean;
  status: "idle" | "ready" | "listening" | "speaking" | "thinking";
}) {
  const statusMap: Record<string, { label: string; dot: string; pulse: boolean }> = {
    idle: { label: "Idle", dot: "bg-muted-foreground", pulse: false },
    ready: { label: "Ready", dot: "bg-gold", pulse: false },
    listening: { label: "Listening", dot: "bg-rule", pulse: true },
    speaking: { label: "Speaking", dot: "bg-ai", pulse: true },
    thinking: { label: "Thinking", dot: "bg-foreground", pulse: true },
  };
  const s = statusMap[status];
  return (
    <header className="fixed top-0 inset-x-0 z-40 px-6 md:px-10 pt-5 flex items-center justify-between text-[10px] tracking-[0.3em] uppercase font-mono font-semibold">
      <button
        onClick={onHome}
        className="flex items-center gap-3 hover:opacity-70 active:scale-95 transition-all cursor-pointer group"
      >
        <span className="size-1.5 rounded-full bg-foreground group-hover:scale-150 transition-transform" />
        <span className="group-hover:text-foreground/80 transition-colors">DECODE/LABS</span>
        <span className="text-muted-foreground hidden sm:inline">PROJECT 01</span>
      </button>
      <div className="hidden md:flex items-center gap-8 text-muted-foreground">
        <span className="inline-flex items-center gap-2 text-foreground">
          <span className={`size-1.5 rounded-full ${s.dot} ${s.pulse ? "animate-pulse" : ""}`} />
          {s.label}
        </span>
        <span>{time}</span>
      </div>
      <div className="flex items-center gap-5">
        <button
          onClick={onAbout}
          className="hover:text-foreground text-muted-foreground hover:scale-110 active:scale-95 transition-all"
        >
          INFO
        </button>
        <button
          onClick={onToggleTheme}
          className="hover:text-foreground text-muted-foreground hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
        >
          <span
            className={`size-1.5 rounded-full ${theme === "light" ? "bg-gold" : "bg-foreground"}`}
          />
          {theme === "light" ? "DAY" : "NIGHT"}
        </button>
      </div>
    </header>
  );
}

function Landing({
  theme,
  voiceIntensity,
  onEnter,
  onAbout,
}: {
  theme: Theme;
  voiceIntensity: number;
  onEnter: () => void;
  onAbout: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, filter: "blur(8px)" }}
      transition={{ duration: 0.7 }}
      className="relative z-10 min-h-screen px-6 md:px-10 pt-24 pb-10 flex flex-col"
    >
      {/* Eyebrow row */}
      <div className="grid grid-cols-12 gap-4 text-[10px] tracking-[0.3em] uppercase text-muted-foreground border-b border-border pb-5">
        <div className="col-span-3 hover:text-foreground transition-colors cursor-default">
          [ 01 ] Introduction
        </div>
        <div className="col-span-3 hidden md:block hover:text-foreground transition-colors cursor-default">
          Dual mode chatbot
        </div>
        <div className="col-span-3 hidden md:block hover:text-foreground transition-colors cursor-default">
          Rule engine ↔ LLM
        </div>
        <div className="col-span-3 text-right hover:text-foreground transition-colors cursor-default">
          v 0.1.0 / 2026
        </div>
      </div>

      {/* Hero */}
      <div className="flex-1 grid grid-cols-12 gap-6 md:gap-10 items-center py-12 md:py-16">
        <div className="col-span-12 lg:col-span-8">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9 }}
            className="display uppercase leading-[0.88] tracking-[-0.04em] text-[clamp(3.5rem,9vw,9rem)] hover:opacity-80 transition-opacity cursor-default"
          >
            Two Eras
            <br />
            of Conversation,
            <br />
            One Interface.
          </motion.h1>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="mt-10 grid grid-cols-12 gap-6"
          >
            <p className="col-span-12 md:col-span-7 text-[15px] leading-[1.6] text-muted-foreground hover:text-foreground transition-colors cursor-default">
              A study of conversational systems from deterministic, dictionary driven logic to a
              contemporary large language model with synthesized voice. Same surface, two
              technologies, decades apart.
            </p>
            <div className="col-span-12 md:col-span-5 flex md:justify-end items-end gap-4">
              <button
                onClick={onAbout}
                className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground hover:text-foreground hover:scale-105 active:scale-95 transition-all"
              >
                ↳ Read brief
              </button>
              <button
                onClick={onEnter}
                className="group inline-flex items-center gap-3 bg-foreground text-background px-6 py-3 text-[10px] tracking-[0.3em] uppercase hover:bg-background hover:text-foreground hover:border-foreground border border-transparent active:scale-95 transition-all"
              >
                <span className="size-1 rounded-full bg-gold" />
                Enter Console
                <span className="group-hover:translate-x-1 transition">→</span>
              </button>
            </div>
          </motion.div>
        </div>

        {/* Indexed object frame */}
        <div className="col-span-12 lg:col-span-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2, delay: 0.3 }}
            className="aspect-square w-full border border-border relative bg-background/40"
          >
            <div className="absolute inset-0 grid-bg opacity-60" />
            <div className="absolute inset-0">
              <Scene3D mode="rule" voiceIntensity={voiceIntensity} theme={theme} />
            </div>
            <div className="absolute top-3 left-3 text-[9px] tracking-[0.3em] uppercase text-muted-foreground">
              Fig. 01 Engine
            </div>
            <div className="absolute bottom-3 right-3 text-[9px] tracking-[0.3em] uppercase text-muted-foreground">
              Polyhedral / Static
            </div>
            <Corner pos="tl" />
            <Corner pos="tr" />
            <Corner pos="bl" />
            <Corner pos="br" />
          </motion.div>
        </div>
      </div>

      {/* Index footer */}
      <div className="mt-20 grid grid-cols-12 gap-4 border-t border-border pt-5 text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
        <div className="col-span-6 md:col-span-3">Index</div>
        <IndexItem n="01" label="Introduction" active />
        <IndexItem n="02" label="Console" />
        <IndexItem n="03" label="Brief" />
      </div>
    </motion.div>
  );
}

function Corner({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
  const map: Record<string, string> = {
    tl: "top-0 left-0 border-t border-l",
    tr: "top-0 right-0 border-t border-r",
    bl: "bottom-0 left-0 border-b border-l",
    br: "bottom-0 right-0 border-b border-r",
  };
  return <span className={`absolute size-2 border-foreground ${map[pos]}`} />;
}

function IndexItem({ n, label, active }: { n: string; label: string; active?: boolean }) {
  return (
    <div
      className={`col-span-6 md:col-span-3 flex items-center gap-3 cursor-pointer hover:text-foreground hover:scale-105 active:scale-95 transition-all ${active ? "text-foreground" : ""}`}
    >
      <span>{n}</span>
      <span className="h-px flex-1 bg-border" />
      <span>{label}</span>
    </div>
  );
}

function Footer({ time }: { time: string }) {
  return (
    <div className="mt-12 border-t border-border pt-5 grid grid-cols-12 gap-4 text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
      <div className="col-span-4 hover:text-foreground transition-colors cursor-default">
        Decode/Labs · 2026
      </div>
      <div className="col-span-4 text-center hidden md:block hover:text-foreground transition-colors cursor-default">
        Groq · ElevenLabs · Three.js
      </div>
      <div className="col-span-4 text-right hover:text-foreground transition-colors cursor-default">
        {time}
      </div>
    </div>
  );
}

function SideBlock({
  label,
  index,
  children,
}: {
  label: string;
  index: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4 text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
        <span>{index}</span>
        <span className="h-px flex-1 bg-border" />
        <span>{label}</span>
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between items-baseline">
      <span className="text-muted-foreground uppercase tracking-[0.3em] text-[10px]">{label}</span>
      <span className={accent ? "text-gold" : "text-foreground"}>
        {accent && <span className="mr-1.5">●</span>}
        {value}
      </span>
    </div>
  );
}

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div className="flex items-center text-[10px] uppercase tracking-[0.3em] border border-border">
      <button
        onClick={() => onChange("rule")}
        className={`px-4 py-2 transition ${mode === "rule" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
      >
        Rule Engine
      </button>
      <span className="w-px h-5 bg-border" />
      <button
        onClick={() => onChange("ai")}
        className={`px-4 py-2 transition ${mode === "ai" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
      >
        AI
      </button>
    </div>
  );
}

function EmptyState({ mode }: { mode: Mode }) {
  return (
    <div className="py-20 max-w-md mx-auto text-center flex flex-col items-center">
      <div className="size-16 rounded-full border border-border flex items-center justify-center text-[14px] tracking-[0.2em] font-semibold text-foreground mb-6 bg-background/50 backdrop-blur-sm">
        {mode === "rule" ? "ENG" : "AI"}
      </div>
      <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-4">
        {mode === "rule" ? "Awaiting command" : "AI core ready"}
      </div>
      <p className="text-[15px] leading-relaxed text-foreground/80">
        {mode === "rule" ? (
          <>
            This engine accepts a fixed vocabulary. Try{" "}
            <span className="font-mono bg-foreground/5 px-1.5 py-0.5 rounded-md">help</span>,{" "}
            <span className="font-mono bg-foreground/5 px-1.5 py-0.5 rounded-md">matrix</span>,{" "}
            <span className="font-mono bg-foreground/5 px-1.5 py-0.5 rounded-md">sudo</span> or{" "}
            <span className="font-mono bg-foreground/5 px-1.5 py-0.5 rounded-md">coffee</span>.
          </>
        ) : (
          <>
            Free form, context aware, voice enabled. Ask anything the model maintains history within
            this session.
          </>
        )}
      </p>
    </div>
  );
}

function MessageBubble({ m, mode, index }: { m: Msg; mode: Mode; index: number }) {
  const isUser = m.role === "user";
  const label = isUser ? "You" : mode === "rule" ? "Engine" : "AI";
  const num = String(index + 1).padStart(2, "0");

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`flex max-w-[85%] md:max-w-[75%] gap-4 ${isUser ? "flex-row-reverse" : "flex-row"}`}
      >
        <div className="flex-shrink-0 mt-1">
          {isUser ? (
            <div className="size-8 rounded-full bg-foreground text-background flex items-center justify-center text-[9px] tracking-[0.1em] font-bold">
              YOU
            </div>
          ) : (
            <div className="size-8 rounded-full border border-border bg-background flex items-center justify-center text-[9px] tracking-[0.1em] font-bold text-foreground">
              {mode === "rule" ? "ENG" : "AI"}
            </div>
          )}
        </div>

        <div className={`flex flex-col gap-2 ${isUser ? "items-end" : "items-start"}`}>
          <div className="text-[10px] tracking-[0.25em] uppercase text-muted-foreground flex items-center gap-2">
            <span>{label}</span>
            <span className="opacity-50">[{num}]</span>
          </div>

          {!isUser && m.pipeline && (
            <div className="font-mono text-[10px] leading-relaxed text-muted-foreground space-y-0.5 border-l border-border pl-3 py-1 bg-muted/10 rounded-r-md w-full max-w-fit">
              {m.pipeline.map((step, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  {step}
                </motion.div>
              ))}
            </div>
          )}

          <div
            className={`text-[15px] leading-relaxed whitespace-pre-wrap font-sans px-5 py-3.5 rounded-2xl ${
              isUser
                ? "bg-foreground text-background rounded-tr-sm"
                : "bg-muted/20 text-foreground rounded-tl-sm border border-border/40 shadow-sm"
            }`}
          >
            {m.content}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ThinkingBubble({ mode }: { mode: Mode }) {
  const phrases =
    mode === "rule" ? ["sanitizing…", "looking up…"] : ["analyzing…", "reasoning…", "generating…"];
  return (
    <div className={`flex w-full justify-start`}>
      <div className={`flex max-w-[85%] md:max-w-[75%] gap-4 flex-row`}>
        <div className="flex-shrink-0 mt-1">
          <div className="size-8 rounded-full border border-border bg-background flex items-center justify-center text-[9px] tracking-[0.1em] font-bold text-foreground animate-pulse">
            {mode === "rule" ? "ENG" : "AI"}
          </div>
        </div>
        <div className={`flex flex-col gap-2 items-start`}>
          <div className="text-[10px] tracking-[0.25em] uppercase text-muted-foreground flex items-center gap-2">
            <span>{mode === "rule" ? "Engine" : "AI"}</span>
          </div>
          <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground relative overflow-hidden mt-3 ml-2">
            <span className="animate-pulse">
              {phrases[Math.floor(Date.now() / 600) % phrases.length]}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Pipeline({ mode }: { mode: Mode }) {
  const steps =
    mode === "rule"
      ? ["Input", "Sanitize", "Dictionary", "Response"]
      : ["Input", "Embedding", "Reasoning", "Response", "Voice"];
  return (
    <ol className="space-y-2.5">
      {steps.map((s, i) => (
        <motion.li
          key={s}
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.06 }}
          className="flex items-center gap-3 text-[11px]"
        >
          <span className="text-[10px] text-muted-foreground w-6">
            {String(i + 1).padStart(2, "0")}
          </span>
          <span className={`size-1 ${mode === "rule" ? "bg-rule" : "bg-ai"}`} />
          <span className="tracking-[0.15em] uppercase">{s}</span>
        </motion.li>
      ))}
    </ol>
  );
}

function AboutPanel({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl overflow-y-auto"
    >
      <div className="min-h-screen px-6 md:px-10 pt-24 pb-16 max-w-[1100px] mx-auto">
        <div className="flex items-center justify-between border-b border-border pb-5 text-[10px] tracking-[0.3em] uppercase">
          <div className="flex items-center gap-5">
            <span className="text-muted-foreground">[ 03 ]</span>
            <span>Project Brief</span>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition"
          >
            Close ✕
          </button>
        </div>

        <div className="grid grid-cols-12 gap-6 md:gap-10 mt-16">
          <div className="col-span-12 md:col-span-4 space-y-6 text-[10px] tracking-[0.3em] uppercase">
            <div>
              <div className="text-muted-foreground mb-2">Programme</div>
              <div>Decode/Labs Internship</div>
            </div>
            <div>
              <div className="text-muted-foreground mb-2">Index</div>
              <div>Project 01 of N</div>
            </div>
            <div>
              <div className="text-muted-foreground mb-2">Discipline</div>
              <div>Conversational AI</div>
            </div>
            <div>
              <div className="text-muted-foreground mb-2">Stack</div>
              <div className="leading-relaxed">
                React · Three.js
                <br />
                Groq · Llama 3.3
                <br />
                ElevenLabs
              </div>
            </div>
          </div>

          <div className="col-span-12 md:col-span-8 space-y-8">
            <h2 className="display uppercase text-[clamp(2.5rem,5vw,4.5rem)] leading-[0.9] tracking-[-0.03em]">
              DecodeBot A Dual Mode
              <br />
              Conversational Assistant.
            </h2>
            <div className="space-y-5 text-[15px] leading-[1.7] text-foreground/85 max-w-[60ch]">
              <p>
                DecodeBot is a dual-mode conversational assistant built as part of
                <span className="text-foreground"> DecodeLabs Project 01</span>. The application
                demonstrates both deterministic rule-based AI and modern LLM-powered conversational
                AI within a single, consistent interface.
              </p>
              <p>Users can switch between two modes:</p>
              <ul className="space-y-3 border-l border-border pl-5">
                <li>
                  <span className="text-foreground">Rule Based Mode</span> built using dictionaries,
                  input sanitization, and decision making logic.
                </li>
                <li>
                  <span className="text-foreground">AI Mode</span> powered by a large language model
                  with voice interaction capabilities.
                </li>
              </ul>
              <p>
                This project showcases the evolution from traditional rule engines to modern AI
                systems while maintaining a clean and interactive user experience.
              </p>
            </div>

            <button
              onClick={onClose}
              className="inline-flex items-center gap-3 bg-foreground text-background px-6 py-3 text-[10px] tracking-[0.3em] uppercase hover:bg-background hover:text-foreground hover:border-foreground border border-transparent active:scale-95 transition-all"
            >
              <span className="size-1 rounded-full bg-gold" />
              Return to console
              <span>→</span>
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
