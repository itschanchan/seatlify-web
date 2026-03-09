/**
 * Invitation Designer — Save & Share
 * Handles serializing invitation state, saving via InvitationService,
 * and displaying the share modal.
 * Depends on: InvitationService (invitations.js), InvDesigner.builder
 */

window.InvDesigner = window.InvDesigner || { state: {} };

window.InvDesigner.save = (() => {

    function serializeSection(sec) {
        const type = sec.dataset.type;
        const data = { type };

        if (type === 'banner' || type === 'image') {
            data.image = sec.querySelector('img').src;

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

    return { bindSaveAndShare, serializeSection };
})();

// Expose as a global so legacy call sites (typeof bindSaveAndShare) still work
window.bindSaveAndShare = window.InvDesigner.save.bindSaveAndShare;
