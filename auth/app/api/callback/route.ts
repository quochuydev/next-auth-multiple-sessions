import configuration from "@/configuration";
import { codeVerifier } from "@/lib/bytes";
import { prisma } from "@/lib/prisma";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { URLSearchParams } from "url";
import { v4 as uuid } from "uuid";
import { sessionCookieName, returnUrlCookieName } from "@/lib/constant";

async function handler(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  const requestCookie = cookies();
  const sessionCookie = requestCookie.get(sessionCookieName);
  const returnUrl = requestCookie.get(returnUrlCookieName);

  console.log(`debug:code`, code);
  console.log(`debug:state`, state);
  console.log(`debug:sessionId`, sessionCookie?.value);
  console.log(`debug:returnUrl`, returnUrl);
  console.log(`debug:hostname`, new URL(configuration.appUrl).hostname);
  console.log("--------------");

  const tokenParams = new URLSearchParams();
  tokenParams.append("code", code as string);
  tokenParams.append("grant_type", "authorization_code");
  tokenParams.append("client_id", configuration.portal.clientId);
  tokenParams.append("redirect_uri", configuration.portal.redirectUrl);
  tokenParams.append("code_verifier", codeVerifier);

  try {
    const response = await fetch(
      `${configuration.portal.issuer}/oauth/v2/token`,
      {
        method: "post",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: tokenParams,
      }
    );

    const tokenData = await response.json();
    console.log(`status:`, response.status);
    console.log(`debug:tokenData`, tokenData);
    const { access_token, token_type, refresh_token, expires_in, id_token } =
      tokenData;

    let userId: string | null = null;

    if (id_token) {
      const decodedIdToken = jwt.decode(id_token);
      console.log(`debug:decodedIdToken`, decodedIdToken);
      userId = decodedIdToken ? (decodedIdToken.sub as string) : null;
    } else {
      const userInfo = await fetch(
        `${configuration.portal.issuer}/oidc/v1/userinfo`,
        {
          headers: {
            Authorization: `Bearer ${access_token}`,
          },
        }
      ).then((res) => res.json());
      console.log(`debug:userInfo`, userInfo);
      userId = userInfo.sub;
    }

    const sessionId = sessionCookie ? sessionCookie.value : uuid();

    const session = await prisma.userSession.create({
      data: {
        sessionId,
        accessToken: access_token,
        tokenType: token_type,
        expiresIn: expires_in,
        refreshToken: refresh_token,
        idToken: id_token,
        userId,
      },
    });

    requestCookie.set({
      name: sessionCookieName,
      value: sessionId,
      sameSite: configuration.cookie.sameSite,
      path: configuration.cookie.path,
      httpOnly: configuration.cookie.httpOnly,
      secure: configuration.cookie.secure,
      domain: configuration.cookie.domain,
    });

    return NextResponse.json(
      {
        sessionId,
        session,
        tokenData,
      },
      {
        status: response.status,
      }
    );
  } catch (error) {
    console.error("Error exchanging code for token:", error);

    return NextResponse.json(
      {
        message: "Internal server error",
      },
      {
        status: 500,
      }
    );
  }
}

export { handler as GET, handler as POST };
