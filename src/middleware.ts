import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/api/webhooks/(.*)",
])

const ALLOWED_DOMAIN = "handledcommerce.com"

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return

  const session = await auth()

  if (!session.userId) {
    return session.redirectToSignIn()
  }

  // Server-side domain check: reject users not on @handledcommerce.com
  const claims = session.sessionClaims as { email?: string } | undefined
  const email = claims?.email
  if (email && !email.endsWith(`@${ALLOWED_DOMAIN}`)) {
    const url = new URL("/sign-in", req.url)
    url.searchParams.set("error", "unauthorized_domain")
    // Sign the user out by clearing the session cookie, then redirect
    const res = NextResponse.redirect(url)
    res.cookies.delete("__session")
    return res
  }
})

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}
