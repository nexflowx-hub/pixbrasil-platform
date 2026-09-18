import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      success: true,
      service: "PiXBrasil Web",
      component: "landing",
      status: "ONLINE",
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "local",
      timestamp: new Date().toISOString()
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
