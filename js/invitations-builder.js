/**
 * Invitation Designer — Section & Form Builder
 * Handles creating, rendering, and binding all section and form types.
 * Depends on: invitations-history.js (window.InvDesigner.history)
 */

window.InvDesigner = window.InvDesigner || { state: {} };

window.InvDesigner.builder = (() => {

    const history = () => window.InvDesigner.history;
    const state   = () => window.InvDesigner.state;
    let mainSortable = null;

    // -------------------------------------------------------------------------
    // Question blocks
    // -------------------------------------------------------------------------

    function bindQuestionOptionEvents(context) {
        context.querySelectorAll('.btn-add-option').forEach(btn => {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);

            newBtn.addEventListener('click', (e) => {
                history().saveState();
                const answerArea   = e.target.closest('.question-answer-area');
                const list         = answerArea.querySelector('.question-options-list');
                const questionBlock = e.target.closest('.question-block');
                const type         = questionBlock.dataset.questionType;
                const isRadio      = type === 'multiple_choice';
                const inputType    = isRadio ? 'radio' : 'checkbox';
                const optionName   = list.querySelector('input')?.name || `option_${Date.now()}`;

                const optionWrapper = document.createElement('div');
                optionWrapper.className = 'd-flex align-items-center mb-2';
                optionWrapper.innerHTML = `
                    <input class="form-check-input" type="${inputType}" name="${optionName}" disabled>
                    <div contenteditable="true" class="ms-2 flex-grow-1" style="color: var(--text-main);">New Option</div>
                    <button class="btn btn-sm btn-link text-danger btn-remove-option" title="Remove option"><i class="bi bi-x-circle"></i></button>
                `;
                if (type === 'dropdown') {
                    optionWrapper.querySelector('input').style.display = 'none';
                }
                list.appendChild(optionWrapper);
                bindQuestionOptionEvents(list);
                history().saveState();
            });
        });

        context.querySelectorAll('.btn-remove-option').forEach(btn => {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            newBtn.addEventListener('click', (e) => {
                history().saveState();
                e.target.closest('.d-flex').remove();
                history().saveState();
            });
        });
    }

    function renderQuestionInput(questionBlock) {
        const answerArea  = questionBlock.querySelector('.question-answer-area');
        const typeSelect  = questionBlock.querySelector('.question-type-select');
        if (!answerArea || !typeSelect) return;

        const type         = typeSelect.value;
        const savedOptions = JSON.parse(answerArea.dataset.options || '[]');
        answerArea.dataset.options = '[]';

        questionBlock.dataset.questionType = type;
        answerArea.innerHTML = '';

        switch (type) {
            case 'short_answer':
                answerArea.innerHTML = `<input type="text" class="form-control" placeholder="Short answer text" disabled style="background-color: var(--bg-input); border-color: var(--border-color);">`;
                break;

            case 'paragraph':
                answerArea.innerHTML = `<textarea class="form-control" rows="3" placeholder="Long answer text" disabled style="background-color: var(--bg-input); border-color: var(--border-color);"></textarea>`;
                break;

            case 'multiple_choice':
            case 'checkboxes':
            case 'dropdown': {
                const isRadio      = type === 'multiple_choice';
                const inputType    = isRadio ? 'radio' : 'checkbox';
                const optionName   = `option_${Date.now()}`;
                const optionsToRender = savedOptions.length > 0 ? savedOptions : ['Option 1', 'Option 2'];

                const optionsContainer = document.createElement('div');
                optionsContainer.className = 'question-options-list';

                optionsToRender.forEach(optText => {
                    const optionWrapper = document.createElement('div');
                    optionWrapper.className = 'd-flex align-items-center mb-2';
                    optionWrapper.innerHTML = `
                        <input class="form-check-input" type="${inputType}" name="${optionName}" disabled>
                        <div contenteditable="true" class="ms-2 flex-grow-1" style="color: var(--text-main);">${optText}</div>
                        <button class="btn btn-sm btn-link text-danger btn-remove-option" title="Remove option"><i class="bi bi-x-circle"></i></button>
                    `;
                    optionsContainer.appendChild(optionWrapper);
                });

                answerArea.appendChild(optionsContainer);

                const addOptionBtn = document.createElement('button');
                addOptionBtn.className = 'btn btn-sm btn-outline-secondary mt-2 btn-add-option';
                addOptionBtn.innerHTML = '<i class="bi bi-plus"></i> Add Option';
                answerArea.appendChild(addOptionBtn);

                if (type === 'dropdown') {
                    optionsContainer.querySelectorAll('input').forEach(inp => inp.style.display = 'none');
                    const dropdownInfo = document.createElement('div');
                    dropdownInfo.className = 'form-text text-muted mt-2';
                    dropdownInfo.innerHTML = '<i class="bi bi-info-circle"></i> Options will be displayed as a dropdown list for guests.';
                    answerArea.appendChild(dropdownInfo);
                }
                break;
            }
        }
        bindQuestionOptionEvents(answerArea);
    }

    // -------------------------------------------------------------------------
    // Form builder
    // -------------------------------------------------------------------------

    function addFieldToBuilder(container, fieldData) {
        const wrapper = document.createElement('div');
        wrapper.className = 'form-field-item mb-3 position-relative p-3 border rounded';
        wrapper.style.backgroundColor = 'var(--bg-muted)';
        wrapper.style.paddingLeft = '2.5rem';
        wrapper.dataset.fieldType = fieldData.type;

        let innerHTML = '';
        if (fieldData.type === 'text') {
            innerHTML = `
                <label class="form-label" contenteditable="true" style="color: var(--text-muted);">${fieldData.label}</label>
                <input type="text" class="form-control" disabled placeholder="" style="background-color: var(--bg-panel); border-color: var(--border-color);">
            `;
        } else if (fieldData.type === 'seat') {
            const pref = fieldData.viewPreference || 'chart';
            innerHTML = `
                <label class="form-label" style="color: var(--text-muted);">Seat Reservation</label>
                <div class="input-group">
                    <input type="text" class="form-control" placeholder="No seat selected" disabled style="background-color: var(--bg-panel); border-color: var(--border-color);">
                    <button class="btn btn-outline-primary dropdown-toggle btn-seat-view-config" type="button" data-bs-toggle="dropdown">
                        <i class="bi bi-grid-3x3"></i> Config View
                    </button>
                    <ul class="dropdown-menu dropdown-menu-end">
                        <li><h6 class="dropdown-header">Guest View Preference</h6></li>
                        <li><a class="dropdown-item ${pref === 'chart' ? 'active' : ''}" href="#" data-view="chart">Chart View</a></li>
                        <li><a class="dropdown-item ${pref === 'table' ? 'active' : ''}" href="#" data-view="table">Table View</a></li>
                        <li><a class="dropdown-item ${pref === 'map'   ? 'active' : ''}" href="#" data-view="map">Map View</a></li>
                    </ul>
                </div>
                <input type="hidden" class="seat-view-preference" value="${pref}">
            `;
        }

        wrapper.innerHTML = innerHTML;

        const dragHandle = document.createElement('div');
        dragHandle.className = 'form-field-drag-handle position-absolute top-50 start-0 translate-middle-y ms-2 text-muted';
        dragHandle.innerHTML = '<i class="bi bi-grip-vertical"></i>';
        dragHandle.style.cursor = 'grab';
        wrapper.prepend(dragHandle);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-sm btn-link text-danger position-absolute top-0 end-0';
        deleteBtn.innerHTML = '<i class="bi bi-x-lg"></i>';
        deleteBtn.title = 'Remove Field';
        deleteBtn.onclick = () => {
            history().saveState();
            if (fieldData.type === 'seat') {
                const builderWrapper = wrapper.closest('.form-builder-wrapper');
                if (builderWrapper) {
                    const addSeatBtn = builderWrapper.querySelector('.btn-add-seat-res');
                    if (addSeatBtn) addSeatBtn.disabled = false;
                }
            }
            wrapper.remove();
            history().saveState();
        };
        wrapper.appendChild(deleteBtn);

        if (fieldData.type === 'seat') {
            const dropdownItems = wrapper.querySelectorAll('.dropdown-item');
            const hiddenInput   = wrapper.querySelector('.seat-view-preference');
            dropdownItems.forEach(item => {
                item.addEventListener('click', (e) => {
                    e.preventDefault();
                    history().saveState();
                    hiddenInput.value = item.dataset.view;
                    wrapper.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('active'));
                    item.classList.add('active');
                    history().saveState();
                });
            });
        }

        container.appendChild(wrapper);

        if (fieldData.type === 'seat') {
            const builderWrapper = container.closest('.form-builder-wrapper');
            if (builderWrapper) {
                const addSeatBtn = builderWrapper.querySelector('.btn-add-seat-res');
                if (addSeatBtn) addSeatBtn.disabled = true;
            }
        }
    }

    function initFormBuilder(builderWrapper, defaultFields = null) {
        if (!builderWrapper) return;

        const list = builderWrapper.querySelector('.form-fields-list');
        if (!list) return;

        if (defaultFields !== null) {
            list.innerHTML = '';
            defaultFields.forEach(f => addFieldToBuilder(list, f));
        } else {
            // Re-bind events for fields restored from storage/history
            list.querySelectorAll('.form-field-item').forEach(wrapper => {
                const fieldType = wrapper.dataset.fieldType;

                const deleteBtn = wrapper.querySelector('.btn-link.text-danger');
                if (deleteBtn) {
                    deleteBtn.onclick = () => {
                        history().saveState();
                        if (fieldType === 'seat') {
                            const addSeatBtn = builderWrapper.querySelector('.btn-add-seat-res');
                            if (addSeatBtn) addSeatBtn.disabled = false;
                        }
                        wrapper.remove();
                        history().saveState();
                    };
                }

                if (fieldType === 'seat') {
                    const dropdownItems = wrapper.querySelectorAll('.dropdown-item');
                    const hiddenInput   = wrapper.querySelector('.seat-view-preference');
                    if (dropdownItems.length && hiddenInput) {
                        dropdownItems.forEach(item => {
                            item.addEventListener('click', (e) => {
                                e.preventDefault();
                                history().saveState();
                                hiddenInput.value = item.dataset.view;
                                wrapper.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('active'));
                                item.classList.add('active');
                                history().saveState();
                            });
                        });
                    }
                }
            });
        }

        const hasSeatField   = list.querySelector('.form-field-item[data-field-type="seat"]') !== null;
        const addSeatBtnInit = builderWrapper.querySelector('.btn-add-seat-res');
        if (addSeatBtnInit) addSeatBtnInit.disabled = hasSeatField;

        if (typeof Sortable !== 'undefined') {
            new Sortable(list, {
                animation: 150,
                ghostClass: 'bg-light',
                handle: '.form-field-drag-handle',
                onEnd: () => history().saveState()
            });
        }

        const addFieldBtn = builderWrapper.querySelector('.btn-add-form-field');
        if (addFieldBtn) {
            const newBtn = addFieldBtn.cloneNode(true);
            addFieldBtn.parentNode.replaceChild(newBtn, addFieldBtn);
            newBtn.addEventListener('click', () => {
                history().saveState();
                addFieldToBuilder(list, { type: 'text', label: 'New Field' });
                history().saveState();
            });
        }

        const addSeatBtn = builderWrapper.querySelector('.btn-add-seat-res');
        if (addSeatBtn) {
            const newBtn = addSeatBtn.cloneNode(true);
            addSeatBtn.parentNode.replaceChild(newBtn, addSeatBtn);
            newBtn.addEventListener('click', () => {
                history().saveState();
                addFieldToBuilder(list, { type: 'seat', viewPreference: 'chart' });
                history().saveState();
            });
        }
    }

    // -------------------------------------------------------------------------
    // Section creation
    // -------------------------------------------------------------------------

    function createNewSection(type, data = null, insertBeforeNode = null, parentContainer = null) {
        const sectionsContainer = document.getElementById('invitationSectionsContainer');
        const container  = parentContainer || sectionsContainer;
        const div        = document.createElement('div');
        const uniqueId   = `${type}_${Date.now()}`;
        const currentEventData = state().currentEventData;

        div.className    = 'invitation-section p-4 p-md-5';
        div.dataset.section = uniqueId;
        div.dataset.type = type;

        const dragHandle = `<div class="section-drag-handle position-absolute top-0 start-0 m-2 p-2 rounded shadow-sm text-secondary" style="z-index: 10;"><i class="bi bi-grip-vertical"></i></div>`;
        const deleteBtn  = `<button class="btn btn-sm btn-light position-absolute top-0 end-0 m-2 text-danger btn-delete-section shadow-sm" style="z-index: 10;"><i class="bi bi-trash"></i></button>`;

        const eventTitle = currentEventData ? currentEventData.title : 'Event Title';
        const eventVenue = currentEventData ? (currentEventData.venue_name || 'Unknown Venue') : 'Location';

        let content = '';

        switch (type) {
            case 'banner': {
                const bannerSrc = (data && data.image) ? data.image : 'https://images.pexels.com/photos/1190298/pexels-photo-1190298.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1';
                div.className = 'invitation-section';
                content = `
                    <div class="invitation-banner position-relative bg-light">
                        <img id="bannerImagePreview_${uniqueId}" src="${bannerSrc}" class="img-fluid" style="object-fit: cover; width: 100%; height: 300px;">
                        <div class="position-absolute top-50 start-50 translate-middle banner-upload-btn-container">
                            <label for="bannerUpload_${uniqueId}" class="btn btn-sm btn-light bg-white shadow-sm">
                                <i class="bi bi-upload me-1"></i> Change Banner
                            </label>
                            <input type="file" id="bannerUpload_${uniqueId}" class="d-none" accept="image/*">
                        </div>
                    </div>
                `;
                break;
            }
            case 'header': {
                const title = (data && data.title)       ? data.title       : eventTitle;
                const host  = (data && data.host)        ? data.host        : 'Subtitle or Host Name';
                const desc  = (data && data.description) ? data.description : '<p>Description text goes here.</p>';
                content = `
                    <h1 contenteditable="true" class="invitation-title display-4 mb-3" style="color: var(--text-main);">${title}</h1>
                    <p contenteditable="true" class="lead" style="color: var(--text-muted);">${host}</p>
                    <hr class="my-4" style="border-color: var(--border-color);">
                    <div contenteditable="true" class="invitation-description fs-5" style="color: var(--text-main);">${desc}</div>
                `;
                break;
            }
            case 'section': {
                const secTitle = (data && data.title) ? data.title : 'New Section';
                content = `
                    <h3 contenteditable="true" style="color: var(--text-main);">${secTitle}</h3>
                    <div class="section-blocks-container p-3 border rounded" style="min-height: 100px; background-color: var(--bg-muted);"></div>
                `;
                break;
            }
            case 'image': {
                const imgSrc = (data && data.image) ? data.image : 'https://via.placeholder.com/800x300/dee2e6/6c757d.png?text=Image';
                div.className = 'invitation-section';
                content = `
                    <div class="position-relative bg-light" style="min-height: 200px;">
                        <img src="${imgSrc}" class="img-fluid w-100" style="object-fit: cover; max-height: 300px;">
                    </div>
                `;
                break;
            }
            case 'details': {
                const start = currentEventData ? new Date(currentEventData.start_datetime) : null;
                const end   = currentEventData && currentEventData.end_datetime ? new Date(currentEventData.end_datetime) : null;

                const eventDateStr = start
                    ? start.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                    : 'Date';

                let eventTimeStr = 'Time';
                if (start) {
                    eventTimeStr = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
                    if (end) eventTimeStr += ' - ' + end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
                }

                content = `
                    <div class="card border-0" style="background-color: var(--bg-muted);">
                        <div class="card-body">
                            <h5 class="card-title" style="color: var(--text-main);">Event Details</h5>
                            <p class="card-text mb-0" style="color: var(--text-main);"><i class="bi bi-calendar3 me-2"></i>${eventDateStr}</p>
                            <p class="card-text mb-2" style="color: var(--text-muted);"><i class="bi bi-clock me-2"></i>${eventTimeStr}</p>
                            <p class="card-text" style="color: var(--text-main);"><i class="bi bi-geo-alt-fill me-2"></i>${eventVenue}</p>
                        </div>
                    </div>
                `;
                break;
            }
            case 'form': {
                const formTitle = (data && data.title) ? data.title : 'Registration Form';
                content = _formBuilderHTML(formTitle);
                break;
            }
            case 'rsvp_form': {
                const rsvpTitle = (data && data.title) ? data.title : 'Please confirm your details:';
                content = _formBuilderHTML(rsvpTitle);
                break;
            }
            case 'question': {
                const question     = (data && data.question)     ? data.question     : 'Your Question Here';
                const questionType = (data && data.questionType) ? data.questionType : 'short_answer';
                const optionsJSON  = (data && data.options)      ? JSON.stringify(data.options) : '[]';
                content = `
                    <div class="question-block" data-question-type="${questionType}">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <h5 contenteditable="true" class="mb-0 question-title" style="color: var(--text-main);">${question}</h5>
                            <select class="form-select form-select-sm question-type-select" style="width: auto; background-color: var(--bg-input); color: var(--text-main); border-color: var(--border-color);">
                                <option value="short_answer"   ${questionType === 'short_answer'   ? 'selected' : ''}>Short Answer</option>
                                <option value="paragraph"      ${questionType === 'paragraph'      ? 'selected' : ''}>Paragraph</option>
                                <option value="multiple_choice"${questionType === 'multiple_choice'? 'selected' : ''}>Multiple Choice</option>
                                <option value="checkboxes"     ${questionType === 'checkboxes'     ? 'selected' : ''}>Checkboxes</option>
                                <option value="dropdown"       ${questionType === 'dropdown'       ? 'selected' : ''}>Drop Down</option>
                            </select>
                        </div>
                        <div class="question-answer-area" data-options='${optionsJSON}'></div>
                        <div class="question-buttons-list mt-3 d-flex flex-wrap gap-2"></div>
                        <div class="mt-3 border-top pt-2" style="border-color: var(--border-color) !important;">
                            <button class="btn btn-sm btn-outline-secondary btn-add-question-btn"><i class="bi bi-plus-square"></i> Add Button</button>
                            <div class="dropdown d-inline-block ms-2">
                                <button class="btn btn-sm btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                                    Bind to Section
                                </button>
                                <ul class="dropdown-menu bind-section-dropdown" style="background-color: var(--bg-panel); color: var(--text-main);">
                                    <li><a class="dropdown-item" href="#">None</a></li>
                                </ul>
                            </div>
                        </div>
                    </div>
                `;
                break;
            }
        }

        div.innerHTML = dragHandle + deleteBtn + content;

        div.querySelector('.btn-delete-section').addEventListener('click', () => {
            history().saveState();
            div.remove();
            history().saveState();
        });

        if (type === 'question') {
            populateBindSectionDropdowns();
            const questionBlock = div.querySelector('.question-block');
            if (questionBlock) {
                renderQuestionInput(questionBlock);

                const typeSelect = questionBlock.querySelector('.question-type-select');
                if (typeSelect) {
                    typeSelect.addEventListener('change', () => {
                        history().saveState();
                        renderQuestionInput(questionBlock);
                        history().saveState();
                    });
                }

                const btnList  = questionBlock.querySelector('.question-buttons-list');
                const addBtn   = questionBlock.querySelector('.btn-add-question-btn');

                const addButtonToUI = (text = 'Submit') => {
                    const btnWrapper = document.createElement('div');
                    btnWrapper.className = 'position-relative d-inline-block me-2 mb-2';

                    const theBtn = document.createElement('div');
                    theBtn.className = 'btn btn-primary question-custom-btn';
                    theBtn.contentEditable = true;
                    theBtn.textContent = text;
                    theBtn.style.minWidth = '80px';

                    const delBtn = document.createElement('button');
                    delBtn.className = 'btn btn-sm btn-danger position-absolute top-0 start-100 translate-middle rounded-circle p-0 d-flex align-items-center justify-content-center';
                    delBtn.style.cssText = 'width:20px; height:20px; font-size:12px;';
                    delBtn.innerHTML = '<i class="bi bi-x"></i>';
                    delBtn.onclick = () => { history().saveState(); btnWrapper.remove(); history().saveState(); };

                    btnWrapper.appendChild(theBtn);
                    btnWrapper.appendChild(delBtn);
                    btnList.appendChild(btnWrapper);
                };

                if (data && data.buttons) {
                    data.buttons.forEach(btnText => addButtonToUI(btnText));
                }

                if (addBtn) {
                    addBtn.addEventListener('click', () => {
                        history().saveState();
                        addButtonToUI('Button');
                        history().saveState();
                    });
                }
            }
        }

        if (type === 'form' || type === 'rsvp_form') {
            const builderWrapper = div.querySelector('.form-builder-wrapper');
            const fields = (data && data.fields && data.fields.length > 0)
                ? data.fields
                : [{ type: 'text', label: 'Full Name' }, { type: 'text', label: 'Email Address' }];
            initFormBuilder(builderWrapper, fields);
        }

        if (type === 'section') {
            const innerContainer = div.querySelector('.section-blocks-container');
            if (innerContainer && typeof Sortable !== 'undefined') {
                new Sortable(innerContainer, {
                    group: 'nested',
                    animation: 150,
                    handle: '.section-drag-handle',
                    ghostClass: 'bg-light',
                    onEnd: () => history().saveState()
                });
            }
            if (data && data.blocks && data.blocks.length > 0) {
                data.blocks.forEach(blockData => createNewSection(blockData.type, blockData, null, innerContainer));
            }
        }

        if (insertBeforeNode) {
            container.insertBefore(div, insertBeforeNode);
        } else {
            container.appendChild(div);
        }

    }

    // -------------------------------------------------------------------------
    // Section utilities
    // -------------------------------------------------------------------------

    function bindSectionControls() {
        document.querySelectorAll('.invitation-section').forEach(sec => {
            if (!sec.querySelector('.btn-delete-section')) {
                const btn = document.createElement('button');
                btn.className = 'btn btn-sm btn-light position-absolute top-0 end-0 m-2 text-danger btn-delete-section shadow-sm';
                btn.style.zIndex = '10';
                btn.innerHTML = '<i class="bi bi-trash"></i>';
                btn.onclick = () => { history().saveState(); sec.remove(); history().saveState(); };
                sec.appendChild(btn);
            }
        });
    }

    function populateBindSectionDropdowns() {
        document.querySelectorAll('.bind-section-dropdown').forEach(dropdown => {
            dropdown.querySelectorAll('li:not(:first-child)').forEach(item => item.remove());
            const allSections = Array.from(document.querySelectorAll('.invitation-section'));
            allSections.forEach(section => addSectionToDropdown(dropdown, section));
        });
    }

    function addSectionToDropdown(dropdown, section) {
        if (!dropdown || !section) return;
        const sectionType = section.dataset.type;
        const sectionName = section.dataset.section || sectionType;

        if (sectionType !== 'question') {
            const dropdownItem = document.createElement('li');
            const link = document.createElement('a');
            link.className = 'dropdown-item';
            link.href = '#';
            link.textContent = sectionName;
            link.style.color = 'var(--text-main)';
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const questionBlock = dropdown.closest('.question-block');
                if (questionBlock) {
                    dropdown.querySelectorAll('.dropdown-item').forEach(item => item.classList.remove('active'));
                    link.classList.add('active');
                    questionBlock.dataset.bindSection = sectionName;
                    history().saveState();
                }
            });
            dropdownItem.appendChild(link);
            dropdown.appendChild(dropdownItem);
        }
    }

    function initSortable() {
        const sortableContainer = document.getElementById('invitationSectionsContainer');
        if (typeof Sortable === 'undefined') return;

        if (sortableContainer) {
            if (mainSortable) mainSortable.destroy();
            
            mainSortable = new Sortable(sortableContainer, {
                group: 'nested',
                animation: 150,
                handle: '.section-drag-handle',
                ghostClass: 'bg-light',
                onEnd: () => history().saveState()
            });
        }

        document.querySelectorAll('.section-blocks-container').forEach(el => {
            if (el._sortable) el._sortable.destroy();
            el._sortable = new Sortable(el, {
                group: 'nested',
                animation: 150,
                handle: '.section-drag-handle',
                ghostClass: 'bg-light',
                onEnd: () => history().saveState()
            });
        });
    }

    function getDragAfterElement(container, y) {
        const draggableElements = [...container.children].filter(child =>
            child.classList.contains('invitation-section') && !child.classList.contains('dragging')
        );

        return draggableElements.reduce((closest, child) => {
            const box    = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            return (offset < 0 && offset > closest.offset)
                ? { offset, element: child }
                : closest;
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    function _formBuilderHTML(title) {
        return `
            <div class="form-builder-wrapper">
                <h4 contenteditable="true" class="mb-3 form-title" style="color: var(--text-main);">${title}</h4>
                <div class="form-fields-list"></div>
                <div class="d-grid mt-3">
                    <button class="btn btn-primary" disabled>Confirm RSVP</button>
                </div>
                <div class="d-flex gap-2 mt-3 border-top pt-3" style="border-color: var(--border-color) !important;">
                    <button class="btn btn-sm btn-outline-secondary btn-add-form-field"><i class="bi bi-plus"></i> Add Text Field</button>
                    <button class="btn btn-sm btn-outline-primary btn-add-seat-res"><i class="bi bi-grid-3x3"></i> Add Seat Reservation</button>
                </div>
            </div>
        `;
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    return {
        createNewSection,
        bindSectionControls,
        populateBindSectionDropdowns,
        addSectionToDropdown,
        initSortable,
        getDragAfterElement,
        initFormBuilder,
        addFieldToBuilder,
        renderQuestionInput,
        bindQuestionOptionEvents,
    };
})();
