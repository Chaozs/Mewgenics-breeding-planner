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
    getActionWarning,
    onOpenEntry,
  }: {
    item: MessageCardItem;
    onApplyAction?: (action: RecommendationAction) => void;
    isActionApplied?: (action: RecommendationAction) => boolean;
    getActionWarning?: (action: RecommendationAction) => string | null;
    onOpenEntry?: (entryId: string) => void;
  },
) {
  const text = typeof item === "string" ? item : item.text;
  if (typeof item !== "string" && item.kind === "group") {
    return (
      <li className="recommendation-group-heading">
        <strong>{text}</strong>
      </li>
    );
  }
  const match = text.match(/^(.+?)\s*(?::|(?:-|\u2013|\u2014))\s+(.+)$/);
  const action = typeof item === "string" ? undefined : item.action;
  const actionWarning = action && getActionWarning ? getActionWarning(action) : null;
  const isApplied = !actionWarning && action && isActionApplied ? isActionApplied(action) : false;
  const canOpenEntry = action?.kind === "delete" && !isApplied && Boolean(onOpenEntry);
  const actionLabel = action
    ? (actionWarning || getActionLabel(action, isApplied))
    : "";
  if (!match) {
    return (
      <li className={isApplied ? "recommendation-item-applied" : ""}>
        <InlineMarkdown text={text} />
        {canOpenEntry && action ? (
          <>
            {" "}
            <button
              type="button"
              className="secondary-btn recommendation-action-btn"
              onClick={() => onOpenEntry?.(action.entryId)}
            >
              Open Cat
            </button>
          </>
        ) : null}
        {action && onApplyAction ? (
          <>
            {" "}
            <button
              type="button"
              className={`secondary-btn recommendation-action-btn${isApplied ? " is-applied" : ""}${actionWarning ? " is-warning" : ""}`}
              disabled={Boolean(actionWarning)}
              title={actionWarning || undefined}
              onClick={() => onApplyAction(action)}
            >
              {actionLabel}
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
      {canOpenEntry && action ? (
        <>
          {" "}
          <button
            type="button"
            className="secondary-btn recommendation-action-btn"
            onClick={() => onOpenEntry?.(action.entryId)}
          >
            Open Cat
          </button>
        </>
      ) : null}
      {action && onApplyAction ? (
        <>
          {" "}
          <button
            type="button"
            className={`secondary-btn recommendation-action-btn${isApplied ? " is-applied" : ""}${actionWarning ? " is-warning" : ""}`}
            disabled={Boolean(actionWarning)}
            title={actionWarning || undefined}
            onClick={() => onApplyAction(action)}
          >
            {actionLabel}
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
    getActionWarning,
    onOpenEntry,
  }: MessageCard & {
    onApplyAction?: (action: RecommendationAction) => void;
    isActionApplied?: (action: RecommendationAction) => boolean;
    getActionWarning?: (action: RecommendationAction) => string | null;
    onOpenEntry?: (entryId: string) => void;
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
              getActionWarning={getActionWarning}
              onOpenEntry={onOpenEntry}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
