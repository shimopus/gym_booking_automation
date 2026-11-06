import { SentSummary } from '../types';

/**
 * Extracts the header (everything before the user list) and footer (everything after)
 * from a summary payments message.
 */
export function extractSummaryHeaderAndFooter(
  existingText: string,
  users?: { name: string; username?: string; userId?: number }[]
): { header: string; footer: string } {
  if (!existingText || !existingText.trim()) {
    return {
      header: `<b>💰 Summary Payments</b>\nДеньги переводим по Zelle: 6692045921`,
      footer: ''
    };
  }

  const lines = existingText.split('\n');

  // Determine if a line represents a user payment entry
  const isUserLine = (line: string): boolean => {
    const trimmed = line.trim();
    if (!trimmed) return false;

    // Standard user entry in summary payments has a price ($ or <b>$)
    const hasPrice = trimmed.includes('$');
    const hasStatus = trimmed.includes('✅') || trimmed.includes('❌');

    // If it has both price and status emoji, it is definitely a user row
    if (hasPrice && hasStatus) {
      return true;
    }

    // Or if it has a price and matches a known user's name, handle, or specific ID tag
    if (hasPrice && users && users.length > 0) {
      const matchesKnownUser = users.some(u => {
        const nameMatch = u.name && u.name.trim().length >= 2 && trimmed.includes(u.name);
        const handleMatch = u.username && trimmed.includes(`@${u.username}`);
        const idMatch = u.userId && (trimmed.includes(`tg://user?id=${u.userId}`) || trimmed.includes(`ID: ${u.userId}`));
        return nameMatch || handleMatch || idMatch;
      });
      if (matchesKnownUser) return true;
    }

    return false;
  };

  const firstUserLineIdx = lines.findIndex(isUserLine);

  // If no user lines were detected, keep the entire text as header so nothing is lost
  if (firstUserLineIdx === -1) {
    return {
      header: existingText.trim(),
      footer: ''
    };
  }

  // Find the last user line
  let lastUserLineIdx = firstUserLineIdx;
  for (let i = lines.length - 1; i >= firstUserLineIdx; i--) {
    if (isUserLine(lines[i])) {
      lastUserLineIdx = i;
      break;
    }
  }

  const header = lines.slice(0, firstUserLineIdx).join('\n').trimEnd();
  const footer = lines.slice(lastUserLineIdx + 1).join('\n').trimStart();

  return {
    header: header || `<b>💰 Summary Payments</b>\nДеньги переводим по Zelle: 6692045921`,
    footer
  };
}

/**
 * Updates the paid status emoji for a specific user directly within the message text,
 * preserving all custom titles, headers, line formatting, and footers verbatim.
 */
export function toggleUserPaidInSummaryText(
  currentText: string,
  user: { name: string; username?: string; userId?: number; paid: boolean },
  newPaidStatus: boolean
): string | null {
  if (!currentText) return null;

  const lines = currentText.split('\n');
  const oldEmoji = user.paid ? '✅' : '❌';
  const newEmoji = newPaidStatus ? '✅' : '❌';

  // Find the line that corresponds to this user
  let targetLineIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const hasOldEmoji = line.includes(oldEmoji);
    const hasNewEmoji = line.includes(newEmoji);
    
    // Check if line matches this user
    let userMatched = false;
    if (user.username && (line.includes(`@${user.username}`) || line.includes(user.username))) {
      userMatched = true;
    } else if (user.userId && line.includes(String(user.userId))) {
      userMatched = true;
    } else if (user.name && line.includes(user.name)) {
      userMatched = true;
    }

    if (userMatched && (hasOldEmoji || hasNewEmoji)) {
      targetLineIdx = i;
      break;
    }
  }

  if (targetLineIdx !== -1) {
    const line = lines[targetLineIdx];
    let updatedLine: string;
    if (line.includes(oldEmoji)) {
      const lastIndex = line.lastIndexOf(oldEmoji);
      updatedLine = line.substring(0, lastIndex) + newEmoji + line.substring(lastIndex + oldEmoji.length);
    } else if (line.includes(newEmoji)) {
      updatedLine = line;
    } else {
      updatedLine = `${line} ${newEmoji}`;
    }

    lines[targetLineIdx] = updatedLine;
    return lines.join('\n');
  }

  return null;
}

/**
 * Rebuilds the entire summary message text with updated users,
 * preserving custom title, header, and footer.
 */
export function buildSummaryMessageText(
  existingText: string,
  users: SentSummary['users'],
  customHeader?: string
): string {
  const { header: extractedHeader, footer } = extractSummaryHeaderAndFooter(existingText, users);
  const header = customHeader || extractedHeader;

  let newText = `${header}\n\n`;

  users.forEach(u => {
    let mention = u.name;
    if (u.username) {
      mention = `@${u.username}`;
    } else if (u.userId) {
      mention = `<a href="tg://user?id=${u.userId}">${u.name}</a>`;
    }

    const displayName = u.username ? `${u.name} (${mention})` : mention;
    const statusEmoji = u.paid ? ' ✅' : ' ❌';
    newText += `${displayName}: <b>$${u.total.toFixed(2)}</b>${statusEmoji}\n`;
  });

  if (footer) {
    newText += `\n${footer}`;
  } else if (existingText.includes('⚠️ Note:')) {
    newText += `\n<i>⚠️ Note: Some sessions had missing price data. Totals might be incomplete.</i>`;
  }

  return newText;
}
