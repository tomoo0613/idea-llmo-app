const URL_REGEX = /https?:\/\/[^\s<>"'{}|\\^`\[\]()]+/gi;

/**
 * テキストからURLを抽出する
 */
export function extractUrls(text: string): string[] {
  if (!text) return [];
  const matches = text.match(URL_REGEX);
  if (!matches) return [];

  // 重複除去 & 末尾の句読点除去
  const cleaned = matches.map((url) =>
    url.replace(/[.,;:!?）】」』。、]+$/, "")
  );
  return [...new Set(cleaned)];
}

/**
 * URLからドメインを抽出する
 */
export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    // URLパースに失敗した場合、プロトコル部を除去してスラッシュまで取得
    const stripped = url.replace(/^https?:\/\//, "");
    const slashIdx = stripped.indexOf("/");
    return slashIdx >= 0 ? stripped.slice(0, slashIdx) : stripped;
  }
}

/**
 * URLからドメインを除いたパスを含む表示用文字列を返す
 * (例: "prtimes.jp/main/html/rd/p/000000177.000045863.html")
 */
export function urlToDisplayPath(url: string): string {
  return url.replace(/^https?:\/\//, "");
}

/**
 * サービス名がテキスト中に言及されているかチェック
 */
export function checkServiceMention(
  text: string,
  serviceName: string
): boolean {
  if (!text || !serviceName) return false;
  const normalizedText = text.normalize("NFKC").toLowerCase();
  const normalizedService = serviceName.normalize("NFKC").toLowerCase();
  return normalizedText.includes(normalizedService);
}

/**
 * ドメインがURLリストに含まれているかチェック
 */
export function checkDomainCited(
  urls: string[],
  targetDomain: string
): boolean {
  if (!targetDomain) return false;
  const normalized = targetDomain.toLowerCase().replace(/^www\./, "");
  return urls.some((url) => {
    const domain = extractDomain(url).toLowerCase().replace(/^www\./, "");
    return domain === normalized || domain.endsWith("." + normalized);
  });
}
