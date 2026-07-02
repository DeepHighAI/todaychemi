import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { ConfigError } from '@/lib/config-error';

import {
  awardDeviceCampaignTalisman,
  awardUserCampaignTalisman,
  type AwardDeviceCampaignArgs,
  type AwardUserCampaignArgs,
  type AwardResult,
  type RpcClient,
} from './award-device-campaign-talisman';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 8787;
const DEVICE_ID_MAX_LENGTH = 512;
const CAMPAIGN_KEY_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const USER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface OpsWebServerOptions {
  token: string;
  port: number;
  rpcClient?: RpcClient;
}

interface GrantRequestBody {
  targetType?: unknown;
  campaignKey?: unknown;
  deviceId?: unknown;
  userId?: unknown;
  amount?: unknown;
  dryRun?: unknown;
}

interface GrantResponse {
  ok: boolean;
  result?: AwardResult;
  message?: string;
  nextStep?: string | null;
  error?: string;
}

const RESULT_COPY: Record<string, { message: string; nextStep?: string }> = {
  AWARDED: {
    message: '지급이 완료되었습니다.',
  },
  ALREADY_AWARDED: {
    message: '이미 같은 캠페인에서 지급된 사용자 또는 기기입니다.',
  },
  USER_NOT_FOUND: {
    message: '해당 userId의 오늘케미 사용자를 찾지 못했습니다.',
    nextStep: '사용자가 내 프로필을 완료했는지, 운영 지원 ID를 정확히 복사했는지 확인하세요.',
  },
  DEVICE_NOT_REGISTERED: {
    message: '이 deviceId로 연결된 사용자를 찾지 못했습니다.',
    nextStep: '사용자가 최신 미니앱을 1회 연 뒤 다시 지급하세요.',
  },
  AMBIGUOUS_DEVICE: {
    message: '같은 deviceId 해시가 여러 사용자와 연결되어 자동 지급을 보류했습니다.',
    nextStep: '수동 확인 후 별도 지급 여부를 결정하세요.',
  },
  PROFILE_REQUIRED: {
    message: '오늘케미 프로필이 없어 지갑 지급 대상이 아닙니다.',
    nextStep: '사용자 온보딩 완료 여부를 먼저 확인하세요.',
  },
  INVALID_INPUT: {
    message: '캠페인 키, 대상 ID, 지급량 중 하나가 정책에 맞지 않습니다.',
  },
  DRY_RUN: {
    message: '드라이런이 완료되었습니다. Supabase 지급 RPC는 호출하지 않았습니다.',
  },
};

const ERROR_COPY: Record<string, { status: number; message: string; nextStep?: string }> = {
  CONFIG_MISSING_DEVICE_HASH_SECRET: {
    status: 500,
    message: '로컬 해시 secret이 없어 deviceId를 검증할 수 없습니다.',
    nextStep: '.env.local에 TOSS_DEVICE_ID_HASH_SECRET 또는 TOSS_USER_PASSWORD_SECRET을 설정한 뒤 운영툴을 다시 실행하세요.',
  },
  CONFIG_MISSING_SUPABASE_URL: {
    status: 500,
    message: 'NEXT_PUBLIC_SUPABASE_URL이 설정되어 있지 않습니다.',
    nextStep: '.env.local 또는 현재 셸 환경변수에 NEXT_PUBLIC_SUPABASE_URL을 설정한 뒤 다시 실행하세요.',
  },
  CONFIG_MISSING_SUPABASE_SERVICE_ROLE_KEY: {
    status: 500,
    message: 'SUPABASE_SERVICE_ROLE_KEY가 설정되어 있지 않습니다.',
    nextStep: '.env.local 또는 현재 셸 환경변수에 SUPABASE_SERVICE_ROLE_KEY를 설정한 뒤 다시 실행하세요.',
  },
  SUPABASE_RPC_ERROR: {
    status: 502,
    message: 'Supabase 지급 RPC 호출이 실패했습니다.',
    nextStep: '네트워크, Supabase 상태, 마이그레이션 적용 여부를 확인하세요.',
  },
  INTERNAL_ERROR: {
    status: 500,
    message: '요청 처리 중 알 수 없는 오류가 발생했습니다.',
  },
};

