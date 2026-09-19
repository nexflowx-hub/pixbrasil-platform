import { NextResponse } from "next/server";
import { clearClientSession } from "@/lib/client-session";

export async function POST() {
  await clearClientSession();
  return NextResponse.json({ success: true });
}
