export enum Action { 
  Save, 
  Delete,
  Update 
}

export interface Message {
  action: Action,
  // Delete: highlight_id (might be local_id)
  // Save: text, title, color, local_id
  data?: any,
}


