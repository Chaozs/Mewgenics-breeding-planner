import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { COLUMN_DEFINITIONS, COLUMN_LABELS, isStatColumn, normalizeColumnInputValue } from "../planner/schema";
import {
  DEFAULT_ROOM,
  ROOM_ORDER,
  ROOM_SHORT_LABEL,
  buildPriorityMutationLookup,
  getCellDisplayClasses,
  getExpectedBodyPartForColumn,
  getMutationTraitName,
  getOrderedRooms,
  groupEntriesByRoom,
} from "../planner/utils";
import type { Entry, MessageCard } from "../types";
import { SectionCard } from "./Cards";

type DropTarget = {
  type: "row" | "room";
  rowIndex?: number;
  room: string;
  placeAfter: boolean;
};

type GroupedEntry = {
  entry: Entry;
  index: number;
};

type Props = {
  entries: Entry[];
  invalidLines: string[];
  priorityOrder: string;
  orderedRooms: string[];
  groupedEntries: Map<string, GroupedEntry[]>;
  actionHistoryCount: number;
  statusCards: MessageCard[];
  dragState: { sourceIndex: number | null; dropTarget: DropTarget | null };
  focusedEntryId?: string | null;
  onFocusedEntryHandled?: () => void;
  onOpenManual: () => void;
  onExport: () => void;
  onUndo: () => void;
  onClear: () => void;
  onDelete: (index: number) => void;
  onEdit: (index: number) => void;
  onMoveRoom: (index: number, targetRoom: string) => void;
  onCellChange: (rowIndex: number, columnIndex: number, value: string) => void;
  onDragStart: (rowIndex: number) => void;
  onDragOver: (target: DropTarget) => void;
  onDrop: (target: DropTarget) => void;
  onDragEnd: () => void;
};

