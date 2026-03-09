/**
 * Invitation Designer — Main Orchestrator
 * Wires together history, builder, and save modules.
 * Handles initialization, drag/drop from toolbar, preview, and event data loading.
 *
 * Depends on (load in order):
 *   invitations-history.js
 *   invitations-builder.js
 *   invitations-save.js
 *   invitations.js  (InvitationService)
 */

(async function () {

    /**
     * Debounce utility to limit the rate at which a function gets called.
     */
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    /**
     * A persistent history manager for the invitation designer.
     * Handles undo/redo functionality and saves the history stack to localStorage
     * to persist across page reloads.
     */
    const invitationHistoryManager = {
        undoStack: [],
        redoStack: [],
        maxHistory: 50,
        rebindCallback: null,
        autoSaveCallback: null, // Callback for auto-saving layout changes

        getStorageKey() {
            const eventId = localStorage.getItem('seatlify_current_event_id');
            return eventId ? `seatlify_invitation_history_${eventId}` : null;
        },

        init(rebindCallback, autoSaveCallback = null, initialContent = '') {
            this.rebindCallback = rebindCallback;
            this.autoSaveCallback = autoSaveCallback;
            this.undoStack = [initialContent];
            this.redoStack = [];
            this.updateButtons();
        },

        _saveToStorage() {
            // Persistence is now handled by the auto-save mechanism, not the history manager.
            // This prevents conflicts between session history and the saved state.
            return;
        },

        loadLastStateFromStorage() {
            // This function is no longer needed as we load from event config.
            return null;
        },

        saveState() {
            const container = document.getElementById('invitationSectionsContainer');
            if (!container) return;

            // 1. Sync Form Inputs (Value -> Attribute) so they persist in innerHTML
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

            // 2. Sync Question Options (DOM Text -> dataset.options)
            container.querySelectorAll('.question-block').forEach(block => {
                const answerArea = block.querySelector('.question-answer-area');
                if (answerArea) {
                    const options = [];
                    answerArea.querySelectorAll('.question-options-list .d-flex div[contenteditable="true"]').forEach(div => {
                        options.push(div.innerText);
                    });
                    if (options.length > 0) answerArea.dataset.options = JSON.stringify(options);
                }
            });

            // 3. Sync Images (ensure src attribute matches current state for uploaded images)
            container.querySelectorAll('img').forEach(img => {
                if (img.src.startsWith('data:')) img.setAttribute('src', img.src);
            });

            const currentState = container.innerHTML;

            // Don't save if nothing has changed
            if (this.undoStack.length > 0 && this.undoStack[this.undoStack.length - 1] === currentState) {
                return;
            }

            this.redoStack = [];
            this.undoStack.push(currentState);
            if (this.undoStack.length > this.maxHistory) this.undoStack.shift();

            this._saveToStorage();
            this.updateButtons();

            // Trigger the auto-save callback if it exists
            if (typeof this.autoSaveCallback === 'function') {
                this.autoSaveCallback();
            }
        },

        undo() {
            if (this.undoStack.length <= 1) return;
            const container = document.getElementById('invitationSectionsContainer');
            if (!container) return;
            this.redoStack.push(this.undoStack.pop());
            container.innerHTML = this.undoStack[this.undoStack.length - 1];
            this._saveToStorage();
            if (this.rebindCallback) this.rebindCallback();
            this.updateButtons();
        },

        redo() {
            if (this.redoStack.length === 0) return;
            const container = document.getElementById('invitationSectionsContainer');
            if (!container) return;
            const stateToRestore = this.redoStack.pop();
            this.undoStack.push(stateToRestore);
            container.innerHTML = stateToRestore;
            this._saveToStorage();
            if (this.rebindCallback) this.rebindCallback();
            this.updateButtons();
        },

        clear() {
            this.undoStack = [];
            this.redoStack = [];
            // No need to touch localStorage as history is session-only now.
        },

        updateButtons() {
            const btnUndo = document.getElementById('btnUndoInvitation');
            const btnRedo = document.getElementById('btnRedoInvitation');
            if (btnUndo) btnUndo.disabled = this.undoStack.length <= 1;
            if (btnRedo) btnRedo.disabled = this.redoStack.length === 0;
        }
    };

    // This will overwrite any existing history object from invitations-history.js
    window.InvDesigner.history = invitationHistoryManager;

    // Convenience aliases
    const history = window.InvDesigner.history;
    const builder = window.InvDesigner.builder;
    const save    = window.InvDesigner.save;
    const state   = window.InvDesigner.state;

    /**
     * This function performs the actual serialization and saving of the invitation layout.
     * It's designed to be synchronous by using MockDB directly, which is crucial for
     * reliability when called during `beforeunload` or `pagehide` events.
     */
    const saveLayoutNow = () => {
        const eventId = localStorage.getItem('seatlify_current_event_id');
        if (!eventId) return;

        const container = document.getElementById('invitationSectionsContainer');
        if (!container) return;

        // Clear stale image keys and reset counter BEFORE serializing so that
        // base64 uploads are stored in dedicated keys instead of inside the
        // seatlify_events blob (prevents localStorage quota errors).
        save.beginSave(eventId);

        const sections  = [];
        [...container.children].forEach(sec => {
            if (sec.classList.contains('invitation-section')) {
                sections.push(save.serializeSection(sec));
            }
        });

        const config = {
            host: document.getElementById('invDesignHost')?.innerHTML || '',
            sections
        };

        MockDB.updateEvent(eventId, { invitation_config: config });
        console.log('Invitation layout saved synchronously.');
    };

    // Use the global InvitationService, or a safe stub if not yet loaded
    const InvitationService = window.InvitationService || {
        sendInvite: async () => ({ success: false, message: 'InvitationService not loaded.' }),
        saveConfig: async () => ({ success: false, message: 'InvitationService not loaded.' })
    };

    // -------------------------------------------------------------------------
    // Event binding helpers
    // -------------------------------------------------------------------------

    function bindToolbarDragAndDrop() {
        document.querySelectorAll('.draggable-tool').forEach(item => {
            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('toolType', item.dataset.type);
                e.dataTransfer.effectAllowed = 'copy';
            });
        });
    }

    function bindUndoRedoControls() {
        const btnUndo = document.getElementById('btnUndoInvitation');
        const btnRedo = document.getElementById('btnRedoInvitation');
        if (btnUndo) btnUndo.addEventListener('click', () => history.undo());
        if (btnRedo) btnRedo.addEventListener('click', () => history.redo());
    }

    function bindGlobalUndoRedoKeys() {
        document.addEventListener('keydown', (e) => {
            if (e.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
            if (e.ctrlKey && e.key.toLowerCase() === 'z' && !e.shiftKey) {
                e.preventDefault();
                history.undo();
            } else if (e.ctrlKey && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
                e.preventDefault();
                history.redo();
            }
        });
    }

    function bindPreviewButton() {
        const previewBtn  = document.getElementById('btnPreviewInvitation');
        const designer    = document.getElementById('invitationDesigner');
        const modalEl     = document.getElementById('invitationPreviewModal');
        if (!previewBtn || !designer || !modalEl) return;

        const modal          = new bootstrap.Modal(modalEl);
        const previewWrapper = document.getElementById('previewContentWrapper');

        previewBtn.addEventListener('click', () => {
            const previewNode = designer.cloneNode(true);

            previewNode.removeAttribute('id');
            previewNode.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));

            previewNode.querySelectorAll('[contenteditable="true"]').forEach(el => {
                el.removeAttribute('contenteditable');
                el.style.outline = 'none';
                el.style.backgroundColor = '';
            });

            previewNode.querySelector('.position-absolute.top-0.end-0')?.remove();
            previewNode.querySelectorAll('.section-drag-handle').forEach(el => el.remove());
            previewNode.querySelectorAll('.btn-delete-section').forEach(el => el.remove());

            // Remove editor-only section wrappers and titles for a clean preview
            previewNode.querySelectorAll('.invitation-section[data-type="section"] > h3').forEach(el => el.remove());
            previewNode.querySelectorAll('.section-blocks-container').forEach(el => {
                el.style.border = 'none';
                el.style.padding = '0';
                el.style.backgroundColor = 'transparent';
            });

            previewNode.style.backgroundColor = 'var(--bg-panel)';
            previewNode.style.borderRadius    = '12px';
            previewNode.style.boxShadow       = '0 10px 30px rgba(0,0,0,0.1)';
            previewNode.style.overflow        = 'hidden';

            previewNode.querySelectorAll('.invitation-section').forEach(el => {
                el.style.border          = 'none';
                el.style.margin          = '0';
                el.style.borderRadius    = '0';
                el.style.backgroundColor = 'transparent';
            });

            previewWrapper.innerHTML = '';
            previewWrapper.appendChild(previewNode);
            modal.show();
        });
    }

    function rebindAllInvitationEvents() {
        builder.initSortable();
        builder.bindSectionControls();

        document.querySelectorAll('.form-builder-wrapper').forEach(fb => {
            builder.initFormBuilder(fb, null);
        });
        document.querySelectorAll('.question-block').forEach(qb => {
            builder.renderQuestionInput(qb);
        });
    }

    function bindDelegatedBannerUpload() {
        const container = document.getElementById('invitationSectionsContainer');
        if (!container) return;

        container.addEventListener('change', e => {
            if (e.target.matches('input[type="file"]') && e.target.closest('.invitation-banner')) {
                const banner = e.target.closest('.invitation-banner');
                const preview = banner.querySelector('img');
                const file = e.target.files[0];

                if (file && preview) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        preview.src = ev.target.result;
                        preview.setAttribute('src', ev.target.result);
                        if (window.InvDesigner.history) {
                            window.InvDesigner.history.saveState();
                        }
                    };
                    reader.readAsDataURL(file);
                }
            }
        });
    }

    function bindDelegatedSectionControls() {
        const container = document.getElementById('invitationSectionsContainer');
        if (!container) return;

        container.addEventListener('click', e => {
            // Use event delegation to handle clicks on delete buttons
            const deleteBtn = e.target.closest('.btn-delete-section');

            if (deleteBtn) {
                e.preventDefault();
                e.stopPropagation();
                const sectionToDelete = deleteBtn.closest('.invitation-section');
                if (sectionToDelete) {
                    history.saveState(); // Save state before deleting to allow undo
                    sectionToDelete.remove();
                    history.saveState(); // Save state after deleting for persistence
                }
            }
        });
    }

    // -------------------------------------------------------------------------
    // Container-level drag & drop (toolbar → canvas)
    // -------------------------------------------------------------------------

    function bindContainerDropZone() {
        const sectionsContainer = document.getElementById('invitationSectionsContainer');
        if (!sectionsContainer) return;

        sectionsContainer.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            sectionsContainer.style.border = '2px dashed var(--primary)';

            const scrollSpeed = 15;
            const scrollZone  = window.innerHeight * 0.15;
            if (e.clientY < scrollZone) {
                window.scrollBy(0, -scrollSpeed);
            } else if (e.clientY > window.innerHeight - scrollZone) {
                window.scrollBy(0, scrollSpeed);
            }
        });

        sectionsContainer.addEventListener('dragleave', () => {
            sectionsContainer.style.border = 'none';
        });

        sectionsContainer.addEventListener('drop', (e) => {
            e.preventDefault();
            sectionsContainer.style.border = 'none';
            const type = e.dataTransfer.getData('toolType');
            if (type) {
                history.saveState();
                const nestedContainer  = e.target.closest('.section-blocks-container');
                const targetContainer  = nestedContainer || sectionsContainer;
                const afterElement     = builder.getDragAfterElement(targetContainer, e.clientY);
                builder.createNewSection(type, null, afterElement, targetContainer);
                history.saveState(); // Save state after adding for persistence
            }
        });
    }

    // -------------------------------------------------------------------------
    // Initialization
    // -------------------------------------------------------------------------

    async function initializeDesigner() {
        // A debounced version of the save function for use during normal editing.
        const debouncedAutoSave = debounce(saveLayoutNow, 1500); // Auto-save 1.5s after a change

        // --- Load toolbar HTML ---
        const toolsContainer = document.getElementById('invitations-designer-tools-container');
        if (toolsContainer) {
            try {
                const res  = await fetch('invitations/invitations-designer-tools.html');
                if (!res.ok) throw new Error('Failed to fetch tools');
                const html = await res.text();

                const parser = new DOMParser();
                const doc    = parser.parseFromString(html, 'text/html');
                // Strip any inline <script> — logic is now in invitations-designer.js
                doc.querySelectorAll('script').forEach(s => s.remove());
                toolsContainer.innerHTML = doc.body.innerHTML;

                bindToolbarDragAndDrop();
                bindUndoRedoControls();
                bindGlobalUndoRedoKeys();
            } catch (err) {
                console.error('Failed to load invitation designer tools:', err);
                toolsContainer.innerHTML = '<div class="alert alert-danger">Failed to load designer tools.</div>';
            }
        }

        // --- Load save/share modal HTML ---
        const saveModalContainer = document.getElementById('saveShareModalContainer');
        if (saveModalContainer) {
            try {
                const res  = await fetch('invitations/save-invitation-modal.html');
                if (!res.ok) throw new Error('Save modal HTML not found');
                const html = await res.text();

                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = html;
                // Strip inline <script> — logic lives in invitations-save.js
                tempDiv.querySelectorAll('script').forEach(s => s.remove());
                saveModalContainer.innerHTML = tempDiv.innerHTML;

                // bindSaveAndShare is now loaded via <script src="invitations-save.js">
                save.bindSaveAndShare(state.currentEventData, InvitationService);
            } catch (err) {
                console.error('Error loading save modal:', err);
            }
        }

        // --- Load preview modal HTML ---
        const modalContainer = document.getElementById('invitationPreviewModalContainer');
        if (modalContainer) {
            try {
                const res  = await fetch('invitations/invitation-preview-modal.html');
                if (!res.ok) throw new Error('Preview modal HTML not found');
                modalContainer.innerHTML = await res.text();
                bindPreviewButton();
            } catch (err) {
                console.error('Error loading preview modal:', err);
            }
        }

        // --- Persist state across SPA navigations ---
        if (typeof window.saveInvitationState === 'function') {
            window.removeEventListener('beforeunload', window.saveInvitationState);
            window.removeEventListener('pagehide', window.saveInvitationState);
        }
        // This is called by dashboard-loader.js on tab switch and by the browser on page close/refresh.
        // It now points to our direct, synchronous save function to ensure data is not lost.
        window.saveInvitationState = saveLayoutNow;
        window.addEventListener('beforeunload', window.saveInvitationState);
        window.addEventListener('pagehide', window.saveInvitationState);

        // --- Load Layout ---
        // Populate the designer canvas from the event's saved configuration.
        // This is the "source of truth" on page load.
        const container = document.getElementById('invitationSectionsContainer');
        const currentEventId = localStorage.getItem('seatlify_current_event_id');

        if (currentEventId && typeof MockDB !== 'undefined' && container) {
            const event = MockDB.getEvents().find(e => e.event_id == currentEventId);
            if (event) {
                state.currentEventData = event;

                // Prioritize loading from the persistent `invitation_config`
                if (event.invitation_config?.sections?.length > 0) {
                    console.log("Loading layout from persistent event.invitation_config.");
                    container.innerHTML = ''; // Clear default content
                    // Resolve __imgref: pointers back to base64 data before rendering
                    const resolvedSections = save.resolveImageRefs(event.invitation_config.sections);
                    resolvedSections.forEach(sectionData => {
                        builder.createNewSection(sectionData.type, sectionData);
                    });
                } else {
                    // If no config, use default content and populate dynamic fields from event metadata
                    console.log("No saved layout found. Using default and populating from event metadata.");
                    const titleEl = document.getElementById('invDesignTitle');
                    const descEl  = document.getElementById('invDesignDesc');
                    const dateEl  = document.getElementById('invDesignDate');
                    const timeEl  = document.getElementById('invDesignTime');
                    const venueEl = document.getElementById('invDesignVenue');
                    if (titleEl) titleEl.textContent = event.title;
                    const start = new Date(event.start_datetime);
                    const end   = event.end_datetime ? new Date(event.end_datetime) : null;
                    if (dateEl) dateEl.innerHTML = `<i class="bi bi-calendar3 me-2"></i>${start.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
                    if (timeEl) {
                        let timeStr = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
                        if (end) timeStr += ' - ' + end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
                        timeEl.innerHTML = `<i class="bi bi-clock me-2"></i>${timeStr}`;
                    }
                    const venueName = event.venue_name || (MockDB.getVenueById(event.venue_id) || {}).name || 'Unknown Venue';
                    if (venueEl) venueEl.innerHTML = `<i class="bi bi-geo-alt-fill me-2"></i>${venueName}`;
                    if (descEl) descEl.innerHTML = `<p>${event.description || 'Join us for this event!'}</p>`;
                }
            }
        }

        // Initialize history AFTER the DOM is settled with the correct layout.
        // The history manager is session-only and its callback triggers the debounced auto-save.
        history.init(rebindAllInvitationEvents, debouncedAutoSave, container.innerHTML);

        // --- Bind canvas drop zone ---
        bindContainerDropZone();
        bindDelegatedSectionControls();
        bindDelegatedBannerUpload();

        // --- Populate default RSVP form fields on fresh load ---
        const defaultFormBuilder = document.querySelector('[data-section="rsvp_form"] .form-builder-wrapper');
        if (defaultFormBuilder && defaultFormBuilder.querySelector('.form-fields-list').children.length === 0) {
            builder.initFormBuilder(defaultFormBuilder, [
                { type: 'text', label: 'Full Name' },
                { type: 'text', label: 'Email Address' },
                { type: 'text', label: 'Age' },
                { type: 'seat', viewPreference: 'chart' }
            ]);
        }

        // --- Final bind & initial history snapshot ---
        rebindAllInvitationEvents();

        document.getElementById('invitationSectionsContainer')
            ?.addEventListener('blur', (e) => {
                if (e.target.isContentEditable) history.saveState();
            }, true);
    }

    // --- Start ---
    await initializeDesigner();

})();
