// Copyright (c) 2026, mohamed elsawy and contributors
// For license information, please see license.txt

frappe.ui.form.on("Form Assignment", {
    refresh(frm) {
        // Show "Start PGS Survey" button when assignment is for PGS Survey
        if (frm.doc.doctype_name === 'PGS Survey' && frm.doc.pgs_template
            && !frm.is_new() && frm.doc.status !== 'Completed') {
            frm.add_custom_button(__('Start PGS Survey'), function () {
                frappe.new_doc('PGS Survey', {
                    template: frm.doc.pgs_template,
                    form_assignment: frm.doc.name
                });
            }, __('Actions'));
        }
    },

    doctype_name(frm) {
        // Clear pgs_template when doctype changes away from PGS Survey
        if (frm.doc.doctype_name !== 'PGS Survey') {
            frm.set_value('pgs_template', '');
        }
    }
});
