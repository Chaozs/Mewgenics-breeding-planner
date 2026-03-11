import {
    ACTION_LABELS,
    COLUMN_LABELS,
    createColumnEditor,
    currentCatsView,
    DEFAULT_ROOM,
    getDefaultBreedWithForGender,
    getOrderedRooms,
    groupEntriesByRoom,
    isStatColumn,
    normalizeColumnInputValue,
    parseStoredEntries,
    ROOM_ORDER,
    ROOM_SHORT_LABEL,
    serializeEntries,
    state,
    normalizeEntryColumns,
    validateMutationValue,
} from "./shared.js";

export function createCurrentCatsController(dependencies) {
    const {
        getStoredEntries,
        getStoredCatsText,
        persistEntries,
        persistEntriesWithOptions,
        pushActionHistory,
    } = dependencies;

    function applyCellValueStyling(cell, editor, columnIndex, value) {
        if (!cell || !editor) {
            return;
        }

        const styleClasses = [
            "value-male",
            "value-female",
            "value-unknown",
            "trait-filled",
            "trait-empty",
            "cell-invalid",
            "stat-good",
            "stat-bad",
        ];

        cell.classList.remove("stat-cell", ...styleClasses);
        editor.classList.remove(...styleClasses);
        editor.removeAttribute("aria-invalid");
        editor.removeAttribute("title");
        cell.removeAttribute("title");

        const normalizedValue = String(value ?? "").trim();
        const normalizedUpper = normalizedValue.toUpperCase();

        if (isStatColumn(columnIndex)) {
            cell.classList.add("stat-cell");
            if (normalizedValue === "1") {
                cell.classList.add("stat-good");
                editor.classList.add("stat-good");
            } else if (normalizedValue === "0") {
                cell.classList.add("stat-bad");
                editor.classList.add("stat-bad");
            }
            return;
        }

        if (columnIndex === 1 || columnIndex === 2) {
            if (normalizedUpper === "M") {
                editor.classList.add("value-male");
            } else if (normalizedUpper === "F") {
                editor.classList.add("value-female");
            } else if (normalizedUpper === "?") {
                editor.classList.add("value-unknown");
            }
            return;
        }

        if (columnIndex >= 10 && columnIndex <= 24) {
            if (normalizedUpper && normalizedUpper !== "X") {
                editor.classList.add("trait-filled");
            } else {
                editor.classList.add("trait-empty");
            }

            const mutationError = validateMutationValue(normalizedValue, columnIndex);
            if (mutationError) {
                cell.classList.add("cell-invalid");
                editor.classList.add("cell-invalid");
                editor.setAttribute("aria-invalid", "true");
                editor.title = mutationError;
                cell.title = mutationError;
            }
        }
    }

    function clearDragIndicators() {
        if (!currentCatsView) {
            return;
        }

        currentCatsView.querySelectorAll(".cats-row.drag-source").forEach((element) => {
            element.classList.remove("drag-source");
        });
        currentCatsView.querySelectorAll(".cats-row.drop-target").forEach((element) => {
            element.classList.remove("drop-target", "drop-after");
        });
        currentCatsView.querySelectorAll(".cats-room.drop-target-room").forEach((element) => {
            element.classList.remove("drop-target-room");
        });
    }

    function resetDragState() {
        state.dragState.sourceIndex = null;
        state.dragState.sourceRoom = "";
        state.dragState.dropTarget = null;
        clearDragIndicators();
    }

    function createRowActionButton(label, action, index, className = "row-action-btn", targetRoom = "") {
        const button = document.createElement("button");
        button.type = "button";
        button.className = className;
        button.textContent = label;
        button.dataset.action = action;
        button.dataset.index = String(index);
        if (targetRoom) {
            button.dataset.targetRoom = targetRoom;
        }
        return button;
    }

    function createRowDragHandle(index) {
        const handle = document.createElement("button");
        handle.type = "button";
        handle.className = "row-action-btn icon-btn row-drag-handle";
        handle.textContent = "\u2261";
        handle.title = "Drag to reorder or move";
        handle.setAttribute("aria-label", "Drag row");
        handle.dataset.dragIndex = String(index);
        handle.draggable = true;
        return handle;
    }

    function createRoomTargetSelect(currentRoom) {
        const select = document.createElement("select");
        select.className = "row-room-select";

        ROOM_ORDER.filter((targetRoom) => targetRoom !== currentRoom).forEach((targetRoom) => {
            const option = document.createElement("option");
            option.value = targetRoom;
            option.textContent = ROOM_SHORT_LABEL.get(targetRoom) || targetRoom.replace(/^Room\s+/i, "");
            select.appendChild(option);
        });

        return select;
    }

    function captureScrollState() {
        if (!currentCatsView) {
            return null;
        }

        return {
            windowX: window.scrollX,
            windowY: window.scrollY,
            roomTableScroll: Array.from(currentCatsView.querySelectorAll(".cats-room[data-room] .cats-table-wrap")).map(
                (tableWrap) => ({
                    room: tableWrap.closest(".cats-room")?.dataset.room || "",
                    left: tableWrap.scrollLeft,
                    top: tableWrap.scrollTop,
                })
            ),
        };
    }

    function restoreScrollState(scrollState) {
        if (!currentCatsView || !scrollState) {
            return;
        }

        scrollState.roomTableScroll.forEach(({ room, left, top }) => {
            const tableWrap = currentCatsView.querySelector(`.cats-room[data-room="${room}"] .cats-table-wrap`);
            if (tableWrap) {
                tableWrap.scrollLeft = left;
                tableWrap.scrollTop = top;
            }
        });

        window.scrollTo(scrollState.windowX, scrollState.windowY);
    }

    function renderCurrentCatsView(options = {}) {
        const { preserveScroll = false } = options;
        if (!currentCatsView) {
            return;
        }

        const currentCatsPanel = currentCatsView.closest(".current-cats-panel");

        const scrollState = preserveScroll ? captureScrollState() : null;
        currentCatsView.innerHTML = "";
        const { rows, invalidLines } = parseStoredEntries(getStoredCatsText());

        if (currentCatsPanel) {
            currentCatsPanel.classList.toggle("has-data", rows.length > 0);
        }

        if (!rows.length) {
            const empty = document.createElement("p");
            empty.className = "empty";
            empty.textContent = "No browser data yet. Parse screenshots or import spreadsheet rows.";
            currentCatsView.appendChild(empty);
            restoreScrollState(scrollState);
            return;
        }

        const grouped = groupEntriesByRoom(rows, (row, index) => ({ ...row, index }));
        const orderedRooms = getOrderedRooms(grouped);

        orderedRooms.forEach((room) => {
            const roomRows = grouped.get(room);
            if (!roomRows || roomRows.length === 0) {
                return;
            }

            const roomSection = document.createElement("section");
            roomSection.className = "cats-room";
            roomSection.dataset.room = room;

            const title = document.createElement("h3");
            title.className = "cats-room-title";
            title.textContent = `${room} (${roomRows.length})`;
            roomSection.appendChild(title);

            const tableWrap = document.createElement("div");
            tableWrap.className = "cats-table-wrap";

            const table = document.createElement("table");
            table.className = "cats-table";

            const thead = document.createElement("thead");
            const headRow = document.createElement("tr");

            const actionTh = document.createElement("th");
            actionTh.textContent = "Actions";
            actionTh.className = "cats-actions-col";
            headRow.appendChild(actionTh);

            COLUMN_LABELS.forEach((label) => {
                const th = document.createElement("th");
                th.textContent = label;
                headRow.appendChild(th);
            });

            thead.appendChild(headRow);
            table.appendChild(thead);

            const tbody = document.createElement("tbody");
            roomRows.forEach((row) => {
                const tr = document.createElement("tr");
                tr.className = "cats-row";
                tr.dataset.rowIndex = String(row.index);
                tr.dataset.room = row.room;

                const actionsTd = document.createElement("td");
                actionsTd.className = "cats-actions-cell";

                const actionsWrap = document.createElement("div");
                actionsWrap.className = "cats-actions-wrap";
                actionsWrap.appendChild(createRowDragHandle(row.index));

                const moveGroup = document.createElement("div");
                moveGroup.className = "row-move-group";
                moveGroup.appendChild(createRowActionButton("Move to", "move-room", row.index, "row-action-btn"));
                moveGroup.appendChild(createRoomTargetSelect(row.room));
                actionsWrap.appendChild(moveGroup);

                actionsWrap.appendChild(createRowActionButton("Del", "delete", row.index, "row-action-btn danger"));

                actionsTd.appendChild(actionsWrap);
                tr.appendChild(actionsTd);

                row.columns.forEach((value, columnIndex) => {
                    const td = document.createElement("td");
                    const editor = createColumnEditor(columnIndex, value, {
                        className: `cell-editor${isStatColumn(columnIndex) ? " stat-editor" : ""}`,
                        dataset: {
                            rowIndex: row.index,
                            columnIndex,
                        },
                    });
                    td.appendChild(editor);
                    applyCellValueStyling(td, editor, columnIndex, value);
                    tr.appendChild(td);
                });

                tbody.appendChild(tr);
            });

            table.appendChild(tbody);
            tableWrap.appendChild(table);
            roomSection.appendChild(tableWrap);
            currentCatsView.appendChild(roomSection);
        });

        if (invalidLines.length) {
            const invalid = document.createElement("p");
            invalid.className = "field-help";
            invalid.textContent = `${invalidLines.length} line(s) were skipped because they are not valid 25-column rows.`;
            currentCatsView.appendChild(invalid);
        }

        restoreScrollState(scrollState);
    }

    function moveEntryToRoom(entries, index, targetRoom) {
        const source = entries[index];
        if (!source || source.room === targetRoom) {
            return false;
        }

        const [entry] = entries.splice(index, 1);
        entry.room = targetRoom;

        let insertIndex = entries.length;
        for (let i = entries.length - 1; i >= 0; i -= 1) {
            if (entries[i].room === targetRoom) {
                insertIndex = i + 1;
                break;
            }
        }

        entries.splice(insertIndex, 0, entry);
        return true;
    }

    function resolveDropTargetFromEvent(event) {
        if (!currentCatsView) {
            return null;
        }

        const targetRow = event.target.closest(".cats-row[data-row-index]");
        if (targetRow && currentCatsView.contains(targetRow)) {
            const rowIndex = Number.parseInt(targetRow.dataset.rowIndex || "", 10);
            if (Number.isInteger(rowIndex)) {
                return {
                    type: "row",
                    rowIndex,
                    room: targetRow.dataset.room || DEFAULT_ROOM,
                    placeAfter: false,
                };
            }
        }

        const targetRoomSection = event.target.closest(".cats-room[data-room]");
        if (targetRoomSection && currentCatsView.contains(targetRoomSection)) {
            return {
                type: "room",
                room: targetRoomSection.dataset.room || DEFAULT_ROOM,
                placeAfter: true,
            };
        }

        return null;
    }

    function applyDragIndicators() {
        if (!currentCatsView) {
            return;
        }

        clearDragIndicators();

        if (Number.isInteger(state.dragState.sourceIndex)) {
            const sourceRow = currentCatsView.querySelector(`.cats-row[data-row-index="${state.dragState.sourceIndex}"]`);
            if (sourceRow) {
                sourceRow.classList.add("drag-source");
            }
        }

        if (!state.dragState.dropTarget) {
            return;
        }

        if (state.dragState.dropTarget.type === "row") {
            const rowElement = currentCatsView.querySelector(
                `.cats-row[data-row-index="${state.dragState.dropTarget.rowIndex}"]`
            );
            if (rowElement) {
                rowElement.classList.add("drop-target");
                if (state.dragState.dropTarget.placeAfter) {
                    rowElement.classList.add("drop-after");
                }
            }
            return;
        }

        if (state.dragState.dropTarget.type === "room") {
            const roomElement = currentCatsView.querySelector(
                `.cats-room[data-room="${state.dragState.dropTarget.room}"]`
            );
            if (roomElement) {
                roomElement.classList.add("drop-target-room");
            }
        }
    }

    function moveEntryByDrop(entries, sourceIndex, target) {
        const sourceEntry = entries[sourceIndex];
        if (!sourceEntry || !target) {
            return;
        }

        const targetRoom = target.room || sourceEntry.room;
        if (target.type === "row" && target.rowIndex === sourceIndex && targetRoom === sourceEntry.room) {
            return;
        }

        const [entry] = entries.splice(sourceIndex, 1);
        entry.room = targetRoom;

        let insertIndex;
        if (target.type === "row" && Number.isInteger(target.rowIndex)) {
            // After removing the dragged row, later indexes shift left by one.
            const adjustedTargetIndex = target.rowIndex > sourceIndex ? target.rowIndex - 1 : target.rowIndex;
            insertIndex = target.placeAfter ? adjustedTargetIndex + 1 : adjustedTargetIndex;
            if (insertIndex < 0) {
                insertIndex = 0;
            }
            if (insertIndex > entries.length) {
                insertIndex = entries.length;
            }
        } else {
            insertIndex = entries.length;
            for (let i = entries.length - 1; i >= 0; i -= 1) {
                if (entries[i].room === targetRoom) {
                    insertIndex = i + 1;
                    break;
                }
            }
        }

        entries.splice(insertIndex, 0, entry);
    }

    function handleRowDragStart(event) {
        if (!currentCatsView) {
            return;
        }

        const dragHandle = event.target.closest(".row-drag-handle[data-drag-index]");
        if (!dragHandle || !currentCatsView.contains(dragHandle)) {
            event.preventDefault();
            return;
        }

        const sourceIndex = Number.parseInt(dragHandle.dataset.dragIndex || "", 10);
        const entries = getStoredEntries();
        if (!Number.isInteger(sourceIndex) || sourceIndex < 0 || sourceIndex >= entries.length) {
            event.preventDefault();
            return;
        }

        state.dragState.sourceIndex = sourceIndex;
        state.dragState.sourceRoom = entries[sourceIndex].room;
        state.dragState.dropTarget = null;
        applyDragIndicators();

        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.dropEffect = "move";
            event.dataTransfer.setData("text/plain", String(sourceIndex));
        }
    }

    function handleRowDragOver(event) {
        if (!Number.isInteger(state.dragState.sourceIndex)) {
            return;
        }

        const dropTarget = resolveDropTargetFromEvent(event);
        if (!dropTarget) {
            return;
        }

        event.preventDefault();
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = "move";
        }

        state.dragState.dropTarget = dropTarget;
        applyDragIndicators();
    }

    function handleRowDrop(event) {
        if (!Number.isInteger(state.dragState.sourceIndex)) {
            return;
        }

        event.preventDefault();
        const sourceIndex = state.dragState.sourceIndex;
        const dropTarget = resolveDropTargetFromEvent(event) || state.dragState.dropTarget;
        if (!dropTarget) {
            resetDragState();
            return;
        }

        const entries = getStoredEntries();
        if (sourceIndex < 0 || sourceIndex >= entries.length) {
            resetDragState();
            return;
        }

        const beforeSnapshot = serializeEntries(entries);
        const catName = (entries[sourceIndex].columns[0] || "").trim() || "cat";
        moveEntryByDrop(entries, sourceIndex, dropTarget);
        const afterSnapshot = serializeEntries(entries);
        if (afterSnapshot !== beforeSnapshot) {
            const actionLabel =
                dropTarget.type === "row" && dropTarget.room === state.dragState.sourceRoom
                    ? `drag reorder in ${dropTarget.room}`
                    : `drag move to ${dropTarget.room}`;
            pushActionHistory(beforeSnapshot, `${actionLabel} (${catName})`);
            persistEntries(entries);
        }

        resetDragState();
    }

    function handleRowDragEnd() {
        resetDragState();
    }

    function handleRowAction(event) {
        if (!currentCatsView) {
            return;
        }

        const button = event.target.closest("button[data-action]");
        if (!button || !currentCatsView.contains(button)) {
            return;
        }

        const index = Number.parseInt(button.dataset.index || "", 10);
        if (!Number.isInteger(index) || index < 0) {
            return;
        }

        const entries = getStoredEntries();
        if (index >= entries.length) {
            return;
        }

        const beforeSnapshot = serializeEntries(entries);
        const catName = (entries[index].columns[0] || "").trim() || "cat";
        const action = button.dataset.action;
        let changed = false;
        let actionLabel = ACTION_LABELS[action] || "change";

        if (action === "move-room") {
            let targetRoom = button.dataset.targetRoom || "";
            if (!targetRoom) {
                const actionsWrap = button.closest(".cats-actions-wrap");
                const targetSelect = actionsWrap ? actionsWrap.querySelector(".row-room-select") : null;
                targetRoom = targetSelect ? targetSelect.value : DEFAULT_ROOM;
            }
            changed = moveEntryToRoom(entries, index, targetRoom);
            actionLabel = `${actionLabel} to ${targetRoom}`;
        } else if (action === "delete") {
            entries.splice(index, 1);
            changed = true;
        }

        if (changed) {
            pushActionHistory(beforeSnapshot, `${actionLabel} (${catName})`);
            persistEntries(entries);
        }
    }

    function getEditorFromEventTarget(target) {
        if (!currentCatsView) {
            return null;
        }

        const editor = target.closest(".cell-editor[data-row-index][data-column-index]");
        if (!editor || !currentCatsView.contains(editor)) {
            return null;
        }
        return editor;
    }

    function applyCellEdit(editor, rerenderAfter = false) {
        const rowIndex = Number.parseInt(editor.dataset.rowIndex || "", 10);
        const columnIndex = Number.parseInt(editor.dataset.columnIndex || "", 10);
        if (!Number.isInteger(rowIndex) || !Number.isInteger(columnIndex)) {
            return;
        }

        const entries = getStoredEntries();
        if (rowIndex < 0 || rowIndex >= entries.length) {
            return;
        }

        const entry = entries[rowIndex];
        const previousGender = entry.columns[1];
        const previousBreedWith = entry.columns[2];
        const nextValue = normalizeColumnInputValue(columnIndex, editor.value);

        entry.columns[columnIndex] = nextValue;
        if (columnIndex === 1) {
            const previousDefaultBreedWith = getDefaultBreedWithForGender(previousGender);
            if (!previousBreedWith || previousBreedWith === previousDefaultBreedWith) {
                entry.columns[2] = getDefaultBreedWithForGender(nextValue);
            }
        }
        normalizeEntryColumns(entry.columns);
        applyCellValueStyling(editor.closest("td"), editor, columnIndex, entry.columns[columnIndex]);

        persistEntriesWithOptions(entries, {
            rerender: rerenderAfter,
            clearRecommendationsAfter: true,
            preserveScroll: rerenderAfter,
        });
    }

    function handleCellEditInput(event) {
        const editor = getEditorFromEventTarget(event.target);
        if (!editor || editor.tagName === "SELECT") {
            return;
        }
        applyCellEdit(editor, false);
    }

    function handleCellEditChange(event) {
        const editor = getEditorFromEventTarget(event.target);
        if (!editor) {
            return;
        }
        applyCellEdit(editor, true);
    }

    return {
        renderCurrentCatsView,
        handleRowAction,
        handleCellEditInput,
        handleCellEditChange,
        handleRowDragStart,
        handleRowDragOver,
        handleRowDrop,
        handleRowDragEnd,
    };
}
