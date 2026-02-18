import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Threads OAuth callback
 * 1. code を受け取る
 * 2. access_token に交換
 * 3. threads_user_id を取得
 * ※ まずは「取得できることの確認」用に JSON で返す
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const code = typeof req.query.code === "string" ? req.query.code : "";

    if (!code) {
      return res.status(400).json({
        error: "missing_code",
        query: req.query,
      });
    }

    // ===== Vercel Environment Variables =====
    const THREADS_APP_ID = process.env.THREADS_APP_ID!;
    const THREADS_APP_SECRET = process.env.THREADS_APP_SECRET!;
    const THREADS_REDIRECT_URI = process.env.THREADS_REDIRECT_URI!;
    // =======================================

    /**
     * 1) code → access_token
     */
    const tokenResp = await fetch(
      "https://graph.threads.net/oauth/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: THREADS_APP_ID,
          client_secret: THREADS_APP_SECRET,
          grant_type: "authorization_code",
          redirect_uri: THREADS_REDIRECT_URI,
          code,
        }),
      }
    );

    const tokenData = await tokenResp.json();

    if (!tokenResp.ok) {
      return res.status(400).json({
        step: "token_exchange_failed",
        tokenData,
      });
    }

    const threadsAccessToken = tokenData.access_token;
    if (!threadsAccessToken) {
      return res.status(400).json({
        step: "no_access_token",
        tokenData,
      });
    }

    /**
     * 2) threads_user_id を取得
     */
    const meResp = await fetch(
      `https://graph.threads.net/v1.0/me?fields=id,username&access_token=${encodeURIComponent(
        threadsAccessToken
      )}`
    );

    const meData = await meResp.json();

    if (!meResp.ok) {
      return res.status(400).json({
        step: "me_failed",
        meData,
      });
    }

    /**
     * ★ 成功時のレスポンス（確認用）
     * 本番では token は返さず DynamoDB 等に保存する
     */
    return res.status(200).json({
      ok: true,
      threads_user: meData, // { id, username }
      threads_access_token: threadsAccessToken,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: "exception",
      message: err?.message ?? String(err),
    });
  }
}