export function loadEnvLocal(envFile = resolve(process.cwd(), '.env.local')): void {
  if (!existsSync(envFile)) return;

  for (const rawLine of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const eqIndex = line.indexOf('=');
    if (eqIndex < 1) continue;

    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) process.env[key] = value;
  }
}

export function createGrantDeviceTalismanWebServer(options: OpsWebServerOptions): Server {
  return createServer(async (request, response) => {
    try {
      if (!isLocalRequestAllowed(request, options)) {
        sendJson(response, 403, { ok: false, error: 'FORBIDDEN' });
        return;
      }

      const url = buildRequestUrl(request, options.port);
      if (request.method === 'GET' && url.pathname === '/') {
        sendHtml(response, renderPage(options.token));
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/grant') {
        const payload = await readJsonBody(request);
        const args = parseGrantRequest(payload);
        const result = 'userId' in args
          ? await awardUserCampaignTalisman(args, options.rpcClient)
          : await awardDeviceCampaignTalisman(args, options.rpcClient);
        const copy = describeAwardResult(result.reason);
        sendJson(response, 200, {
          ok: true,
          result,
          message: copy.message,
          nextStep: copy.nextStep ?? null,
        } satisfies GrantResponse);
        return;
      }

      sendJson(response, 404, { ok: false, error: 'NOT_FOUND' });
    } catch (error) {
      const mapped = mapGrantError(error);
      sendJson(response, mapped.status, {
        ok: false,
        error: mapped.code,
        message: mapped.message,
        nextStep: mapped.nextStep ?? null,
      });
    }
  });
}

export function isLocalRequestAllowed(request: IncomingMessage, options: OpsWebServerOptions): boolean {
  const remoteAddress = request.socket.remoteAddress;
  if (!isLocalRemoteAddress(remoteAddress)) return false;

  const host = request.headers.host;
  if (!isAllowedHost(host, options.port)) return false;

  const origin = request.headers.origin;
  const expectedOrigin = `http://${host}`;
  if (request.method === 'POST' && origin !== expectedOrigin) return false;
  if (origin && origin !== expectedOrigin) return false;

  const url = buildRequestUrl(request, options.port);
  const tokenFromHeader = getHeaderValue(request, 'x-ops-token');
  const tokenFromQuery = url.searchParams.get('token');
  return tokenFromHeader === options.token || tokenFromQuery === options.token;
}

export function describeAwardResult(reason: unknown): { message: string; nextStep?: string } {
  if (typeof reason === 'string' && RESULT_COPY[reason]) return RESULT_COPY[reason];
  return { message: '알 수 없는 지급 결과입니다.' };
}

export function mapGrantError(error: unknown): {
  status: number;
  code: string;
  message: string;
  nextStep?: string;
} {
  if (error instanceof GrantRequestError) {
    return {
      status: error.status,
      code: error.code,
      message: requestErrorMessage(error.code),
    };
  }

  const message = error instanceof Error ? error.message : '';
  if (message === 'TOSS_DEVICE_ID_HASH_SECRET is not configured') {
    return { code: 'CONFIG_MISSING_DEVICE_HASH_SECRET', ...ERROR_COPY.CONFIG_MISSING_DEVICE_HASH_SECRET };
  }
  if (message === 'INVALID_DEVICE_ID') {
    return { status: 400, code: 'INVALID_DEVICE_ID', message: requestErrorMessage('INVALID_DEVICE_ID') };
  }
  if (error instanceof ConfigError && message.includes('NEXT_PUBLIC_SUPABASE_URL')) {
    return { code: 'CONFIG_MISSING_SUPABASE_URL', ...ERROR_COPY.CONFIG_MISSING_SUPABASE_URL };
  }
  if (error instanceof ConfigError && message.includes('SUPABASE_SERVICE_ROLE_KEY')) {
    return {
      code: 'CONFIG_MISSING_SUPABASE_SERVICE_ROLE_KEY',
      ...ERROR_COPY.CONFIG_MISSING_SUPABASE_SERVICE_ROLE_KEY,
    };
  }
  if (message.startsWith('award_device_campaign_talisman failed:')) {
    return { code: 'SUPABASE_RPC_ERROR', ...ERROR_COPY.SUPABASE_RPC_ERROR };
  }
  if (message.startsWith('award_user_campaign_talisman failed:')) {
    return { code: 'SUPABASE_RPC_ERROR', ...ERROR_COPY.SUPABASE_RPC_ERROR };
  }

  return { code: 'INTERNAL_ERROR', ...ERROR_COPY.INTERNAL_ERROR };
}

