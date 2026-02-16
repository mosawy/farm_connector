frappe.provide('farm_connector.template_builder');

farm_connector.template_builder = {
    render_template_builder: function (frm) {
        let wrapper = frm.get_field('template_builder_html').$wrapper;
        wrapper.empty();

        let html = `
            <div class="template-builder-container">
                <div class="builder-toolbar">
                    <button class="btn btn-sm btn-primary" data-action="add-section">
                        <i class="fa fa-plus"></i> Add Section
                    </button>
                </div>
                <div class="builder-sections" id="builder-sections"></div>
            </div>
        `;

        wrapper.html(html);

        // Bind toolbar events
        wrapper.find('[data-action="add-section"]').on('click', () => farm_connector.template_builder.add_section(frm));

        // Render existing sections and fields
        farm_connector.template_builder.render_sections(frm);
    },

    render_sections: function (frm) {
        let container = frm.get_field('template_builder_html').$wrapper.find('#builder-sections');
        container.empty();

        // Group items by section
        let sections = {};
        (frm.doc.items || []).forEach(item => {
            let section_name = item.section || 'General';
            if (!sections[section_name]) {
                sections[section_name] = [];
            }
            sections[section_name].push(item);
        });

        let section_order = farm_connector.template_builder.get_section_order(frm);

        // Handle orphans (sections in items but not in order)
        Object.keys(sections).forEach(s => {
            if (!section_order.includes(s)) {
                section_order.push(s);
            }
        });

        // Save updated order
        farm_connector.template_builder.set_section_order(frm, section_order);

        if (section_order.length === 0) {
            container.html('<div class="empty-section">No sections added. Click "Add Section" to get started.</div>');
            return;
        }

        // Render each section
        section_order.forEach((section_name, index) => {
            let fields = sections[section_name] || [];
            let section_html = farm_connector.template_builder.get_section_html(frm, section_name, fields, index, section_order.length);
            container.append(section_html);
        });

        // Bind events
        farm_connector.template_builder.bind_section_events(frm);
        farm_connector.template_builder.setup_sortable(frm);
    },

    get_section_html: function (frm, section_name, fields, index, total) {
        let fields_html = fields.map(field => farm_connector.template_builder.get_field_html(frm, field)).join('');

        let up_disabled = index === 0 ? 'disabled' : '';
        let down_disabled = index === total - 1 ? 'disabled' : '';

        return `
            <div class="builder-section" data-section="${section_name}">
                <div class="section-header">
                    <div style="display: flex; align-items: center; gap: 5px; flex: 1;">
                        <div class="section-move-controls">
                            <button class="btn btn-xs btn-default" data-action="move-section-up" data-section="${section_name}" ${up_disabled}>
                                <i class="fa fa-arrow-up"></i>
                            </button>
                            <button class="btn btn-xs btn-default" data-action="move-section-down" data-section="${section_name}" ${down_disabled}>
                                <i class="fa fa-arrow-down"></i>
                            </button>
                        </div>
                        <input type="text" class="section-title-input" value="${section_name}" data-section="${section_name}">
                    </div>
                    <div class="section-actions">
                        <button class="btn btn-xs btn-default" data-action="add-field-to-section" data-section="${section_name}" title="Add Field">
                            <i class="fa fa-plus"></i>
                        </button>
                        <button class="btn btn-xs btn-default" data-action="delete-section" data-section="${section_name}" title="Delete Section">
                            <i class="fa fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="field-list" data-section="${section_name}">
                    ${fields_html || '<div class="empty-section-placeholder" style="padding: 10px; color: #ccc; text-align: center; font-style: italic;">No fields</div>'}
                </div>
            </div>
        `;
    },

    get_field_html: function (frm, field) {
        let mandatory_badge = field.is_mandatory ? '<span style="color: #d32f2f; margin-left: 4px;">*</span>' : '';
        let details = [];

        if (field.options) details.push(`Options: ${field.options.split('\n').length} items`);
        if (field.help_text) details.push(`Help: ${field.help_text.substring(0, 30)}...`);
        if (field.display_depends_on) details.push('Has display condition');
        if (field.mandatory_depends_on) details.push('Has mandatory condition');
        if (field.fieldname) details.push(`Fieldname: ${field.fieldname}`);

        let wrapper_class = 'field-item';
        let content_html = '';

        if (field.field_type === 'Section Break') {
            wrapper_class += ' field-section-break';
            content_html = `
                <div class="field-header section-break-header">
                    <div>
                        <span class="field-label"><i class="fa fa-minus"></i> ${field.field_label} (Section Break)</span>
                    </div>
                    <div>
                        <button class="btn btn-xs btn-default" data-action="edit-field" data-field-name="${field.name}">
                            <i class="fa fa-edit"></i>
                        </button>
                        <button class="btn btn-xs btn-default" data-action="delete-field" data-field-name="${field.name}">
                            <i class="fa fa-trash"></i>
                        </button>
                    </div>
                </div>
                ${details.length > 0 ? `<div class="field-details">${details.map(d => `<span>• ${d}</span>`).join('')}</div>` : ''}
            `;
        } else {
            content_html = `
                <div class="field-header">
                    <div>
                        <span class="field-label">${field.field_label}${mandatory_badge}</span>
                        <span class="field-type-badge">${field.field_type}</span>
                    </div>
                    <div>
                        <button class="btn btn-xs btn-default" data-action="edit-field" data-field-name="${field.name}">
                            <i class="fa fa-edit"></i>
                        </button>
                        <button class="btn btn-xs btn-default" data-action="delete-field" data-field-name="${field.name}">
                            <i class="fa fa-trash"></i>
                        </button>
                    </div>
                </div>
                ${details.length > 0 ? `<div class="field-details">${details.map(d => `<span>• ${d}</span>`).join('')}</div>` : ''}
            `;
        }

        return `
            <div class="${wrapper_class}" data-field-name="${field.name}">
                ${content_html}
            </div>
        `;
    },

    bind_section_events: function (frm) {
        let wrapper = frm.get_field('template_builder_html').$wrapper;

        // Section title change
        wrapper.find('.section-title-input').on('change', function () {
            let old_section = $(this).data('section');
            let new_section = $(this).val();
            farm_connector.template_builder.rename_section(frm, old_section, new_section);
        });

        // Delete section
        wrapper.find('[data-action="delete-section"]').on('click', function () {
            let section = $(this).data('section');
            farm_connector.template_builder.delete_section(frm, section);
        });

        // Add field to section
        wrapper.find('[data-action="add-field-to-section"]').on('click', function () {
            let section = $(this).data('section');
            farm_connector.template_builder.add_field(frm, section);
        });

        // Move section
        wrapper.find('[data-action="move-section-up"]').on('click', function () {
            let section = $(this).data('section');
            farm_connector.template_builder.move_section(frm, section, 'up');
        });

        wrapper.find('[data-action="move-section-down"]').on('click', function () {
            let section = $(this).data('section');
            farm_connector.template_builder.move_section(frm, section, 'down');
        });

        // Edit field
        wrapper.find('[data-action="edit-field"]').on('click', function () {
            let field_name = $(this).data('field-name');
            farm_connector.template_builder.edit_field(frm, field_name);
        });

        // Delete field
        wrapper.find('[data-action="delete-field"]').on('click', function () {
            let field_name = $(this).data('field-name');
            farm_connector.template_builder.delete_field(frm, field_name);
        });
    },

    setup_sortable: function (frm) {
        let container = frm.get_field('template_builder_html').$wrapper.find('#builder-sections');
        try {
            container.find('.field-list').each(function () {
                new Sortable(this, {
                    group: 'fields',
                    animation: 150,
                    onEnd: () => farm_connector.template_builder.update_field_order(frm)
                });
            });
        } catch (e) {
            console.warn('SortableJS not available', e);
        }
    },

    update_field_order: function (frm) {
        let container = frm.get_field('template_builder_html').$wrapper.find('#builder-sections');
        let new_items = [];

        container.find('.builder-section').each(function () {
            let section_name = $(this).data('section');
            $(this).find('.field-item').each(function () {
                let field_name = $(this).data('field-name');
                let item = frm.doc.items.find(i => i.name === field_name);
                if (item) {
                    item.section = section_name;
                    new_items.push(item);
                }
            });
        });

        frm.doc.items = new_items;
        frm.refresh_field('items');
        if (!frm.doc.__islocal) frm.dirty();
    },

    move_section: function (frm, section_name, direction) {
        let order = farm_connector.template_builder.get_section_order(frm);
        let idx = order.indexOf(section_name);
        if (idx === -1) return;

        if (direction === 'up' && idx > 0) {
            [order[idx], order[idx - 1]] = [order[idx - 1], order[idx]];
        } else if (direction === 'down' && idx < order.length - 1) {
            [order[idx], order[idx + 1]] = [order[idx + 1], order[idx]];
        }

        farm_connector.template_builder.set_section_order(frm, order);
        farm_connector.template_builder.render_sections(frm);
    },

    add_section: function (frm) {
        frappe.prompt([
            {
                label: 'Section Name',
                fieldname: 'section_name',
                fieldtype: 'Data',
                reqd: 1
            }
        ], (values) => {
            let order = farm_connector.template_builder.get_section_order(frm);
            if (order.includes(values.section_name)) {
                frappe.msgprint('Section already exists');
                return;
            }
            order.push(values.section_name);
            farm_connector.template_builder.set_section_order(frm, order);
            farm_connector.template_builder.render_sections(frm);
        }, 'Add New Section');
    },

    add_field: function (frm, section_name) {
        if (!section_name) {
            let sections = farm_connector.template_builder.get_section_order(frm);
            section_name = sections.length > 0 ? sections[0] : 'General';
        }

        let dialog = new frappe.ui.Dialog({
            title: 'Add Field',
            fields: farm_connector.template_builder.get_field_dialog_fields(section_name),
            primary_action_label: 'Add Field',
            primary_action: (values) => {
                let row = frm.add_child('items');
                Object.assign(row, values);
                frm.refresh_field('items');
                farm_connector.template_builder.render_sections(frm);
                if (!frm.doc.__islocal) frm.dirty();
                dialog.hide();
            }
        });

        farm_connector.template_builder.setup_field_dialog_events(dialog);
        dialog.show();
    },

    edit_field: function (frm, field_name) {
        let field = frm.doc.items.find(f => f.name === field_name);
        if (!field) return;

        let dialog = new frappe.ui.Dialog({
            title: 'Edit Field',
            fields: farm_connector.template_builder.get_field_dialog_fields(null, field),
            primary_action_label: 'Update Field',
            primary_action: (values) => {
                Object.assign(field, values);
                frm.refresh_field('items');
                farm_connector.template_builder.render_sections(frm);
                if (!frm.doc.__islocal) frm.dirty();
                dialog.hide();
            }
        });

        farm_connector.template_builder.setup_field_dialog_events(dialog);
        dialog.show();
    },

    delete_field: function (frm, field_name) {
        frappe.confirm('Are you sure you want to delete this field?', () => {
            let idx = frm.doc.items.findIndex(f => f.name === field_name);
            if (idx !== -1) {
                frm.doc.items.splice(idx, 1);
                frm.refresh_field('items');
                farm_connector.template_builder.render_sections(frm);
                if (!frm.doc.__islocal) frm.dirty();
            }
        });
    },

    rename_section: function (frm, old_name, new_name) {
        if (old_name === new_name) return;

        let order = farm_connector.template_builder.get_section_order(frm);
        let idx = order.indexOf(old_name);
        if (idx !== -1) {
            order[idx] = new_name;
            farm_connector.template_builder.set_section_order(frm, order);
        }

        (frm.doc.items || []).forEach(item => {
            if (item.section === old_name) {
                item.section = new_name;
            }
        });

        frm.refresh_field('items');
        farm_connector.template_builder.render_sections(frm);
    },

    delete_section: function (frm, section_name) {
        frappe.confirm(`Are you sure you want to delete section "${section_name}"? All fields in this section will be deleted.`, () => {
            let order = farm_connector.template_builder.get_section_order(frm);
            order = order.filter(s => s !== section_name);
            farm_connector.template_builder.set_section_order(frm, order);

            frm.doc.items = (frm.doc.items || []).filter(item => item.section !== section_name);
            frm.refresh_field('items');
            farm_connector.template_builder.render_sections(frm);
        });
    },

    get_section_order: function (frm) {
        try {
            return JSON.parse(frm.doc.section_order || '[]');
        } catch (e) {
            return [];
        }
    },

    set_section_order: function (frm, order) {
        frm.set_value('section_order', JSON.stringify(order));
    },

    get_field_dialog_fields: function (section_name, field_data = {}) {
        let fields = [
            {
                label: 'Field Label',
                fieldname: 'field_label',
                fieldtype: 'Data',
                reqd: 1,
                default: field_data.field_label
            },
            {
                label: 'Fieldname',
                fieldname: 'fieldname',
                fieldtype: 'Data',
                read_only: 1,
                default: field_data.fieldname,
                description: 'Auto-generated from label'
            },
            {
                label: 'Field Type',
                fieldname: 'field_type',
                fieldtype: 'Select',
                options: 'Data\nInt\nFloat\nSmall Text\nLong Text\nSelect\nRadio\nCheckbox\nMulti-Select\nAttachment\nFormula\nSection Break',
                reqd: 1,
                default: field_data.field_type || 'Data'
            },
            {
                fieldtype: 'Section Break'
            },
            {
                label: 'Required',
                fieldname: 'is_mandatory',
                fieldtype: 'Check',
                default: field_data.is_mandatory
            },
            {
                label: 'Options (one per line)',
                fieldname: 'options',
                fieldtype: 'Small Text',
                depends_on: 'eval:in_list(["Select", "Radio", "Multi-Select"], doc.field_type)',
                default: field_data.options
            },
            {
                label: 'Formula',
                fieldname: 'formula',
                fieldtype: 'Code',
                depends_on: 'eval:doc.field_type == "Formula"',
                default: field_data.formula
            },
            {
                label: 'Help Text',
                fieldname: 'help_text',
                fieldtype: 'Small Text',
                default: field_data.help_text
            },
            {
                fieldtype: 'Section Break',
                label: 'Conditional Logic'
            },
            {
                label: 'Display Depends On',
                fieldname: 'display_depends_on',
                fieldtype: 'Code',
                description: 'JavaScript expression (e.g., crop_type == "Rice")',
                default: field_data.display_depends_on
            },
            {
                label: 'Mandatory Depends On',
                fieldname: 'mandatory_depends_on',
                fieldtype: 'Code',
                description: 'JavaScript expression (e.g., plot_size > 10)',
                default: field_data.mandatory_depends_on
            }
        ];

        if (section_name) {
            fields.unshift({
                fieldname: 'section',
                fieldtype: 'Data',
                hidden: 1,
                default: section_name
            });
        }

        return fields;
    },

    setup_field_dialog_events: function (dialog) {
        dialog.fields_dict.field_label.df.onchange = () => {
            let label = dialog.get_value('field_label');
            if (label) {
                let fieldname = label.toLowerCase().replace(/ /g, '_').replace(/[^a-z0-9_]/g, '');
                dialog.set_value('fieldname', fieldname);
            }
        };
    }
};