export function CurrentCatsPanel(props: Props) {
  const ACTION_MENU_GAP = 6;
  const ACTION_MENU_MARGIN = 8;
  const ACTION_MENU_FALLBACK_WIDTH = 148;
  const ACTION_MENU_FALLBACK_HEIGHT = 220;

  const {
    entries,
    invalidLines,
    priorityOrder,
    actionHistoryCount,
    statusCards,
    dragState,
    focusedEntryId,
    onFocusedEntryHandled,
    onOpenManual,
    onExport,
    onUndo,
    onClear,
    onDelete,
    onEdit,
    onMoveRoom,
    onCellChange,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
  } = props;
  const [nameFilter, setNameFilter] = useState("");
  const [mutationFilter, setMutationFilter] = useState("");
  const [genderFilter, setGenderFilter] = useState("");
  const [breedWithFilter, setBreedWithFilter] = useState("");
  const [selectedColumnIndex, setSelectedColumnIndex] = useState<number | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [openActionMenuEntryId, setOpenActionMenuEntryId] = useState<string | null>(null);
  const [openActionMenuVerticalPlacement, setOpenActionMenuVerticalPlacement] = useState<"down" | "up">("down");
  const [openActionMenuPosition, setOpenActionMenuPosition] = useState({ top: 0, left: 0 });
  const rowRefs = useRef(new Map<string, HTMLTableRowElement | null>());
  const actionButtonRefs = useRef(new Map<string, HTMLButtonElement | null>());
  const actionMenuRef = useRef<HTMLDivElement | null>(null);
  const deferredNameFilter = useDeferredValue(nameFilter);
  const deferredMutationFilter = useDeferredValue(mutationFilter);
  const entryIndexById = useMemo(
    () => new Map(entries.map((entry, index) => [entry.id, index])),
    [entries],
  );
  const priorityLookup = useMemo(() => buildPriorityMutationLookup(priorityOrder), [priorityOrder]);

  const filteredGroupedEntries = useMemo(() => {
    const normalizedName = deferredNameFilter.trim().toLowerCase();
    const normalizedMutation = deferredMutationFilter.trim().toLowerCase();
    const normalizedGender = genderFilter.trim().toUpperCase();
    const normalizedBreedWith = breedWithFilter.trim().toUpperCase();
    const matchingEntries = entries.filter((entry) => {
      const matchesName = !normalizedName || (entry.columns[0] ?? "").toLowerCase().includes(normalizedName);
      const matchesMutation = !normalizedMutation
        || entry.columns.slice(10).some((value) => value.toLowerCase().includes(normalizedMutation));
      const matchesGender = !normalizedGender || (entry.columns[1] ?? "").toUpperCase() === normalizedGender;
      const matchesBreedWith = !normalizedBreedWith || (entry.columns[2] ?? "").toUpperCase() === normalizedBreedWith;
      return matchesName && matchesMutation && matchesGender && matchesBreedWith;
    });
    return groupEntriesByRoom(matchingEntries, (entry) => ({ entry, index: entryIndexById.get(entry.id) ?? -1 }));
  }, [breedWithFilter, deferredMutationFilter, deferredNameFilter, entries, entryIndexById, genderFilter]);

  const visibleOrderedRooms = useMemo(() => getOrderedRooms(filteredGroupedEntries), [filteredGroupedEntries]);
  const visibleEntryCount = useMemo(
    () => Array.from(filteredGroupedEntries.values()).reduce((count, roomRows) => count + roomRows.length, 0),
    [filteredGroupedEntries],
  );

  const hasActiveFilters = Boolean(nameFilter.trim() || mutationFilter.trim() || genderFilter || breedWithFilter);

  useEffect(() => {
    if (!openActionMenuEntryId) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".row-actions-menu-shell") || target?.closest(".row-actions-menu")) {
        return;
      }
      setOpenActionMenuEntryId(null);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [openActionMenuEntryId]);

  useEffect(() => {
    if (!openActionMenuEntryId) {
      return;
    }

    function updateMenuPosition() {
      const entryId = openActionMenuEntryId;
      if (!entryId) {
        return;
      }

      const trigger = actionButtonRefs.current.get(entryId);
      if (!trigger) {
        return;
      }

      const triggerRect = trigger.getBoundingClientRect();
      const menuRect = actionMenuRef.current?.getBoundingClientRect();
      const menuWidth = menuRect?.width ?? ACTION_MENU_FALLBACK_WIDTH;
      const menuHeight = menuRect?.height ?? ACTION_MENU_FALLBACK_HEIGHT;
      const spaceBelow = window.innerHeight - triggerRect.bottom - ACTION_MENU_MARGIN;
      const spaceAbove = triggerRect.top - ACTION_MENU_MARGIN;
      const placement: "down" | "up" = spaceBelow >= menuHeight || spaceBelow >= spaceAbove ? "down" : "up";
      const top = placement === "down"
        ? Math.min(triggerRect.bottom + ACTION_MENU_GAP, window.innerHeight - menuHeight - ACTION_MENU_MARGIN)
        : Math.max(ACTION_MENU_MARGIN, triggerRect.top - menuHeight - ACTION_MENU_GAP);
      const left = Math.max(
        ACTION_MENU_MARGIN,
        Math.min(triggerRect.right + ACTION_MENU_GAP, window.innerWidth - menuWidth - ACTION_MENU_MARGIN),
      );

      setOpenActionMenuVerticalPlacement(placement);
      setOpenActionMenuPosition((current) => (
        current.top === top && current.left === left
          ? current
          : { top, left }
      ));
    }

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [openActionMenuEntryId]);

  useEffect(() => {
    if (!focusedEntryId) {
      return;
    }

    setSelectedEntryId(focusedEntryId);
    const frameId = window.requestAnimationFrame(() => {
      rowRefs.current.get(focusedEntryId)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
      onFocusedEntryHandled?.();
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [entries, focusedEntryId, onFocusedEntryHandled]);

  function toggleActionMenu(entryId: string, trigger: HTMLButtonElement) {
    if (openActionMenuEntryId === entryId) {
      setOpenActionMenuEntryId(null);
      return;
    }

    const triggerRect = trigger.getBoundingClientRect();
    const initialLeft = Math.max(
      ACTION_MENU_MARGIN,
      Math.min(triggerRect.right + ACTION_MENU_GAP, window.innerWidth - ACTION_MENU_FALLBACK_WIDTH - ACTION_MENU_MARGIN),
    );
    const initialTop = Math.max(
      ACTION_MENU_MARGIN,
      Math.min(triggerRect.bottom + ACTION_MENU_GAP, window.innerHeight - ACTION_MENU_FALLBACK_HEIGHT - ACTION_MENU_MARGIN),
    );
    setOpenActionMenuPosition({ top: initialTop, left: initialLeft });
    setOpenActionMenuEntryId(entryId);
  }

  return (
      <section className={`panel planner-centered current-cats-panel${entries.length > 0 ? " has-data" : ""}`}>
        <label className="section-label">Current Cat Rows</label>
        <div className="planner-guidance-box current-cats-warning">
          <strong>Local browser storage only</strong>
          <span>Cats are stored only in this browser on this machine. Switching browsers or computers will not carry this data over.</span>
        </div>
        <p className="field-help">Review all saved cats here. You can edit cells inline, open row actions, drag to reorder, or filter across rooms before analysis.</p>
        <div className="buttons compact">
          <button type="button" className="primary-btn" onClick={onOpenManual}>Add Cat</button>
          <button type="button" className="secondary-btn" disabled={entries.length === 0} onClick={onExport}>Export to Excel Data</button>
          <button type="button" className="secondary-btn" disabled={actionHistoryCount === 0} onClick={onUndo}>Undo</button>
          <button type="button" className="secondary-btn" onClick={onClear}>Clear all cats</button>
        </div>
        <p className="field-help storage-meta">Browser storage: {entries.length} row{entries.length === 1 ? "" : "s"}.</p>
        <section className="cats-filter-panel">
        <label className="section-label">Filter And Highlight</label>
        <p className="field-help">Use filters to narrow the list. Click any column header to highlight that column across every room table.</p>
        <div className="cats-filter-grid">
          <label className="manual-field">
            <span className="manual-label">Filter by name</span>
            <input
              type="text"
              value={nameFilter}
              placeholder="Contains cat name"
              onChange={(event) => setNameFilter(event.target.value)}
            />
          </label>
          <label className="manual-field">
            <span className="manual-label">Filter by mutation</span>
            <input
              type="text"
              value={mutationFilter}
              placeholder="Contains mutation text"
              onChange={(event) => setMutationFilter(event.target.value)}
            />
          </label>
          <label className="manual-field">
            <span className="manual-label">Filter by gender</span>
            <select value={genderFilter} onChange={(event) => setGenderFilter(event.target.value)}>
              <option value="">All</option>
              <option value="M">M</option>
              <option value="F">F</option>
              <option value="?">?</option>
            </select>
          </label>
          <label className="manual-field">
            <span className="manual-label">Filter by BreedWith</span>
            <select value={breedWithFilter} onChange={(event) => setBreedWithFilter(event.target.value)}>
              <option value="">All</option>
              <option value="ANY">Any</option>
              <option value="M">M</option>
              <option value="F">F</option>
              <option value="?">?</option>
            </select>
          </label>
        </div>
          <div className="buttons compact cats-filter-actions">
            <button
              type="button"
              className="secondary-btn"
              disabled={!hasActiveFilters}
            onClick={() => {
              setNameFilter("");
              setMutationFilter("");
              setGenderFilter("");
              setBreedWithFilter("");
            }}
            >
              Clear Filters
            </button>
          </div>
        <p className="field-help cats-filter-summary">
          Showing {visibleEntryCount} of {entries.length} row{entries.length === 1 ? "" : "s"}.
          {" "}
          Click the same column header again to remove its highlight.
        </p>
      </section>
      <div className="section-status current-cats-status">
        {statusCards.map((card, index) => <SectionCard key={`${card.title}-${index}`} {...card} />)}
      </div>
      <div className="cats-view">
        {entries.length === 0 ? (
          <p className="empty">No cats saved yet. Import spreadsheet rows or click Add Cat to begin.</p>
        ) : visibleEntryCount === 0 ? (
          <p className="empty">No cats match the current filters.</p>
        ) : (
          visibleOrderedRooms.map((room) => {
            const roomRows = filteredGroupedEntries.get(room);
            if (!roomRows?.length) {
              return null;
            }

            return (
              <section
                key={room}
                className={`cats-room${dragState.dropTarget?.type === "room" && dragState.dropTarget.room === room ? " drop-target-room" : ""}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (dragState.sourceIndex !== null) {
                    onDragOver({ type: "room", room, placeAfter: true });
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onDrop({ type: "room", room, placeAfter: true });
                }}
              >
                <h3 className="cats-room-title">{room} ({roomRows.length})</h3>
                <div className="cats-table-wrap">
                  <table className="cats-table">
                    <thead>
                      <tr>
                        <th className="cats-actions-col">Actions</th>
                        {COLUMN_LABELS.map((label, columnIndex) => (
                          <th
                            key={`${room}-${label}`}
                            className={`cats-column-header${selectedColumnIndex === columnIndex ? " column-selected" : ""}${columnIndex === 0 ? " cats-name-col" : ""}`}
                          >
                            <button
                              type="button"
                              className="column-select-btn"
                              onClick={() => setSelectedColumnIndex((current) => current === columnIndex ? null : columnIndex)}
                            >
                              {label}
                            </button>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {roomRows.map(({ entry, index }) => {
                        const isActionMenuOpen = openActionMenuEntryId === entry.id;
                        return (
                        <tr
                          // Keep the key stable while inline-editing values like cat name.
                          key={entry.id}
                          ref={(element) => {
                            rowRefs.current.set(entry.id, element);
                          }}
                          className={`cats-row${isActionMenuOpen ? " menu-open" : ""}${selectedEntryId === entry.id ? " row-selected" : ""}${dragState.sourceIndex === index ? " drag-source" : ""}${dragState.dropTarget?.type === "row" && dragState.dropTarget.rowIndex === index ? ` drop-target${dragState.dropTarget.placeAfter ? " drop-after" : ""}` : ""}`}
                          onClick={() => setSelectedEntryId(entry.id)}
                          onDragOver={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            if (dragState.sourceIndex !== null) {
                              onDragOver({ type: "row", rowIndex: index, room: entry.room, placeAfter: false });
                            }
                          }}
                          onDrop={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            onDrop({ type: "row", rowIndex: index, room: entry.room, placeAfter: false });
                          }}
                        >
                          <td className={`cats-actions-cell${isActionMenuOpen ? " menu-open" : ""}`}>
                            <div className="cats-actions-wrap">
                              <button
                                type="button"
                                className="row-action-btn icon-btn row-drag-handle"
                                aria-label="Drag row"
                                draggable
                                onDragStart={() => onDragStart(index)}
                                onDragEnd={onDragEnd}
                              >
                                ===
                              </button>
                                <div className={`row-actions-menu-shell${isActionMenuOpen ? " menu-open" : ""}`} onClick={(event) => event.stopPropagation()}>
                                  <button
                                    type="button"
                                    className="row-action-btn row-actions-toggle"
                                    aria-expanded={isActionMenuOpen}
                                    ref={(element) => {
                                      actionButtonRefs.current.set(entry.id, element);
                                    }}
                                    onClick={(event) => toggleActionMenu(entry.id, event.currentTarget)}
                                  >
                                    Actions
                                  </button>
                                {isActionMenuOpen && typeof document !== "undefined"
                                  ? createPortal(
                                    <div
                                      ref={actionMenuRef}
                                      className={`row-actions-menu row-actions-menu-${openActionMenuVerticalPlacement}`}
                                      style={{ top: `${openActionMenuPosition.top}px`, left: `${openActionMenuPosition.left}px` }}
                                    >
                                      <button
                                        type="button"
                                        className="row-actions-menu-item"
                                        onClick={() => {
                                          onEdit(index);
                                          setOpenActionMenuEntryId(null);
                                        }}
                                      >
                                        Edit
                                      </button>
                                      {ROOM_ORDER.filter((targetRoom) => targetRoom !== entry.room).map((targetRoom) => (
                                        <button
                                          key={`${entry.id}-${targetRoom}`}
                                          type="button"
                                          className="row-actions-menu-item"
                                          onClick={() => {
                                            onMoveRoom(index, targetRoom || DEFAULT_ROOM);
                                            setOpenActionMenuEntryId(null);
                                          }}
                                        >
                                          Move to {ROOM_SHORT_LABEL.get(targetRoom) || targetRoom}
                                        </button>
                                      ))}
                                      <button
                                        type="button"
                                        className="row-actions-menu-item danger"
                                        onClick={() => {
                                          onDelete(index);
                                          setOpenActionMenuEntryId(null);
                                        }}
                                      >
                                        Delete
                                      </button>
                                    </div>,
                                    document.body,
                                  )
                                  : null}
                              </div>
                            </div>
                          </td>
                          {entry.columns.map((value, columnIndex) => {
                            const definition = COLUMN_DEFINITIONS[columnIndex];
                            const { classes, mutationError } = getCellDisplayClasses(columnIndex, value);
                            const bodyPart = getExpectedBodyPartForColumn(columnIndex);
                            const mutationTraitName = getMutationTraitName(value);
                            const isPriorityMutation = Boolean(
                              bodyPart
                              && mutationTraitName
                              && priorityLookup.get(bodyPart)?.has(mutationTraitName),
                            );
                            const className = `cell-editor${isStatColumn(columnIndex) ? " stat-editor" : ""}${classes.length > 0 ? ` ${classes.join(" ")}` : ""}`;
                            const cellClasses = [
                              ...classes,
                              columnIndex === 0 ? "cats-name-col" : "",
                              selectedColumnIndex === columnIndex ? "column-selected" : "",
                              isPriorityMutation ? "priority-mutation-cell" : "",
                            ].filter(Boolean).join(" ");
                            return (
                              <td key={`${entry.id}-${definition.key}`} className={cellClasses} title={mutationError || undefined}>
                                {definition.control === "select" ? (
                                  <select
                                    className={className}
                                    value={value}
                                    aria-invalid={mutationError ? true : undefined}
                                    title={mutationError || undefined}
                                    onChange={(event) => onCellChange(index, columnIndex, event.target.value)}
                                  >
                                    {definition.options?.map((option) => (
                                      <option key={`${definition.key}-${option.value}`} value={option.value}>{option.label}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <input
                                    className={className}
                                    type="text"
                                    value={value}
                                    aria-invalid={mutationError ? true : undefined}
                                    title={mutationError || undefined}
                                    onChange={(event) => onCellChange(index, columnIndex, normalizeColumnInputValue(columnIndex, event.target.value))}
                                  />
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })
        )}
        {invalidLines.length > 0 ? (
          <p className="field-help">{invalidLines.length} line(s) were skipped because they are not valid 25-column rows.</p>
        ) : null}
      </div>
    </section>
  );
}
