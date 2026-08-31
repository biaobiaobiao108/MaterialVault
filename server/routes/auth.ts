import { json, error } from '../utils';
import {
  isAuthRequired,
  isPasswordSet,
  verifyPassword,
  setPassword,
  createSession,
  validateToken,
  revokeSession,
  getApiToken,
  generateApiToken,
} from '../services/auth';

export function handleAuthStatus(req: Request): Response {
  const authHeader = req.headers.get('authorization') || req.headers.get('x-api-token');
  const requireAuth = isAuthRequired();
  const isSetup = isPasswordSet();
  const authenticated = validateToken(authHeader);

  return json({
    requireAuth,
    isSetup,
    authenticated,
  });
}

export async function handleAuthSetup(req: Request): Promise<Response> {
  // Only allow if password is not set yet
  if (isPasswordSet()) {
    return error('系统密码已经初始化，请直接登录', 400);
  }

  const body: any = await req.json().catch(() => ({}));
  const password = String(body.password || '').trim();
  if (!password || password.length < 4) {
    return error('密码长度不能少于 4 个字符', 400);
  }

  await setPassword(password);
  const session = createSession();
  const apiToken = getApiToken();

  return json(
    {
      message: '密码初始化成功',
      token: session.token,
      expiresAt: session.expiresAt,
      apiToken,
    },
    201
  );
}

export async function handleAuthLogin(req: Request): Promise<Response> {
  const body: any = await req.json().catch(() => ({}));
  const password = String(body.password || '').trim();

  if (!password) {
    return error('请输入密码', 400);
  }

  const valid = await verifyPassword(password);
  if (!valid) {
    return error('密码错误，请重试', 401);
  }

  const session = createSession();
  return json({
    token: session.token,
    expiresAt: session.expiresAt,
  });
}

export function handleAuthLogout(req: Request): Response {
  const authHeader = req.headers.get('authorization') || req.headers.get('x-api-token');
  if (authHeader) {
    revokeSession(authHeader);
  }
  return json({ success: true });
}

export async function handleChangePassword(req: Request): Promise<Response> {
  const body: any = await req.json().catch(() => ({}));
  const oldPassword = String(body.oldPassword || '').trim();
  const newPassword = String(body.newPassword || '').trim();

  if (!newPassword || newPassword.length < 4) {
    return error('新密码长度不能少于 4 个字符', 400);
  }

  if (isPasswordSet()) {
    const valid = await verifyPassword(oldPassword);
    if (!valid) {
      return error('原密码错误', 401);
    }
  }

  await setPassword(newPassword);
  return json({ message: '密码已成功修改' });
}

export function handleGetApiToken(): Response {
  const token = getApiToken();
  return json({ apiToken: token });
}

export function handleResetApiToken(): Response {
  const token = generateApiToken();
  return json({ apiToken: token, message: 'API Token 已重置' });
}
