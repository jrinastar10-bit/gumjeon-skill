import axios from "axios"; import cheerio from "cheerio";

const SERVER_MAP = { deian: ["데이안", "deian", "데이안", "데이안섭"], aira: ["아이라", "aira", "아이라섭"], duncan: ["던컨", "duncan", "던컨섭"], alisa: ["알리사", "alisa", "알리사섭"], maven: ["메이븐", "maven", "메이븐섭"], rasa: ["라사", "rasa", "라사섭"], calix: ["칼릭스", "calix", "칼릭스섭"] };

const norm = (s) => { if (!s) return "alisa"; s = String(s).toLowerCase(); for (const k of Object.keys(SERVER_MAP)) { if (SERVER_MAP[k].map(v => v.toLowerCase()).includes(s)) return k; } return "alisa"; };

const clean = (t) => String(t ?? "").replace(/\s+/g, " ").trim();

const formatNumber = (t) => { const n = Number(String(t).replace(/[^\d.-]/g, "")); if (!isFinite(n)) return clean(t); return n.toLocaleString("ko-KR"); };

const reply = (text) => ({ version: "2.0", template: { outputs: [{ simpleText: { text } }] } });

export default async function handler(req, res) { if (req.method !== "POST") { return res.status(405).json({ error: "POST only" }); }

try { const params = req.body?.action?.params || {}; const nickname = clean(params.nickname); const server = norm(params.server);


if (!nickname) {
  return res.json(reply("[껌전봇]\n닉네임을 알려줘! 예) 알리사 껌전"));
}

const url = `https://mabimobi.life/ranking?server=${encodeURIComponent(server)}`;
const html = (await axios.get(url, {
  timeout: 20000,
  headers: { "User-Agent": "Mozilla/5.0 (compatible; GumjeonBot/1.0)" }
})).data;

const $ = cheerio.load(html);

const primary = $('table.ranking, #ranking, .ranking-table').toArray();
const fallback = $('table').toArray();
const candidates = primary.length ? primary : fallback;

let found = null;
let partialCount = 0;

const idxFromHeader = (tbl) => {
  const headers = [];
  const headRows = $(tbl).find("thead tr").length
    ? $(tbl).find("thead tr")
    : $(tbl).find("tr").first();

  $(headRows).find("th, td").each((i, th) => {
    headers[i] = $(th).text().replace(/\s+/g, " ").trim();
  });

  let iName = 1, iCombat = 2, iCharm = 3, iLife = 4;
  headers.forEach((t, i) => {
    const k = t.toLowerCase();
    if (k.includes("닉네임") || k.includes("이름")) iName = i;
    if (k.includes("전투")) iCombat = i;
    if (k.includes("매력")) iCharm = i;
    if (k.includes("생활")) iLife = i;
  });

  return { iName, iCombat, iCharm, iLife };
};

for (const tbl of candidates) {
  const hasHeader = $(tbl).find("tr").first().find("th").length > 0;
  const rows = $(tbl).find("tbody tr").length
    ? $(tbl).find("tbody tr")
    : (hasHeader ? $(tbl).find("tr").slice(1) : $(tbl).find("tr"));

  if (!rows.length) continue;

  const { iName, iCombat, iCharm, iLife } = idxFromHeader(tbl);

  rows.each((_, el) => {
    const tds = $(el).find("td");
    if (tds.length < Math.max(iName, iCombat, iCharm, iLife) + 1) return;

    const name = clean($(tds[iName]).text());
    const combat = clean($(tds[iCombat]).text());
    const charm = clean($(tds[iCharm]).text());
    const life = clean($(tds[iLife]).text());

    if (!name) return;

    if (name === nickname) {
      found = { name, combat, charm, life, exact: true };
      return false;
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
} catch (e) { console.error("lookup error:", e?.message, e?.stack, { method: req.method, bodyHasAction: !!req.body?.action, nicknameTried: req.body?.action?.params?.nickname, serverTried: req.body?.action?.params?.server }); return res.json( reply("[껌전봇]\n조회 중 오류가 났어 ㅠㅠ 잠시 후 다시 시도해줘!") ); } }
