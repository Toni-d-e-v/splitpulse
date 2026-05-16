import { Suspense } from "react";
import { LoginClient } from "@/components/auth/LoginClient";

export default function LoginPage() {
  return (
    <main className="relative min-h-screen overflow-hidden grid place-items-center p-6 bg-deep">
      {/* Backdrop: animated radial glows on Split coordinates feel */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-80"
        style={{
          background:
            "radial-gradient(circle at 20% 30%, rgba(0,212,255,0.18), transparent 45%), radial-gradient(circle at 80% 70%, rgba(200,64,255,0.14), transparent 50%), radial-gradient(circle at 50% 100%, rgba(255,184,0,0.10), transparent 55%)",
        }}
      />
      {/* Subtle dot grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.07]"
        style={{
          backgroundImage:
            "radial-gradient(circle, #ffffff 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      <Suspense fallback={null}>
        <LoginClient />
      </Suspense>
    </main>
  );
}
