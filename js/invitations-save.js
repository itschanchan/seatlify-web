/**
 * Invitation Designer — Save & Share
 * Handles serializing invitation state, saving via InvitationService,
 * and displaying the share modal.
 * Depends on: InvitationService (invitations.js), InvDesigner.builder
 */

window.InvDesigner = window.InvDesigner || { state: {} };

window.InvDesigner.save = (() => {

    // -------------------------------------------------------------------------
    // Image Storage Helpers
    // Uploaded images (base64 data URLs) are kept in their own localStorage
    // keys so they never bloat the shared `seatlify_events` key.
    // The config stores a lightweight "__imgref:<key>" pointer instead.
    // -------------------------------------------------------------------------

    const _IMG_KEY_PREFIX = 'seatlify_inv_img_';
    const _IMG_REF_MARKER = '__imgref:';
    const _IMG_SIZE_LIMIT = 3 * 1024 * 1024; // 3 MB – warn above this
    let   _imgSaveCounter = 0;

    /**
     * Remove every image key that belongs to the given event.
     * Call this at the START of a save pass so stale keys don't pile up.
     */
    function _clearEventImages(eventId) {
        const prefix   = `${_IMG_KEY_PREFIX}${eventId}_`;
        const toRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith(prefix)) toRemove.push(k);
        }
        toRemove.forEach(k => localStorage.removeItem(k));
    }

    /**
     * Persist one base64 image in its own key.
     * Returns a "__imgref:<key>" reference string, or '' when storage fails.
     */
    function _storeImage(eventId, base64Data) {
        if (base64Data.length > _IMG_SIZE_LIMIT) {
            console.warn(
                `InvDesigner: uploaded image is ${(base64Data.length / 1024 / 1024).toFixed(1)} MB. ` +
                'Consider using a smaller image to avoid storage limits.'
            );
        }

        const key = `${_IMG_KEY_PREFIX}${eventId}_${_imgSaveCounter++}`;
        try {
            localStorage.setItem(key, base64Data);
            return `${_IMG_REF_MARKER}${key}`;
        } catch (e) {
            console.error(
                'InvDesigner: localStorage quota exceeded while storing image. ' +
                'The image will not be persisted across sessions.', e
            );
            return ''; // Graceful degradation — don't crash the save
        }
    }

    // -------------------------------------------------------------------------
    // Public API for the designer orchestrator (invitations-designer.js)
    // -------------------------------------------------------------------------

    /**
     * Must be called ONCE before every save pass.
     * Clears previous image keys for the event and resets the counter so that
     * keys are deterministic and old data does not accumulate.
     */
    function beginSave(eventId) {
        _clearEventImages(eventId);
        _imgSaveCounter = 0;
    }

    /**
     * Walk a sections array (as returned by MockDB) and replace every
     * "__imgref:<key>" placeholder with the actual base64 data from localStorage.
     * Call this when loading a saved config before passing sections to the builder.
     */
    function resolveImageRefs(sections) {
        if (!Array.isArray(sections)) return sections;
        return sections.map(sec => {
            const resolved = { ...sec };

            if (
                (sec.type === 'banner' || sec.type === 'image') &&
                typeof sec.image === 'string' &&
                sec.image.startsWith(_IMG_REF_MARKER)
            ) {
                const key = sec.image.slice(_IMG_REF_MARKER.length);
                resolved.image = localStorage.getItem(key) || ''; // '' if key was evicted
            }

            // Recurse into nested section blocks
            if (Array.isArray(sec.blocks)) {
                resolved.blocks = resolveImageRefs(sec.blocks);
            }

            return resolved;
        });
    }

    // -------------------------------------------------------------------------
    // Section Serializer
    // -------------------------------------------------------------------------

    function serializeSection(sec) {
        const type = sec.dataset.type;
        const data = { type };

        if (type === 'banner' || type === 'image') {
            const imgEl  = sec.querySelector('img');
            const imgSrc = imgEl ? imgEl.src : '';

            if (imgSrc.startsWith('data:')) {
                // Base64 upload — store separately to keep the events key small
                const eventId = localStorage.getItem('seatlify_current_event_id');
                data.image = eventId ? _storeImage(eventId, imgSrc) : '';
            } else {
                // External URL — safe to store inline
                data.image = imgSrc;
            }

        } else if (type === 'header') {
            data.title       = sec.querySelector('h1').innerHTML;
            data.host        = sec.querySelector('.lead').innerHTML;
            data.description = sec.querySelector('.invitation-description').innerHTML;

        } else if (type === 'section') {
            data.title  = sec.querySelector('h3').innerHTML;
            data.blocks = [];
            const innerContainer = sec.querySelector('.section-blocks-container');
            if (innerContainer) {
                [...innerContainer.children].forEach(child => {
                    if (child.classList.contains('invitation-section')) {
                        data.blocks.push(serializeSection(child));
                    }
                });
            }

        } else if (type === 'form' || type === 'rsvp_form') {
            data.title  = sec.querySelector('.form-title').innerHTML;
            data.fields = [];
            sec.querySelectorAll('.form-field-item').forEach(field => {
                const fType = field.dataset.fieldType;
                if (fType === 'text') {
                    data.fields.push({ type: 'text', label: field.querySelector('label').innerHTML });
                } else if (fType === 'seat') {
                    data.fields.push({ type: 'seat', viewPreference: field.querySelector('.seat-view-preference').value });
                }
            });

        } else if (type === 'question') {
            data.question     = sec.querySelector('.question-title')?.innerHTML || '';
            data.questionType = sec.querySelector('.question-block')?.dataset.questionType || 'short_answer';

            if (['multiple_choice', 'checkboxes', 'dropdown'].includes(data.questionType)) {
                data.options = [];
                sec.querySelectorAll('.question-options-list .d-flex').forEach(opt => {
                    const label = opt.querySelector('[contenteditable="true"]')?.innerHTML || '';
                    if (label) data.options.push(label);
                });
            }

            data.buttons = [];
            sec.querySelectorAll('.question-buttons-list .question-custom-btn').forEach(btn => {
                data.buttons.push(btn.textContent);
            });
        }

        return data;
    }

    // -------------------------------------------------------------------------
    // Save & Share Modal Binding
    // -------------------------------------------------------------------------

    function bindSaveAndShare(currentEventData, InvitationService) {
        const btnSave      = document.getElementById('btnSaveInvitation');
        const shareModalEl = document.getElementById('saveShareModal');
        const shareInput   = document.getElementById('shareLinkInput');
        const btnCopy      = document.getElementById('btnCopyLink');
        const copyAlert    = document.getElementById('copySuccessAlert');

        if (!btnSave || !shareModalEl) return;

        const shareModal = new bootstrap.Modal(shareModalEl);

        btnSave.addEventListener('click', () => {
            const eventId = localStorage.getItem('seatlify_current_event_id');
            if (!eventId) {
                alert('No active event found.');
                return;
            }

            // Clear stale image keys and reset counter before serializing
            beginSave(eventId);

            const sections  = [];
            const container = document.getElementById('invitationSectionsContainer');
            [...container.children].forEach(sec => {
                if (sec.classList.contains('invitation-section')) {
                    sections.push(serializeSection(sec));
                }
            });

            const config = {
                host: document.getElementById('invDesignHost')?.innerHTML || '',
                sections
            };

            InvitationService.saveConfig(eventId, config)
                .then(data => {
                    if (data.success) {
                        let baseUrl = window.location.href.split('?')[0];
                        baseUrl = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);
                        if (!baseUrl.endsWith('/invitations/')) baseUrl += 'invitations/';

                        const link = `${baseUrl}public-view-invitation.html?event=${eventId}&share=${Date.now()}`;
                        shareInput.value = link;
                        if (copyAlert) copyAlert.classList.add('d-none');
                        shareModal.show();
                    } else {
                        alert('Failed to save configuration: ' + data.message);
                    }
                })
                .catch(err => {
                    console.error(err);
                    alert('Network error while saving.');
                });
        });

        if (btnCopy) {
            btnCopy.addEventListener('click', () => {
                shareInput.select();
                navigator.clipboard.writeText(shareInput.value).then(() => {
                    if (copyAlert) copyAlert.classList.remove('d-none');
                    setTimeout(() => { if (copyAlert) copyAlert.classList.add('d-none'); }, 3000);
                });
            });
        }

        const btnSendInvite = document.getElementById('btnSendInvite');
        if (btnSendInvite) {
            btnSendInvite.addEventListener('click', async () => {
                const email = document.getElementById('inviteEmailInput').value;
                const link  = shareInput.value;
                if (!email || !link) return alert('Please enter an email address.');

                const title = currentEventData ? currentEventData.title : 'Event';
                const date  = currentEventData ? currentEventData.start_datetime : '';

                const originalText = btnSendInvite.innerHTML;
                btnSendInvite.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
                btnSendInvite.disabled  = true;

                const res = await InvitationService.sendInvite(email, title, date, link);

                btnSendInvite.innerHTML = originalText;
                btnSendInvite.disabled  = false;

                alert(res.success ? 'Invitation sent successfully!' : 'Failed to send: ' + res.message);
                if (res.success) document.getElementById('inviteEmailInput').value = '';
            });
        }
    }

    return { beginSave, resolveImageRefs, serializeSection, bindSaveAndShare };
})();

// Expose as a global so legacy call sites (typeof bindSaveAndShare) still work
window.bindSaveAndShare = window.InvDesigner.save.bindSaveAndShare;
