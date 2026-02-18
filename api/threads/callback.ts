import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Threads OAuth callback（確認用・安全版）
 *
 * 目的：
 * - code を access_token に交換
 * - threads_user_id を取得
 * - 画面には threads_user_id のみ表示（access_token は表示しない）
 *
 * ※ 保存処理（DynamoDB等）はしない
 * ※ 本番では access_token を画面に出さない（この版はOK）
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const code = typeof req.query.code === "string" ? req.query.code : "";

    if (!code) {
      return res.status(400).json({
        ok: false,
        error: "missing_code",
      });
    }

    // ===== Vercel Environment Variables =====
    const THREADS_APP_ID = process.env.THREADS_APP_ID!;
    const THREADS_APP_SECRET = process.env.THREADS_APP_SECRET!;
    const THREADS_REDIRECT_URI = process.env.THREADS_REDIRECT_URI!;
    // =======================================

    // 1) code → access_token
    const tokenResp = await fetch("https://graph.threads.net/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: THREADS_APP_ID,
        client_secret: THREADS_APP_SECRET,
        grant_type: "authorization_code",
        redirect_uri: THREADS_REDIRECT_URI,
        code,
      }),
    });

    const tokenData = await tokenResp.json();

    if (!tokenResp.ok || !tokenData.access_token) {
      // tokenData はデバッグに便利ですが、念のため最小限だけ返す
      console.error("Token exchange failed:", {
        status: tokenResp.status,
        error: tokenData?.error,
      });
      return res.status(400).json({
        ok: false,
        step: "token_exchange_failed",
        error: tokenData?.error ?? tokenData,
      });
    }

    const threadsAccessToken: string = tokenData.access_token;

    // 2) threads_user_id 取得
    const meResp = await fetch(
      `https://graph.threads.net/v1.0/me?fields=id,username&access_token=${encodeURIComponent(
        threadsAccessToken
      )}`
    );

    const meData = await meResp.json();

    if (!meResp.ok || !meData?.id) {
      console.error("Me fetch failed:", {
        status: meResp.status,
        meData,
      });
      return res.status(400).json({
        ok: false,
        step: "me_failed",
        error: meData,
      });
    }

    // ✅ 画面に返すのは ID/username のみ（tokenは返さない）
    return res.status(200).json({
      ok: true,
      threads_user: {
        id: meData.id,
        username: meData.username,
      },
      note: "access_token is NOT returned. Save it manually if needed.",
    });
  } catch (err: any) {
    console.error("Callback exception:", err);
    return res.status(500).json({
      ok: false,
      error: "internal_error",
    });
  }
}
