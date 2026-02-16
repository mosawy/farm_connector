# Copyright (c) 2026, mohamed elsawy and contributors
# For license information, please see license.txt

from frappe.model.document import Document

class PGSTemplate(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF
		from farm_connector.farm_connector.doctype.pgs_template_section.pgs_template_section import PGSTemplateSection

		category: DF.Literal["", "Pre-Germination", "Post-Harvest", "Soil Analysis", "Crop Health", "General"]
		description: DF.SmallText | None
		is_active: DF.Check
		items: DF.Table[PGSTemplateSection]
		section_order: DF.Text | None
		template_name: DF.Data
	# end: auto-generated types
	pass
