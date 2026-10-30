import { NextResponse } from "next/server";
import type { SessionInfo } from "@/lib/auth";
import { getSessionMember } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSessionMember();
  if (!session) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }
  const info: SessionInfo = {
    authType: session.authType,
    loginId: session.loginId,
    language: session.language,
  };
  return NextResponse.json(info);
}
