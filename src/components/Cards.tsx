import type { MessageCard, MessageCardItem, RecommendationAction } from "../types";

function parseItemContent(text: string) {
  const tokenPattern = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  return text.split(tokenPattern).filter(Boolean);
}

function InlineMarkdown({ text }: { text: string }) {
  const tokens = parseItemContent(text);
  return (
    <>
      {tokens.map((token, index) => {
        if (token.startsWith("**") && token.endsWith("**") && token.length > 4) {
          return <strong key={`${token}-${index}`}>{token.slice(2, -2)}</strong>;
        }
        if (token.startsWith("*") && token.endsWith("*") && token.length > 2) {
          return <em key={`${token}-${index}`}>{token.slice(1, -1)}</em>;
        }
        return <span key={`${token}-${index}`}>{token}</span>;
      })}
    </>
  );
}

function stripInlineMarkdownWrapper(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith("**") && trimmed.endsWith("**") && trimmed.length > 4) {
    return trimmed.slice(2, -2).trim();
  }
  if (trimmed.startsWith("*") && trimmed.endsWith("*") && trimmed.length > 2) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function getActionLabel(action: RecommendationAction, isApplied: boolean) {
  if (action.kind === "delete") {
    return isApplied ? "Undo Delete" : "Apply Delete";
  }
  return isApplied ? `Undo Move to ${action.targetRoom}` : `Apply Move to ${action.targetRoom}`;
}

function CardListItem(
  {
    item,
    onApplyAction,
    isActionApplied,
  }: {
    item: MessageCardItem;
    onApplyAction?: (action: RecommendationAction) => void;
    isActionApplied?: (action: RecommendationAction) => boolean;
  },
) {
  const text = typeof item === "string" ? item : item.text;
  const match = text.match(/^(.+?)\s*(?::|(?:-|\u2013|\u2014))\s+(.+)$/);
  const action = typeof item === "string" ? undefined : item.action;
  const isApplied = action && isActionApplied ? isActionApplied(action) : false;
  if (!match) {
    return (
      <li className={isApplied ? "recommendation-item-applied" : ""}>
        <InlineMarkdown text={text} />
        {action && onApplyAction ? (
          <>
            {" "}
            <button
              type="button"
              className={`secondary-btn recommendation-action-btn${isApplied ? " is-applied" : ""}`}
              onClick={() => onApplyAction(action)}
            >
              {getActionLabel(action, isApplied)}
            </button>
          </>
        ) : null}
      </li>
    );
  }

  return (
    <li className={isApplied ? "recommendation-item-applied" : ""}>
      <strong>{stripInlineMarkdownWrapper(match[1])}</strong>
      {": "}
      <InlineMarkdown text={match[2].trim()} />
      {action && onApplyAction ? (
        <>
          {" "}
          <button
            type="button"
            className={`secondary-btn recommendation-action-btn${isApplied ? " is-applied" : ""}`}
            onClick={() => onApplyAction(action)}
          >
            {getActionLabel(action, isApplied)}
          </button>
        </>
      ) : null}
    </li>
  );
}

export function SectionCard(
  {
    title,
    items,
    className = "other-section",
    onApplyAction,
    isActionApplied,
  }: MessageCard & {
    onApplyAction?: (action: RecommendationAction) => void;
    isActionApplied?: (action: RecommendationAction) => boolean;
  },
) {
  return (
    <section className={`recommendation-card ${className}`}>
      <h3>{title}</h3>
      {items.length === 0 ? (
        <p className="empty">No cats listed.</p>
      ) : (
        <ul>
          {items.map((item, index) => (
            <CardListItem
              key={`${title}-${index}-${typeof item === "string" ? item : item.text}`}
              item={item}
              onApplyAction={onApplyAction}
              isActionApplied={isActionApplied}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
