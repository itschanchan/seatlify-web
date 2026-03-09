/**
 * Invitation Designer — History Manager
 * Handles undo/redo state with localStorage persistence.
 */

window.InvDesigner = window.InvDesigner || { state: {} };

window.InvDesigner.history = {
    undoStack: [],
    redoStack: [],
    maxHistory: 30,
    rebindCallback: () => {},

    init(rebindCallback) {
        this.rebindCallback = rebindCallback;

        const currentEventId = localStorage.getItem('seatlify_current_event_id');
        if (currentEventId) {
            try {
                const savedUndo = localStorage.getItem(`seatlify_invitation_undo_stack_${currentEventId}`);
                const savedRedo = localStorage.getItem(`seatlify_invitation_redo_stack_${currentEventId}`);
                if (savedUndo) this.undoStack = JSON.parse(savedUndo);
                if (savedRedo) this.redoStack = JSON.parse(savedRedo);
            } catch (e) {
                console.error('Failed to parse history stacks from localStorage', e);
                this.undoStack = [];
                this.redoStack = [];
            }
        }
        this.updateButtons();
    },

    saveState() {
        const container = document.getElementById('invitationSectionsContainer');
        if (!container) return;

        // Persist input values to attributes so they survive innerHTML serialization
        container.querySelectorAll('input, textarea, select').forEach(input => {
            if (input.type === 'checkbox' || input.type === 'radio') {
                if (input.checked) input.setAttribute('checked', 'checked');
                else input.removeAttribute('checked');
            } else if (input.tagName === 'SELECT') {
                input.querySelectorAll('option').forEach(opt => {
                    if (opt.selected) opt.setAttribute('selected', 'selected');
                    else opt.removeAttribute('selected');
                });
            } else {
                input.setAttribute('value', input.value);
                if (input.tagName === 'TEXTAREA') input.textContent = input.value;
            }
        });

        const currentState = container.innerHTML;

        if (this.undoStack.length > 0 && this.undoStack[this.undoStack.length - 1] === currentState) {
            return;
        }

        this.redoStack = [];
        this.undoStack.push(currentState);

        if (this.undoStack.length > this.maxHistory) {
            this.undoStack.shift();
        }

        const currentEventId = localStorage.getItem('seatlify_current_event_id');
        if (currentEventId) {
            localStorage.setItem(`seatlify_invitation_draft_${currentEventId}`, currentState);
            localStorage.setItem(`seatlify_invitation_undo_stack_${currentEventId}`, JSON.stringify(this.undoStack));
            localStorage.setItem(`seatlify_invitation_redo_stack_${currentEventId}`, JSON.stringify(this.redoStack));
        }

        this.updateButtons();
    },

    undo() {
        if (this.undoStack.length <= 1) return;

        const container = document.getElementById('invitationSectionsContainer');
        if (!container) return;

        this.redoStack.push(this.undoStack.pop());
        const prevState = this.undoStack[this.undoStack.length - 1];
        container.innerHTML = prevState;

        const currentEventId = localStorage.getItem('seatlify_current_event_id');
        if (currentEventId) {
            localStorage.setItem(`seatlify_invitation_undo_stack_${currentEventId}`, JSON.stringify(this.undoStack));
            localStorage.setItem(`seatlify_invitation_redo_stack_${currentEventId}`, JSON.stringify(this.redoStack));
            localStorage.setItem(`seatlify_invitation_draft_${currentEventId}`, prevState);
        }

        if (typeof this.rebindCallback === 'function') this.rebindCallback();
        this.updateButtons();
    },

    redo() {
        if (this.redoStack.length === 0) return;

        const container = document.getElementById('invitationSectionsContainer');
        if (!container) return;

        const nextState = this.redoStack.pop();
        this.undoStack.push(nextState);
        container.innerHTML = nextState;

        const currentEventId = localStorage.getItem('seatlify_current_event_id');
        if (currentEventId) {
            localStorage.setItem(`seatlify_invitation_undo_stack_${currentEventId}`, JSON.stringify(this.undoStack));
            localStorage.setItem(`seatlify_invitation_redo_stack_${currentEventId}`, JSON.stringify(this.redoStack));
            localStorage.setItem(`seatlify_invitation_draft_${currentEventId}`, nextState);
        }

        if (typeof this.rebindCallback === 'function') this.rebindCallback();
        this.updateButtons();
    },

    clear() {
        this.undoStack = [];
        this.redoStack = [];
        const currentEventId = localStorage.getItem('seatlify_current_event_id');
        if (currentEventId) {
            localStorage.removeItem(`seatlify_invitation_undo_stack_${currentEventId}`);
            localStorage.removeItem(`seatlify_invitation_redo_stack_${currentEventId}`);
        }
        this.updateButtons();
    },

    updateButtons() {
        const btnUndo = document.getElementById('btnUndoInvitation');
        const btnRedo = document.getElementById('btnRedoInvitation');
        if (btnUndo) btnUndo.disabled = this.undoStack.length <= 1;
        if (btnRedo) btnRedo.disabled = this.redoStack.length === 0;
    }
};
