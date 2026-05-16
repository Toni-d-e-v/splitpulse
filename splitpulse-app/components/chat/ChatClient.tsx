"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Bot, MapPin, Send } from "lucide-react";
import { Markdown } from "@/components/chat/Markdown";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  slug?: string | null;
}

interface Props {
  initialQuery: string | null;
  pulseName: string | null;
}

const SUGGESTIONS = [
  "Where should I go right now?",
  "Best place for sunset",
  "Anything happening at Riva?",
  "Quiet spot near the sea?",
];

export function ChatClient({ initialQuery, pulseName }: Props) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const startedRef = useRef(false);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      const userMessage: Message = {
        id: `u-${Date.now()}`,
        role: "user",
        content: trimmed,
      };
      const nextHistory: Message[] = [...messages, userMessage];
      setMessages(nextHistory);
      setInput("");
      setError(null);
      setLoading(true);

      try {
        const response = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: nextHistory.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
        });
        const json = (await response.json()) as {
          reply?: string;
          slug?: string | null;
          error?: string;
        };
        if (!response.ok) {
          throw new Error(json.error ?? "Chat failed");
        }
        setMessages((current) => [
          ...current,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            content: json.reply ?? "(no reply)",
            slug: json.slug ?? null,
          },
        ]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Chat failed");
      } finally {
        setLoading(false);
      }
    },
    [loading, messages],
  );

  useEffect(() => {
    if (initialQuery && !startedRef.current) {
      startedRef.current = true;
      void send(initialQuery);
    }
  }, [initialQuery, send]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  const openOnMap = (slug: string) => {
    router.push(`/map?focus=${encodeURIComponent(slug)}`);
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-[max(16px,env(safe-area-inset-top))]">
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-white/80 transition active:scale-95"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/40">
            Pulse AI
          </p>
          <h1 className="text-lg font-bold text-white">Ask anything</h1>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-full bg-white text-xs font-bold text-black">
          {pulseName ? pulseName[0]?.toUpperCase() : "@"}
        </div>
      </header>

      <div className="mt-5 flex-1 space-y-3 overflow-y-auto pb-4">
        {messages.length === 0 && !initialQuery && (
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 text-sm text-white/70">
            <div className="flex items-center gap-2 text-white">
              <Bot className="h-4 w-4" />
              <span className="font-semibold">Pulse AI</span>
            </div>
            <p className="mt-2 leading-snug text-white/65">
              Ask about Split — places, vibes, what is happening right now.
              I know the live objects on the map.
            </p>
            <div className="mt-4 grid gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => send(suggestion)}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-xs font-semibold text-white/75 transition active:scale-[0.99]"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <ChatBubble
            key={message.id}
            message={message}
            onOpen={openOnMap}
          />
        ))}

        {loading && <TypingIndicator />}

        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-end gap-2 rounded-2xl border border-white/10 bg-black/40 p-2 backdrop-blur-xl"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={1}
          placeholder="Ask anything…"
          className="max-h-32 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-white outline-none placeholder:text-white/35"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          aria-label="Send"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-black transition active:scale-[0.95] disabled:bg-white/10 disabled:text-white/40"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

function ChatBubble({
  message,
  onOpen,
}: {
  message: Message;
  onOpen: (slug: string) => void;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-3xl rounded-br-md bg-white px-4 py-2.5 text-sm font-medium leading-snug text-black">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[88%] space-y-2">
        <div className="rounded-3xl rounded-bl-md border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm leading-snug text-white/90">
          <Markdown text={message.content} />
        </div>
        {message.slug && (
          <button
            type="button"
            onClick={() => onOpen(message.slug!)}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-bold text-white transition active:scale-[0.97]"
          >
            <MapPin className="h-3 w-3" />
            Show on map
          </button>
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="rounded-3xl rounded-bl-md border border-white/10 bg-white/[0.05] px-4 py-3">
        <div className="flex items-center gap-1">
          <span
            className="h-1.5 w-1.5 rounded-full bg-white/60"
            style={{
              animation: "pulse-dot 1.2s infinite",
              animationDelay: "0s",
            }}
          />
          <span
            className="h-1.5 w-1.5 rounded-full bg-white/60"
            style={{
              animation: "pulse-dot 1.2s infinite",
              animationDelay: "0.15s",
            }}
          />
          <span
            className="h-1.5 w-1.5 rounded-full bg-white/60"
            style={{
              animation: "pulse-dot 1.2s infinite",
              animationDelay: "0.3s",
            }}
          />
        </div>
      </div>
      <style jsx>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 0.3; transform: translateY(0); }
          50% { opacity: 1; transform: translateY(-2px); }
        }
      `}</style>
    </div>
  );
}