function requestErrorMessage(code: string): string {
  switch (code) {
    case 'INVALID_CAMPAIGN':
      return '캠페인 키 형식이 올바르지 않습니다.';
    case 'INVALID_DEVICE_ID':
      return 'deviceId가 비어 있거나 너무 깁니다.';
    case 'INVALID_USER_ID':
      return 'userId 형식이 올바르지 않습니다.';
    case 'INVALID_AMOUNT':
      return '지급 부적 수는 1 이상의 정수여야 합니다.';
    case 'INVALID_JSON':
      return '요청 본문 형식이 올바르지 않습니다.';
    default:
      return '요청 값이 올바르지 않습니다.';
  }
}

function parseGrantRequest(body: GrantRequestBody): AwardDeviceCampaignArgs | AwardUserCampaignArgs {
  const targetType = body.targetType === 'user' || body.targetType === 'device'
    ? body.targetType
    : typeof body.userId === 'string'
      ? 'user'
      : 'device';
  const campaignKey = typeof body.campaignKey === 'string' ? body.campaignKey.trim() : '';
  const deviceId = typeof body.deviceId === 'string' ? body.deviceId.trim() : '';
  const userId = typeof body.userId === 'string' ? body.userId.trim().toLowerCase() : '';
  const amount = typeof body.amount === 'number' ? body.amount : Number(body.amount);
  const dryRun = body.dryRun === true;

  if (!CAMPAIGN_KEY_PATTERN.test(campaignKey)) {
    throw new GrantRequestError(400, 'INVALID_CAMPAIGN');
  }
  if (targetType === 'user') {
    if (!USER_ID_PATTERN.test(userId)) {
      throw new GrantRequestError(400, 'INVALID_USER_ID');
    }
  } else {
    if (!deviceId || deviceId.length > DEVICE_ID_MAX_LENGTH) {
      throw new GrantRequestError(400, 'INVALID_DEVICE_ID');
    }
  }
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new GrantRequestError(400, 'INVALID_AMOUNT');
  }

  if (targetType === 'user') {
    return { campaignKey, userId, amount, dryRun };
  }

  return { campaignKey, deviceId, amount, dryRun };
}

async function readJsonBody(request: IncomingMessage): Promise<GrantRequestBody> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  try {
    const body = Buffer.concat(chunks).toString('utf8');
    return JSON.parse(body) as GrantRequestBody;
  } catch {
    throw new GrantRequestError(400, 'INVALID_JSON');
  }
}

