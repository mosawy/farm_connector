// Copyright (c) 2026, mohamed elsawy and contributors
// For license information, please see license.txt

frappe.ui.form.on('PGS Template', {
    refresh: function (frm) {
        // Migrate existing sections if section_order is empty
        frm.events.migrate_sections(frm);
        farm_connector.template_builder.render_template_builder(frm);
    },

    migrate_sections: function (frm) {
        let order = farm_connector.template_builder.get_section_order(frm);
        if (order.length === 0 && (frm.doc.items || []).length > 0) {
            let sections = [...new Set(frm.doc.items.map(i => i.section || 'General'))];
            farm_connector.template_builder.set_section_order(frm, sections);
        }
    },

    preview_template: function (frm) {
        frappe.msgprint({
            title: 'Template Preview',
            message: 'Preview functionality will show how the survey form will look to users.',
            indicator: 'blue'
        });
    }
});
