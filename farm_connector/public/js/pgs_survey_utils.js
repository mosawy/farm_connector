frappe.provide('farm_connector.survey_form');

farm_connector.survey_form = {
    render_survey_form: function (frm) {
        let wrapper = frm.get_field('survey_html').$wrapper;
        wrapper.empty();

        if (!frm.doc.items || frm.doc.items.length === 0) {
            wrapper.html(`
                <div class="survey-form-container">
                    <div class="empty-state">
                        Please select a template to load the survey form
                    </div>
                </div>
            `);
            return;
        }

        let html = `
            <div class="survey-form-container">
        `;

        let current_outer_section = null;
        let current_inner_section_open = false;

        frm.doc.items.forEach((row, index) => {
            // 1. Handle Outer Section (from Builder "Add Section")
            if (row.section !== current_outer_section) {
                // Close previous inner section if open
                if (current_inner_section_open) {
                    html += `</div></div></div>`; // Close .custom-section-body, .collapsible-section-body, .collapsible-section
                    current_inner_section_open = false;
                }
                // Close previous outer section if exists
                if (current_outer_section !== null) {
                    html += `</div>`; // Close .survey-section
                }

                // Start new Outer Section
                html += `<div class="survey-section">`;
                if (row.section) {
                    html += `<h4 class="section-title">${row.section}</h4>`;
                }

                current_outer_section = row.section;
            }

            // 2. Handle layout breaks
            if (row.field_type === 'Column Break') {
                // Column Break: visual separator, skip rendering as a field
                return;
            }

            // 3. Handle Section Break / Tab Break (Inner Collapsible Section)
            if (row.field_type === 'Section Break' || row.field_type === 'Tab Break') {
                // Close previous inner section if open
                if (current_inner_section_open) {
                    html += `</div></div></div>`; // Close .custom-section-body, .collapsible-section-body, .collapsible-section
                    current_inner_section_open = false;
                }

                // Start new Collapsible Section
                html += `
                    <div class="collapsible-section expanded" data-section-name="${row.name}">
                        <div class="collapsible-section-header">
                            <i class="fa fa-chevron-down"></i>
                            <span class="header-text">${row.field_label}</span>
                        </div>
                        <div class="collapsible-section-body">
                            <div class="custom-section-body">
                `;
                current_inner_section_open = true;
            } else {
                // Regular Field
                // If no inner section is open, we need to open an implicit one
                if (!current_inner_section_open) {
                    html += `
                        <div class="collapsible-section expanded implicit-section">
                            <div class="collapsible-section-body">
                                <div class="custom-section-body">
                    `;
                    current_inner_section_open = true;
                }

                // Render Field
                html += farm_connector.survey_form.get_field_html(frm, row);
            }
        });

        // Close all open tags
        if (current_inner_section_open) {
            html += `</div></div></div>`; // Close .custom-section-body, .collapsible-section-body, .collapsible-section
        }
        if (current_outer_section !== null) {
            html += `</div>`; // Close .survey-section
        }

        html += `</div>`; // Close .survey-form-container

        wrapper.html(html);

        // Bind Events
        farm_connector.survey_form.bind_form_events(frm, wrapper);
        farm_connector.survey_form.bind_collapsible_events(wrapper);

        // Initial Dependency Check - hide fields that don't meet conditions
        farm_connector.survey_form.check_dependencies(frm);
    },

    get_field_html: function (frm, row) {
        let value = row.reading_value || "";
        let label = row.field_label;

        // Check if field is conditionally mandatory
        let is_mandatory = row.is_mandatory;
        if (row.mandatory_depends_on) {
            try {
                let context = farm_connector.survey_form.build_context(frm);
                is_mandatory = is_mandatory || farm_connector.survey_form.evaluate_expression(row.mandatory_depends_on, context);
            } catch (e) {
                console.error('Mandatory dependency error:', e);
            }
        }

        let mandatory_indicator = is_mandatory ? '<span class="reqd">*</span>' : '';
        let help_text = row.help_text ? `<div class="help-box small text-muted">${row.help_text}</div>` : '';
        let field_html = '';

        let common_attrs = `data-row-name="${row.name}" data-field-type="${row.field_type}"`;

        let wrapper_class = "frappe-control survey-field-wrapper";
        if (['Long Text', 'HTML', 'Small Text', 'Text', 'Text Editor', 'Markdown Editor', 'HTML Editor', 'Code', 'JSON', 'Signature', 'Geolocation', 'Table'].includes(row.field_type) || (row.options && row.options.length > 50)) {
            wrapper_class += " full-width";
        }

        switch (row.field_type) {
            case 'Data':
                field_html = `<input type="text" class="input-with-feedback form-control" value="${frappe.utils.escape_html(value)}" placeholder="Enter ${label.toLowerCase()}" ${common_attrs}>`;
                break;

            case 'Int':
                field_html = `<input type="number" step="1" class="input-with-feedback form-control" value="${frappe.utils.escape_html(value)}" placeholder="Enter number" ${common_attrs}>`;
                break;

            case 'Float':
                field_html = `<input type="number" step="0.01" class="input-with-feedback form-control" value="${frappe.utils.escape_html(value)}" placeholder="Enter decimal number" ${common_attrs}>`;
                break;

            case 'Small Text':
                field_html = `<textarea class="input-with-feedback form-control" rows="2" placeholder="Enter text" ${common_attrs}>${frappe.utils.escape_html(value)}</textarea>`;
                break;

            case 'Long Text':
                field_html = `<textarea class="input-with-feedback form-control" rows="5" placeholder="Enter detailed text" ${common_attrs}>${frappe.utils.escape_html(value)}</textarea>`;
                break;

            case 'Select':
                let options = (row.options || "").split('\n').filter(o => o).map(o =>
                    `<option value="${frappe.utils.escape_html(o)}" ${value === o ? 'selected' : ''}>${frappe.utils.escape_html(o)}</option>`
                ).join('');
                field_html = `<select class="input-with-feedback form-control" ${common_attrs}>
                    <option value="">-- Select --</option>${options}
                </select>`;
                break;

            case 'Checkbox':
                return `
                    <div class="frappe-control survey-field-wrapper" data-row-name="${row.name}" data-field-type="${row.field_type}">
                        <div class="checkbox">
                            <label>
                                <input type="checkbox" ${value == 1 ? 'checked' : ''} ${common_attrs}>
                                <span class="label-area">${label} ${mandatory_indicator}</span>
                            </label>
                        </div>
                        ${help_text}
                    </div>
                `;

            case 'Radio':
                let radio_opts = (row.options || "").split('\n').filter(o => o);
                let radio_html = radio_opts.map(opt => `
                    <div class="radio">
                        <label>
                            <input type="radio" name="radio_${row.name}" value="${frappe.utils.escape_html(opt)}" ${value === opt ? 'checked' : ''} ${common_attrs}>
                            <span class="label-area">${frappe.utils.escape_html(opt)}</span>
                        </label>
                    </div>
                `).join('');

                return `
                    <div class="frappe-control survey-field-wrapper" data-row-name="${row.name}" data-field-type="${row.field_type}">
                        <div class="control-label">${label} ${mandatory_indicator}</div>
                        <div class="control-value">
                            ${radio_html}
                        </div>
                        ${help_text}
                    </div>
                `;

            case 'Multi-Select':
                let ms_values = value.split(',').map(v => v.trim());
                let ms_opts = (row.options || "").split('\n').filter(o => o);
                let ms_html = ms_opts.map(opt => `
                    <div class="checkbox">
                        <label>
                            <input type="checkbox" class="multi-select-input" value="${frappe.utils.escape_html(opt)}" ${ms_values.includes(opt) ? 'checked' : ''} ${common_attrs}>
                            <span class="label-area">${frappe.utils.escape_html(opt)}</span>
                        </label>
                    </div>
                `).join('');

                return `
                    <div class="frappe-control survey-field-wrapper" data-row-name="${row.name}" data-field-type="${row.field_type}">
                        <div class="control-label">${label} ${mandatory_indicator}</div>
                        <div class="control-value">
                            ${ms_html}
                        </div>
                        ${help_text}
                    </div>
                `;

            case 'Formula':
                field_html = `<input type="text" class="input-with-feedback form-control" value="${frappe.utils.escape_html(value)}" readonly ${common_attrs} style="background-color: #f5f5f5;">`;
                break;

            case 'Currency':
                field_html = `<div class="input-group">
                    <span class="input-group-addon" style="background:#f5f5f5; border:1px solid #d1d8dd; padding:2px 8px;">$</span>
                    <input type="number" step="0.01" class="input-with-feedback form-control" value="${frappe.utils.escape_html(value)}" placeholder="0.00" ${common_attrs}>
                </div>`;
                break;

            case 'Percent':
                field_html = `<div class="input-group">
                    <input type="number" step="0.01" min="0" max="100" class="input-with-feedback form-control" value="${frappe.utils.escape_html(value)}" placeholder="0-100" ${common_attrs}>
                    <span class="input-group-addon" style="background:#f5f5f5; border:1px solid #d1d8dd; padding:2px 8px;">%</span>
                </div>`;
                break;

            case 'Phone':
                field_html = `<input type="tel" class="input-with-feedback form-control" value="${frappe.utils.escape_html(value)}" placeholder="Enter phone number" ${common_attrs}>`;
                break;

            case 'Date':
                field_html = `<input type="date" class="input-with-feedback form-control" value="${frappe.utils.escape_html(value)}" ${common_attrs}>`;
                break;

            case 'Datetime':
                field_html = `<input type="datetime-local" class="input-with-feedback form-control" value="${frappe.utils.escape_html(value)}" ${common_attrs}>`;
                break;

            case 'Time':
                field_html = `<input type="time" class="input-with-feedback form-control" value="${frappe.utils.escape_html(value)}" ${common_attrs}>`;
                break;

            case 'Duration':
                field_html = `<input type="text" class="input-with-feedback form-control" value="${frappe.utils.escape_html(value)}" placeholder="e.g. 1h 30m or 01:30:00" ${common_attrs}>`;
                break;

            case 'Color':
                field_html = `<div style="display:flex; gap:8px; align-items:center;">
                    <input type="color" class="input-with-feedback color-picker-input" value="${value || '#000000'}" ${common_attrs} style="width:48px; height:36px; padding:2px; cursor:pointer; border:1px solid #d1d8dd; border-radius:4px;">
                    <input type="text" class="input-with-feedback form-control color-text-input" value="${frappe.utils.escape_html(value)}" placeholder="#000000" data-row-name="${row.name}" style="flex:1;">
                </div>`;
                break;

            case 'Rating':
                let rating_val = parseInt(value) || 0;
                let stars_html = '';
                for (let i = 1; i <= 5; i++) {
                    stars_html += `<span class="rating-star" data-value="${i}" data-row-name="${row.name}" style="cursor:pointer; font-size:24px; color:${i <= rating_val ? '#ffa00a' : '#d1d8dd'};">&#9733;</span>`;
                }
                field_html = `<div class="rating-input" ${common_attrs}>${stars_html}</div>
                    <input type="hidden" class="input-with-feedback rating-hidden" value="${rating_val}" data-row-name="${row.name}">`;
                break;

            case 'Barcode':
                field_html = `<input type="text" class="input-with-feedback form-control" value="${frappe.utils.escape_html(value)}" placeholder="Enter or scan barcode" ${common_attrs}>`;
                break;

            case 'Icon':
                field_html = `<input type="text" class="input-with-feedback form-control" value="${frappe.utils.escape_html(value)}" placeholder="e.g. fa fa-home" ${common_attrs}>`;
                break;

            case 'Password':
                field_html = `<input type="password" class="input-with-feedback form-control" value="${frappe.utils.escape_html(value)}" placeholder="Enter password" ${common_attrs}>`;
                break;

            case 'Link':
            case 'Dynamic Link':
                field_html = `<input type="text" class="input-with-feedback form-control" value="${frappe.utils.escape_html(value)}" placeholder="Search ${frappe.utils.escape_html(row.link_doctype || row.options || '')}..." ${common_attrs}>`;
                break;

            case 'Autocomplete':
                let ac_options = (row.options || "").split('\n').filter(o => o).map(o =>
                    `<option value="${frappe.utils.escape_html(o)}">`
                ).join('');
                let list_id = 'datalist_' + row.name;
                field_html = `<input type="text" class="input-with-feedback form-control" list="${list_id}" value="${frappe.utils.escape_html(value)}" placeholder="Type to search..." ${common_attrs}>
                    <datalist id="${list_id}">${ac_options}</datalist>`;
                break;

            case 'Text':
            case 'Text Editor':
            case 'Markdown Editor':
            case 'HTML Editor':
                field_html = `<textarea class="input-with-feedback form-control" rows="6" placeholder="Enter content" ${common_attrs}>${frappe.utils.escape_html(value)}</textarea>`;
                break;

            case 'Code':
            case 'JSON':
                field_html = `<textarea class="input-with-feedback form-control" rows="8" placeholder="Enter code" ${common_attrs} style="font-family:monospace; font-size:13px;">${frappe.utils.escape_html(value)}</textarea>`;
                break;

            case 'Attach Image':
                field_html = `<div class="attach-image-wrapper">
                    ${value ? `<img src="${frappe.utils.escape_html(value)}" style="max-width:200px; max-height:150px; border-radius:4px; margin-bottom:8px; display:block;">` : ''}
                    <input type="file" accept="image/*" class="input-with-feedback form-control file-input" ${common_attrs}>
                </div>`;
                break;

            case 'Signature':
                field_html = `<div class="signature-wrapper" style="border:1px solid #d1d8dd; border-radius:4px; min-height:150px; background:#fafafa; text-align:center; padding:20px;">
                    <p class="text-muted">Signature capture available in mobile app</p>
                    <input type="hidden" class="input-with-feedback" value="${frappe.utils.escape_html(value)}" ${common_attrs}>
                </div>`;
                break;

            case 'Geolocation':
                field_html = `<textarea class="input-with-feedback form-control" rows="3" placeholder='{"type":"FeatureCollection","features":[]}' ${common_attrs} style="font-family:monospace; font-size:12px;">${frappe.utils.escape_html(value)}</textarea>`;
                break;

            case 'Read Only':
                field_html = `<input type="text" class="input-with-feedback form-control" value="${frappe.utils.escape_html(value)}" readonly ${common_attrs} style="background-color: #f5f5f5;">`;
                break;

            case 'HTML':
                field_html = `<div class="html-field-content">${row.options || ''}</div>`;
                break;

            default:
                field_html = `<input type="text" class="input-with-feedback form-control" value="${frappe.utils.escape_html(value)}" ${common_attrs}>`;
        }

        return `
            <div class="${wrapper_class}" data-row-name="${row.name}" data-field-type="${row.field_type}">
                <div class="control-label">${label} ${mandatory_indicator}</div>
                <div class="control-value">
                    ${field_html}
                </div>
                ${help_text}
            </div>
        `;
    },

    bind_form_events: function (frm, wrapper) {
        // Text, Number, Select, Textarea
        wrapper.find('input.input-with-feedback, textarea.input-with-feedback, select.input-with-feedback').on('change', function () {
            let row_name = $(this).data('row-name');
            let value = $(this).val();
            farm_connector.survey_form.update_row_value(frm, row_name, value);
        });

        // Checkbox (Single)
        wrapper.find('input[type="checkbox"]:not(.multi-select-input)').on('change', function () {
            let row_name = $(this).data('row-name');
            let value = $(this).is(':checked') ? 1 : 0;
            farm_connector.survey_form.update_row_value(frm, row_name, value);
        });

        // Radio
        wrapper.find('input[type="radio"]').on('change', function () {
            let row_name = $(this).data('row-name');
            let value = $(this).val();
            farm_connector.survey_form.update_row_value(frm, row_name, value);
        });

        // Multi-Select
        wrapper.find('.multi-select-input').on('change', function () {
            let row_name = $(this).data('row-name');
            let values = [];
            wrapper.find(`.multi-select-input[data-row-name="${row_name}"]:checked`).each(function () {
                values.push($(this).val());
            });
            farm_connector.survey_form.update_row_value(frm, row_name, values.join(', '));
        });

        // Rating stars
        wrapper.find('.rating-star').on('click', function () {
            let row_name = $(this).data('row-name');
            let value = $(this).data('value');
            $(this).parent().find('.rating-star').each(function () {
                $(this).css('color', $(this).data('value') <= value ? '#ffa00a' : '#d1d8dd');
            });
            wrapper.find(`.rating-hidden[data-row-name="${row_name}"]`).val(value);
            farm_connector.survey_form.update_row_value(frm, row_name, value);
        });

        // Color picker sync
        wrapper.find('.color-picker-input').on('input', function () {
            let row_name = $(this).data('row-name');
            let value = $(this).val();
            $(this).siblings('.color-text-input').val(value);
            farm_connector.survey_form.update_row_value(frm, row_name, value);
        });
        wrapper.find('.color-text-input').on('change', function () {
            let row_name = $(this).data('row-name');
            let value = $(this).val();
            $(this).siblings('.color-picker-input').val(value);
            farm_connector.survey_form.update_row_value(frm, row_name, value);
        });

        // File/Attach Image inputs
        wrapper.find('.file-input').on('change', function () {
            let row_name = $(this).data('row-name');
            let file = this.files[0];
            if (file) {
                farm_connector.survey_form.update_row_value(frm, row_name, file.name);
            }
        });
    },

    bind_collapsible_events: function (wrapper) {
        wrapper.find('.collapsible-section-header').on('click', function () {
            let section = $(this).closest('.collapsible-section');
            let icon = $(this).find('.fa');

            if (section.hasClass('expanded')) {
                section.removeClass('expanded').addClass('collapsed');
                icon.removeClass('fa-chevron-down').addClass('fa-chevron-right');
                section.find('.collapsible-section-body').slideUp(200);
            } else {
                section.removeClass('collapsed').addClass('expanded');
                icon.removeClass('fa-chevron-right').addClass('fa-chevron-down');
                section.find('.collapsible-section-body').slideDown(200);
            }
        });
    },

    update_row_value: function (frm, row_name, value) {
        let row = frappe.get_doc('PGS Survey Item', row_name);
        frappe.model.set_value(row.doctype, row.name, 'reading_value', value)
            .then(() => {
                farm_connector.survey_form.check_dependencies(frm);
            });
    },

    build_context: function (frm) {
        let context = {};
        (frm.doc.items || []).forEach(item => {
            let var_name = item.field_label.toLowerCase().replace(/ /g, '_').replace(/-/g, '_');
            let val = item.reading_value;

            // Try to convert to number
            try {
                if (['Int', 'Float', 'Currency', 'Percent', 'Rating'].includes(item.field_type)) {
                    val = parseFloat(val) || val;
                }
            } catch (e) { }

            context[var_name] = val;
            context[item.field_label] = val;
            if (item.fieldname) {
                context[item.fieldname] = val;
            }
        });
        return context;
    },

    is_field_visible: function (frm, item) {
        if (!item.display_depends_on) return true;

        try {
            let context = farm_connector.survey_form.build_context(frm);
            let result = farm_connector.survey_form.evaluate_expression(item.display_depends_on, context);
            return result;
        } catch (e) {
            console.error(`Display dependency error for "${item.field_label}":`, e);
            return true;
        }
    },

    evaluate_expression: function (expression, context) {
        try {
            // Filter context to only include valid JS identifiers
            let safe_context = {};
            Object.keys(context).forEach(key => {
                if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)) {
                    safe_context[key] = context[key];
                }
            });

            const keys = Object.keys(safe_context);
            const values = Object.values(safe_context);

            // Create a function with keys as arguments and return the expression result
            const func = new Function(...keys, `return ${expression}`);
            return func(...values);
        } catch (e) {
            console.warn(`Evaluation failed for expression "${expression}":`, e);
            return false;
        }
    },

    check_dependencies: function (frm) {
        let wrapper = frm.get_field('survey_html').$wrapper;

        (frm.doc.items || []).forEach(row => {
            let field_wrapper = wrapper.find(`.survey-field-wrapper[data-row-name="${row.name}"]`);

            if (row.display_depends_on) {
                let visible = farm_connector.survey_form.is_field_visible(frm, row);

                if (visible) {
                    field_wrapper.show();
                } else {
                    field_wrapper.hide();
                }
            } else {
                // Fields without conditions should always be visible
                field_wrapper.show();
            }
        });
    }
};
