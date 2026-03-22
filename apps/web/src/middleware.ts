import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { user, supabaseResponse, supabase } = await updateSession(request);

  // (auth) routes: redirect to login if unauthenticated
  if (pathname.startsWith("/dashboard")) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  // (admin) routes: require auth + is_admin
  if (pathname.startsWith("/admin")) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!profile || !(profile as { is_admin: boolean }).is_admin) {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  // Geo extraction — lightweight, non-blocking
  // Reads CDN/proxy geo headers and forwards as x-quesera-* headers
  const country =
    request.headers.get("cf-ipcountry") ??
    request.headers.get("x-vercel-ip-country") ??
    null;
  const region =
    request.headers.get("cf-region") ??
    request.headers.get("x-vercel-ip-country-region") ??
    null;

  if (country && country !== "XX" && country !== "T1") {
    supabaseResponse.headers.set("x-quesera-country", country.toUpperCase());
    if (region) {
      supabaseResponse.headers.set("x-quesera-region", region);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
