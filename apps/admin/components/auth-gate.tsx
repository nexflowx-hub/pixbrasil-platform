"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    async function verify() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) return;
      if (!session) {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }

      const { data, error } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

      if (!active) return;
      if (error || data.currentLevel !== "aal2") {
        router.replace("/mfa");
        return;
      }

      setReady(true);
    }

    void verify();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") router.replace("/login");
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [pathname, router]);

  if (!ready) {
    return (
      <main className="auth-loading">
        <div className="loading-mark">
          <ShieldCheck size={22} />
        </div>
        <p>Validando sessão AAL2…</p>
      </main>
    );
  }

  return children;
}
