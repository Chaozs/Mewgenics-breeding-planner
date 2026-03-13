import type { PlannerAnalysisState, PlannerConfig, RecommendationAction } from "../types";
import { ROOM_FOCUS_CONFIGS } from "../planner/room-config";
import { PRIORITY_ORDER_LABELS, PRIORITY_ORDER_PARTS, parsePriorityOrderText, serializePriorityOrderText } from "../planner/utils";
import { SectionCard } from "./Cards";

type Props = {
  plannerConfig: PlannerConfig;
  plannerLocked: boolean;
  plannerLockMessage: string;
  analysisState: PlannerAnalysisState;
  followupInput: string;
  onConfigChange: (key: "priorityOrder" | "roomAFocus" | "roomBFocus" | "roomCFocus" | "roomDFocus" | "additionalPromptInstructions", value: string) => void;
  onRoomEnabledChange: (key: "roomBEnabled" | "roomCEnabled" | "roomDEnabled", value: boolean) => void;
  onSkillMappingChange: (index: number, key: "source" | "target", value: string) => void;
  onAddSkillMapping: () => void;
  onRemoveSkillMapping: (index: number) => void;
  onAnalyze: () => void;
  onFollowupInputChange: (value: string) => void;
  onSendFollowup: () => void;
  onApplyRecommendationAction: (action: RecommendationAction) => void;
  isRecommendationActionApplied: (action: RecommendationAction) => boolean;
  getRecommendationActionWarning: (action: RecommendationAction) => string | null;
};

