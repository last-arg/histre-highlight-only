export enum Action { 
  Save, 
  Remove,
  Update 
}

export interface Message {
  action: Action,
  // Delete: highlight_id (might be local_id)
  // Save: text, title, color, local_id
  data: any,
}

export type HighlightId = string;

export interface LocalHighlight {
  text: string,
  color?: string,
}

export type HighlightLocation = {
  start: number,
  end: number,
  index: number,
}

export interface LocalHighlightInfo {
  [url: string] : {
    title: string,
    highlights: {
      [id: string]: LocalHighlight,
    }
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

