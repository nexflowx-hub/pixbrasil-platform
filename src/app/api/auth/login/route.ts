import { NextResponse } from "next/server";
import { createClientSession } from "@/lib/client-session";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  if (!email || !password) {
    return NextResponse.json(
      { success: false, message: "Email e senha são obrigatórios." },
      { status: 400 },
    );
  }

  const result = await createClientSession(email, password);
  if (!result.ok) {
    return NextResponse.json(
      { success: false, message: result.message },
      { status: result.status === 400 ? 401 : result.status },
    );
  }

  return NextResponse.json({ success: true });
}
