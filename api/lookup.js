곰멍이6519, 코드 상태 아주 좋아! 그대로 배포해도 대부분 잘 돌아갈 거야. 대신 “딱 두 군데”만 더 안정화하면 실운영에서 덜 삐걱거려.

확인 포인트(지금 코드 기준)
POST 전용 처리 OK
서버 보정(norm), 닉네임 공백 정리(clean) OK
UA/타임아웃 OK
완전일치 우선 + 부분일치 보조 OK
카카오 simpleText 포맷 OK
숫자 포맷(formatNumber) 적용 OK
권장 보완 2가지
tbody가 없는 테이블 대비는 이미 했지만, 실제 대상 테이블이 아닌 다른 테이블을 먼저 집는 경우가 있어. 후보 테이블 선택 우선순위를 조금 더 강화하면 안정적이야.
에러 로그에 닉네임/서버를 같이 찍으면 디버깅이 쉬워.
아래는 네 코드에 아주 살짝만 손본 “최종본”이야. 지금 올린 코드와 동작은 같고, 선택자 우선순위와 로그만 강화했어. 통째로 바꾸거나, 네 코드 유지해도 됨!

최종본(원하면 그대로 교체)
import axios from "axios"; import cheerio from "cheerio";

const SERVER_MAP = { deian: ["데이안", "deian", "데이안", "데이안섭"], aira: ["아이라", "aira", "아이라섭"], duncan: ["던컨", "duncan", "던컨섭"], alisa: ["알리사", "alisa", "알리사섭"], maven: ["메이븐", "maven", "메이븐섭"], rasa: ["라사", "rasa", "라사섭"], calix: ["칼릭스", "calix", "칼릭스섭"] };

const norm = (s) => { if (!s) return "alisa"; s = String(s).toLowerCase(); for (const k of Object.keys(SERVER_MAP)) { if (SERVER_MAP[k].map(v => v.toLowerCase()).includes(s)) return k; } return "alisa"; };

const clean = (t) => String(t ?? "").replace(/\s+/g, " ").trim();

const formatNumber = (t) => { const n = Number(String(t).replace(/[^\d.-]/g, "")); if (!isFinite(n)) return clean(t); return n.toLocaleString("ko-KR"); };

const reply = (text) => ({ version: "2.0", template: { outputs: [{ simpleText: { text } }] } });

export default async function handler(req, res) { if (req.method !== "POST") { return res.status(405).json({ error: "POST only" }); }

try { // Body 안전 가드 const params = req.body?.action?.params || {}; const nickname = clean(params.nickname); const server = norm(params.server);


if (!nickname) {
  return res.json(reply("[껌전봇]\n닉네임을 알려줘! 예) 알리사 껌전"));
}

const url = `https://mabimobi.life/ranking?server=${encodeURIComponent(server)}`;
const html = (await axios.get(url, {
  timeout: 10000,
  headers: { "User-Agent": "Mozilla/5.0 (compatible; GumjeonBot/1.0)" }
})).data;

const $ = cheerio.load(html);

// 랭킹 테이블 후보들(우선순위 높은 것부터)
const primary = $('table.ranking, #ranking, .ranking-table').toArray();
const fallback = $('table').toArray();
const candidates = primary.length ? primary : fallback;

let found = null;
let partialCount = 0;

for (const tbl of candidates) {
  // tbody가 없을 수도 있어 tr 전체 조회
  const rows = $(tbl).find("tbody tr").length
    ? $(tbl).find("tbody tr")
    : $(tbl).find("tr");

  if (!rows.length) continue;

  rows.each((_, el) => {
    const tds = $(el).find("td");
    if (tds.length < 5) return;

    const name = clean($(tds[1]).text());
    const combat = clean($(tds[2]).text());
    const charm = clean($(tds[3]).text());
    const life = clean($(tds[4]).text());

    if (name === nickname) {
      found = { name, combat, charm, life, exact: true };
      return false; // 완전일치 즉시 종료
    }
    if (!found && name.includes(nickname)) {
      found = { name, combat, charm, life, exact: false };
      partialCount += 1;
    }
  });

  if (found?.exact) break;
}

if (!found) {
  return res.json(
    reply(`[껌전봇]\n검색 결과가 없었어 ㅠㅠ\n(서버: ${server}, 닉네임: ${nickname})`)
  );
}

const base =
  `[껌전봇]\n` +
  `🏷️ 닉네임: ${found.name}\n` +
  `⚔️ 전투력: ${formatNumber(found.combat)}\n` +
  `✨ 매력: ${formatNumber(found.charm)}\n` +
  `🛠️ 생활력: ${formatNumber(found.life)}`;

const hint = !found.exact && partialCount > 1
  ? `\n(동명이인 여러 명 감지됨! 서버와 닉네임을 더 정확히 적어줘 🙏)`
  : "";

return res.json(reply(base + hint));
} catch (e) { console.error("lookup error:", e?.message, { nicknameTried: req.body?.action?.params?.nickname, serverTried: req.body?.action?.params?.server }); return res.json(reply("[껌전봇]\n조회 중 오류가 났어 ㅠㅠ 잠시 후 다시 시도해줘!")); } }
