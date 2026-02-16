// Copyright (c) 2026, mohamed elsawy and contributors
// For license information, please see license.txt

frappe.ui.form.on('PGS Survey', {
    refresh: function (frm) {
        farm_connector.survey_form.render_survey_form(frm);
    },

    category: function (frm) {
        frm.set_query('template', function () {
            return {
                filters: {
                    category: frm.doc.category,
                    is_active: 1
                }
            }
        })
    },

    template: function (frm) {
        if (frm.doc.template) {
            frappe.call({
                method: 'farm_connector.farm_connector.doctype.pgs_survey.pgs_survey.get_template_details',
                args: {
                    template_name: frm.doc.template
                },
                callback: function (r) {
                    if (r.message) {
                        frm.clear_table('items');

                        let items = r.message.items || [];
                        let section_order = [];
                        try {
                            section_order = JSON.parse(r.message.section_order || '[]');
                        } catch (e) {
                            console.warn('Failed to parse section_order', e);
                        }

                        // Sort items based on section order
                        if (section_order.length > 0) {
                            items.sort((a, b) => {
                                let idxA = section_order.indexOf(a.section);
                                let idxB = section_order.indexOf(b.section);
                                if (idxA === -1) idxA = 9999;
                                if (idxB === -1) idxB = 9999;
                                if (idxA !== idxB) return idxA - idxB;
                                return 0;
                            });
                        }

                        items.forEach(item => {
                            let row = frm.add_child('items');
                            row.section = item.section;
                            row.field_label = item.field_label;
                            row.fieldname = item.fieldname;
                            row.field_type = item.field_type;
                            row.is_mandatory = item.is_mandatory;
                            row.formula = item.formula;
                            row.options = item.options;
                            row.help_text = item.help_text;
                            row.display_depends_on = item.display_depends_on;
                            row.mandatory_depends_on = item.mandatory_depends_on;
                        });
                        frm.refresh_field('items');
                        farm_connector.survey_form.render_survey_form(frm);
                    }
                }
            });
        }
    }
});
