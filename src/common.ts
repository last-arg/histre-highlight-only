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

export function removeHighlightFromDom(highlights: LocalHighlightsObject, elems: NodeListOf<Element>) {
  // TODO: have to hold on to histre highlights and local highlights.
  // Or get local highlight when needed?
  // console.log("elems to remove: ", elems)
  console.log("elems length: ", elems[0].textContent!.length)
  for (const fill_elem of elems) {
    let prev = fill_elem.previousElementSibling;
    const prev_elems: [Element, number][] = [];
    let total_len = 0;
    while (prev?.classList.contains("hho-mark")) {
      total_len += prev.textContent?.length || 0;
      prev_elems.push([prev, total_len]);
      prev = prev.previousElementSibling;
    }

    if (prev_elems.length === 0) {
      console.log("ALONE")
      fill_elem.replaceWith(fill_elem.textContent!);
      continue;
    }

    console.log("prev", prev_elems.length);
    const filtered_elems = prev_elems.filter(([elem, _], elem_index, arr) => {
      const id = elem.getAttribute("data-hho-id");
      const index = arr.findLastIndex(([el, _]) => el.getAttribute("data-hho-id") === id);
      return elem_index === index;
    })
    console.log("filter", filtered_elems.length)
    let fill_len = fill_elem.textContent?.length || 0;
    let fill_text_node: Node | undefined = undefined;
    for (const [f_elem, len] of filtered_elems) {
      const curr_id = f_elem.getAttribute("data-hho-id")!;
      const {text, color} = highlights[curr_id];
      // TODO: make sure f_elem is start of highlight?  
      const total_len = len + fill_len;
      if (text.length >= total_len && fill_text_node === undefined) {
        console.log("REPLACE")
        fill_elem.setAttribute("data-hho-id", curr_id);
        fill_elem.setAttribute("data-hho-color", color!);
        break;
      } else if (text.length > len) {
        console.log("MULTIPLE")
        // Highlight only covers part of 'removed' node
        // TODO: highlight only covers part of node
        // remove surrounding <mark>
        // split text node in right place
        // change text node 
        if (fill_text_node === undefined) {
          fill_text_node = fill_elem.firstChild!;
          // fill_elem.parentNode?.insertBefore(fill_text_node, fill_elem);
          // fill_elem.remove();

          // fill_elem.replaceWith(fill_text_node);
          // TODO: @continue
          fill_text_node = (fill_text_node as Text).splitText(text.length - len);
        }
      } else if (fill_text_node === undefined) {
        console.log("JUST remove")
        fill_elem.replaceWith(fill_elem.textContent!);
        break;
      }

      // console.log(text)
      // console.log(text.slice(0,len))
    }
  }
}
