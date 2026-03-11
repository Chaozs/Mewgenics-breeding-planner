import { COLUMN_DEFINITIONS, getDefaultValueForColumn, normalizeColumnInputValue } from "../planner/schema";
import { DEFAULT_ROOM, ROOM_ORDER, getDefaultBreedWithForGender } from "../planner/utils";

type ParseStatus = {
  text: string;
  isError: boolean;
};

type Props = {
  open: boolean;
  values: Record<string, string>;
  parseLocked: boolean;
  parseLockMessage: string;
  parseStatus: ParseStatus;
  manualCatError: string;
  previewUrl: string;
  onClose: () => void;
  onClearDraft: () => void;
  onSubmit: () => void;
  onValueChange: (key: string, value: string) => void;
  onFileChange: (file: File) => void;
  onPaste: (event: React.ClipboardEvent<HTMLFormElement>) => void;
};

export function ManualCatDialog(props: Props) {
  const {
    open,
    values,
    parseLocked,
    parseLockMessage,
    parseStatus,
    manualCatError,
    previewUrl,
    onClose,
    onClearDraft,
    onSubmit,
    onValueChange,
    onFileChange,
    onPaste,
  } = props;

  if (!open) {
    return null;
  }

  return (
    <div className="manual-cat-overlay" onClick={onClose}>
      <dialog className="manual-cat-dialog" open onClick={(event) => event.stopPropagation()}>
        <form className="manual-cat-form" method="dialog" onSubmit={(event) => event.preventDefault()} onPaste={onPaste}>
          <h3 className="section-title">Add Cat</h3>
          <p className="field-help">Add a cat by parsing a screenshot or by filling the fields manually. When finished, click <strong>Add Cat</strong> to save it to this browser.</p>
          <section id="manualParseSection" className={`manual-dialog-group${parseLocked ? " feature-locked" : ""}`}>
            <label className="section-label" htmlFor="manualParseFileInput">Upload screenshot</label>
            <p className="field-help">Fastest option: paste an image, drag it in, or choose a screenshot file.</p>
            <div id="manualParseDropzone" className={`dropzone${parseLocked ? " feature-locked-dropzone" : ""}`}>
              <p><strong>Paste, drag and drop, or choose a screenshot</strong></p>
              <input
                id="manualParseFileInput"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={parseLocked}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    onFileChange(file);
                  }
                }}
              />
            </div>
            <div id="manualParseLockNotice" className="feature-lock-notice" hidden={!parseLocked}>{parseLockMessage}</div>
            <div id="manualParseStatus" className={`status${parseStatus.isError ? " error" : ""}`} hidden={parseLocked}>{parseStatus.text}</div>
            <label className="section-label">Preview</label>
            <div id="manualParsePreview" className={`preview${parseLocked ? " feature-locked-preview" : ""}`}>
              {previewUrl ? <img src={previewUrl} alt="Screenshot preview" /> : null}
            </div>
          </section>

          <section className="manual-dialog-group">
            <h4 className="section-label">Add cat manually</h4>
            <p className="field-help">You can edit any parsed values here before saving, or enter everything manually if you are not using screenshot parsing.</p>
            <div className="manual-cat-fields">
              <label className="manual-field">
                <span className="manual-label">Room</span>
                <select name="room" value={values.room ?? DEFAULT_ROOM} onChange={(event) => onValueChange("room", event.target.value)}>
                  {ROOM_ORDER.map((room) => <option key={room} value={room}>{room}</option>)}
                </select>
              </label>
              {COLUMN_DEFINITIONS.map((definition, index) => (
                <label key={definition.key} className="manual-field">
                  <span className="manual-label">{definition.label}</span>
                  {definition.control === "select" ? (
                    <select
                      name={definition.key}
                      value={values[definition.key] ?? getDefaultValueForColumn(index)}
                      onChange={(event) => {
                        const nextValue = normalizeColumnInputValue(index, event.target.value);
                        onValueChange(definition.key, nextValue);
                        if (index === 1) {
                          const previousGender = values.gender ?? "?";
                          const previousBreedWith = values.breed_with ?? "";
                          const previousDefault = getDefaultBreedWithForGender(previousGender);
                          if (!previousBreedWith || previousBreedWith === previousDefault) {
                            onValueChange("breed_with", getDefaultBreedWithForGender(nextValue));
                          }
                        }
                      }}
                    >
                      {definition.options?.map((option) => (
                        <option key={`${definition.key}-${option.value}`} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      name={definition.key}
                      value={values[definition.key] ?? getDefaultValueForColumn(index)}
                      onChange={(event) => onValueChange(definition.key, event.target.value)}
                    />
                  )}
                </label>
              ))}
            </div>
            <p className="manual-cat-error" role="alert">{manualCatError}</p>
          </section>

          <div className="buttons compact">
            <button type="button" className="secondary-btn" onClick={onClearDraft}>Clear Draft</button>
            <button type="button" className="secondary-btn" onClick={onClose}>Cancel</button>
            <button type="button" className="primary-btn" onClick={onSubmit}>Add Cat</button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