export function PlannerSection(props: Props) {
  const {
    plannerConfig,
    plannerLocked,
    plannerLockMessage,
    analysisState,
    followupInput,
    onConfigChange,
    onRoomEnabledChange,
    onSkillMappingChange,
    onAddSkillMapping,
    onRemoveSkillMapping,
    onAnalyze,
    onFollowupInputChange,
    onSendFollowup,
    onApplyRecommendationAction,
    isRecommendationActionApplied,
    getRecommendationActionWarning,
  } = props;

  const hasStructuredAnalysis = analysisState.mode === "structured";
  const followupPrompt = hasStructuredAnalysis ? analysisState.followupPrompt : "";
  const hasSuggestedFollowupPrompt = Boolean(followupPrompt.trim());
  const recommendationCards = hasStructuredAnalysis ? analysisState.cards : analysisState.mode === "error" ? analysisState.cards : [];
  const parsedPriorityOrder = parsePriorityOrderText(plannerConfig.priorityOrder);
  return (
    <section id="plannerAiSection" className={`panel planner-centered${plannerLocked ? " feature-locked" : ""}`}>
      <h2 className="section-title">ChatGPT Planner Recommendation (Experimental)</h2>
      <div id="plannerAiLockNotice" className="feature-lock-notice" hidden={!plannerLocked}>{plannerLockMessage}</div>

      <details className={`import-panel${plannerLocked ? " feature-locked-panel" : ""}`}>
        <summary className="import-summary" aria-disabled={plannerLocked}>Skill Mapping (IMPORTANT!)</summary>
        <div className="import-content">
          <p className="field-help">Maintain this list whenever the screenshot parser encounters new mutation wording. If this list is not kept up to date, the same mutation may be mapped to different results across different parses.</p>
          <label className="section-label">Skill mapping</label>
          <p className="field-help">Add one mapping per row. Use the left field for the original screenshot text and the right field for the canonical token.</p>
          <div className="skill-mapping-list">
            {plannerConfig.skillMappings.map((row, index) => (
              <div key={`skill-map-${index}`} className="skill-mapping-row">
                <input
                  type="text"
                  className="skill-mapping-input"
                  placeholder="Original screenshot text"
                  disabled={plannerLocked}
                  value={row.source}
                  onChange={(event) => onSkillMappingChange(index, "source", event.target.value)}
                />
                <span className="skill-mapping-arrow">=&gt;</span>
                <input
                  type="text"
                  className="skill-mapping-input"
                  placeholder="Mapped token"
                  disabled={plannerLocked}
                  value={row.target}
                  onChange={(event) => onSkillMappingChange(index, "target", event.target.value)}
                />
                <button type="button" className="secondary-btn skill-mapping-remove" disabled={plannerLocked} onClick={() => onRemoveSkillMapping(index)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
          <div className="buttons compact">
            <button id="addSkillMappingBtn" type="button" className="secondary-btn" disabled={plannerLocked} onClick={onAddSkillMapping}>
              Add Skill Mapping
            </button>
          </div>
        </div>
      </details>

      <details className={`import-panel${plannerLocked ? " feature-locked-panel" : ""}`}>
        <summary className="import-summary" aria-disabled={plannerLocked}>Planner Recommendation Customization</summary>
        <div className="import-content">
          <div className="planner-guidance-box planner-edit-guidance">
            <strong>When should you edit this?</strong>
            <span>Leave these defaults alone unless you want to change which mutations matter most or what each room is intended to do.</span>
          </div>

          <section className="planner-customization-section">
            <h3 className="section-label planner-subsection-title">Mutation Priority Order</h3>
            <p className="field-help">Edit priorities separately for each body part. Use `-&gt;` between mutations, for example `confusion -&gt; reflect -&gt; any`.</p>
            <div className="priority-order-grid">
              {PRIORITY_ORDER_PARTS.map((bodyPart) => (
                <label key={bodyPart} className="manual-field">
                  <span className="manual-label">{PRIORITY_ORDER_LABELS[bodyPart]}</span>
                  <textarea
                    rows={2}
                    disabled={plannerLocked}
                    value={parsedPriorityOrder.priorities[bodyPart]}
                    onChange={(event) => {
                      const nextPriorities = {
                        ...parsedPriorityOrder.priorities,
                        [bodyPart]: event.target.value,
                      };
                      onConfigChange("priorityOrder", serializePriorityOrderText(nextPriorities, parsedPriorityOrder.extraLines));
                    }}
                  />
                </label>
              ))}
            </div>
          </section>

          <section className="planner-customization-section">
            <h3 className="section-label planner-subsection-title">Room Focus</h3>
            <p className="field-help">Describe what each enabled room should be optimized for during planner analysis.</p>
            {ROOM_FOCUS_CONFIGS.map(({ focusKey, enabledKey, label, rows, help }) => {
              const isEnabled = enabledKey ? plannerConfig[enabledKey] : true;
              return (
                <div key={focusKey} className={`room-focus-block${!isEnabled ? " room-focus-disabled" : ""}`}>
                  <div className="room-focus-header">
                    <label className="section-label" htmlFor={focusKey}>{label}</label>
                    {enabledKey ? (
                      <label className="room-toggle-row">
                        <input
                          type="checkbox"
                          disabled={plannerLocked}
                          checked={plannerConfig[enabledKey]}
                          onChange={(event) => onRoomEnabledChange(enabledKey, event.target.checked)}
                        />
                        <span>{plannerConfig[enabledKey] ? "Enabled" : "Disabled"}</span>
                      </label>
                    ) : (
                      <span className="room-toggle-static">Enabled</span>
                    )}
                  </div>
                  <p className={`field-help${!isEnabled ? " room-disabled-note" : ""}`}>
                    {isEnabled ? help : "Disabled rooms are excluded from validation and planner recommendations."}
                  </p>
                  <textarea
                    id={focusKey}
                    rows={rows}
                    disabled={plannerLocked || !isEnabled}
                    value={plannerConfig[focusKey]}
                    onChange={(event) => onConfigChange(focusKey, event.target.value)}
                  />
                </div>
              );
            })}
          </section>

          <section className="planner-customization-section">
            <h3 className="section-label planner-subsection-title">Additional Prompt Instructions</h3>
            <p className="field-help">Optional freeform instructions appended to the planner prompt. Example: <code>please keep at least 2 cats with reflect(eye)</code>.</p>
            <textarea
              rows={4}
              disabled={plannerLocked}
              placeholder="Add any extra planning constraints or instructions here..."
              value={plannerConfig.additionalPromptInstructions}
              onChange={(event) => onConfigChange("additionalPromptInstructions", event.target.value)}
            />
          </section>
        </div>
      </details>

      <button id="analyzeCatsBtn" className="primary-btn analyze-btn" type="button" disabled={plannerLocked || analysisState.mode === "streaming"} onClick={onAnalyze}>
        Analyze Cats
      </button>

      <div id="loading" className="loading" style={{ display: analysisState.mode === "streaming" ? "flex" : "none" }}>
        <p>Analyzing cats...</p>
        <div className="spinner"></div>
      </div>

      <div id="resultStructured" className="recommendation-grid">
        {analysisState.mode === "streaming" ? (
          <>
            <SectionCard title="Analysis Progress" items={analysisState.statuses} className="move-section" />
            <section className="recommendation-card other-section">
              <h3>Live Response</h3>
              {analysisState.liveOutput ? <pre className="stream-output">{analysisState.liveOutput}</pre> : <p className="empty">Waiting for streamed output...</p>}
            </section>
          </>
        ) : (
          recommendationCards.map((card, index) => (
            <SectionCard
              key={`${card.title}-${index}`}
              {...card}
              onApplyAction={onApplyRecommendationAction}
              isActionApplied={isRecommendationActionApplied}
              getActionWarning={getRecommendationActionWarning}
            />
          ))
        )}
      </div>

      <section id="followupPanel" className="followup-panel" hidden={!hasStructuredAnalysis || plannerLocked}>
        <h3 className="section-label">Planner Follow-up</h3>
        <p id="followupPromptText" className="field-help">
          {hasSuggestedFollowupPrompt
            ? "The planner asked for one more input before refining the recommendations:"
            : "Add any corrections, constraints, or preferences here to recompile the recommendations using the current analysis as context."}
        </p>
        {hasSuggestedFollowupPrompt ? (
          <div className="planner-guidance-box followup-guidance">
            <span>{followupPrompt}</span>
          </div>
        ) : null}
        <textarea
          id="followupResponseInput"
          rows={4}
          placeholder={hasSuggestedFollowupPrompt
            ? "Type your response to continue..."
            : "Example: keep at least 2 reflect cats, avoid trimming Room B incubators, and prefer moving duplicates before deleting them."}
          value={followupInput}
          onChange={(event) => onFollowupInputChange(event.target.value)}
          disabled={plannerLocked || analysisState.mode === "streaming"}
        />
        <div className="buttons compact">
          <button id="sendFollowupBtn" type="button" className="primary-btn" disabled={plannerLocked || analysisState.mode === "streaming" || !followupInput.trim()} onClick={onSendFollowup}>
            {hasSuggestedFollowupPrompt ? "Send Follow-up" : "Recompile Suggestions"}
          </button>
        </div>
      </section>
    </section>
  );
}
