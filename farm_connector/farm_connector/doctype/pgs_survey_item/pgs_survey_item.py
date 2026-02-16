# Copyright (c) 2026, mohamed elsawy and contributors
# For license information, please see license.txt

from frappe.model.document import Document

class PGSSurveyItem(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		attachment: DF.Attach | None
		display_depends_on: DF.Code | None
		field_label: DF.Data | None
		field_type: DF.Data | None
		fieldname: DF.Data | None
		formula: DF.Code | None
		help_text: DF.SmallText | None
		is_mandatory: DF.Check
		mandatory_depends_on: DF.Code | None
		options: DF.SmallText | None
		parent: DF.Data
		parentfield: DF.Data
		parenttype: DF.Data
		reading_value: DF.LongText | None
		section: DF.Data | None
	# end: auto-generated types
	pass
