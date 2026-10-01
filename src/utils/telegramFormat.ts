/**
 * Utility functions to convert Telegram Message text + entities into valid Telegram HTML
 * and handle HTML escaping safely.
 */

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function escapeHtmlAttr(str: string): string {
  return escapeHtml(str).replace(/"/g, '&quot;');
}

export interface TelegramEntity {
  type: string;
  offset: number;
  length: number;
  url?: string;
  user?: {
    id: number;
    first_name?: string;
    last_name?: string;
    username?: string;
  };
  language?: string;
  custom_emoji_id?: string;
}

interface EntityNode {
  entity?: TelegramEntity;
  start: number;
  end: number;
  children: EntityNode[];
}

function getEntityTags(entity: TelegramEntity): [string, string] {
  switch (entity.type) {
    case 'bold':
      return ['<b>', '</b>'];
    case 'italic':
      return ['<i>', '</i>'];
    case 'underline':
      return ['<u>', '</u>'];
    case 'strikethrough':
      return ['<s>', '</s>'];
    case 'spoiler':
      return ['<tg-spoiler>', '</tg-spoiler>'];
    case 'code':
      return ['<code>', '</code>'];
    case 'pre':
      if (entity.language) {
        return [`<pre><code class="language-${escapeHtmlAttr(entity.language)}">`, '</code></pre>'];
      }
      return ['<pre>', '</pre>'];
    case 'text_link':
      if (entity.url) {
        return [`<a href="${escapeHtmlAttr(entity.url)}">`, '</a>'];
      }
      return ['', ''];
    case 'text_mention':
      if (entity.user?.id) {
        return [`<a href="tg://user?id=${entity.user.id}">`, '</a>'];
      }
      return ['', ''];
    case 'custom_emoji':
      if (entity.custom_emoji_id) {
        return [`<tg-emoji emoji-id="${escapeHtmlAttr(entity.custom_emoji_id)}">`, '</tg-emoji>'];
      }
      return ['', ''];
    case 'blockquote':
      return ['<blockquote>', '</blockquote>'];
    case 'expandable_blockquote':
      return ['<blockquote expandable>', '</blockquote>'];
    default:
      // Other entities like 'mention', 'hashtag', 'url', 'bot_command' are plain text in the message
      // and are autolinked by Telegram.
      return ['', ''];
  }
}

function insertNode(parent: EntityNode, newNode: EntityNode) {
  // Check if newNode fits entirely inside any child of parent
  for (const child of parent.children) {
    if (child.start <= newNode.start && newNode.end <= child.end) {
      insertNode(child, newNode);
      return;
    }
  }

  // Otherwise, newNode is a child of parent, and might adopt some of parent's current children
  const adoptedChildren: EntityNode[] = [];
  const remainingChildren: EntityNode[] = [];

  for (const child of parent.children) {
    if (newNode.start <= child.start && child.end <= newNode.end) {
      adoptedChildren.push(child);
    } else {
      remainingChildren.push(child);
    }
  }

  newNode.children = adoptedChildren;
  remainingChildren.push(newNode);

  // Keep children sorted by start asc, length desc
  remainingChildren.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
  parent.children = remainingChildren;
}

function renderNode(text: string, node: EntityNode): string {
  let result = '';
  let currentPos = node.start;

  for (const child of node.children) {
    // Text before child
    if (child.start > currentPos) {
      result += escapeHtml(text.slice(currentPos, child.start));
    }
    // Child's rendered content
    result += renderNode(text, child);
    currentPos = Math.max(currentPos, child.end);
  }

  // Remaining text after last child
  if (node.end > currentPos) {
    result += escapeHtml(text.slice(currentPos, node.end));
  }

  if (node.entity) {
    const [openTag, closeTag] = getEntityTags(node.entity);
    return openTag + result + closeTag;
  }

  return result;
}

/**
 * Converts Telegram Message text and its formatting entities to an HTML string
 * compatible with Telegram's HTML parse_mode.
 */
export function telegramEntitiesToHtml(text: string, entities?: TelegramEntity[]): string {
  if (!text) return '';
  if (!entities || entities.length === 0) {
    return escapeHtml(text);
  }

  const textLen = text.length;

  // Filter valid entities that are supported and within text bounds
  const validEntities = entities
    .filter(e => e && typeof e.offset === 'number' && typeof e.length === 'number' && e.length > 0)
    .map(e => ({
      ...e,
      offset: Math.max(0, Math.min(e.offset, textLen)),
      length: Math.max(0, Math.min(e.length, textLen - Math.max(0, Math.min(e.offset, textLen))))
    }))
    .filter(e => e.length > 0);

  if (validEntities.length === 0) {
    return escapeHtml(text);
  }

  // Sort: outer entities first (start asc, length desc)
  validEntities.sort((a, b) => a.offset - b.offset || b.length - a.length);

  const root: EntityNode = {
    start: 0,
    end: textLen,
    children: []
  };

  for (const ent of validEntities) {
    insertNode(root, {
      entity: ent,
      start: ent.offset,
      end: ent.offset + ent.length,
      children: []
    });
  }

  return renderNode(text, root);
}
