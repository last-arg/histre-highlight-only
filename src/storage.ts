import { storage } from 'webextension-polyfill';
import { localAuthSchema, localUserSchema, UserData, ValidToken } from "./common";

export async function getLocalAuthData(): Promise<ValidToken | undefined> {
  const data = await storage.local.get(
    {token: {access: undefined, refresh: undefined}, created_at: undefined});
  const token = localAuthSchema.safeParse(data);
  if (token.success) {
    return token.data
  }
  return undefined;
}

export async function setLocalAuthData(auth_data: ValidToken) {
  await storage.local.set(auth_data);
}

export async function getLocalUser(): Promise<UserData | undefined> {
  const data = await storage.local.get({username: undefined, password: undefined});
  const user = localUserSchema.safeParse(data);
  if (user.success) {
    return user.data
  }
  return undefined;
}

export async function setLocalUser(user: UserData): Promise<void> {
  await storage.local.set(user);
}


