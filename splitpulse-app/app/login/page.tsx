import { Suspense } from "react";
import { LoginClient } from "@/components/auth/LoginClient";

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-deep p-6">
      <Suspense fallback={null}>
        <LoginClient />
      </Suspense>
    </main>
  );
}
