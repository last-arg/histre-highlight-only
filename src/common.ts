import { z } from 'zod';

export const local_id_prefix = "local";

export enum Color { yellow, orange, green, blue, purple, red };

export const histreResponseSchema = z.object({
  data: z.unknown().nullable(),
  details: z.unknown().nullable(),
  error: z.boolean(),
  errcode: z.number().nullable(),
  errmsg: z.string().nullable(),
  status: z.number().nullable(),
})
export type HistreResponse = z.infer<typeof histreResponseSchema>;

export enum Action { 
  Create, 
  Remove,
  Modify,
  UpdateUser,
}

export type DataCreate = { text: string, color: string, id: string }
export type DataModify = { id: string, color: string }
export type DataRemove = { id: string }

export interface Message {
  action: Action,
  // Delete: highlight_id (might be local_id)
  // Save: text, title, color, local_id
  data: DataCreate | DataModify | DataRemove | UserData,
}

export type HighlightId = string;

export type HighlightLocation = {
  start: number,
  end: number,
  index: number,
}

export interface LocalHighlight {
  text: string,
  color?: string,
}

export interface LocalHighlightsObject { [id: HighlightId]: LocalHighlight, }

export interface HighlightAdd {
  url: string,
  title: string,
  text: string,
  color?: string
  // tweet (Boolean): optional
  // extra (Object): optional
}

export interface HighlightUpdate {
  highlight_id: string,
  color: string
}

// access is valid for 15 minutes
// refresh is valid for 30 days
export const histreAuthSchema = z.object({
  access: z.string(),
  refresh: z.string(),
})
export type AuthData = z.infer<typeof histreAuthSchema>

export const localUserSchema = z.object({
  username: z.string(),
  password: z.string(),
})
export type UserData = z.infer<typeof localUserSchema>;

export const localAuthSchema = z.object({
  created_at: z.number(),
  token: z.object({
    access: z.string(),
    refresh: z.string(),
  }),
})
export type ValidToken = z.infer<typeof localAuthSchema>;

export type Position = "top" | "bottom";

