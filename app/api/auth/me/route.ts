import { NextResponse } from "next/server";
import { getSessionMember } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSessionMember();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }
  return NextResponse.json({ authType: session.authType, loginId: session.loginId });
}