function renderPage(token: string): string {
  const escapedToken = escapeHtml(token);
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>오늘케미 로컬 부적 지급툴</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f6f7f9;
      --surface: #ffffff;
      --surface-subtle: #f0f3f7;
      --text: #14171f;
      --muted: #646b78;
      --border: #d9dee8;
      --accent: #1164ff;
      --accent-strong: #0647c9;
      --danger: #b42318;
      --success: #067647;
      --warning: #9a6700;
      --radius: 8px;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      min-height: 100vh;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      letter-spacing: 0;
    }

    main {
      width: min(960px, calc(100vw - 32px));
      margin: 0 auto;
      padding: 32px 0;
    }

    header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 20px;
      margin-bottom: 20px;
    }

    h1 {
      margin: 0 0 8px;
      font-size: 28px;
      line-height: 1.2;
    }

    p {
      margin: 0;
      color: var(--muted);
      line-height: 1.55;
    }

    .shell {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 340px;
      gap: 16px;
      align-items: start;
    }

    .panel {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 20px;
      box-shadow: 0 10px 24px rgba(20, 23, 31, 0.06);
    }

    label {
      display: block;
      margin-bottom: 8px;
      font-size: 13px;
      font-weight: 700;
      color: #2f3542;
    }

    fieldset {
      margin: 0 0 16px;
      padding: 0;
      border: 0;
    }

    legend {
      margin-bottom: 8px;
      font-size: 13px;
      font-weight: 700;
      color: #2f3542;
    }

    .mode-row {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin: 0 12px 0 0;
      min-height: 32px;
      font-weight: 600;
    }

    .mode-row input {
      width: 16px;
      height: 16px;
    }

    input[type="text"],
    input[type="password"],
    input[type="number"] {
      width: 100%;
      min-height: 44px;
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 10px 12px;
      background: #fff;
      color: var(--text);
      font: inherit;
      outline: none;
    }

    input:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(17, 100, 255, 0.14);
    }

    .field { margin-bottom: 16px; }

    .help {
      margin-top: 6px;
      font-size: 12px;
      color: var(--muted);
    }

    .row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin: 14px 0 18px;
    }

    .row input {
      width: 18px;
      height: 18px;
    }

    button {
      min-height: 44px;
      border: 0;
      border-radius: 6px;
      padding: 0 16px;
      background: var(--accent);
      color: #fff;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
    }

    button:hover { background: var(--accent-strong); }
    button:disabled { opacity: 0.55; cursor: not-allowed; }

    .button-row {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .secondary {
      background: var(--surface-subtle);
      color: var(--text);
      border: 1px solid var(--border);
    }

    .secondary:hover { background: #e6ebf2; }

    .confirm {
      display: none;
      margin-top: 16px;
      border: 1px solid #f0c36d;
      background: #fff8e6;
      border-radius: 8px;
      padding: 14px;
    }

    .confirm strong {
      display: block;
      margin-bottom: 8px;
    }

    .status {
      min-height: 180px;
      border-radius: 8px;
      background: var(--surface-subtle);
      padding: 16px;
      white-space: pre-wrap;
      line-height: 1.55;
      font-size: 14px;
    }

    .status.success { color: var(--success); background: #ecfdf3; }
    .status.warning { color: var(--warning); background: #fffaeb; }
    .status.error { color: var(--danger); background: #fef3f2; }

    .local {
      display: inline-flex;
      align-items: center;
      min-height: 28px;
      border-radius: 999px;
      padding: 0 10px;
      background: #eaf1ff;
      color: #0b4ab8;
      font-size: 12px;
      font-weight: 700;
      white-space: nowrap;
    }

    @media (max-width: 760px) {
      main { width: min(100vw - 24px, 960px); padding: 20px 0; }
      header { display: block; }
      .local { margin-top: 12px; }
      .shell { grid-template-columns: 1fr; }
      h1 { font-size: 24px; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>오늘케미 로컬 부적 지급</h1>
        <p>운영 지원 ID(userId)를 기본으로 단건 지급합니다. deviceId 지급은 해시 secret이 있을 때만 보조로 사용하세요.</p>
      </div>
      <span class="local">127.0.0.1 전용</span>
    </header>

    <div class="shell">
      <section class="panel" aria-labelledby="grant-title">
        <h2 id="grant-title">지급 입력</h2>
        <form id="grant-form">
          <fieldset class="field">
            <legend>지급 대상</legend>
            <label class="mode-row">
              <input type="radio" name="targetType" value="user" checked>
              <span>운영 지원 ID(userId)</span>
            </label>
            <label class="mode-row">
              <input type="radio" name="targetType" value="device">
              <span>토스 deviceId</span>
            </label>
          </fieldset>

          <div class="field">
            <label for="campaignKey">캠페인 키</label>
            <input id="campaignKey" name="campaignKey" type="text" required pattern="[a-z0-9][a-z0-9_-]{0,63}" value="launch_bonus_202607" autocomplete="off">
            <div class="help">소문자, 숫자, 밑줄, 하이픈만 사용합니다.</div>
          </div>

          <div id="userIdField" class="field">
            <label for="userId">운영 지원 ID(userId)</label>
            <input id="userId" name="userId" type="text" autocomplete="off" placeholder="00000000-0000-0000-0000-000000000000">
            <div class="help">미니앱 내 프로필에서 사용자가 복사한 ID를 붙여넣습니다.</div>
          </div>

          <div id="deviceIdField" class="field" hidden>
            <label for="deviceId">토스 deviceId</label>
            <input id="deviceId" name="deviceId" type="password" maxlength="512" autocomplete="off">
            <div class="help">서버와 DB에는 HMAC 해시만 전달됩니다.</div>
          </div>

          <div class="field">
            <label for="amount">지급 부적 수</label>
            <input id="amount" name="amount" type="number" required min="1" step="1" value="10" inputmode="numeric">
          </div>

          <label class="row">
            <input id="dryRun" name="dryRun" type="checkbox" checked>
            <span>드라이런으로 먼저 확인</span>
          </label>

          <button id="prepare" type="submit">지급 확인</button>
        </form>

        <div id="confirm" class="confirm" role="status" aria-live="polite">
          <strong>실행 전 확인</strong>
          <p id="confirm-copy"></p>
          <div class="button-row" style="margin-top: 12px;">
            <button id="execute" type="button">실행</button>
            <button id="cancel" class="secondary" type="button">취소</button>
          </div>
        </div>
      </section>

      <aside class="panel" aria-labelledby="result-title">
        <h2 id="result-title">결과</h2>
        <div id="status" class="status">아직 실행한 지급이 없습니다.</div>
      </aside>
    </div>
  </main>

  <script>
    const OPS_TOKEN = "${escapedToken}";
    const form = document.querySelector("#grant-form");
    const confirmBox = document.querySelector("#confirm");
    const confirmCopy = document.querySelector("#confirm-copy");
    const executeButton = document.querySelector("#execute");
    const cancelButton = document.querySelector("#cancel");
    const statusBox = document.querySelector("#status");
    const userIdField = document.querySelector("#userIdField");
    const deviceIdField = document.querySelector("#deviceIdField");
    const userIdInput = document.querySelector("#userId");
    const deviceIdInput = document.querySelector("#deviceId");
    let pending = null;

    function readTargetType() {
      return document.querySelector("input[name=targetType]:checked").value;
    }

    function syncTargetFields() {
      const targetType = readTargetType();
      const userMode = targetType === "user";
      userIdField.hidden = !userMode;
      deviceIdField.hidden = userMode;
      userIdInput.required = userMode;
      deviceIdInput.required = !userMode;
    }

    function readPayload() {
      const targetType = readTargetType();
      return {
        targetType,
        campaignKey: document.querySelector("#campaignKey").value.trim(),
        userId: userIdInput.value.trim(),
        deviceId: deviceIdInput.value.trim(),
        amount: Number(document.querySelector("#amount").value),
        dryRun: document.querySelector("#dryRun").checked
      };
    }

    function showStatus(text, tone) {
      statusBox.textContent = text;
      statusBox.className = "status" + (tone ? " " + tone : "");
    }

    function toneFor(reason, ok) {
      if (!ok) return "error";
      if (reason === "AWARDED" || reason === "DRY_RUN") return "success";
      return "warning";
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      pending = readPayload();
      const targetLabel = pending.targetType === "user" ? "운영 지원 ID 기준으로" : "deviceId 기준으로";
      confirmCopy.textContent = "캠페인 " + pending.campaignKey + "에 부적 " + pending.amount + "개를 " + targetLabel + " " + (pending.dryRun ? "드라이런으로 확인합니다." : "실제로 지급합니다.");
      confirmBox.style.display = "block";
    });

    cancelButton.addEventListener("click", () => {
      pending = null;
      confirmBox.style.display = "none";
    });

    executeButton.addEventListener("click", async () => {
      if (!pending) return;
      executeButton.disabled = true;
      showStatus("처리 중입니다...", "");

      try {
        const response = await fetch("/api/grant?token=" + encodeURIComponent(OPS_TOKEN), {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-ops-token": OPS_TOKEN
          },
          body: JSON.stringify(pending)
        });
        const data = await response.json();
        const result = data.result || {};
        const lines = [
          "결과: " + (result.reason || data.error || "UNKNOWN"),
          "메시지: " + (data.message || "요청을 처리하지 못했습니다."),
          "지급 여부: " + Boolean(result.awarded),
          "지급 수량: " + (typeof result.amount_awarded === "number" ? result.amount_awarded : 0)
        ];
        if (typeof result.balance_after === "number") lines.push("지급 후 잔액: " + result.balance_after);
        if (result.ledger_id) lines.push("ledger_id: " + result.ledger_id);
        if (data.nextStep) lines.push("다음 단계: " + data.nextStep);
        showStatus(lines.join("\\n"), toneFor(result.reason, data.ok));
      } catch {
        showStatus("요청 처리 중 오류가 발생했습니다.", "error");
      } finally {
        userIdInput.value = "";
        deviceIdInput.value = "";
        pending = null;
        confirmBox.style.display = "none";
        executeButton.disabled = false;
      }
    });

    for (const radio of document.querySelectorAll("input[name=targetType]")) {
      radio.addEventListener("change", syncTargetFields);
    }
    syncTargetFields();
  </script>
</body>
</html>`;
}

function sendHtml(response: ServerResponse, html: string): void {
  response.writeHead(200, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(html);
}

function sendJson(response: ServerResponse, status: number, body: GrantResponse | { ok: false; error: string }): void {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(JSON.stringify(body));
}

function buildRequestUrl(request: IncomingMessage, port: number): URL {
  return new URL(request.url ?? '/', `http://${DEFAULT_HOST}:${port}`);
}

function getHeaderValue(request: IncomingMessage, name: string): string | undefined {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function isLocalRemoteAddress(address: string | undefined): boolean {
  return address === DEFAULT_HOST || address === '::1' || address === `::ffff:${DEFAULT_HOST}`;
}

function isAllowedHost(host: string | undefined, port: number): host is string {
  if (!host) return false;
  if (port === 0) return /^127\.0\.0\.1:\d+$/.test(host);
  return host === `${DEFAULT_HOST}:${port}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function readPort(argv: string[]): number {
  const withEquals = argv.find((arg) => arg.startsWith('--port='));
  const value = withEquals ? withEquals.slice('--port='.length) : argv[argv.indexOf('--port') + 1];
  if (!value || argv.indexOf('--port') < 0 && !withEquals) return DEFAULT_PORT;

  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Invalid --port. Use a TCP port between 1 and 65535.');
  }
  return port;
}

class GrantRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

async function main(): Promise<void> {
  loadEnvLocal();
  const port = readPort(process.argv.slice(2));
  const token = randomBytes(24).toString('base64url');
  const server = createGrantDeviceTalismanWebServer({ token, port });

  server.listen(port, DEFAULT_HOST, () => {
    console.log('오늘케미 로컬 부적 지급툴이 실행 중입니다.');
    console.log(`URL: http://${DEFAULT_HOST}:${port}/?token=${token}`);
    console.log('종료: Ctrl+C');
  });

  server.on('error', (error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
