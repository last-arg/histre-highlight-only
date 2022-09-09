export const local_id_prefix = "local";

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

