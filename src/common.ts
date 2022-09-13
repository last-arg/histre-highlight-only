import { z } from 'zod';

export const local_id_prefix = "local";

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
  Modify 
}

export type DataCreate = { text: string, color: string }
export type DataModify = { id: string, color: string }
export type DataRemove = { id: string }

export interface Message {
  action: Action,
  // Delete: highlight_id (might be local_id)
  // Save: text, title, color, local_id
  data: DataCreate | DataModify | DataRemove,
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

export interface LocalHighlightInfo {
  [url: string] : {
    title: string,
    highlights: LocalHighlightsObject
  }
}

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

export interface UserData {
  username: string,
  password: string,
}

// access is valid for 15 minutes
// refresh is valid for 30 days
export interface AuthData {
  access: string,
  refresh: string,
}

interface HistreResp<T> {
  data?: T,
  // TODO: Not sure if this has defined shape
  details?: any,
  error: boolean,
  errcode?: number, // Can be null. Got it when tried to remove empty id ("")
  errmsg?: string, 
  status?: number, // In some cases can be null
}

export type AuthResp = HistreResp<Required<AuthData>>;
export type AddResp = HistreResp<{highlight_id: string, highlight_link: string}>;
export type ValidToken = { token: AuthData, created_at: number};


